import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  protocol,
  screen,
  type NativeImage,
} from 'electron';
import { clampToVisibleArea, loadWindowState, saveWindowState, type WindowState } from './windowState';
import { showNativeNotification, type ShowNotificationOptions } from './notifications';

// Must run before `app.whenReady()` — Electron requires scheme privileges to
// be registered at module load time.
const APP_SCHEME = 'app';
const APP_HOST = 'phishy-hub';
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
// `assets/icon.png` isn't inside `dist/` (electron-builder's own `files`
// list only bundles `dist/**/*`) — packaged builds get it copied in
// separately via `build.extraResources` in package.json, unpackaged runs
// read it straight out of the source tree.
const ICON_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'icon.png')
  : path.join(__dirname, '..', 'assets', 'icon.png');

/**
 * Where the built `web/dist` lives. Packaged: electron-builder copies
 * `../web/dist` into `resources/web-dist` (see package.json's `build.
 * extraResources`). Unpackaged (`npm run dev`/`start`, still built via
 * `tsc` into `dist/`): resolved relative to this compiled file, two levels
 * up from `desktop/dist/main.js` to the repo's `web/dist`.
 */
function webDistDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'web-dist')
    : path.join(__dirname, '..', '..', 'web', 'dist');
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

function mimeTypeFor(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Serves the built `web/dist` under a custom `app://phishy-hub/...` origin.
 * `createWebHistory` (web/src/router/index.ts) needs a real origin with
 * path-based routing to work at all — a bare `file://` load breaks it, and
 * switching the router to hash history was explicitly ruled out (that's a
 * shared, already-reviewed file used by the web deployment too). Any path
 * that doesn't resolve to a real file on disk (e.g. `/chat/<channelId>`,
 * a client-side route) falls back to `index.html` so vue-router's own
 * client-side matching takes over, exactly like an SPA fallback on a real
 * HTTP server.
 */
function registerAppProtocol(): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    const distDir = webDistDir();
    const decodedPath = decodeURIComponent(url.pathname);
    const relativePath = decodedPath === '' || decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
    const normalizedDistDir = path.normalize(distDir);
    const resolved = path.normalize(path.join(distDir, relativePath));

    // Containment check — never serve a path that escaped `distDir` via `..`.
    // A bare `startsWith(normalizedDistDir)` would also match a sibling
    // directory sharing the same string prefix (e.g. `dist-secret` matching
    // `dist`), so require an exact match or a path.sep-bounded prefix.
    const withSep = normalizedDistDir.endsWith(path.sep) ? normalizedDistDir : normalizedDistDir + path.sep;
    if (resolved !== normalizedDistDir && !resolved.startsWith(withSep)) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      const data = await fs.promises.readFile(resolved);
      return new Response(data, { headers: { 'content-type': mimeTypeFor(resolved) } });
    } catch {
      try {
        const fallback = await fs.promises.readFile(path.join(distDir, 'index.html'));
        return new Response(fallback, { headers: { 'content-type': 'text/html' } });
      } catch (err) {
        return new Response(`web/dist not built or not found at ${distDir}: ${String(err)}`, { status: 500 });
      }
    }
  });
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let unreadOverlayIcon: NativeImage | null = null;

function persistCurrentWindowState(win: BrowserWindow): void {
  const isMaximized = win.isMaximized();
  const bounds = isMaximized ? win.getNormalBounds() : win.getBounds();
  const state: WindowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized,
  };
  saveWindowState(app.getPath('userData'), state);
}

function createWindow(): BrowserWindow {
  const saved = loadWindowState(app.getPath('userData'));
  const state = clampToVisibleArea(saved, screen.getAllDisplays());

  const win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    show: false,
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (state.isMaximized) win.maximize();

  win.once('ready-to-show', () => win.show());

  // Block window.open()/target=_blank popups — this is an internal single-
  // window app, nothing needs a second BrowserWindow.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  let persistTimer: NodeJS.Timeout | null = null;
  const schedulePersist = () => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      if (!win.isDestroyed()) persistCurrentWindowState(win);
    }, 300);
  };
  win.on('resize', schedulePersist);
  win.on('move', schedulePersist);
  win.on('maximize', schedulePersist);
  win.on('unmaximize', schedulePersist);

  // Minimize hides to tray instead of leaving a minimized taskbar entry —
  // the tray icon is the app's "minimized" affordance per the plan.
  // BrowserWindow's `minimize` event fires *after* the OS has already
  // minimized the window (it isn't cancelable, unlike `close` below), so
  // this just immediately follows up with `hide()` rather than preventing
  // the minimize itself.
  win.on('minimize', () => {
    win.hide();
  });

  // Close also hides to tray (never quits) unless we're actually quitting
  // (tray "Quit" / OS shutdown), matching the plan's "closing... hide to
  // tray (not quit)".
  win.on('close', (event) => {
    if (isQuitting) {
      if (!win.isDestroyed()) persistCurrentWindowState(win);
      return;
    }
    event.preventDefault();
    win.hide();
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

function loadAppContent(win: BrowserWindow): void {
  if (!app.isPackaged) {
    void win.loadURL(DEV_SERVER_URL);
  } else {
    void win.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`);
  }
}

function focusWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

/** A small solid-color circle badge (no numeral — Electron's main process has no canvas/text-rendering API available without extra deps) used as the Windows taskbar overlay icon when there's unread activity. */
function getUnreadOverlayIcon(): NativeImage {
  if (unreadOverlayIcon) return unreadOverlayIcon;
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const i = (y * size + x) * 4;
      if (dx * dx + dy * dy <= r * r) {
        // BGRA — nativeImage.createFromBitmap expects BGRA byte order.
        buffer[i] = 53;
        buffer[i + 1] = 53;
        buffer[i + 2] = 220;
        buffer[i + 3] = 255;
      }
    }
  }
  unreadOverlayIcon = nativeImage.createFromBitmap(buffer, { width: size, height: size });
  return unreadOverlayIcon;
}

function setUnreadBadge(count: number): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (process.platform === 'win32') {
    mainWindow.setOverlayIcon(count > 0 ? getUnreadOverlayIcon() : null, count > 0 ? `${count} unread` : '');
  } else {
    // No-op / returns false on platforms without badge support (Windows) —
    // harmless to call unconditionally on macOS/Linux where it IS supported.
    app.setBadgeCount(count);
  }

  tray?.setToolTip(count > 0 ? `Phishy Hub (${count} unread)` : 'Phishy Hub');
}

function buildTrayMenu(): Menu {
  const openAtLogin = app.getLoginItemSettings().openAtLogin;
  return Menu.buildFromTemplate([
    { label: 'Open Phishy Hub', click: focusWindow },
    { type: 'separator' },
    {
      label: 'Start on login',
      type: 'checkbox',
      checked: openAtLogin,
      click: () => {
        app.setLoginItemSettings({ openAtLogin: !openAtLogin });
        tray?.setContextMenu(buildTrayMenu());
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function createTray(): void {
  const icon = nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Phishy Hub');
  tray.setContextMenu(buildTrayMenu());
  tray.on('double-click', focusWindow);
}

function registerIpcHandlers(): void {
  ipcMain.on('unread-count:update', (_event, count: unknown) => {
    setUnreadBadge(typeof count === 'number' && Number.isFinite(count) ? count : 0);
  });

  ipcMain.on('notification:show', (_event, options: ShowNotificationOptions) => {
    if (!mainWindow || !options || typeof options.title !== 'string') return;
    showNativeNotification(mainWindow, options, ICON_PATH);
  });
}

// Tray apps should be single-instance — a second launch just focuses the
// existing window rather than spawning a second tray icon.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', focusWindow);

  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.phishyhub.desktop');
    }

    registerAppProtocol();
    registerIpcHandlers();

    mainWindow = createWindow();
    loadAppContent(mainWindow);
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow();
        loadAppContent(mainWindow);
      } else {
        focusWindow();
      }
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  // Hiding to tray (see win.on('close') above) means the app never quits
  // when all windows are closed on any platform — it lives in the tray
  // until "Quit" is chosen. This deliberately overrides the default
  // Electron behavior (quit on all-windows-closed except macOS).
  app.on('window-all-closed', () => {
    // no-op — intentional, see comment above
  });
}
