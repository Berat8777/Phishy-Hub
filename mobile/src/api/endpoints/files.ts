import { http } from '../http';
import * as tokenManager from '../tokenManager';
import { ApiError, NetworkError } from '../errors';
import { API_BASE_URL } from '../../config/env';
import type { AttachableType, FileDTO, FileDownloadResponse } from '../types';

/** Shape RN's `ImagePicker`/`Camera` results are normalized to before upload — see src/utils/attachments.ts. */
export interface PickedAsset {
  uri: string;
  name: string;
  mimeType: string;
}

/**
 * `POST /files` (CONTRACT.md §3.7, field name `file`, multipart/form-data).
 * React Native's FormData accepts `{ uri, name, type }` objects in place of
 * a browser `File`/`Blob` — RN's networking layer streams directly from the
 * URI (works for both `file://` picker results and camera captures).
 * Deliberately over `fetch`, not XHR-with-progress like web's
 * `uploadFileWithProgress` — chat image/file attachments in this app are
 * small enough (MAX_UPLOAD_SIZE_MB, CONTRACT.md §7) that a bare spinner is
 * an acceptable simplification for this pass.
 */
export async function uploadFile(
  asset: PickedAsset,
  attach?: { attachableType: AttachableType; attachableId: string },
): Promise<FileDTO> {
  const formData = new FormData();
  // @ts-expect-error RN's FormData typing wants a DOM Blob; RN itself accepts {uri,name,type}.
  formData.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType });
  if (attach) {
    formData.append('attachableType', attach.attachableType);
    formData.append('attachableId', attach.attachableId);
  }

  const token = tokenManager.getAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/files`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      // Deliberately no Content-Type — RN sets the multipart boundary itself.
      body: formData,
    });
  } catch {
    throw new NetworkError('Upload failed');
  }

  const text = await response.text();
  const json = text
    ? (JSON.parse(text) as { success: true; data: FileDTO } | { success: false; error: { code: string; message: string } })
    : null;

  if (!response.ok || !json || json.success === false) {
    if (json && json.success === false) {
      throw new ApiError(response.status, json.error.code, json.error.message);
    }
    throw new ApiError(response.status, 'INTERNAL_ERROR', `Upload failed with status ${response.status}`);
  }

  return json.data;
}

export function getDownloadUrl(fileId: string, variant?: 'thumbnail'): Promise<FileDownloadResponse> {
  return http.get<FileDownloadResponse>(`/files/${fileId}`, { query: { variant } }).then((r) => r.data);
}
