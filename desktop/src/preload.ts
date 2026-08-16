import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type { NavigateTarget, ShowNotificationOptions } from './notifications';

/**
 * The only surface the renderer (web/'s bundle, loaded with nodeIntegration
 * disabled + contextIsolation enabled) gets into the main process. Kept
 * intentionally tiny — three calls, matching exactly what
 * web/src/lib/electronBridge.ts needs and nothing else.
 */
export interface PhishyHubBridge {
  readonly isElectron: true;
  setUnreadCount(count: number): void;
  showNotification(options: ShowNotificationOptions): void;
  onNavigate(callback: (target: NavigateTarget) => void): () => void;
}

const bridge: PhishyHubBridge = {
  isElectron: true,

  setUnreadCount(count) {
    ipcRenderer.send('unread-count:update', count);
  },

  showNotification(options) {
    ipcRenderer.send('notification:show', options);
  },

  onNavigate(callback) {
    const listener = (_event: IpcRendererEvent, target: NavigateTarget) => callback(target);
    ipcRenderer.on('notification:navigate', listener);
    return () => {
      ipcRenderer.removeListener('notification:navigate', listener);
    };
  },
};

contextBridge.exposeInMainWorld('phishyHub', bridge);
