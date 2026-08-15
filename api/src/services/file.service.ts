import { randomUUID } from 'crypto';
import { File, FileAttachment } from '../models';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { assertCanAccessFile, assertCanAttachFile } from './authz.service';
import { buildStorageKey, buildThumbnailKey, deleteObject, getPresignedDownloadUrl, putObject } from './storage.service';
import { generateThumbnail, isImageMimeType } from './thumbnail.service';
import type { AttachableType, UserRole } from '../utils/constants';

export interface FileDTO {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  hasThumbnail: boolean;
  uploadedById: string;
  createdAt: string;
}

export function toFileDTO(file: InstanceType<typeof File>): FileDTO {
  const json = file.toJSON();
  return {
    id: json.id,
    originalName: json.originalName,
    mimeType: json.mimeType,
    sizeBytes: Number(json.sizeBytes),
    status: json.status,
    hasThumbnail: Boolean(json.thumbnailKey),
    uploadedById: json.uploadedById,
    createdAt: new Date(json.createdAt).toISOString(),
  };
}

/**
 * Upload proxy flow (architecture doc §5): multer hands us a memory buffer
 * -> magic-byte sniff -> MinIO putObject -> synchronous thumbnail for
 * images -> File row. `file-type` is ESM-only from v17 onward, so it's
 * loaded via dynamic import() from this CommonJS module.
 */
export async function uploadFile(input: {
  uploaderId: string;
  buffer: Buffer;
  originalName: string;
  declaredMimeType: string;
}): Promise<InstanceType<typeof File>> {
  if (!input.buffer || input.buffer.length === 0) {
    throw new BadRequestError('Uploaded file is empty');
  }

  const { fileTypeFromBuffer } = await import('file-type');
  const detected = await fileTypeFromBuffer(input.buffer);
  // file-type only recognizes binary signatures — text-ish formats (plain
  // text, csv, json) fall back to the client-declared Content-Type.
  const mimeType = detected?.mime ?? input.declaredMimeType ?? 'application/octet-stream';

  const fileId = randomUUID();
  const storageKey = buildStorageKey(input.uploaderId, fileId, input.originalName);
  await putObject(storageKey, input.buffer, mimeType);

  let thumbnailKey: string | null = null;
  if (isImageMimeType(mimeType)) {
    try {
      const thumbnailBuffer = await generateThumbnail(input.buffer);
      thumbnailKey = buildThumbnailKey(input.uploaderId, fileId);
      await putObject(thumbnailKey, thumbnailBuffer, 'image/webp');
    } catch (err) {
      logger.warn({ err, fileId }, 'thumbnail generation failed — continuing without one');
      thumbnailKey = null;
    }
  }

  return File.create({
    id: fileId,
    storageKey,
    originalName: input.originalName,
    mimeType,
    sizeBytes: input.buffer.length,
    uploadedById: input.uploaderId,
    thumbnailKey,
    status: 'ready',
  });
}

export async function attachFile(
  userId: string,
  role: UserRole,
  fileId: string,
  attachableType: AttachableType,
  attachableId: string,
): Promise<InstanceType<typeof FileAttachment>> {
  const file = await File.findByPk(fileId);
  if (!file) throw new NotFoundError('File not found');
  await assertCanAttachFile(userId, role, attachableType, attachableId);
  return FileAttachment.create({ fileId, attachableType, attachableId });
}

export async function getDownloadUrl(
  userId: string,
  role: UserRole,
  fileId: string,
): Promise<{ url: string; expiresInSeconds: number; file: FileDTO }> {
  const file = await File.findByPk(fileId);
  if (!file) throw new NotFoundError('File not found');
  await assertCanAccessFile(userId, role, file);

  const url = await getPresignedDownloadUrl(file.storageKey, file.originalName);
  return { url, expiresInSeconds: env.signedUrlExpirySeconds, file: toFileDTO(file) };
}

export async function deleteFile(userId: string, role: UserRole, fileId: string): Promise<void> {
  const file = await File.findByPk(fileId);
  if (!file) throw new NotFoundError('File not found');
  if (file.uploadedById !== userId && role !== 'admin') {
    throw new ForbiddenError('Only the uploader or an admin can delete this file');
  }

  await deleteObject(file.storageKey);
  if (file.thumbnailKey) await deleteObject(file.thumbnailKey);
  // FileAttachment rows cascade-delete at the DB level (files.id -> file_attachments.file_id ON DELETE CASCADE).
  await file.destroy();
}
