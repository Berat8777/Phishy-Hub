import { io, type Socket } from 'socket.io-client';
import * as tokenManager from '../api/tokenManager';
import { SOCKET_URL } from '../config/env';
import type { ClientToServerEvents, ServerToClientEvents } from './events';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Ported from web/src/socket/connection.ts. Same two load-bearing details
 * from CONTRACT.md §4.1/§4.5, which apply identically to `socket.io-client`
 * on React Native:
 *  - `auth` is a CALLBACK, not a static object — re-evaluated on every
 *    reconnect attempt, so it always sends the CURRENT access token (a
 *    static object would pin the token from first connect forever, which
 *    breaks every reconnect after the access token's ~15min expiry).
 *  - `transports` is deliberately NOT restricted to `['websocket']` —
 *    CONTRACT.md §4.5 documents dropped packets when that's forced.
 */

let socket: AppSocket | null = null;

function createSocket(): AppSocket {
  const instance: AppSocket = io(SOCKET_URL, {
    auth: (cb) => cb({ token: tokenManager.getAccessToken() }),
    autoConnect: false,
  });

  instance.on('connect_error', () => {
    // Most likely cause: expired access token (CONTRACT.md §4.1). Kick off a
    // refresh through the same shared single-flight path HTTP uses, then let
    // socket.io's own reconnection schedule retry on its own — we do NOT
    // call connect() again ourselves (double-connect race risk).
    void tokenManager.refreshTokens().catch(() => {
      // If refresh itself ultimately failed, tokenManager already ran the
      // hard-logout flow (cleared SecureStore, notified onSessionExpired
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

/** Used on logout — drops the singleton so a subsequent login builds a fresh socket with the new session's token. */
export function destroySocket(): void {
  socket?.disconnect();
  socket = null;
}
