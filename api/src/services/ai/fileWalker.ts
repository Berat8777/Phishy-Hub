import fs, { Dirent, Stats } from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * Files eligible for indexing (services/ai/indexing.service.ts). Extensions
 * only — matching is case-insensitive on the extension.
 */
export const ALLOWED_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.vue',
  '.md',
  '.yml',
  '.yaml',
  '.sql',
  '.css',
  '.json',
  '.html',
];

/** Any directory whose NAME (not full path) matches one of these is never descended into. */
const DENIED_DIR_SEGMENTS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.vite',
  '.turbo',
  '.cache',
  '.next',
  '.expo',
  'release',
  'android',
  'ios',
  '.idea',
  '.vscode',
]);

const DENIED_FILE_EXACT = new Set(['package-lock.json']);
const DENIED_FILE_SUFFIXES = ['.lock', '.map', '.log'];

function isMinFile(name: string): boolean {
  return /\.min\.[^.]+$/i.test(name);
}

/**
 * Hard, non-configurable security rule (never overridable via env/allow-list):
 * secrets/credentials are never indexed, full stop. `.env.example` is the one
 * documented exception (it's meant to be public/committed).
 */
export function isSecuritySensitiveFile(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower === '.env.example') return false;
  if (lower === '.env' || lower.startsWith('.env.')) return true;
  if (/\.pem$/i.test(name)) return true;
  if (/\.key$/i.test(name)) return true;
  if (/\.p12$/i.test(name)) return true;
  if (/^id_rsa/i.test(name)) return true;
  return false;
}

export interface WalkedFile {
  /** Real, resolved absolute path on disk. */
  absolutePath: string;
  /** Repo-relative path with POSIX ('/') separators, regardless of host OS. */
  relativePath: string;
  sizeBytes: number;
}

/** NUL byte in the first 8KB is treated as "binary" — cheap, standard heuristic (git uses the same one). */
async function isBinaryFile(filePath: string): Promise<boolean> {
  const handle = await fsp.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(8192);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) return true;
    }
    return false;
  } finally {
    await handle.close();
  }
}

async function walkDir(dir: string, resolvedRoot: string, results: WalkedFile[]): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (err) {
    logger.warn({ err, dir }, 'ai fileWalker: failed to read directory, skipping');
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (DENIED_DIR_SEGMENTS.has(entry.name)) continue;
      await walkDir(entryPath, resolvedRoot, results);
      continue;
    }

    // Symlinked directories are deliberately never followed (dirent.isDirectory()
    // is false for a symlink-to-directory) — keeps the traversal/escape guard
    // simple. Symlinked *files* fall through to the checks below, where the
    // realpath resolution + root-containment check handles them safely.
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;

    if (isSecuritySensitiveFile(entry.name)) continue;
    if (DENIED_FILE_EXACT.has(entry.name)) continue;
    if (DENIED_FILE_SUFFIXES.some((suffix) => entry.name.toLowerCase().endsWith(suffix))) continue;
    if (isMinFile(entry.name)) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) continue;

    let realPath: string;
    try {
      realPath = await fsp.realpath(entryPath);
    } catch {
      continue; // broken symlink etc.
    }

    // Traversal/symlink-escape guard: the resolved real path must stay
    // inside the resolved root.
    const relative = path.relative(resolvedRoot, realPath);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) continue;

    let stat: Stats;
    try {
      stat = await fsp.stat(realPath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    if (stat.size === 0 || stat.size > env.ai.maxFileBytes) continue;

    if (await isBinaryFile(realPath)) continue;

    results.push({
      absolutePath: realPath,
      relativePath: relative.split(path.sep).join('/'),
      sizeBytes: stat.size,
    });
  }
}

/**
 * Walks `root` (default `env.ai.indexRoot`, i.e. the repo root) and returns
 * every file eligible for AI indexing — see services/ai/indexing.service.ts.
 */
export async function walkRepoFiles(root: string = env.ai.indexRoot): Promise<WalkedFile[]> {
  if (!fs.existsSync(root)) {
    logger.warn({ root }, 'ai fileWalker: AI_INDEX_ROOT does not exist, returning empty file list');
    return [];
  }
  const resolvedRoot = await fsp.realpath(root);
  const results: WalkedFile[] = [];
  await walkDir(resolvedRoot, resolvedRoot, results);
  return results;
}
