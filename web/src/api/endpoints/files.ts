import { http } from '../http';
import * as tokenManager from '../tokenManager';
import { ApiError, NetworkError } from '../errors';
import type { AttachableType, FileDTO, FileDownloadResponse } from '../types';

export function uploadFile(
  file: File,
  attach?: { attachableType: AttachableType; attachableId: string },
): Promise<FileDTO> {
  const formData = new FormData();
  formData.append('file', file);
  if (attach) {
    formData.append('attachableType', attach.attachableType);
    formData.append('attachableId', attach.attachableId);
  }
  return http.post<FileDTO>('/files', formData).then((r) => r.data);
}

/**
 * Same upload as `uploadFile`, but over XHR instead of `fetch` so upload
 * progress events are available (fetch's request body has no progress
 * signal in this codebase's target browsers) — used by AttachmentTray.vue
 * to show real per-file progress instead of a bare spinner. Deliberately
 * separate from `http.ts`: no 401 -> refresh -> retry handling here (an
 * upload is short-lived relative to the 15min access token lifetime; on a
 * 401 the caller's retry affordance re-reads the (possibly by-then-fresh)
 * token from tokenManager anyway).
 */
export function uploadFileWithProgress(
  file: File,
  onProgress: (fraction: number) => void,
  attach?: { attachableType: AttachableType; attachableId: string },
): { promise: Promise<FileDTO>; abort: () => void } {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<FileDTO>((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    if (attach) {
      formData.append('attachableType', attach.attachableType);
      formData.append('attachableId', attach.attachableId);
    }

    const baseUrl = import.meta.env.VITE_API_BASE_URL as string;
    xhr.open('POST', `${baseUrl}/api/v1/files`);
    const token = tokenManager.getAccessToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });

    xhr.addEventListener('load', () => {
      let json: { success: true; data: FileDTO } | { success: false; error: { code: string; message: string } } | null;
      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        json = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && json?.success) {
        resolve(json.data);
      } else if (json && json.success === false) {
        reject(new ApiError(xhr.status, json.error.code, json.error.message));
      } else {
        reject(new ApiError(xhr.status, 'INTERNAL_ERROR', `Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new NetworkError('Upload failed')));
    xhr.addEventListener('abort', () => reject(new NetworkError('Upload aborted')));

    xhr.send(formData);
  });

  return { promise, abort: () => xhr.abort() };
}

export function getDownloadUrl(fileId: string, variant?: 'thumbnail'): Promise<FileDownloadResponse> {
  return http.get<FileDownloadResponse>(`/files/${fileId}`, { query: { variant } }).then((r) => r.data);
}

export function attachFile(
  fileId: string,
  input: { attachableType: AttachableType; attachableId: string },
): Promise<unknown> {
  return http.post(`/files/${fileId}/attach`, input).then((r) => r.data);
}

export function deleteFile(fileId: string): Promise<void> {
  return http.delete(`/files/${fileId}`).then(() => undefined);
}
