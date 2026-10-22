# Project Memory Bank — Bricx & Hannah Wedding Photo Sharer

> **Purpose:** persistent memory for THIS project only. This is a workspace steering file
> (`.kiro/steering/`), auto-loaded into context at the start of every session in this
> workspace. Update it as the project evolves so context survives across sessions.
>
> **Scope:** `/home/bricx/dev/qr-code-images` only. GitHub: `bricxcarasco/wedding-photo-sharer`.

---

## 🔴 HARD RULES (do not violate)

1. **NEVER `git commit` or `git push` without an explicit go-signal from the user in that
   message.** "Fix it / adjust it / add X" means code changes ONLY — stop after making +
   verifying the change, then wait. Each commit AND each push needs its own explicit ask.
   This includes updating this memory bank file — do not commit it until told.
2. **Secrets stay out of git.** `.env` is git-ignored and must stay that way. Only
   `.env.example` is tracked. Never commit `GOOGLE_*` or `KV_*` values.
3. **Use the right GitHub account.** This repo pushes as **`bricxcarasco`** via the SSH
   alias `git@github-other:...` (NOT the default `git@github.com`, which is the work
   account `bizmatesph-bricx-carasco`). See "Git / GitHub" below.

---

## What the project is

A mobile-first wedding photo-sharing PWA. Guests scan a QR at the venue, open the site on
their phone, take/pick photos, and they upload to a shared Google Drive. 
**Couple:** Bricx & Hannah. **Date:** February 6, 2027. **Theme:** sage green.

- **Frontend:** React 18 + TypeScript + Vite (SPA so navigation never kills the upload engine).
- **Backend:** Vercel serverless functions in `/api` (hold Google secrets; browser never sees them).
- **Storage:** Google Drive (`drive.file` scope). No database — ownership/dedup stored as Drive
  file `appProperties` (`guestId`, `sha256`, `app`). Optional Vercel KV only for rate-limit/cache.
- **Deploy target:** Vercel. Repo already pushed.

Full rationale is in `ARCHITECTURE.md`; deployment/setup in `README.md`.

---

## Environment / tooling facts (this machine)

- Repos co-located under `/home/bricx/dev/`. This project: `/home/bricx/dev/qr-code-images`.
  Reference wedding repo: `/home/bricx/dev/wedding-invitation` (its git identity we matched).
- **Node:** default shell node is **v15.14.0 (too old for Vite 5)**. The working version is
  **v24.3.0** via nvm. Always run build/test/dev with:
  `source ~/.nvm/nvm.sh && nvm use 24` (inside `wsl bash -lic`). Non-interactive shells don't
  load nvm, so `node` isn't on PATH without this.
- **Vercel supported function runtimes (updated Oct 2026):** Node **24.x (default) / 22.x / 20.x**.
  Node **24 is now allowed on Vercel** and is its default. Node 20 was **deprecated Oct 1, 2026**.
  `package.json` `engines.node` is now `"24.x"` (bumped from `"22.x"`), and `.nvmrc` pins `24` for
  local dev so `nvm use` (no arg) picks it up. Source: Vercel docs "Supported Node.js versions".
- **Terminal gotcha:** the PowerShell→WSL layer echoes/mangles long commands and nested quotes.
  Workaround that works: write output to a file in the WORKSPACE (not `/tmp` — the agent file
  tools can't read `/tmp`) and read it with the file tool, OR run a `.sh` scratch script.
  Clean up scratch files after. Use `git -c core.pager=cat` / `GIT_SSH_COMMAND=...` to avoid pagers.
- **Vercel CLI** is installed globally (v62.x) but `vercel dev` requires interactive login
  (device-code OAuth). For quick local testing the user prefers **`npm run dev`** (frontend only;
  `/api` calls 404, so real uploads don't complete locally — test real uploads on the deployed site).
- **Auto-update hook:** `.kiro/hooks/update-memory-bank.json` — a `Stop`-trigger **agent** hook that
  reminds the agent to update THIS memory bank after every turn (correct outdated sections + append a
  session-history entry), skipping pure Q&A turns. It must NOT commit/push (HARD RULE 1). Hooks
  activate at session start, so it applies to subsequent sessions, not the turn that created it. The
  user wants learnings captured automatically rather than asking each time.

---

## Git / GitHub

- Local git identity (set per-repo, matches `wedding-invitation`):
  `user.name = "Bricx Carasco"`, `user.email = "bricxraincarasco21@gmail.com"`.
- **Two SSH keys exist:**
  - `~/.ssh/id_rsa` → GitHub account **bizmatesph-bricx-carasco** (WORK — do not use here).
  - `~/.ssh/github-other` → GitHub account **bricxcarasco** (USE THIS). SSH config has a
    `Host github-other` alias pointing at it.
- **Remote:** `origin = git@github-other:bricxcarasco/wedding-photo-sharer.git`.
- Push command pattern (only when user gives the go-signal):
  `GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=accept-new' git push origin main`
- Branch: `main`.

---

## Google Drive / OAuth setup (DONE)

- Google Cloud OAuth client: **Web application**, redirect URI `http://localhost:4567/oauth2callback`
  (used ONLY by `scripts/get-refresh-token.mjs` locally; Vercel doesn't need a redirect URI
  because production auth uses the refresh token directly). "Used by AI-powered agent" checkbox
  left UNCHECKED.
- Consent screen is in **Testing** mode. The owning Google account must be added as a **Test user**
  or auth fails with `Error 403: access_denied`. The owner/test user used was
  **`thedeventrep@gmail.com`**.
- `npm run token` generated the refresh token and auto-created the "Bricx & Hannah Wedding" root
  folder. All four `GOOGLE_*` values are now in local `.env`:
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID`
  (folder id `1UioFozdkLHYHSByQmuqDTzAMlmKNzHwA`).
- **Testing-mode caveat:** refresh tokens for unverified apps can expire ~7 days out. If uploads
  start 401ing, rerun `npm run token` and update the token (locally + Vercel). Publishing the app
  avoids this but may trigger Google verification.
- **Security note:** the client secret + refresh token were shown in chat during setup — consider
  rotating the client secret after the wedding. They are NOT in git.

---

## Vercel env vars (set these in dashboard, no quotes, Production + Preview)

- Required (4): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`,
  `GOOGLE_DRIVE_FOLDER_ID`.
- `VITE_APP_URL`: add AFTER first deploy (set to the real production URL), then redeploy.
- `VITE_COUPLE` / `VITE_WEDDING_DATE`: optional (code defaults to "Bricx & Hannah" / 2027-02-06).
- `KV_REST_API_URL` / `KV_REST_API_TOKEN`: leave unset (optional rate-limit/cache).
- Local `.env` has the client id/secret wrapped in quotes; in Vercel paste values WITHOUT quotes.

---

## UI / styling customizations (user-requested, applied)

- **Fonts (`index.html` Google Fonts + `src/theme.css`):** loads **Inter** + **Parisienne**.
  - `--font-body` = Inter stack (`'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI',
    Roboto, 'Helvetica Neue', sans-serif`). `--font-display` now aliases `--font-body`, so ALL
    text is Inter EXCEPT the couple's names.
  - `--font-script` = `'Parisienne', 'Snell Roundhand', cursive` — used ONLY on `.names`
    ("Bricx & Hannah"). `.names` size bumped (`clamp(2.8rem,12vw,4rem)`; compact `2.6rem`).
  - Dropped Cormorant Garamond (no longer referenced).
- **Hashtag:** `#itinadHANNAHsiBRICXparakayMAE` rendered under the names in `Monogram.tsx`
  (class `.hashtag`, sage-deep, bold, wraps on narrow screens). Shows wherever Monogram shows.
- **Backgrounds (`theme.css` tokens):** `--page-bg: #bbb999` (solid, replaced the sage-wash
  radial gradient on `body`); `--tabbar-bg: #ede0cd` (bottom nav; removed the old translucent
  blur since it's now opaque).
- **Click animations:** `src/hooks/useRipple.ts` — one delegated `pointerdown` listener spawns a
  material-style ripple on `.btn`/`.tile`/`.shutter`/`[data-ripple]` (called once via `useRipple()`
  in `App.tsx`). Buttons also have a `press-pop` bounce + hover lift; tiles scale/zoom on press.
- **Confetti:** `src/components/Confetti.tsx` mounted once at app root in `App.tsx` (above the page
  bg, below content via `.page { z-index:2 }`; `pointer-events:none`). Continuous CSS-only falling
  glyphs 💗💍💎🌿🤍🍃✨ (hearts/rings/diamonds/leaves) with randomized pos/speed/drift/spin/opacity.
  Glyph size is **0.55–1.15rem** (shrunk from 0.9–2.0 at user request).
- **Accessibility:** both confetti and ripples are disabled under `prefers-reduced-motion: reduce`.
- **Camera front/back switch (`CameraCapture.tsx` + `CameraFlipIcon.tsx` + `theme.css`):**
  `facing` state toggles `environment` ↔ `user`; the effect is keyed on `facing`, stops the old
  stream and reopens `getUserMedia({ video: { facingMode: { ideal: facing } } })`. The front-camera
  preview is mirrored (`.camera-video.mirror` → `scaleX(-1)`) and front captures are flipped back on
  the canvas (`ctx.translate/scale`) so saved photos aren't reversed. The "N taken" counter moved
  below the viewfinder. Flip button is `.cam-flip` (sage-wash bg, sage-light border, sage-deep icon,
  hover→sage-light, active→sage fill + scale 0.92). The icon is a **custom inline SVG**
  (`CameraFlipIcon`): camera body + sage-light lens + two rotation arcs top/bottom, drawn with
  `currentColor`; geometry was tuned so the arrows don't overlap the body (body compact in the
  center band, arcs pushed to the edges).
- **Gallery/My-Photos image preview = padded full-screen modal (`Lightbox.tsx` + `theme.css`):**
  shared `Lightbox` component (used by both `Gallery.tsx` and `MyPhotos.tsx`). History: started as
  an `<img>` capped at 86vh → briefly `background-size: cover` (full-bleed, but **cropped**) →
  **current:** a real `<img className="lightbox-image">` with `object-fit: contain` + `margin:auto`
  (whole image, no crop), inside `.lightbox` (dark backdrop). `.lightbox` has `padding: 10px` all
  sides plus safe-area insets (top/bottom), `box-sizing:border-box`, and a quick `lightbox-fade`.
  Close via backdrop click, the circular `.close` ✕ button (semi-transparent bg, raised with
  z-index), or Esc; `document.body` overflow is locked while open. Still uses the thumbnail proxy,
  never the raw original.
  - **CRITICAL fix #1 — React portal (THE real bug):** `Lightbox` MUST
    `createPortal(<div className="lightbox">…</div>, document.body)`. It is rendered from inside
    `<main className="page">`, and **`.page` has `animation: fade-up` whose keyframe uses
    `transform: translateY(...)`**. An element with an animated/filled `transform` becomes the
    *containing block* for its `position:fixed` descendants — so without the portal the overlay was
    anchored to `.page` (a scrollable, `max-width:640px`, padded box), NOT the viewport. Symptom: the
    preview appeared INLINE inside the grid, pinned near the top, with the gallery still scrolling
    behind it (looked "stuck", lower photos couldn't be previewed). The portal lifts the overlay out
    to `<body>`, a sibling of `.app-shell` (which has no transform), so `position:fixed` resolves
    against the true viewport. **Do NOT remove the portal.** (This is why the earlier pure-CSS
    `dvh` attempts "didn't fix it" — the overlay was trapped regardless of its own sizing.)
  - **CRITICAL fix #2 — mobile sizing:** `.lightbox` is sized `width:100vw;height:100vh` **then**
    overridden with `width:100dvw;height:100dvh` (not `inset:0`). On mobile, `inset:0`/`100%` resolve
    against the *layout* viewport, so as the address bar shows/hides the centered image drifted
    up/down or hid behind the tab bar. `dvh/dvw` track the *visible* viewport; the `vh/vw` lines are
    the fallback. Keep this. (Tab bar z-index 50 < lightbox 200, so stacking was never the issue.)
  - **General rule:** any future full-screen overlay/modal in this app must portal to `document.body`
    for the same reason (`.page`'s animated transform traps `position:fixed`).
- **Landing wedding logo (`Landing.tsx` + `theme.css`):** `src/assets/images/wedding-logo.png`
  is imported in `Landing.tsx` (`import weddingLogo from '../assets/images/wedding-logo.png'` so
  Vite bundles/hashes it) and rendered as `<img className="wedding-logo" loading="lazy">` directly
  BELOW the "No sign-up needed…" note (last element in `<main className="page">`). CSS `.wedding-logo`:
  `display:block; width:100%; max-width:140px; height:auto; margin:20px auto 8px; object-fit:contain`
  (centered, never distorts/overflows the content column). Mobile override `@media (max-width:480px)`
  caps it at `max-width:35vw`, `margin:16px auto 4px`. Build emits `dist/assets/wedding-logo-*.png`.
  (Sizes shrunk from 240px/60vw → 180px/45vw → 140px/35vw at user request.)
- **Bolder names (`theme.css`):** Parisienne ships only a 400 weight on Google Fonts, so
  `font-weight` alone can't thicken it. `.names` now uses `font-weight:700` **plus**
  `-webkit-text-stroke: 0.6px var(--ink)`; the `&` keeps a gold stroke (`.names .amp`
  `-webkit-text-stroke-color: var(--gold)`).

## Performance optimizations (behavior-preserving — applied, local only)

A full frontend perf review was done (context-gatherer + reads). Codebase was already
well-optimized (route code-splitting via React.lazy, single reused optimize worker, thumbnail
proxy everywhere, `loading="lazy"`+`decoding="async"` on grid imgs, CSS-only confetti, Lightbox
portal, singleton engine surviving navigation). Only safe, no-behavior-change tweaks were applied:

- **Engine progress-emit throttling (`src/lib/uploadEngine.ts`) — the main render hotspot.**
  `onProgress` used to call `this.emit()` on every XHR progress tick → every queue screen re-rendered
  many times/sec. Added `private progressFrame: number|null`, an `emitProgress()` that coalesces
  progress-only updates to one emit per animation frame via module helpers `scheduleFrame()`
  /`cancelFrame()` (rAF with `setTimeout(…,16)` fallback for tests/workers). `emit()` (status changes)
  stays immediate and now cancels any pending progress frame first; `dispose()` cancels the frame.
  `onProgress` now calls `emitProgress()` instead of `emit()`. Tests unaffected (they poll
  `snapshot()`, not emit timing). 28/28 tests still pass.
- **`QueueRow` wrapped in `React.memo`** (`src/components/QueueRow.tsx`; component renamed to
  `QueueRowImpl`, exported as `export const QueueRow = memo(QueueRowImpl)`). Safe because the engine
  mutates each item in place and keeps its object identity stable when unchanged (snapshot spreads the
  Map into a new array but reuses item refs), so shallow prop compare is correct.
- **Stable row callbacks** via `useCallback` in `Upload.tsx` and `UploadStatus.tsx`
  (`handleRetry`/`handleRemove`/`handleResolveDuplicate`) — otherwise inline arrows would defeat the
  memo. Also wrapped the previously-inline `items.find(status==='duplicate')` and
  `items.slice().sort(...)` in `useMemo([items])` in UploadStatus.
- **Landing `active` count** now `useMemo([items])` (`src/pages/Landing.tsx`) instead of inline filter.
- **`useGallery` `loadMore`/`reload`** now `useCallback([load])` (`src/hooks/useGallery.ts`) so
  Gallery's IntersectionObserver effect stops re-subscribing every render.
- **Vite `manualChunks` vendor split** (`vite.config.ts`): `rollupOptions.output.manualChunks`
  `{ 'react-vendor': ['react','react-dom','react-router-dom'] }`. Result: app main chunk dropped
  ~190kB → **27kB** (`index-*.js`), React/router now a cacheable **`react-vendor` ~164kB** chunk.
  Route-level lazy chunks unaffected.

**NOT done (deferred — would risk layout/behavior, need sign-off):** list virtualization on
Gallery/MyPhotos (DOM grows unbounded on long scroll); explicit `width`/`height` on grid imgs for CLS
(masonry CSS controls sizing, so could shift layout).

## Code map (key files)

- `api/_lib/` — drive.ts (Drive client + secrets), http.ts (guest id, HMAC-signed upload
  sessions, raw body, limits), validate.ts, rateLimit.ts.
- `api/*.ts` — check-duplicate, upload-init, upload-proxy (chunk relay), finalize, my-photos,
  gallery, thumb/[id].
- `src/lib/` — uploadEngine.ts (singleton queue: concurrency 3, retry+backoff, resume-on-return,
  EngineConfig ctor + dispose() for tests), db.ts (IndexedDB via idb), guest.ts, hash.ts (SHA-256),
  imageOptimize.ts (+ worker), api.ts, net.ts, capabilities.ts, config.ts.
- `src/pages/` — Landing, Upload, MyPhotos, Gallery, UploadStatus, Privacy, errors/.
- `scripts/get-refresh-token.mjs` — `npm run token`.
- Tests: `npm test` → 28 tests, 5 files (vitest). Verify loop:
  `npm run typecheck && npm test && npm run build` (all green as of last run).

---

## Known issues fixed

- **Vercel build error** `Function Runtimes must have a valid version`: caused by
  `vercel.json functions.runtime: "nodejs20.x"` (invalid — that field wants a versioned package
  id). FIX: removed `runtime` (kept `maxDuration: 60`); pinned Node via `engines.node` (then `22.x`,
  **now `24.x`**). Committed `3bfbe5d` and pushed (with user's go-signal at that time).
- **Node version bump to 24:** `engines.node` `22.x` → `24.x` and added `.nvmrc` (`24`). Vercel now
  supports Node 24 (its default), so the next deploy from `main` builds on 24. Verified green
  locally (typecheck + 28 tests + build). Committed in `8cbab65`.
- **Lightbox image drifted vertically / hid behind tab bar on mobile:** caused by sizing the
  overlay with `inset:0` + image `max-height:100%`, which resolve against the layout viewport (taller
  than the visible area as the mobile address bar shows/hides). FIX: size `.lightbox` with
  `100dvh/100dvw` (fallback `100vh/100vw`) + `margin:auto` on the image. Committed in `1b8c51e`.
- **Lightbox appeared INLINE in the grid / "stuck" / couldn't preview lower photos / page still
  scrolled (THE real bug behind the above):** `.page` has `animation: fade-up` using
  `transform: translateY`, which makes `.page` the containing block for its `position:fixed`
  children. The `Lightbox` rendered inside `.page`, so its "fixed" overlay anchored to `.page`
  (a scrollable, max-width-640px, padded box) instead of the viewport. The `dvh` sizing fix alone
  could not help while the overlay was trapped. FIX: render `Lightbox` via
  `createPortal(…, document.body)` so it sits outside any transformed ancestor and `position:fixed`
  resolves against the real viewport. Committed in `8d1a190`.
- **Upload row stuck on "Preparing" even though the photo reached Drive (real-time status never
  updated):** "Preparing" = the engine's `optimizing` status (`QueueRow` `STATUS_META`). The engine
  was NOT actually stuck — it ran through to `done` (gallery proved it) but the UI row froze on its
  first paint. ROOT CAUSE: `UploadEngine` mutates each `QueueItem` **in place** (`Object.assign`,
  `item.blob=`, `item.progress=`) and reuses the SAME object in the Map, IndexedDB, and every
  `snapshot()` (`[...this.items.values()]` = new array, same item refs). `QueueRow` is wrapped in
  `React.memo`, whose default shallow compare sees `prevProps.item === nextProps.item` (same ref) →
  **bails out and skips the re-render**, so the row keeps its first status forever. The `queued`→
  `optimizing` emits batch into one render at the start of `process()`, so the first (and only)
  painted status is `optimizing` = "Preparing". The earlier perf-pass memo assumed "engine replaces
  item identity only when it changes" — FALSE; it mutates in place. FIX (`src/lib/uploadEngine.ts`):
  `snapshot()` now returns **fresh clones for changed items, stable refs for unchanged ones** so
  `React.memo` works AND still saves re-renders on untouched rows. Added a monotonic revision counter
  (`itemRev`/`revSeq`, a counter not `Date.now()` so same-ms mutations get distinct revs) stamped on
  every mutation — in `persist()`, in the `uploadChunk` `onProgress` callback (which bypasses
  `persist`), and in `retryAllFailed()` — plus a per-id clone cache (`snapClones` keyed by rev;
  stale entries pruned in `snapshot()`). `cloneForSnapshot()` re-clones only when the rev advanced.
  Verified: typecheck clean, 28/28 tests pass, build green. Committed `d0415c4`, pushed to
  `origin/main`.

---

## Outstanding / next steps

- Confirm the Vercel redeploy from `3bfbe5d` built green.
- After green: test a real upload on the deployed URL; confirm it lands in the Drive folder.
- Add `VITE_APP_URL` in Vercel → redeploy.
- Generate QR pointing at the production URL (`npx qrcode "<url>" -o wedding-qr.png -e H -w 1200`).
- Optional polish: generate PWA PNG icons per `public/icons/README.md`.

---

## Session history (prompt-by-prompt log)

Keep appending brief entries so intent is retained across sessions.

1. **Initial build request** — Build the full mobile-first React + Vercel + Google Drive wedding
   photo PWA per a 30-section spec. Delivered: ARCHITECTURE.md (§29 proposal), full scaffold,
   libs, API, UI, 28 passing tests, README. Verified typecheck/test/build on Node 24.
2. **"Can I test it locally?"** — Explained `npm run dev` (frontend only) vs `vercel dev` (full
   stack, needs Google creds). Noted Node-15-default gotcha and camera-needs-HTTPS-or-localhost.
3. **"Commit and push to github.com/bricxcarasco/wedding-photo-sharer (SSH), use bricxcarasco
   account"** — Matched identity to wedding-invitation repo; found `github-other` key = bricxcarasco;
   init repo, committed, pushed `main` (commit `73b121d`). Verified remote + author.
4. **"Upload to Vercel — instructions?"** — Gave full Google OAuth + Vercel deploy + QR walkthrough.
5. **Google OAuth client field questions** — redirect URI stays `localhost:4567/oauth2callback`;
   JS origins empty; "AI agent" checkbox unchecked.
6. **Env setup** — Verified `.env` keys; client id/secret added; ran `npm run token`; handled the
   `Error 403 access_denied` (added test user); wrote refresh token + folder id into `.env`.
7. **Vercel env var questions** — Enumerated which vars to set and which to skip.
8. **Vercel build failed** (`Function Runtimes must have a valid version`) — fixed vercel.json +
   engines, rebuilt, committed `3bfbe5d`, pushed (user had asked to deploy).
9. **"Why not newest Node?"** — Explained local uses Node 24; Vercel pinned 22 because Vercel
   doesn't support Node 24 functions.
10. **"Test it locally — npm run dev"** — Installed Vercel CLI, tried `vercel dev` (needs login),
    user chose `npm run dev`; started Vite dev server (served on :5174).
11. **"Create a memory bank + don't commit/push without go-signal"** — Created this file;
    reaffirmed the no-commit/push-without-explicit-approval rule.
12. **"Parisienne for the names + add hashtag"** — Added Parisienne (names only) + the
    `#itinadHANNAHsiBRICXparakayMAE` hashtag under the names. (local only)
13. **"Page bg #bbb999, tab bar #ede0cd, Inter everywhere except names"** — Applied the
    backgrounds + Inter body/display font; kept Parisienne on names. (local only)
14. **"Add click animations + continuous confetti (hearts/rings/diamonds/leaves)"** — Added
    useRipple + button press-pop + Confetti component. (local only)
15. **"Make confetti smaller"** — Shrunk glyph size to 0.55–1.15rem. (local only)
16. **"Update memory bank + commit and push all updates"** — Updated this file; committed and
    pushed all pending UI changes (go-signal given).
17. **"Run the project locally"** — Started the Vite dev server on :5173 via
    `wsl bash -lic "... nvm use 24 && npm run dev"`. Reminded: frontend only, uploads need the
    deployed site.
18. **"Why not upgrade to the latest Node just for this project?"** — Explained local already uses
    nvm Node 24; the only cap was Vercel. Web-checked Vercel docs: Node 24 is now supported/default,
    Node 20 deprecated Oct 1 2026. Bumped `engines.node` → `24.x`, added `.nvmrc` (`24`). Verified
    typecheck + 28 tests + build green on Node 24. (local only at the time)
19. **"Add front/back camera switch; fix gallery image centering (use background-size: cover);
    make the names bolder"** — Implemented all three in `CameraCapture.tsx`, `Lightbox.tsx`,
    `theme.css` (see UI section). Verified green. (local only at the time)
20. **"Create a custom sage-green switch-camera icon"** — Added `CameraFlipIcon.tsx` (inline SVG),
    swapped the 🔄 emoji, restyled `.cam-flip` into the sage palette. (local only at the time)
21. **"Add spacing so the arrows don't overlap the camera icon"** — Reworked the SVG geometry:
    compact centered camera body, arcs pushed to the edges. Previewed as an artifact. (local only)
22. **"Commit and push all our updates"** — Go-signal given. Staged the 6 files, committed
    `8cbab65` ("Add camera front/back switch, full-screen lightbox, bolder names, Node 24"), pushed
    to `origin/main` (bricxcarasco via `github-other`). Verified local == remote.
23. **"Update the memory bank"** — Updated this file: corrected Vercel/Node facts, documented the
    three UI features + custom icon, refreshed known-issues, added entries 17–23.
24. **"Update memory bank + commit and push"** — Committed the memory-bank update as `c9072c1` and
    pushed to `origin/main`.
25. **"Make the image preview a padded full-screen modal (≈10px, closeable), for Gallery + My
    Photos"** — Switched `Lightbox` back to an `<img object-fit:contain>` (whole image, no crop)
    inside a dark `.lightbox` with `padding:10px` + safe-area insets, circular `.close` button, fade
    animation. Verified green. (local only at the time)
26. **"Commit and push"** — Committed `b997341` ("Make gallery/my-photos image preview a padded
    full-screen modal", 2 files), pushed to `origin/main`.
27. **"Preview images aren't consistently vertically centered on mobile — fix within the viewport"**
    — Root cause: `.lightbox` used `inset:0` + image `max-height:100%` → resolves against the layout
    viewport, so the image drifted as the mobile address bar showed/hid. Fixed by sizing `.lightbox`
    with `100dvh/100dvw` (fallback `100vh/100vw`) + `margin:auto` on the image. Verified green.
    (local only — not yet committed.)
28. **"Make memory-bank updates automatic after each prompt"** — Created `Stop`-trigger agent hook
    `.kiro/hooks/update-memory-bank.json` that reminds the agent to keep this file current each turn
    (no commit/push). Explained it activates next session. (not yet committed)
29. **(auto hook) Update the memory bank** — Caught the file up on entries 24–29, rewrote the
    lightbox UI section to the padded-modal + `dvh` reality, logged the mobile-centering fix under
    known-issues, and recorded the auto-update hook.
30. **"Commit and push all the updates"** — Go-signal given. Committed `1b8c51e` ("Fix mobile
    lightbox vertical centering; add auto memory-bank hook", 3 files: `theme.css`,
    `.kiro/hooks/update-memory-bank.json`, `memory-bank.md`), pushed `b997341..1b8c51e` to
    `origin/main`. Working tree clean.
31. **(auto hook) Update the memory bank** — Logged entry 30 (commit `1b8c51e`) and marked the
    mobile-centering fix committed.
32. **"Preview still broken — lower images can't preview, seems stuck, can't scroll, fix it
    properly"** — Found the REAL root cause: `.page`'s `fade-up` animation uses `transform`, making
    `.page` the containing block for `position:fixed`, so the in-`.page` `Lightbox` overlay was
    trapped inside the scrollable grid box (not the viewport). FIX: render `Lightbox` through
    `createPortal(…, document.body)`. Verified typecheck + build green. Updated the lightbox UI
    section + known-issues with the portal/containing-block gotcha and a general "modals must portal
    to body" rule.
33. **"Commit and push the updates"** — Go-signal given. Committed `8d1a190` ("Fix lightbox trapped
    inside page: render via portal to document.body", 2 files: `Lightbox.tsx`, `memory-bank.md`),
    pushed `1b8c51e..8d1a190` to `origin/main`. Working tree clean. ← this entry.
34. **"Run the project locally"** — Started the Vite dev server on :5173 via a background
    process (`wsl bash -lic "source ~/.nvm/nvm.sh && nvm use 24 && npm run dev"`, Node v24.3.0,
    Vite 5.4.21). Reminded: frontend only, `/api` 404s so real uploads need the deployed site;
    camera works on localhost. No code/config changes.
35. **"Add the wedding logo below the 'No sign-up needed' note; make it responsive, esp. mobile"**
    — Imported `src/assets/images/wedding-logo.png` into `Landing.tsx` and added an
    `<img className="wedding-logo" loading="lazy">` right after that paragraph. Added `.wedding-logo`
    CSS (centered, `max-width:240px`, `object-fit:contain`) + a `max-width:480px` override capping at
    `60vw`. Verified `tsc -b` + `vite build` green (logo emitted as `dist/assets/wedding-logo-*.png`).
    (local only — not committed.)
36. **"Review the whole site and make it smoother/faster without changing behavior or adding bugs"**
    — Ran a context-gatherer perf review, then applied only behavior-preserving changes: rAF-coalesced
    engine progress emits (`uploadEngine.ts`: `emitProgress`/`progressFrame`/`scheduleFrame`/`cancelFrame`),
    `React.memo` on `QueueRow`, `useCallback` row handlers in `Upload.tsx`/`UploadStatus.tsx` +
    `useMemo` for the inline find/sort, `useMemo` for Landing's `active`, `useCallback`
    `loadMore`/`reload` in `useGallery`, and a Vite `manualChunks` react-vendor split (app chunk
    190kB→27kB). Verified typecheck clean + 28/28 tests pass + build clean. Deferred (flagged to user):
    list virtualization + img width/height. (local only — not committed.)
37. **"Adjust an image-gen prompt (not project-related): add subtle pink to flowers/backdrop;
    make the central carpet white with slight green shades"** — Non-project text task. Edited the
    user's wedding-venue image-generation prompt only (no repo files touched): added soft blush pink
    as a subtle secondary accent in the COLOR MOTIF, wedding backdrop, arc, and all floral
    centerpieces (with guardrails that it stays delicate); relaxed the "avoid" list so blush pink is
    allowed while still banning red/purple/blue/hot-pink/pink-dominated; changed the carpet from
    "white or ivory" to a white carpet with very subtle soft green/sage shading, and updated the
    floor-plan summary + final-palette lines to match. No code/config/state change.
38. **"Make the glass stage adjacent to the building (no gap) — adjust the prompt only"** —
    Non-project text task (no repo files changed). Edited the wedding image-gen prompt: Section 2
    now specifies the 3×3 glass stage is directly attached to the building/main stage with no gap
    (seamless extension, no strip of grass between). Mirrored this in the strict-sequence item, the
    floor-plan summary, and the final-result sequence line.
39. **"Add flowers on both sides of the carpet; glass stage not huge, only 1.5m × 1.5m —
    adjust the prompt only"** — Non-project text task (no repo files changed). Edited the wedding
    image-gen prompt: added a "FLOWERS ALONG THE CARPET" subsection (symmetric florals lining both
    carpet edges, white/ivory + greenery + subtle blush, kept low/non-blocking); set the 3×3 glass
    stage to small ~1.5m × 1.5m ("do NOT make it large/oversized"). Mirrored both in the floor-plan
    summary and final-result sequence line.
40. **"Monobloc chairs get sage-green linens w/ a bit of design; change 'no excessive flowers' to
    moderate; make the prompt briefer"** — Non-project text task (no repo files changed). Edited the
    wedding image-gen prompt: round-table monobloc chairs now dressed in sage green chair
    linens/covers with a subtle tasteful design (sash/trim/pattern) while VIP tables keep Tiffany
    chairs; floral guidance changed from "no excessive flowers" to "keep flowers MODERATE" (removed
    "excessive flowers" from the avoid list); condensed the whole prompt ~60% while preserving all
    counts, sequence, and constraints.
41. **"Add minimal flowers on the glass-stage sides; make the carpet not too wide; decorate the
    building pillars; put a B&H monogram on the LED wall — adjust the prompt only"** — Non-project
    text task (no repo files changed). Edited the wedding image-gen prompt: added minimal low
    white+sage floral accents framing the glass stage sides/corners; set the central carpet to a
    NARROW slim runner ("NOT wide"); added decorated building pillars/columns (wrapped greenery,
    white flowers w/ blush, draped ivory fabric, warm lighting); LED wall now displays an elegant
    "B&H" couple-initials monogram in sage/white/ivory. Mirrored all four in the camera and
    final-result sections.
42. **"Carpet flowers must be a complete line on each side; couple seating + LED wall + backdrop
    must be INSIDE the building; backdrop must be elegant — adjust the prompt only"** — Non-project
    text task (no repo files changed). Edited the wedding image-gen prompt: carpet florals changed
    to a CONTINUOUS, unbroken, symmetrical line running the full aisle length on both sides (no
    gaps); backdrop, couple couch, and LED wall now explicitly placed INSIDE the building (under
    roof/covered interior), not on open grass; backdrop re-emphasized as elegant/sophisticated main
    focal point. Mirrored in camera + final-result sections.
43. **"Add flowers on the floor around the wedding couch; backdrop MUST be elegant in a SAGE GREEN
    motif; make it all realistic — adjust the prompt only"** — Non-project text task (no repo files
    changed). Edited the wedding image-gen prompt: added floral FLOOR styling (low arrangements +
    scattered petals, white/ivory + sage + subtle blush) framing the couch base without blocking the
    couple; backdrop now specified as an elegant SAGE GREEN motif (sage foliage/eucalyptus/olive
    dominant, white/ivory + hint of blush as accents); reinforced photorealism throughout (intro,
    style, camera→"CAMERA & REALISM", final-result) — natural lighting, real materials/textures,
    accurate shadows, explicitly "not a 3D/CGI render."
37. **"Commit and push our updates"** — Go-signal given. Staged the 10 changed files explicitly
    (wedding logo asset + Landing/theme + perf changes + memory-bank), committed `f050db7` ("Add
    landing wedding logo; behavior-preserving perf pass", +248/-34), pushed to `origin/main` via
    `github-other` (bricxcarasco). Verified remote refs/heads/main == local == f050db7. Working tree
    clean. (Covers entries 35 + 36.)
44. **"Run it locally so I can test"** — Started the Vite dev server on :5173 via a background
    process (`wsl bash -lic "source ~/.nvm/nvm.sh && nvm use 24 && npm run dev"`, Node v24.3.0,
    Vite 5.4.21). Reminded: frontend only, `/api` 404s so real uploads need the deployed site;
    camera works on localhost. No code/config changes.
45. **"Make the landing logo a bit smaller"** — Shrank `.wedding-logo` in `theme.css`:
    `max-width` 240px → 180px (desktop) and 60vw → 45vw (mobile ≤480px). Dev server hot-reloads.
    (local only — not committed.)
46. **"A little bit smaller again"** — Shrank `.wedding-logo` further in `theme.css`:
    `max-width` 180px → 140px (desktop) and 45vw → 35vw (mobile ≤480px). (local only — not committed.)
47. **"Commit and push our updates"** — Go-signal given. Staged `src/theme.css` + this memory-bank,
    committed `7a4413d` ("Shrink landing wedding logo (140px / 35vw)", 2 files), pushed to
    `origin/main` via `github-other` (bricxcarasco). Verified remote main == local HEAD
    (`7a4413dcc95ad34c7e53d4a9472aecf052c269a3`). Note: the PowerShell→WSL terminal mangles output and
    returns Exit Code -1 even on success — verified push by writing `ls-remote` to a workspace scratch
    file and reading it, then cleaned up.
48. **"Production My Photos + Gallery 500 — is it the Google credentials expiring?"** — Diagnosis
    (no code change). Browser response was `{"error":"Could not load the gallery"}` — the generic
    catch-all in `api/gallery.ts` (`console.error('gallery failed', e); clientError(res,500,...)`).
    Both `gallery` and `my-photos` share the same `getOAuth()`→`getAccessToken()` path in
    `api/_lib/drive.ts`, so a dead refresh token breaks BOTH at once while the static app shell still
    loads — exactly the observed symptom. Most likely cause = **`GOOGLE_REFRESH_TOKEN` expired**
    because the Google consent screen is still in **Testing** mode (unverified-app refresh tokens
    expire ~7 days out; matches "worked before, now errors"). NOT the client id/secret (don't expire),
    NOT the folder id (would give empty results, not 500), NOT a code bug (nothing changed server-side).
    To CONFIRM: Vercel dashboard → Logs, filter `gallery failed`; `invalid_grant` / "Token has been
    expired or revoked" = confirmed. FIX: rerun `npm run token`, update `GOOGLE_REFRESH_TOKEN` locally
    + in Vercel (Production + Preview), redeploy. PERMANENT FIX: publish the OAuth app to Production on
    the Google consent screen so the refresh token stops expiring. Awaiting user's choice (confirm via
    logs vs. just regenerate).
49. **Confirmed the gallery/my-photos 500 cause from Vercel logs** — `GaxiosError: invalid_grant`,
    `error_description: 'Token has been expired or revoked.'` from `https://oauth2.googleapis.com/token`,
    stack through `getSubfolderId`→`listPhotos`→`gallery` handler. 100% the expired `GOOGLE_REFRESH_TOKEN`
    (Testing-mode ~7-day expiry), as predicted in entry 48. Started `npm run token` (background process,
    Node v24.3.0) which printed the Google consent URL and is waiting on `http://localhost:4567/oauth2callback`.
    Reminded user: sign in as `thedeventrep@gmail.com` (test user; else 403 access_denied), click
    Advanced→proceed past the unverified-app warning, approve Drive. Pending: user approves → capture new
    refresh token → update `.env` locally + Vercel (Production+Preview) → redeploy. Permanent fix =
    publish OAuth app to Production so token stops expiring. (no code change this turn)
50. **"Can we make the token last 1 year / never expire?"** — Explained: no literal expiry setting;
    instead change the mode that causes expiry. TWO options recorded:
    * **Option A (recommended, free, no code change): Publish the OAuth app to Production.** Google
      Cloud Console → APIs & Services → OAuth consent screen → **Publish app**. The ~7-day refresh-token
      expiry only applies in **Testing** mode; in **Production** the refresh token does not expire as
      long as it's used within ~6 months (ours runs constantly), isn't revoked, and the Google account
      password/security isn't changed (limit ~100 live tokens/client; we have 1). Because the app uses
      ONLY the `drive.file` scope (NON-sensitive — app sees only files it created), publishing does
      NOT trigger Google verification review (no privacy policy/video needed); you just get the
      harmless "unverified app" warning that only the owner ever sees. After publishing, rerun
      `npm run token` so the token is minted under Production rules, then update `.env` + Vercel.
    * **Option B (truly zero expiry, needs a code change): Service Account.** Swap the `OAuth2` client
      in `api/_lib/drive.ts` for `google.auth.GoogleAuth` with a service-account JSON key — key-based
      auth, nothing to expire. Caveat: a service account has no Drive storage of its own, so share the
      wedding root folder with the service account's email (or use a Shared Drive). One extra secret
      (JSON key / base64) replaces the 3 GOOGLE_* OAuth vars.
    Recommended path: finish today's token regen to restore the site, then publish to Production.
    (no code change this turn)
51. **"Where is Publish app in the console?"** — Google renamed the "OAuth consent screen" to
    **Google Auth Platform** (console.cloud.google.com/auth/...). The **Publish app** button is NOT on
    the Overview page — it's under the **Audience** tab (left sidebar) in the **Publishing status**
    section (shows "Testing" → click **Publish app** → confirm → flips to "In production"). The
    Audience tab is also where the old Test users list lives. Because the app uses only the
    non-sensitive `drive.file` scope, no verification submission is required (ignore any "Prepare for
    verification" prompt; "unverified app" warning is harmless, owner-only). After it reads
    "In production", rerun `npm run token` and update `.env` + Vercel. (no code change this turn)
52. **"Publish app" button is greyed out** — Google requires Branding fields before allowing the
    switch to external Production. Tooltip: valid **app name, user support email, app homepage URL,
    and privacy policy URL** required → set them on the **Branding** tab (left sidebar), save, then
    Audience → Publish app becomes clickable. Suggested values: app name "Bricx & Hannah Wedding",
    support email `thedeventrep@gmail.com`, homepage `https://bricxhannah-wedding-photos.vercel.app`.
    Privacy policy URL is the catch — either reuse the homepage URL, or add a real `/privacy` page to
    the site. Filling these is metadata only; still NO verification review needed (non-sensitive
    `drive.file` scope). Also noted: OAuth user cap in Testing = 100 users/lifetime; currently
    "1 user (1 test, 0 other) / 100 user cap". Awaiting user's choice on the privacy URL. (no code
    change this turn)

## Privacy page (`/privacy`) — added for Google OAuth "Publish app" requirement

- `src/pages/Privacy.tsx` — themed privacy policy page (uses `COUPLE`/`WEDDING_DATE_LABEL` from
  `src/lib/config.ts`). Content: no accounts/passwords, photos stored in couple's private Google
  Drive, device-local random guestId for "My Photos", only `drive.file` scope (app can't see the
  rest of a user's Drive), no ad/tracking cookies, how to request deletion, link to Google's privacy
  policy, "Back to home" button.
- `src/App.tsx` — `Privacy` lazy-loaded; `<Route path="/privacy">` added above the `*` catch-all;
  `hideTabs` now also true for `/privacy` (standalone page, like `/`).
- `src/theme.css` — added `.prose` styles (readable long-form body/h2/ul/li/a using `--ink`/
  `--sage-deep`) and `.privacy-link` (small centered underlined footer link, `--ink-soft`).
- `src/pages/Landing.tsx` — added a subtle `.privacy-link` button under the wedding logo → `/privacy`.
- SPA routing: existing `vercel.json` rewrite `"/((?!api/).*)" → /index.html` already serves
  `/privacy` on a direct hit, so no config change needed.
- Verified: `npm run typecheck` + `npm run build` green; Privacy emits its own lazy chunk (~2.85 kB).
- Privacy URL for the Google Branding page (goes live only AFTER deploy):
  `https://bricxhannah-wedding-photos.vercel.app/privacy`.

53. **"Add a /privacy page for the OAuth Branding privacy-policy URL"** — Created `Privacy.tsx`,
    wired the lazy route + hideTabs in `App.tsx`, added `.prose`/`.privacy-link` CSS, and a landing
    footer link. Verified typecheck + build green (Privacy = own 2.85 kB chunk). Next steps for user:
    commit+push → confirm `/privacy` loads on prod → fill Branding fields (app name, support email,
    homepage, the `/privacy` URL) → Audience Publish app → regen token (`npm run token`) → update
    `.env` + Vercel → redeploy. (local only — NOT committed, awaiting go-signal.)
54. **"What about the Application Terms of Service link?"** — Clarified: on the Google Branding
    page the **Application Terms of Service URL is OPTIONAL** (not required to Publish app, unlike the
    privacy policy URL which IS required). Offered to add a matching `/terms` page for consistency
    (same pattern as `/privacy`, URL `https://bricxhannah-wedding-photos.vercel.app/terms`). Awaiting
    user's choice — add `/terms` or leave the ToS field blank. (no code change this turn)
56. **(Branding page full screenshot) "Is this all good?"** — Confirmed all fields correct: App name
    **"Bricx & Hannah Wedding Photos"**, support email `thedeventrep@gmail.com`, logo uploaded (B&H
    wreath monogram shows in preview), home + privacy URLs set. Google panel confirms "Verification is
    not required since your app is in Testing status"; the logo "submit for verification" warning only
    applies to sensitive/restricted scopes (we use only non-sensitive `drive.file`), so publishing
    won't force verification. Reminded: click **Save** → Audience **Publish app**. Still pending (my
    steps): commit+push `/privacy` so the URL resolves in prod (currently 404), then regen token +
    update `.env`/Vercel + redeploy + verify. Awaiting go-signal to commit+push. (no code change)
58. **(Audience screenshot) App now "In production"** — Publishing status flipped to **In production**
    (External). This resolves the ~7-day refresh-token expiry going forward. The yellow "Your app
    requires verification / submit for review" banner is HARMLESS and can be IGNORED: verification is
    only enforced for sensitive/restricted scopes; this app uses only non-sensitive `drive.file`, so
    nothing to submit and nothing gets cut off (the page's own OAuth-user-cap note confirms the cap/
    verification only apply "if requesting approved sensitive or restricted scopes"). Do NOT click
    "Back to testing" (would reinstate the 7-day expiry). Restarted `npm run token` (reused terminal,
    Node v24.3.0) — again printing the consent URL and waiting on `http://localhost:4567/oauth2callback`.
    Pending: user approves (sign in as `thedeventrep@gmail.com`, click past unverified-app warning,
    approve Drive) → capture new token → update `.env` + Vercel (Prod+Preview) → redeploy → verify
    Gallery/My Photos. (no code change this turn)

### CRITICAL Google OAuth facts (learned this session — keep)
- The old "OAuth consent screen" is now **Google Auth Platform** (console.cloud.google.com/auth/...).
  **Publish app** lives on the **Audience** tab (Publishing status section), NOT Overview.
- Publishing requires Branding fields first: app name, user support email, app homepage URL, and
  **privacy policy URL** (ToS URL is OPTIONAL). That's why Publish app was greyed out until Branding
  was completed.
- **Testing mode force-expires refresh tokens ~7 days out** → `invalid_grant` "Token has been expired
  or revoked" on `oauth2.googleapis.com/token`, surfacing as the generic 500 in `api/gallery.ts` /
  `api/my-photos.ts` (shared `getOAuth()`→`getAccessToken()` in `api/_lib/drive.ts`). Publishing to
  Production stops this (token effectively non-expiring under normal use).
- Because the app uses only the **non-sensitive `drive.file`** scope, **publishing does NOT trigger
  Google verification review** despite the scary banner. The only effect is the owner-only
  "unverified app" consent warning.
- After publishing, regenerate the refresh token (`npm run token`) so it's minted under Production
  rules, then update `GOOGLE_REFRESH_TOKEN` in `.env` AND Vercel (Production + Preview) and redeploy.
59. **User approved the OAuth consent → new refresh token minted** — `npm run token` completed
    (browser showed "Success!"); script printed a fresh `GOOGLE_REFRESH_TOKEN` (folder id unchanged
    `1UioFozdkLHYHSByQmuqDTzAMlmKNzHwA`). Updated the token line in local `.env` (git-ignored — NOT
    committed, HARD RULE 2). Stopped the token terminal. Only `GOOGLE_REFRESH_TOKEN` changed; client
    id/secret + folder id unchanged. Gave user the Vercel steps: Settings → Environment Variables →
    edit `GOOGLE_REFRESH_TOKEN` (paste WITHOUT quotes, Production + Preview) → Save → **Redeploy**
    (env changes need a new deploy; note the `/privacy` push 281a7dd built with the OLD token, so a
    redeploy AFTER saving the new token is required) → verify Gallery/My Photos load + `/privacy`
    resolves. Token no longer expires now that the app is In Production. Awaiting user confirmation
    that Vercel is updated + redeployed. (secret value intentionally NOT recorded here)
60. **"Free-tier Google account — will it work through Feb 2027 without re-refreshing the token?"** —
    Answered yes (Q&A, no code change). Key facts recorded:
    * The app uses ONLY the **Google Drive API** (free, quota-based, no GCP billing/credit card). The
      "Google Cloud free tier expiring" concern doesn't apply — no compute/storage GCP services used.
    * Now that the app is **In Production**, the OAuth refresh token has **no fixed expiry**; it keeps
      working as long as it's used within ~6 months (ours runs constantly), the account password/
      security isn't changed, access isn't revoked, and the OAuth client/project isn't deleted. So it
      covers now → Feb 2027 and beyond with no manual refresh.
    * **The real limit = Google Drive storage: free account has 15 GB** shared across Gmail/Drive/
      Photos. Optimized phone photos ~1–3 MB each → thousands fit; one wedding very unlikely to hit it,
      but a very photo-heavy crowd could. Cheap fix if needed: Google One 100 GB (~couple $/month).
    * Drive API request quota (~12k req/min, ~1B/day) is far beyond a wedding's needs.
    * OAuth **100-user cap** only counts users who authorize via Google sign-in — only the OWNER ever
      does (once, to mint the token); guests never sign in. So 1/100 forever, not a concern.
    Offered to add a storage check or help verify the Vercel redeploy. (no code change this turn)

## Gallery stacked-list layout (replaced masonry grid on the Gallery page only)

- `src/pages/Gallery.tsx` — the gallery now renders a **stacked list** (`<ul className="gallery-list">`)
  instead of the `.masonry`/`.tile` grid. Each row (`.gallery-row` button) shows: a square thumbnail
  (`.gallery-thumb` → `<img loading="lazy" decoding="async">`), the **file name** (`.gallery-name`,
  ellipsized), and the **upload date/time** (`.gallery-date`, via `formatDateTime(p.uploadedAt)` from
  `src/lib/format.ts`). `p.mine` adds a gold border (`.gallery-row.mine`). Clicking a row still opens
  the shared `Lightbox`. Progressive/lazy loading is twofold: the existing `IntersectionObserver`
  infinite-scroll (`loadMore`, 400px rootMargin, +"Load more" fallback button) is kept, and each
  `<img>` keeps `loading="lazy"`.
- `src/theme.css` — added a `.gallery-list` style block (`.gallery-row`, `.gallery-thumb`,
  `.gallery-meta`, `.gallery-name`, `.gallery-date`). All scoped under `.gallery-list`. Row
  background = `var(--sage)` (rgb(138,154,123)) with matching sage border; `.gallery-name` and
  `.gallery-date` text = `#fff` (white). `.gallery-row.mine` keeps a gold-soft border accent.
- **IMPORTANT scoping:** `.masonry`/`.tile` are SHARED by `MyPhotos.tsx` — left completely untouched,
  so My Photos still uses the column/masonry grid. Only the Gallery page changed. No other pages/
  functionality altered. Lightbox, useGallery hook, and the API are unchanged.
- Verified: `npm run typecheck` + `npm run build` green; Gallery chunk 2.69 kB, MyPhotos unchanged.
  (local only — NOT committed, awaiting go-signal.)

61. **"Change Gallery (only) to a stacked list w/ lazy loading; each row = thumbnail + file name +
    upload date/time; leave other pages unchanged. Possible?"** — Yes; implemented. Rewrote the
    Gallery grid as a `.gallery-list` of `.gallery-row` items (thumb + name + `formatDateTime` date),
    kept the IntersectionObserver infinite scroll + per-image `loading="lazy"`, added scoped CSS, and
    deliberately left the shared `.masonry`/`.tile` (My Photos) untouched. Verified typecheck + build
    green (Gallery 2.69 kB chunk, MyPhotos unchanged). (local only — not committed.)
62. **"Commit and push all updates"** — Go-signal given. Staged `src/pages/Gallery.tsx`,
    `src/theme.css`, `.kiro/steering/memory-bank.md` (`.env` correctly git-ignored, not staged);
    committed `9fc5cce` ("Gallery: stacked list layout with lazy loading, name and upload time",
    3 files, +163/-10); pushed `281a7dd..9fc5cce` to `origin/main` via `github-other` (bricxcarasco).
    Verified via push output `281a7dd..9fc5cce main -> main`. Cleaned up scratch files. Vercel
    auto-redeploys. Reminder to user: this deploy only fixes the 500s if the new
    `GOOGLE_REFRESH_TOKEN` was already saved in Vercel env vars + redeployed after saving. ← this entry.
63. **"Make the gallery list background rgb(138,154,123) and the text white"** — Set `.gallery-row`
    background + border to `var(--sage)` (= rgb(138,154,123)) and `.gallery-name`/`.gallery-date`
    color to `#fff` in `theme.css`. Kept `.gallery-row.mine` gold border (good contrast on sage).
    Verified typecheck + build green. (local only before this commit.)
64. **"Commit and push the updates"** — Go-signal given. Staged `src/theme.css` +
    `.kiro/steering/memory-bank.md`; committed `cc545b5` ("Gallery list: sage background with white
    text", 2 files, +18/-5); pushed `9fc5cce..cc545b5` to `origin/main` via `github-other`
    (bricxcarasco). Verified push output `9fc5cce..cc545b5 main -> main`. Cleaned up scratch files.
    Vercel auto-redeploys. ← this entry.
65. **"Investigate why uploads get stuck on 'Preparing' even though the photo actually uploads
    (status not updating in real time)"** — Diagnosed + fixed. "Preparing" = engine `optimizing`
    status; engine ran to `done` fine (gallery confirmed) but the `QueueRow` froze. ROOT CAUSE: the
    `React.memo` on `QueueRow` bailed out because the engine mutates each `QueueItem` in place and
    reuses the same object reference in the Map/IndexedDB/`snapshot()`, so the memo saw an identical
    `item` prop and skipped every re-render after the first paint (which lands on `optimizing`).
    FIX in `src/lib/uploadEngine.ts`: `snapshot()` now hands out fresh clones for changed items and
    stable refs for unchanged ones — added a monotonic rev counter (`itemRev`/`revSeq`) bumped in
    `persist()`, the `onProgress` progress callback, and `retryAllFailed()`, plus a per-id clone
    cache (`snapClones`) that re-clones only when the rev advanced (stale entries pruned in
    `snapshot()`). Keeps the perf memo intact for untouched rows. Verified: typecheck clean, 28/28
    tests pass, build green. Cleaned up scratch files. (local only — NOT committed, awaiting
    go-signal.) ← this entry.
66. **"Commit and push our updates"** — Go-signal given. Staged `src/lib/uploadEngine.ts` +
    `.kiro/steering/memory-bank.md` (only two changed files, confirmed via `git status --short`),
    committed `d0415c4` ("Fix upload row stuck on Preparing: hand React fresh item refs on change",
    2 files, +82/-1), pushed to `origin/main` via `github-other` (bricxcarasco). Verified local ==
    remote == `d0415c4` with `ls-remote`, working tree clean. Cleaned up scratch files. Vercel
    auto-redeploys. ← this entry.
67. **"Run this project locally"** — Started the Vite dev server on :5173 via a background
    process (`wsl bash -lic "source ~/.nvm/nvm.sh && nvm use 24 && npm run dev"`, Node v24.3.0,
    Vite 5.4.21). Reminded: frontend only, `/api` 404s so real uploads need the deployed site;
    camera works on localhost. No code/config changes.
