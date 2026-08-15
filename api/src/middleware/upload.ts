import multer from 'multer';
import { env } from '../config/env';

/**
 * Memory storage — the buffer never touches disk. We forward it straight to
 * MinIO (architecture doc §1.2: API proxies the upload, clients never talk
 * to MinIO directly).
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadSizeMb * 1024 * 1024 },
});
