# Phishy Hub Desktop

Electron shell around the existing `web/` SPA. Adds: a tray icon (close/
minimize hide to tray instead of quitting), native OS notifications with
click-to-deep-link, an unread-count badge on the Windows taskbar icon,
auto-launch-on-login (opt-in via the tray menu), and window position/size/
maximized-state persistence across restarts.

This package makes **zero** changes to how `web/` behaves as a browser app —
it only loads `web/`'s build output (or dev server) inside a `BrowserWindow`
and talks to it over a small `contextBridge` API (`window.phishyHub`, see
`src/preload.ts`). The one addition on the `web/` side is
`web/src/lib/electronBridge.ts`, a no-op outside Electron, wired in from
`web/src/main.ts`.

## Dev mode (hot reload)

1. In one terminal, start `web`'s Vite dev server as usual:
   ```
   cd web
   npm run dev
   ```
   (defaults to `http://localhost:5173`)

2. In another terminal:
   ```
   cd desktop
   npm install   # first time only
   npm run dev
   ```
   This compiles `desktop/src/*.ts` with `tsc` and launches Electron.
   Because the app isn't packaged (`app.isPackaged === false`), `main.ts`
   loads `VITE_DEV_SERVER_URL` (`desktop/.env`, falls back to
   `http://localhost:5173` if unset — copy `.env.example` to `.env` to
   override) directly, so Vite's HMR works exactly like in a browser tab.

   Re-run `npm run dev` after editing anything under `desktop/src/` (main/
   preload run compiled JS, not TS directly — there's no watch mode wired up
   this pass). Renderer-side (`web/`) changes hot-reload without restarting
   Electron at all.

## Packaged / production mode

1. Build the web app first:
   ```
   cd web
   npm run build      # outputs web/dist
   ```
2. Build and package the desktop app:
   ```
   cd desktop
   npm run build      # compiles desktop/src -> desktop/dist
   npm run package    # electron-builder -> desktop/release/**
   ```
   The packaged app loads `web/dist` (bundled in as `resources/web-dist` via
   `electron-builder`'s `extraResources`) through a custom `app://` protocol
   registered in `src/main.ts` — `web/src/router/index.ts` uses
   `createWebHistory` (path-based routing), which does not work from a bare
   `file://` URL. The protocol handler serves files straight out of
   `web-dist` and falls back to `index.html` for any path that isn't a real
   file on disk, so client-side routes resolve exactly like they would
   behind a real HTTP server's SPA fallback.

`npm run package` has **not** been exercised in this pass (no installer/
signing verification) — `assets/icon.png` is a placeholder solid-color square
(generated inline, no real brand asset existed anywhere in the repo yet) and
should be replaced with real icon artwork (and a proper macOS `.icns` /
Windows `.ico` if those platforms are packaged for real) before shipping a
real installer.

## Environment

Copy `.env.example` to `.env` and adjust if needed:

- `VITE_DEV_SERVER_URL` — dev-mode only, the Vite dev server URL to load.
  Defaults to `http://localhost:5173`, matching `web`'s own default.

`VITE_API_BASE_URL`/`VITE_SOCKET_URL` are **not** read here — those are
baked into `web/dist` at `web`'s own build time (`web/.env`), same as any
other static deploy of `web/`. The desktop shell has no API/socket
connection of its own; all of that lives in the renderer exactly as it does
in a browser tab.

## Architecture notes

- `src/main.ts` — app lifecycle, window creation + state persistence, the
  `app://` protocol handler, tray, IPC handlers, auto-launch toggle.
- `src/preload.ts` — the only bridge into the main process
  (`contextBridge.exposeInMainWorld('phishyHub', ...)`). `nodeIntegration`
  is off and `contextIsolation`/`sandbox` are on for the renderer — this is
  a real security boundary even though this is an internal tool.
- `src/notifications.ts` — native `Notification` wiring; click handling
  focuses/restores the window and forwards a `navigate` target to the
  renderer, which does the actual `router.push` (see
  `web/src/lib/electronBridge.ts`) — main never drives navigation directly.
- `src/windowState.ts` — reads/writes `<userData>/window-state.json`;
  clamps a restored position to a currently-connected display so a window
  last seen on a since-unplugged second monitor doesn't restore off-screen.

## Known gaps / not exercised this pass

- `npm run package` (electron-builder) is wired up but not run — see above.
- Auto-launch (`app.setLoginItemSettings`) is implemented via Electron's
  built-in API and toggled from the tray menu, but wasn't verified against
  an actual OS reboot in this pass (nothing to verify without one).
- The unread taskbar badge is a plain dot (no numeral) — Electron's main
  process has no text/canvas rendering API without extra dependencies, and
  none were pulled in for this pass.
