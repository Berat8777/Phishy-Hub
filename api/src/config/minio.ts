import { Client } from 'minio';
import { env } from './env';
import { logger } from '../utils/logger';

/**
 * Two separate MinIO client instances — see architecture doc §5 "Kritik
 * risk". The MinIO JS SDK bakes `endPoint`/`port` straight into any
 * presigned URL it signs, so the client used to *generate* a presigned URL
 * must be configured with the endpoint that the requester (a browser /
 * Electron / Expo client on another machine) can actually reach.
 *
 * - `minioInternalClient`: used for all real object operations issued from
 *   this server process (putObject, bucket checks). Talks to MinIO the way
 *   the API itself sees it (localhost, since both run on the same host).
 * - `minioPublicClient`: used ONLY to sign presigned GET URLs. Never used
 *   to actually perform I/O — MINIO_PUBLIC_ENDPOINT may not even be
 *   reachable from this process (e.g. it's a LAN IP bound to this same
 *   machine, or a hostname only resolvable by other machines on demo day).
 */
export const minioInternalClient = new Client({
  endPoint: env.minio.internalEndpoint,
  port: env.minio.internalPort,
  useSSL: env.minio.useSSL,
  accessKey: env.minio.accessKey,
  secretKey: env.minio.secretKey,
});

export const minioPublicClient = new Client({
  endPoint: env.minio.publicEndpoint,
  port: env.minio.publicPort,
  useSSL: env.minio.useSSL,
  accessKey: env.minio.accessKey,
  secretKey: env.minio.secretKey,
});

/** Idempotent bucket check/create, called once at server startup. */
export async function ensureBucket(): Promise<void> {
  const exists = await minioInternalClient.bucketExists(env.minio.bucket).catch(() => false);
  if (!exists) {
    await minioInternalClient.makeBucket(env.minio.bucket);
    logger.info({ bucket: env.minio.bucket }, 'MinIO bucket created');
  } else {
    logger.info({ bucket: env.minio.bucket }, 'MinIO bucket already exists');
  }
}
