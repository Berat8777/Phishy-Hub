import { ref } from 'vue';
import { defineStore } from 'pinia';
import * as filesApi from '../api/endpoints/files';
import type { FileDTO } from '../api/types';

interface CachedUrl {
  url: string;
  /** Epoch ms — CONTRACT.md §3.7/§7: presigned GET URLs expire (`SIGNED_URL_EXPIRY_SECONDS`, default 900s). */
  expiresAt: number;
}

/** Refetch this many ms before actual expiry so an in-flight `<img>` render never races a URL going stale mid-request. */
const EXPIRY_SAFETY_BUFFER_MS = 5_000;

function cacheKey(fileId: string, variant?: 'thumbnail'): string {
  return variant ? `${fileId}:${variant}` : fileId;
}

export const useFilesStore = defineStore('files', () => {
  const byId = ref<Map<string, FileDTO>>(new Map());
  const urlByKey = ref<Map<string, CachedUrl>>(new Map());
  const urlFetchInflight = new Map<string, Promise<string>>();

  function upsert(file: FileDTO): void {
    byId.value.set(file.id, file);
  }

  function getFile(fileId: string): FileDTO | undefined {
    return byId.value.get(fileId);
  }

  /**
   * Returns a live presigned URL for a file, fetching/refetching as needed:
   * a cache hit only counts if it hasn't passed (or is about to pass) its
   * `expiresAt`. Callers that hit a broken `<img>` load (URL expired mid-
   * session) should call `refreshUrl` instead to force a bypass of a
   * not-yet-expired-by-the-clock-but-apparently-already-dead cache entry.
   */
  async function getUrl(fileId: string, variant?: 'thumbnail'): Promise<string> {
    const key = cacheKey(fileId, variant);
    const cached = urlByKey.value.get(key);
    if (cached && cached.expiresAt - EXPIRY_SAFETY_BUFFER_MS > Date.now()) {
      return cached.url;
    }

    const inflight = urlFetchInflight.get(key);
    if (inflight) return inflight;

    const promise = filesApi
      .getDownloadUrl(fileId, variant)
      .then((res) => {
        urlByKey.value.set(key, { url: res.url, expiresAt: Date.now() + res.expiresInSeconds * 1000 });
        upsert(res.file);
        return res.url;
      })
      .finally(() => {
        urlFetchInflight.delete(key);
      });
    urlFetchInflight.set(key, promise);
    return promise;
  }

  /** Forces a fresh presigned URL, bypassing any cached (even if not-yet-"expired") entry — used on `<img>`/`<a>` load error. */
  function refreshUrl(fileId: string, variant?: 'thumbnail'): Promise<string> {
    urlByKey.value.delete(cacheKey(fileId, variant));
    return getUrl(fileId, variant);
  }

  function reset(): void {
    byId.value = new Map();
    urlByKey.value = new Map();
    urlFetchInflight.clear();
  }

  return { byId, upsert, getFile, getUrl, refreshUrl, reset };
});
