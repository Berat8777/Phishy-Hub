import { BrowserWindow, Notification, nativeImage } from 'electron';

/**
 * Mirrors `web/src/lib/electronBridge.ts`'s `NotificationNavigateTarget` —
 * kept as a separately-declared (but shape-compatible) type here rather
 * than shared/imported across the `desktop`/`web` package boundary, same as
 * every other main<->renderer IPC payload in this app (there's no shared
 * types package between the two, and `payload: Record<string, unknown>`
 * already sets the precedent of a loosely-typed boundary for this kind of
 * data).
 */
export interface NavigateTarget {
  routeName: string;
  params?: Record<string, string>;
  scrollTo?: { channelId: string; messageId: string };
}

export interface ShowNotificationOptions {
  title: string;
  body: string;
  navigate: NavigateTarget;
}

/**
 * Fires a native OS notification and wires its click handler to focus/
 * restore the window and forward `navigate` to the renderer over
 * `notification:navigate` — the renderer (electronBridge.ts) is the one
 * that actually calls `router.push`/`searchStore.requestScrollTo`; this
 * file deliberately never touches routing itself.
 */
export function showNativeNotification(win: BrowserWindow, options: ShowNotificationOptions, iconPath: string): void {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title: options.title,
    body: options.body,
    icon: nativeImage.createFromPath(iconPath),
  });

  notification.on('click', () => {
    if (win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();
    win.webContents.send('notification:navigate', options.navigate);
  });

  notification.show();
}
