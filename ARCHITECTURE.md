# Bricx & Hannah Wedding Photo App — Technical Architecture

> **February 6, 2027** · Mobile-first React PWA · Deployed on Vercel · Photos stored in Google Drive

This document is the architecture proposal required by section 29 of the brief. Read it before the code — it explains *why* the implementation looks the way it does, and it is honest about what browsers can and cannot do.

---

## 0. TL;DR

- **Frontend:** React 18 + TypeScript + Vite, deployed as a static SPA on Vercel. PWA (manifest + service worker) as a *progressive enhancement*, never a requirement.
- **Backend:** Vercel Serverless Functions (`/api/*`) that hold the Google credentials and talk to the Google Drive API. The browser never sees a Google secret.
- **Storage:** Google Drive (a folder you already own) for originals + thumbnails. **No database is required** for the core product — guest identity is anonymous and client-side, and the "whose photo is this" link is stored *as Drive file metadata*. A tiny optional KV is only suggested for rate-limiting at scale.
- **Uploads:** A client-side upload engine backed by **IndexedDB**. The queue survives reloads and crashes. It resumes automatically when the guest reopens the site. Resumable (chunked) uploads use Google Drive's resumable upload protocol so a dropped connection doesn't restart a 10 MB photo from zero.
- **Honesty about "background":** Uploads continue while the **tab is alive** (even when you navigate between pages — it's a SPA, so navigation never kills the engine). They do **not** continue after the browser is fully closed on iOS, because iOS Safari does not support Background Sync / Background Fetch. We persist the queue and resume on return instead of pretending otherwise.

---

## 1. React Architecture

A single-page React app so that in-app navigation (`/`, `/upload`, `/photos`, `/gallery`, `/upload-status`) **never tears down the upload engine**. If each page were a full document load, every navigation would abort in-flight uploads. SPA routing is therefore a correctness requirement, not just a UX nicety.

```
src/
  main.tsx                 # entry, registers SW, mounts providers
  App.tsx                  # routes
  theme.css                # sage-green design tokens
  lib/
    guest.ts               # anonymous guest id (IndexedDB + localStorage mirror)
    db.ts                  # IndexedDB wrapper (idb) — queue + my-photos store
    hash.ts                # SHA-256 of file bytes (dedup key)
    imageOptimize.ts       # downscale/re-encode in a Web Worker, strip rotation
    api.ts                 # centralized fetch client to /api/*
    uploadEngine.ts        # the queue: concurrency, retry, resumable, persistence
    net.ts                 # online/offline + connection quality
    format.ts              # bytes/date helpers
  workers/
    optimize.worker.ts     # OffscreenCanvas image resize off the main thread
  hooks/
    useGuest.ts
    useUploadQueue.ts      # subscribe to engine state for the UI
    useOnline.ts
    useGallery.ts          # paginated gallery fetch
  components/              # Button, PhotoTile, ProgressBar, Toast, Lightbox, ...
  pages/
    Landing.tsx  Upload.tsx  MyPhotos.tsx  Gallery.tsx  UploadStatus.tsx
    errors/ (Offline, Unsupported, ServerError, ...)
```

Principles (section 25): UI is dumb; all upload/dedup/optimization logic lives in `lib/` and is unit-tested in isolation. Components subscribe to the engine through hooks. No god-component.

---

## 2. Vercel Architecture

```
Guest phone ──HTTPS──> Vercel Edge/CDN ──> React static assets (SPA)
                                   │
                                   └─> /api/* Serverless Functions (Node 20)
                                              │  (holds GOOGLE_* secrets)
                                              └─> Google Drive API
```

Serverless endpoints (all under `/api`, Node runtime because `googleapis` needs Node):

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/upload-init` | POST | Validate (type/size/guest), check duplicate by hash, open a Drive **resumable** session, return the upload URL + fileId plan |
| `/api/upload-proxy` | PUT | Relay chunks to Drive's resumable URL (keeps the Drive URL server-side; also lets us set metadata) |
| `/api/finalize` | POST | Confirm the file exists in Drive, write thumbnail, return the canonical photo record |
| `/api/check-duplicate` | POST | Given `{hash}`, say if this guest already uploaded it |
| `/api/my-photos` | GET | List photos whose `appProperties.guestId` == caller's guest id |
| `/api/gallery` | GET | Paginated public list (thumbnail links + pageToken) |
| `/api/thumb/[id]` | GET | Stream/redirect a thumbnail (cached at the edge) |

Why a proxy for chunks instead of uploading straight from the browser to Drive? Because a direct browser→Drive upload needs an access token in the browser (leaks credentials) or per-guest OAuth (accounts — the brief says avoid). Proxying through the function keeps the single wedding Drive account's credentials server-side. The tradeoff is Vercel bandwidth/execution; see §11.

`vercel.json` rewrites all non-`/api`, non-asset paths to `index.html` for SPA routing.

---

## 3. Google Drive Integration

- One Google account (yours) owns a folder tree. We authenticate the **server** with OAuth2 using a long-lived **refresh token** (generated once via a helper script), exchanged for short-lived access tokens inside the function. Secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID` — all Vercel env vars, never `VITE_`.
- Each uploaded file carries Drive **`appProperties`** (indexed, queryable, hidden from users):
  - `guestId` — which anonymous guest uploaded it (ownership)
  - `sha256` — content hash (dedup)
  - `uploadedAt`, `app = "bricx-hannah-2027"`
- Ownership & dedup checks are **Drive queries**, e.g. `appProperties has { key='sha256' and value='...' } and appProperties has { key='app' and value='bricx-hannah-2027' }`. This is why **no database is needed**: Drive itself is the index.
- A guest can only act on files whose `appProperties.guestId` matches their id (enforced server-side), so one guest can never replace/delete another's photo (section 13/17).

### Folder structure (refined from section 10)
```
Bricx & Hannah Wedding/           (GOOGLE_DRIVE_FOLDER_ID)
├── Originals/                     full-resolution uploads
└── Thumbnails/                    ~800px web thumbnails (JPEG/WebP)
```
I dropped the separate `Metadata/` folder: metadata lives in Drive `appProperties` on each file, which is faster and avoids extra API calls and a parallel JSON store to keep in sync.

---

## 4. Is a database required?

**No, not for the core app.** Everything the product needs is expressible as Drive file metadata:
- *My photos* → query by `appProperties.guestId`.
- *Dedup* → query by `appProperties.sha256`.
- *Gallery* → list the `Originals`/`Thumbnails` folder with `pageToken` pagination.

A database would only help with (a) **rate limiting / abuse protection** across function invocations and (b) caching gallery pages to cut Drive API calls at high traffic. For those, the simplest free option is **Vercel KV (Upstash Redis)** — used purely as a counter/cache, storing *no* photo data and *no* PII. It's optional and the app runs fully without it. I'll include a feature-flagged stub so you can switch it on if the wedding is large.

---

## 5. Anonymous guest sessions

On first visit we generate `guest_<uuidv4-hex>` (via `crypto.randomUUID()`), store it in **IndexedDB** (primary) and mirror to **localStorage** (fast sync read + survives some IndexedDB eviction). No PII, ever. The id is sent to the API as an `X-Guest-Id` header; the server stamps it onto Drive `appProperties.guestId`.

Honest limitation (section 11): clearing site data, Private/Incognito mode, a different browser, or a different device = a new id, so "My Photos" can't recover the old uploads. The UI states this plainly on the My Photos empty state rather than implying magic cross-device recovery.

---

## 6. Duplicate detection

Dedup key = **SHA-256 of the raw file bytes** (computed in the browser via `crypto.subtle.digest`, chunked for big files so the UI doesn't freeze). Filenames are explicitly *not* trusted (phones reuse `IMG_0001.jpg`).

Flow: before uploading, the engine asks `/api/check-duplicate` with the hash (and the guest id). If a file with that hash already exists for this guest, we show the **Keep / Replace / Cancel** dialog (section 13). "Replace" is only allowed when the existing file's `guestId` matches the caller — enforced server-side — so you can't touch someone else's photo. We also dedup *within* the local queue so re-selecting the same picture doesn't enqueue it twice.

---

## 7. Upload queue

A persistent, concurrency-limited engine (`uploadEngine.ts`):
- Items live in **IndexedDB** (`{id, guestId, name, size, type, hash, blob, status, progress, attempts, driveFileId, resumableUrl, createdAt}`). The actual bytes are stored as a `Blob` in IDB so the queue survives a reload/crash.
- **Concurrency limit = 3** (tunable). More than that on phone networks just causes timeouts and head-of-line blocking.
- **States:** `queued → optimizing → hashing → checking → uploading → done` with `failed`/`paused`/`duplicate` branches. Mirrors the section 6 UI exactly.
- **Retry:** automatic with exponential backoff + jitter, capped attempts; then it parks in `failed` with a manual **Retry** button.
- **Resume on return:** on app start the engine rehydrates from IDB and continues anything not `done`.
- **Responsiveness:** hashing + image optimization run in a **Web Worker**, so a 12 MP photo never freezes the UI (section 8/20).

The engine is a singleton module (not React state) so it keeps running across route changes; React just *subscribes* to a snapshot via `useUploadQueue`.

---

## 8. Image optimization

In a Web Worker using `createImageBitmap` + `OffscreenCanvas`:
- Keep an **original** (lightly handled) for the archive, and generate a **web thumbnail** (~1600px long edge for "originals we show" / ~800px for grid tiles).
- Re-encode to **WebP** when the browser can (`canvas.convertToBlob({type:'image/webp'})`), else JPEG at ~0.82 quality. We detect support at runtime; Safari gained `OffscreenCanvas` + WebP encode, but we feature-detect and fall back on the main thread with a yielded loop if a worker/offscreen path is missing.
- **EXIF orientation** is normalized by drawing through the decoded bitmap (browsers apply orientation on decode), so photos aren't sideways. We don't ship a huge EXIF library; GPS/EXIF is naturally dropped by canvas re-encode, which is also a privacy win.
- We **don't** over-compress: the brief is explicit. Originals stay high quality; only the gallery/thumbnail variants are aggressively sized.

Balance (quality ↔ speed ↔ storage): originals ≈ near-full quality, thumbnails small and cache-friendly.

---

## 9. Background / resumable uploads — and what actually happens

**Resumable:** We use Google Drive's **resumable upload** protocol. `/api/upload-init` opens a session; chunks (e.g. 2–4 MB) are PUT through `/api/upload-proxy`; a dropped connection resumes from the last confirmed byte instead of restarting. This is what makes flaky venue Wi-Fi survivable.

**"Background" — the honest matrix:**

| Situation | What we do | Reality |
|---|---|---|
| Guest navigates between app pages | Uploads keep going | ✅ Works everywhere (SPA, engine is a module) |
| Tab visible, screen on | Uploads keep going | ✅ |
| Tab backgrounded / phone screen off, browser still running | Keep going best-effort | ⚠️ Browser may throttle timers/network; iOS aggressively suspends. Not guaranteed. |
| **Android Chrome**, want robustness when backgrounded | Register **Background Sync** as a progressive enhancement to nudge resumption | ✅ Android only |
| **iOS Safari** backgrounded | No Background Sync/Fetch exists | ❌ Apple doesn't support it (confirmed, 2026) |
| **Browser fully closed** (any OS) | We **do not** claim it uploads | ❌ JS is dead. We persist the queue and resume when the guest reopens the site. |

The UI never says "uploaded" until `/api/finalize` confirms Drive has the bytes (section 16).

---

## 10. What happens when the browser is closed

JavaScript stops. In-flight transfers abort. But because every queue item (including its `Blob`) is in IndexedDB with its status, nothing is lost: when the guest reopens the site (or re-scans the QR), the engine rehydrates and resumes `queued`/`uploading`/`failed` items. We surface this honestly: "Your photos are safely waiting on this device and will finish when you reopen this page."

---

## 11. Expected free-tier limitations (no hand-waving)

- **Vercel Hobby (free):** generous but has monthly bandwidth (~100 GB) and function execution limits, and a per-request body/time ceiling. Because we **proxy chunks** through functions, every uploaded megabyte counts against Vercel bandwidth *twice-ish* (in and out). For a wedding (hundreds–low thousands of photos) this is usually fine, but a 150-guest flood of 10 MB originals could approach limits. Mitigations: aggressive client-side downscaling of the *shown* variant, 2–4 MB chunks, and the option to upload originals directly to Drive via a short-lived scoped session if you later accept more complexity. Commercial/【ad】use of Hobby is disallowed — a personal wedding is fine.
- **Google Drive:** storage counts against your **15 GB** free Google quota (shared with Gmail/Photos) unless the account has more. 1,000 × ~5 MB web-sized ≈ 5 GB; originals at ~8–12 MB each could blow past 15 GB — plan storage or prune originals.
- **Drive API quotas:** generous default per-project query/write quotas; our design minimizes calls (metadata-as-appProperties, paginated listing, edge-cached thumbnails) so a normal wedding stays well under them. Bursty simultaneous finalize calls are the thing to watch; KV-backed rate limiting (§4) is the pressure valve.
- **Vercel KV / Upstash (if enabled):** free tier has a daily command cap — fine for counters.

I won't call the whole thing "free" blindly: it's **free for a typical wedding** on existing Google storage, with the two realistic cost triggers being **Drive storage overflow** and **Vercel bandwidth** under a very heavy original-photo flood.

---

## 12. Expected maximum practical scale

- **Guests/concurrency:** 100–200 phones uploading over an evening is comfortable. The concurrency cap (3/phone) and resumable chunks smooth bursts; the real bottleneck is venue Wi-Fi, not the stack.
- **Photos:** low thousands is practical. Gallery stays fast via pagination + lazy-loaded, edge-cached thumbnails (never full-res grids). Beyond ~5–10k photos you'd want the optional KV gallery-page cache turned on and possibly a nightly move of originals to a dedicated Shared Drive.

---

## 13. If Google Drive proves unsuitable for a part

Drive is great for storage + ownership metadata here. The one place it's awkward is **high-rate public gallery reads** (listing + thumbnail streaming under a crowd). If that bites, the simplest low/no-cost swap for *just the hot read path* is **Cloudinary free tier** or **Vercel Blob** for thumbnails, keeping originals in Drive. We isolate storage behind `lib/api.ts` + the `/api` functions so this swap is contained and doesn't touch the UI. We will **not** force a fragile direct-browser-to-Drive token scheme just to avoid proxying.
