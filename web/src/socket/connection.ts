import { io, type Socket } from 'socket.io-client';
import * as tokenManager from '../api/tokenManager';
import type { ClientToServerEvents, ServerToClientEvents } from './events';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Pure transport — no vue/pinia import (repo CLAUDE.md hard rule). Anything
 * that needs to react to socket lifecycle by touching Pinia stores (resync
 * on reconnect, event -> store dispatch) belongs in socket/eventBridge.ts,
 * which attaches its own listeners to the socket this module hands out.
 */

let socket: AppSocket | null = null;

function createSocket(): AppSocket {
  const instance: AppSocket = io(import.meta.env.VITE_SOCKET_URL, {
    // Callback form (not a static object) — re-evaluated on every reconnect
    // attempt, so it always sends the CURRENT access token. A static object
    // would pin the token from the first connect forever, which breaks every
    // reconnect after the access token's ~15min expiry (CONTRACT.md §4.1 —
    // the socket dies on that boundary and must reconnect with a fresh token).
    auth: (cb) => cb({ token: tokenManager.getAccessToken() }),
    autoConnect: false,
    // Deliberately NOT setting `transports: ['websocket']` — CONTRACT.md §4.5
    // documents that forcing websocket-only transport silently drops packets
    // in this environment. Use the default polling -> websocket upgrade.
  });

  instance.on('connect_error', () => {
    // The most common cause of a connect_error here is an expired access
    // token (CONTRACT.md §4.1). Kick off a refresh through the same shared
    // single-flight path HTTP uses, then let socket.io's own reconnection
    // schedule retry on its own — we do NOT call connect() again ourselves,
    // that risks a double-connect race with socket.io's internal retry.
    void tokenManager.refreshTokens().catch(() => {
      // If the refresh itself ultimately fails, tokenManager already ran
      // the hard-logout flow (cleared storage, notified onSessionExpired
      // listeners) — nothing further to do from here.
    });
  });

  return instance;
}

export function getSocket(): AppSocket {
  if (!socket) {
    socket = createSocket();
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
