import { QueryTypes } from 'sequelize';
import { sequelize, AiIndexRun } from '../../models';
import { env } from '../../config/env';
import { embedTexts } from './embedding.service';

export interface RetrievedBlock {
  documentId: string;
  path: string;
  startLine: number;
  endLine: number;
  heading: string | null;
  content: string;
  score: number;
}

interface ChunkRow {
  id: string;
  document_id: string;
  path: string;
  start_line: number;
  end_line: number;
  heading: string | null;
  content: string;
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

export async function getActiveIndexRun(): Promise<InstanceType<typeof AiIndexRun> | null> {
  return AiIndexRun.findOne({ where: { isActive: true } });
}

async function runVectorSearch(indexRunId: string, vector: number[]): Promise<ChunkRow[]> {
  return sequelize.query<ChunkRow>(
    `
    SELECT ac.id, ac.document_id, ad.path, ac.start_line, ac.end_line, ac.heading, ac.content
    FROM ai_chunks ac
    JOIN ai_documents ad ON ad.id = ac.document_id
    WHERE ac.index_run_id = :indexRunId AND ac.embedding IS NOT NULL
    ORDER BY ac.embedding <=> :vec::vector
    LIMIT 30
    `,
    { replacements: { indexRunId, vec: toVectorLiteral(vector) }, type: QueryTypes.SELECT },
  );
}

async function runLexicalSearch(indexRunId: string, question: string): Promise<ChunkRow[]> {
  return sequelize.query<ChunkRow>(
    `
    SELECT ac.id, ac.document_id, ad.path, ac.start_line, ac.end_line, ac.heading, ac.content
    FROM ai_chunks ac
    JOIN ai_documents ad ON ad.id = ac.document_id
    WHERE ac.index_run_id = :indexRunId AND ac.tsv @@ websearch_to_tsquery('simple', :question)
    ORDER BY ts_rank_cd(ac.tsv, websearch_to_tsquery('simple', :question)) DESC
    LIMIT 30
    `,
    { replacements: { indexRunId, question }, type: QueryTypes.SELECT },
  );
}

/** Reciprocal Rank Fusion: score = sum(1 / (60 + rank)) across every ranked list a chunk appears in. */
function fuse(lists: ChunkRow[][]): { row: ChunkRow; score: number }[] {
  const scoreById = new Map<string, number>();
  const rowById = new Map<string, ChunkRow>();
  for (const rows of lists) {
    rows.forEach((row, idx) => {
      const rank = idx + 1;
      scoreById.set(row.id, (scoreById.get(row.id) ?? 0) + 1 / (60 + rank));
      if (!rowById.has(row.id)) rowById.set(row.id, row);
    });
  }
  return Array.from(scoreById.entries())
    .map(([id, score]) => ({ row: rowById.get(id)!, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Merges adjacent/overlapping chunks from the same document (after RRF
 * ranking narrows to the top K) into single contiguous blocks, so the
 * generation prompt doesn't repeat overlap lines or show artificially
 * fragmented context. Input must already be sorted by (documentId, startLine).
 */
function mergeAdjacent(blocks: RetrievedBlock[]): RetrievedBlock[] {
  const merged: RetrievedBlock[] = [];
  for (const block of blocks) {
    const last = merged[merged.length - 1];
    if (last && last.documentId === block.documentId && block.startLine <= last.endLine + 1) {
      if (block.endLine > last.endLine) {
        const overlapLines = last.endLine - block.startLine + 1;
        const blockLines = block.content.split('\n');
        const newLines = overlapLines > 0 ? blockLines.slice(overlapLines) : blockLines;
        last.content = [last.content, ...newLines].join('\n');
        last.endLine = block.endLine;
      }
      last.score = Math.max(last.score, block.score);
      if (!last.heading && block.heading) last.heading = block.heading;
    } else {
      merged.push({ ...block });
    }
  }
  return merged;
}

/** Drops the lowest-scoring blocks until total content fits `AI_CONTEXT_MAX_CHARS`. */
function budget(blocks: RetrievedBlock[]): RetrievedBlock[] {
  const sorted = [...blocks].sort((a, b) => b.score - a.score);
  const kept: RetrievedBlock[] = [];
  let total = 0;
  for (const block of sorted) {
    if (total + block.content.length > env.ai.contextMaxChars && kept.length > 0) continue;
    kept.push(block);
    total += block.content.length;
  }
  return kept;
}

/**
 * Full retrieval pipeline against the currently active index run: vector +
 * lexical search in parallel, RRF fusion, adjacent-chunk merge, char budget.
 * Returns `[]` (not an error) when there's no active run — callers decide
 * whether that's a hard failure (aiQuery.service.ts::AiNotIndexedError) or
 * just an empty result (POST /ai/search).
 */
export async function retrieveContext(question: string, topKOverride?: number): Promise<RetrievedBlock[]> {
  const activeRun = await getActiveIndexRun();
  if (!activeRun) return [];

  const topK = topKOverride ?? env.ai.retrievalTopK;
  const hasEmbeddings = (activeRun.embeddedChunkCount ?? 0) > 0;

  const searches: Promise<ChunkRow[]>[] = [runLexicalSearch(activeRun.id, question)];
  if (hasEmbeddings) {
    const [vector] = await embedTexts([question]);
    if (vector) searches.push(runVectorSearch(activeRun.id, vector));
  }

  const results = await Promise.all(searches);
  const fused = fuse(results).slice(0, topK);

  const asBlocks: RetrievedBlock[] = fused
    .map(({ row, score }) => ({
      documentId: row.document_id,
      path: row.path,
      startLine: row.start_line,
      endLine: row.end_line,
      heading: row.heading,
      content: row.content,
      score,
    }))
    .sort((a, b) => (a.documentId === b.documentId ? a.startLine - b.startLine : a.documentId.localeCompare(b.documentId)));

  const merged = mergeAdjacent(asBlocks);
  return budget(merged);
}
