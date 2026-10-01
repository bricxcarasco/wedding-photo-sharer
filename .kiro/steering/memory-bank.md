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
- **Vercel supported function runtimes:** Node 18 / 20 / 22 only (NOT 24). `package.json`
  `engines.node` is pinned to `"22.x"`. Do NOT set `24.x` for Vercel.
- **Terminal gotcha:** the PowerShell→WSL layer echoes/mangles long commands and nested quotes.
  Workaround that works: write output to a file in the WORKSPACE (not `/tmp` — the agent file
  tools can't read `/tmp`) and read it with the file tool, OR run a `.sh` scratch script.
  Clean up scratch files after. Use `git -c core.pager=cat` / `GIT_SSH_COMMAND=...` to avoid pagers.
- **Vercel CLI** is installed globally (v62.x) but `vercel dev` requires interactive login
  (device-code OAuth). For quick local testing the user prefers **`npm run dev`** (frontend only;
  `/api` calls 404, so real uploads don't complete locally — test real uploads on the deployed site).

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

## Code map (key files)

- `api/_lib/` — drive.ts (Drive client + secrets), http.ts (guest id, HMAC-signed upload
  sessions, raw body, limits), validate.ts, rateLimit.ts.
- `api/*.ts` — check-duplicate, upload-init, upload-proxy (chunk relay), finalize, my-photos,
  gallery, thumb/[id].
- `src/lib/` — uploadEngine.ts (singleton queue: concurrency 3, retry+backoff, resume-on-return,
  EngineConfig ctor + dispose() for tests), db.ts (IndexedDB via idb), guest.ts, hash.ts (SHA-256),
  imageOptimize.ts (+ worker), api.ts, net.ts, capabilities.ts, config.ts.
- `src/pages/` — Landing, Upload, MyPhotos, Gallery, UploadStatus, errors/.
- `scripts/get-refresh-token.mjs` — `npm run token`.
- Tests: `npm test` → 28 tests, 5 files (vitest). Verify loop:
  `npm run typecheck && npm test && npm run build` (all green as of last run).

---

## Known issues fixed

- **Vercel build error** `Function Runtimes must have a valid version`: caused by
  `vercel.json functions.runtime: "nodejs20.x"` (invalid — that field wants a versioned package
  id). FIX: removed `runtime` (kept `maxDuration: 60`); pinned Node via `engines.node: "22.x"`.
  Committed `3bfbe5d` and pushed (with user's go-signal at that time).

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
    pushed all pending UI changes (go-signal given). ← this entry.
