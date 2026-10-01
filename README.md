# Bricx & Hannah · Wedding Photo Sharing 💐

A mobile-first wedding website and guest photo-sharing app. Guests scan a QR code at the venue, open the site on their phone, snap or pick photos, and they upload to a shared Google Drive. Built with **React + TypeScript + Vite**, deployed on **Vercel**, with photos stored in **Google Drive** via serverless functions.

> **Bricx & Hannah — February 6, 2027** · Sage-green theme · PWA · no guest accounts

For the full technical rationale (every design decision, trade-off, and honest limitation), read **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

---

## What it does

- 📸 **Take a photo** with the live camera (or the phone's native camera as a fallback)
- 🖼️ **Pick many photos** at once from the library
- ⟳ **Robust upload queue** — concurrency-limited, auto-retrying, resumable, survives reloads
- 💕 **My Photos** — what this device uploaded, with live status
- ✨ **Wedding Gallery** — everyone's photos, lazy-loaded, infinite scroll, lightbox
- 📶 **Offline-aware** — queues while offline, resumes when back online
- 🔁 **Duplicate detection** by content hash (SHA-256), with Keep / Replace / Cancel
- 🔒 **Secure** — Google credentials live only on the server; one guest can't touch another's photos

---

## Project layout

```
qr-code-images/
├── api/                      # Vercel serverless functions (Node) — hold Google secrets
│   ├── _lib/                 # drive, http (auth/signing), validation, rate limit
│   ├── check-duplicate.ts    # POST  dedup by hash
│   ├── upload-init.ts        # POST  open a Drive resumable session (signed)
│   ├── upload-proxy.ts       # PUT   relay chunks to Drive (keeps Drive URL server-side)
│   ├── finalize.ts           # POST  attach the thumbnail + confirm
│   ├── my-photos.ts          # GET   this guest's photos
│   ├── gallery.ts            # GET   paginated shared gallery
│   └── thumb/[id].ts         # GET   stream a thumbnail (edge-cached)
├── src/
│   ├── lib/                  # guest id, IndexedDB, upload engine, image optimize, hashing, API client
│   ├── workers/              # OffscreenCanvas image-resize worker
│   ├── hooks/                # useUploadQueue, useOnline, useGuest, useGallery
│   ├── components/           # Monogram, TabBar, QueueRow, DuplicateDialog, Lightbox, CameraCapture, Toast
│   └── pages/                # Landing, Upload, MyPhotos, Gallery, UploadStatus, errors/
├── public/                   # manifest, service worker, icons
├── scripts/get-refresh-token.mjs   # one-time Google OAuth helper
├── .env.example
└── vercel.json
```

---

## 1. Local development

Requires **Node 18+** (Vercel builds on Node 20; the project is tested on Node 24).

```bash
npm install
cp .env.example .env     # then fill in the Google values (see §3)
npm run dev              # Vite dev server (frontend)
```

> **Note on the API during local dev:** the `/api/*` functions are Vercel serverless functions. `npm run dev` serves only the frontend. To run the functions locally too, use the Vercel CLI:
> ```bash
> npm i -g vercel
> vercel dev            # serves frontend + /api together on one port
> ```
> Without `vercel dev`, uploads/gallery calls will 404 locally — that's expected; the UI itself still runs.

Other scripts:

```bash
npm run build       # type-check + production build to dist/
npm run typecheck   # tsc only
npm test            # vitest (unit tests for upload/dedup/optimize/security)
npm run token       # one-time Google refresh-token helper (see §3)
```

---

## 2. Environment variables

Full annotated list is in **[.env.example](./.env.example)**. The golden rule:

| Prefix | Shipped to browser? | Use for |
|---|---|---|
| `VITE_*` | **Yes — public** | app URL, couple name, date. **Never a secret.** |
| everything else | **No — server only** | Google credentials, KV tokens |

**Public (safe):**
- `VITE_APP_URL` — your production URL (used for share links / QR target)
- `VITE_COUPLE` — defaults to `Bricx & Hannah`
- `VITE_WEDDING_DATE` — defaults to `2027-02-06`

**Server-only secrets (set in Vercel, never `VITE_`):**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_DRIVE_FOLDER_ID`

**Optional (rate-limit/cache at scale, app runs fine without):**
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` (Vercel KV / Upstash)

Where they live:
- **Local:** `.env` (git-ignored).
- **Production:** Vercel → Project → Settings → Environment Variables (add to Production **and** Preview).

---

## 3. Google Drive setup (one time)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/), create (or pick) a project.
2. **Enable the Google Drive API** for that project.
3. **OAuth consent screen:** configure it (External is fine), add your Google account as a **Test user** so the refresh token doesn't expire quickly.
4. **Create credentials → OAuth client ID → Web application.** Add this authorized redirect URI:
   ```
   http://localhost:4567/oauth2callback
   ```
   Copy the **Client ID** and **Client secret** into your `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. Generate the refresh token and the wedding folder:
   ```bash
   npm run token
   ```
   Open the printed URL, approve with the Google account that should **own** the photos. The script prints:
   ```
   GOOGLE_REFRESH_TOKEN=...
   GOOGLE_DRIVE_FOLDER_ID=...   # a freshly created "Bricx & Hannah Wedding" folder
   ```
   Paste both into `.env` (and later into Vercel).

The app uses the narrow **`drive.file`** scope — it can only see files it creates, not your whole Drive. The `Originals/` and `Thumbnails/` subfolders are created automatically on first upload.

> Already have a folder you want to use? Put its id in `GOOGLE_DRIVE_FOLDER_ID`. With the `drive.file` scope the app must have created it, so the easiest path is to let `npm run token` create a fresh one.

---

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "Wedding photo app"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`.env` is git-ignored — your secrets stay local.

---

## 5. Deploy to Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project → Import** your GitHub repo.
2. Framework preset: **Vite** (auto-detected). Build command `npm run build`, output `dist` (already in `vercel.json`).
3. **Environment Variables:** add all the server secrets from §2 (Production + Preview). Add `VITE_APP_URL` once you know the final URL (you can set it after the first deploy and redeploy).
4. **Deploy.** First build runs on Node 20.
5. **Test production:** open the URL on a real phone — try camera, multi-select, watch the queue, check the gallery.
6. **Custom domain (optional):** Project → Settings → Domains → add e.g. `photos.bricxandhannah.com`, follow the DNS steps, then update `VITE_APP_URL` and redeploy.
7. **Important OAuth note:** `npm run token` used the `localhost:4567` redirect to mint the refresh token — that token keeps working in production (the redirect URI only matters at token-generation time), so no extra OAuth config is needed on Vercel.

---

## 6. Generate the QR code

Point the QR at your production URL (or custom domain). Any generator works; a quick local one:

```bash
npx qrcode "https://your-wedding.vercel.app" -o wedding-qr.png
# or higher error-correction + bigger for printing:
npx qrcode "https://your-wedding.vercel.app" -o wedding-qr.png -e H -w 1200
```

Print it big, put it on tables/signage. Tip: add a short line like "Scan to share your photos 💐" above it.

---

## 7. Browser support (built around real capabilities, not wishes)

| Capability | iOS Safari / Chrome (iOS = WebKit) | Android Chrome |
|---|---|---|
| Multi-file selection | ✅ | ✅ |
| Native camera (`<input capture>`) | ✅ | ✅ |
| Live camera (`getUserMedia`) | ✅ (needs HTTPS) | ✅ |
| IndexedDB (persistent queue) | ✅ | ✅ |
| Service worker / PWA install | ✅ (with WebKit limits) | ✅ |
| Resume queue on reopen | ✅ | ✅ |
| **Background Sync** (resume while backgrounded) | ❌ not supported | ✅ |
| Uploads while **browser fully closed** | ❌ (JS is dead — any browser) | ❌ |
| Web notifications | ⚠️ installed-PWA only, opt-in | ✅ |

What this means in practice:
- Uploads **continue while you move between pages** of the app on every phone (it's a single-page app, so navigation never kills the uploader).
- If the tab is backgrounded, Android can nudge uploads to resume via Background Sync; iOS can't, so we **persist the queue and resume when the guest reopens the page**.
- We **never** claim a photo reached Drive until the server confirms it.

---

## 8. Cost & limits (honest version)

Free for a typical wedding on an existing Google account, with two realistic cost triggers to watch:

- **Google Drive storage** counts against your Google quota (**15 GB** free, shared with Gmail/Photos). ~1,000 web-sized photos ≈ 5 GB; full-size originals can exceed 15 GB — plan storage or prune.
- **Vercel Hobby (free):** ~100 GB/month bandwidth + function execution limits. Chunks are proxied through functions, so each uploaded MB counts toward Vercel bandwidth. Fine for hundreds–low-thousands of photos; a huge flood of 10 MB originals from 150+ guests could approach limits (mitigated by client-side downscaling and 2 MB chunks).
- **Drive API quotas:** generous; the design minimizes calls (metadata on files, paginated listing, edge-cached thumbnails).
- **Vercel KV (optional):** only if you enable rate-limiting/caching; free tier has a daily command cap.

Practical scale: 100–200 phones over an evening is comfortable; low thousands of photos stays fast via pagination + lazy thumbnails. See ARCHITECTURE.md §11–12.

---

## 9. Security notes

- HTTPS everywhere (Vercel default).
- Google credentials **only** on the server; nothing sensitive is in `VITE_*`.
- Server validates file type, size (25 MB cap on the optimized upload), and sanitizes filenames.
- Upload sessions are **HMAC-signed and bound to the guest** — a client can't redirect the proxy at an arbitrary URL or hijack another guest's session.
- Ownership is enforced server-side via Drive `appProperties.guestId`: a guest can only replace/finalize their own photos.
- Rate limiting per guest (in-memory, optionally shared via KV).

---

## 10. Testing checklist (before the big day)

- **iPhone (Safari + Chrome):** camera, multi-select, progress, tab-switch & return, duplicate prompt, gallery.
- **Android (Chrome):** same, plus confirm backgrounded uploads resume.
- **Network:** fast Wi-Fi, slow Wi-Fi, mobile data, kill Wi-Fi mid-upload (should pause then resume), offline → online.
- **Scale:** a few phones uploading at once.
- **Icons:** generate the PWA PNGs (see `public/icons/README.md`) if you want a polished home-screen icon.

Run the automated checks anytime:
```bash
npm run typecheck && npm test && npm run build
```
