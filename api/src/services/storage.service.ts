import { minioInternalClient, minioPublicClient } from '../config/minio';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * All real object I/O goes through `minioInternalClient` (the endpoint this
 * server process can actually reach). Presigned URLs are signed with
 * `minioPublicClient` so the URL host is one an external client can reach
 * too — see architecture doc §5 and config/minio.ts for why these are two
 * separate client instances.
 */

export function buildStorageKey(userId: string, fileId: string, originalName: string): string {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `uploads/${userId}/${fileId}/${safeName}`;
}

export function buildThumbnailKey(userId: string, fileId: string): string {
  return `uploads/${userId}/${fileId}/thumbnail.webp`;
}

export async function putObject(key: string, buffer: Buffer, mimeType: string): Promise<void> {
  await minioInternalClient.putObject(env.minio.bucket, key, buffer, buffer.length, {
    'Content-Type': mimeType,
  });
}

export async function getPresignedDownloadUrl(key: string, downloadFilename?: string): Promise<string> {
  const reqParams = downloadFilename
    ? { 'response-content-disposition': `attachment; filename="${encodeURIComponent(downloadFilename)}"` }
    : undefined;
  return minioPublicClient.presignedGetObject(env.minio.bucket, key, env.signedUrlExpirySeconds, reqParams);
}

/**
 * Best-effort delete: a failure here shouldn't block the caller from
 * finishing its own cleanup (e.g. deleting the File DB row), but silently
 * swallowing it would leave orphaned objects in MinIO with no trace of why
 * — so it's logged even though it isn't re-thrown.
 */
export async function deleteObject(key: string): Promise<void> {
  await minioInternalClient.removeObject(env.minio.bucket, key).catch((err: unknown) => {
    logger.error({ err, key, bucket: env.minio.bucket }, 'failed to delete object from MinIO');
  });
}
