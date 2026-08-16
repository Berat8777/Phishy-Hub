/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SOCKET_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Web Locks API (`navigator.locks`) — used by api/tokenManager.ts for
 * cross-tab refresh-token single-flight. Not yet part of lib.dom.d.ts in
 * every TS version this repo might run, so it's shimmed minimally here.
 * Feature-detected at runtime (`hasLocksApi()`) — this type doesn't claim
 * every browser has it, it just describes the shape when present.
 */
interface LockManager {
  request<T>(name: string, callback: (lock: unknown) => Promise<T> | T): Promise<T>;
}

interface Navigator {
  readonly locks?: LockManager;
}
