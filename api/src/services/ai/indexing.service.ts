import crypto from 'crypto';
import fs from 'fs/promises';
import { QueryTypes } from 'sequelize';
import { sequelize, AiIndexRun, AiDocument, AiChunk } from '../../models';
import { ConflictError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { walkRepoFiles } from './fileWalker';
import { chunkFile, buildEmbeddingInput, detectLanguage, type Chunk } from './chunker';
import { embedTexts } from './embedding.service';
import type { AiIndexRunTrigger } from '../../utils/constants';

export interface IndexProgress {
  runId: string;
  status: 'running' | 'succeeded' | 'failed';
  filesProcessed: number;
  totalFiles: number;
  chunkCount: number;
}

export type IndexProgressCallback = (progress: IndexProgress) => void;

/**
 * In-process guard against overlapping runs, in addition to the DB check
 * below — the DB check alone has a race window between "check" and
 * "insert", closed by this synchronous flag (a single Node process handles
 * all requests here, so this is sufficient; see architecture note on
 * presence.handler.ts's similarly single-process assumption).
 */
let runningInProcess = false;

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

interface FileRecord {
  absolutePath: string;
  relativePath: string;
  content: string;
  contentHash: string;
  language: string;
  lineCount: number;
  chunks: Chunk[];
}

/**
 * Guard + row-creation half of an index run — fast (one DB round trip),
 * throws `ConflictError` (409) if a run is already in progress. Split out
 * from `executeIndexRun()` below so `POST /ai/index` can await just this
 * part, return the created (status: 'running') row immediately, and let the
 * actual walk/chunk/embed work continue in the background — see
 * controllers/ai.controller.ts.
 */
export async function beginIndexRun(input: {
  trigger: AiIndexRunTrigger;
  startedById?: string | null;
}): Promise<InstanceType<typeof AiIndexRun>> {
  if (runningInProcess) {
    throw new ConflictError('An AI index run is already in progress');
  }
  const alreadyRunning = await AiIndexRun.findOne({ where: { status: 'running' } });
  if (alreadyRunning) {
    throw new ConflictError('An AI index run is already in progress');
  }

  runningInProcess = true;
  return AiIndexRun.create({
    status: 'running',
    trigger: input.trigger,
    startedById: input.startedById ?? null,
    isActive: false,
    startedAt: new Date(),
  });
}

/** The long-running half — walk/chunk/embed/activate. On any throw: marks `run` failed and leaves the previous active run untouched. */
export async function executeIndexRun(
  run: InstanceType<typeof AiIndexRun>,
  onProgress?: IndexProgressCallback,
): Promise<InstanceType<typeof AiIndexRun>> {
  try {
    await doIndex(run, onProgress);
    return run;
  } catch (err) {
    logger.error({ err, runId: run.id }, 'ai indexing.service: run failed');
    await run.update({
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
      finishedAt: new Date(),
    });
    onProgress?.({ runId: run.id, status: 'failed', filesProcessed: 0, totalFiles: 0, chunkCount: run.chunkCount ?? 0 });
    return run;
  } finally {
    runningInProcess = false;
  }
}

/** Convenience wrapper that awaits the full run end-to-end — used by `npm run ai:index` (src/scripts/aiIndex.ts), which wants a single blocking call. */
export async function runIndex(input: {
  trigger: AiIndexRunTrigger;
  startedById?: string | null;
  onProgress?: IndexProgressCallback;
}): Promise<InstanceType<typeof AiIndexRun>> {
  const run = await beginIndexRun(input);
  return executeIndexRun(run, input.onProgress);
}

async function readFileRecords(onFileRead?: () => void): Promise<FileRecord[]> {
  const walked = await walkRepoFiles();
  const records: FileRecord[] = [];

  for (const file of walked) {
    let buffer: Buffer;
    try {
      buffer = await fs.readFile(file.absolutePath);
    } catch (err) {
      logger.warn({ err, path: file.relativePath }, 'ai indexing.service: failed to read file, skipping');
      continue;
    }
    const content = buffer.toString('utf8');
    const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const language = detectLanguage(file.relativePath);
    const chunks = chunkFile(content, language);

    records.push({
      absolutePath: file.absolutePath,
      relativePath: file.relativePath,
      content,
      contentHash,
      language,
      lineCount: content.split(/\r\n|\r|\n/).length,
      chunks,
    });
    onFileRead?.();
  }

  return records;
}

interface OldChunkRow {
  id: string;
  chunk_index: number;
  path: string;
}

interface OldDocRow {
  id: string;
  path: string;
  content_hash: string;
}

async function doIndex(run: InstanceType<typeof AiIndexRun>, onProgress?: IndexProgressCallback): Promise<void> {
  const previousActiveRun = await AiIndexRun.findOne({ where: { isActive: true } });

  let oldHashByPath = new Map<string, string>();
  let oldChunkIdByPathIndex = new Map<string, string>();
  if (previousActiveRun) {
    const oldDocs = await sequelize.query<OldDocRow>(
      'SELECT id, path, content_hash FROM ai_documents WHERE index_run_id = :runId',
      { replacements: { runId: previousActiveRun.id }, type: QueryTypes.SELECT },
    );
    oldHashByPath = new Map(oldDocs.map((d) => [d.path, d.content_hash]));

    const oldChunks = await sequelize.query<OldChunkRow>(
      `SELECT ac.id, ac.chunk_index, ad.path
       FROM ai_chunks ac
       JOIN ai_documents ad ON ad.id = ac.document_id
       WHERE ac.index_run_id = :runId AND ac.embedding IS NOT NULL`,
      { replacements: { runId: previousActiveRun.id }, type: QueryTypes.SELECT },
    );
    oldChunkIdByPathIndex = new Map(oldChunks.map((c) => [`${c.path}#${c.chunk_index}`, c.id]));
  }

  let filesProcessed = 0;
  const totalFilesEstimate = { value: 0 };
  const records = await readFileRecords(() => {
    filesProcessed += 1;
    onProgress?.({
      runId: run.id,
      status: 'running',
      filesProcessed,
      totalFiles: totalFilesEstimate.value,
      chunkCount: 0,
    });
  });
  totalFilesEstimate.value = records.length;

  let totalChunkCount = 0;
  const toEmbed: { chunkId: string; text: string }[] = [];
  const toReuse: { chunkId: string; oldChunkId: string }[] = [];

  for (const record of records) {
    const document = await AiDocument.create({
      indexRunId: run.id,
      path: record.relativePath,
      language: record.language,
      sizeBytes: Buffer.byteLength(record.content, 'utf8'),
      lineCount: record.lineCount,
      contentHash: record.contentHash,
      chunkCount: record.chunks.length,
    });

    if (record.chunks.length === 0) continue;

    const createdChunks = await AiChunk.bulkCreate(
      record.chunks.map((chunk) => ({
        indexRunId: run.id,
        documentId: document.id,
        chunkIndex: chunk.chunkIndex,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        heading: chunk.heading,
        content: chunk.content,
        charCount: chunk.content.length,
      })),
      { returning: true },
    );

    const contentUnchanged = oldHashByPath.get(record.relativePath) === record.contentHash;

    for (let i = 0; i < createdChunks.length; i++) {
      const chunk = record.chunks[i];
      const created = createdChunks[i];
      totalChunkCount += 1;

      const oldChunkId = contentUnchanged
        ? oldChunkIdByPathIndex.get(`${record.relativePath}#${chunk.chunkIndex}`)
        : undefined;

      if (oldChunkId) {
        toReuse.push({ chunkId: created.id, oldChunkId });
      } else {
        toEmbed.push({ chunkId: created.id, text: buildEmbeddingInput(record.relativePath, chunk) });
      }
    }

    onProgress?.({
      runId: run.id,
      status: 'running',
      filesProcessed,
      totalFiles: totalFilesEstimate.value,
      chunkCount: totalChunkCount,
    });
  }

  // Copy reused embeddings directly from the previous run's still-present
  // rows (old runs are only deleted after this run succeeds — see cleanup
  // below), avoiding a round-trip through JS for the vector value.
  for (const { chunkId, oldChunkId } of toReuse) {
    await sequelize.query('UPDATE ai_chunks SET embedding = (SELECT embedding FROM ai_chunks WHERE id = :oldChunkId) WHERE id = :chunkId', {
      replacements: { chunkId, oldChunkId },
    });
  }

  let embeddedChunkCount = toReuse.length;
  let embeddingProvider = 'none';
  if (toEmbed.length > 0) {
    const vectors = await embedTexts(toEmbed.map((t) => t.text));
    let anyEmbedded = false;
    for (let i = 0; i < toEmbed.length; i++) {
      const vector = vectors[i];
      if (!vector) continue;
      anyEmbedded = true;
      embeddedChunkCount += 1;
      await sequelize.query('UPDATE ai_chunks SET embedding = :vec::vector WHERE id = :chunkId', {
        replacements: { vec: toVectorLiteral(vector), chunkId: toEmbed[i].chunkId },
      });
    }
    if (anyEmbedded) embeddingProvider = 'local:transformers';
  } else if (toReuse.length > 0) {
    embeddingProvider = 'local:transformers';
  }

  await sequelize.transaction(async (transaction) => {
    if (previousActiveRun) {
      await previousActiveRun.update({ isActive: false }, { transaction });
    }
    await run.update(
      {
        status: 'succeeded',
        isActive: true,
        embeddingProvider,
        fileCount: records.length,
        chunkCount: totalChunkCount,
        embeddedChunkCount,
        finishedAt: new Date(),
      },
      { transaction },
    );
  });

  onProgress?.({
    runId: run.id,
    status: 'succeeded',
    filesProcessed,
    totalFiles: totalFilesEstimate.value,
    chunkCount: totalChunkCount,
  });

  await cleanupOldRuns();
}

/** Keeps only the 2 most recent `ai_index_runs` rows — older ones cascade-delete their documents/chunks. */
async function cleanupOldRuns(): Promise<void> {
  try {
    const runs = await AiIndexRun.findAll({ order: [['createdAt', 'DESC']], attributes: ['id'] });
    const toDelete = runs.slice(2);
    if (toDelete.length === 0) return;
    await AiIndexRun.destroy({ where: { id: toDelete.map((r) => r.id) } });
    logger.info({ deletedCount: toDelete.length }, 'ai indexing.service: cleaned up old index runs');
  } catch (err) {
    logger.warn({ err }, 'ai indexing.service: failed to clean up old index runs — leaving them in place');
  }
}
