import path from 'path';
import { env } from '../../config/env';

/** Best-effort language tag stored on `ai_documents.language` and used to pick a boundary regex below. */
export function detectLanguage(relativePath: string): string {
  const ext = path.extname(relativePath).toLowerCase();
  switch (ext) {
    case '.ts':
      return 'ts';
    case '.tsx':
      return 'tsx';
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'js';
    case '.vue':
      return 'vue';
    case '.md':
      return 'md';
    case '.yml':
    case '.yaml':
      return 'yaml';
    case '.sql':
      return 'sql';
    case '.css':
      return 'css';
    case '.json':
      return 'json';
    case '.html':
      return 'html';
    default:
      return ext.replace(/^\./, '') || 'text';
  }
}

const CODE_BOUNDARY_REGEX = /^\s*(export\s+)?(default\s+)?(async\s+)?(function\b|class\b|interface\b|type\b)/;
const MARKDOWN_BOUNDARY_REGEX = /^#{1,6}\s+/;
/** sql/yaml/css have no natural "heading" keyword — a blank line followed by content is treated as a section boundary instead. */
const BLANK_LINE_BOUNDARY_LANGUAGES = new Set(['sql', 'yaml', 'css']);

function boundaryRegexForLanguage(language: string): RegExp | null {
  switch (language) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'vue':
      return CODE_BOUNDARY_REGEX;
    case 'md':
      return MARKDOWN_BOUNDARY_REGEX;
    default:
      return null;
  }
}

export interface Chunk {
  chunkIndex: number;
  /** 1-based, inclusive. */
  startLine: number;
  /** 1-based, inclusive. */
  endLine: number;
  heading: string | null;
  content: string;
}

/**
 * Line-based sliding-window chunking with overlap, preferring to break at
 * "boundary-like" lines (function/class/heading starts, or blank-line
 * section gaps for sql/yaml/css) instead of an arbitrary line count, so a
 * chunk boundary rarely lands mid-function. `heading` is the boundary line
 * that introduces the chunk's content (or the nearest earlier one if the
 * chunk starts mid-section), truncated to 120 chars — used both as
 * `ai_chunks.heading` and folded into the embedding input text.
 */
export function chunkFile(content: string, language: string): Chunk[] {
  const maxLines = env.ai.chunkMaxLines;
  const overlapLines = env.ai.chunkOverlapLines;
  const lines = content.split(/\r\n|\r|\n/);
  const total = lines.length;
  if (total === 0 || (total === 1 && lines[0] === '')) return [];

  const boundaryRegex = boundaryRegexForLanguage(language);
  const useBlankLineBoundaries = BLANK_LINE_BOUNDARY_LANGUAGES.has(language);

  // 0-based indices of lines that are a good place to START a new chunk.
  const boundaryLines = new Set<number>();
  for (let i = 0; i < total; i++) {
    if (boundaryRegex && boundaryRegex.test(lines[i])) {
      boundaryLines.add(i);
    } else if (useBlankLineBoundaries && i > 0 && lines[i - 1].trim() === '' && lines[i].trim() !== '') {
      boundaryLines.add(i);
    }
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < total) {
    let end = Math.min(start + maxLines, total); // exclusive

    if (end < total) {
      // Prefer to end the chunk right before the next boundary line, as
      // long as that doesn't shrink the chunk below half the target size.
      const searchFloor = start + Math.floor(maxLines / 2);
      for (let i = end - 1; i > searchFloor; i--) {
        if (boundaryLines.has(i)) {
          end = i;
          break;
        }
      }
    }
    if (end <= start) end = Math.min(start + maxLines, total);

    let heading: string | null = null;
    for (let i = start; i < end; i++) {
      if (boundaryLines.has(i)) {
        heading = lines[i];
        break;
      }
    }
    if (heading === null) {
      for (let i = start - 1; i >= 0; i--) {
        if (boundaryLines.has(i)) {
          heading = lines[i];
          break;
        }
      }
    }

    chunks.push({
      chunkIndex: chunkIndex++,
      startLine: start + 1,
      endLine: end,
      heading: heading ? heading.trim().slice(0, 120) : null,
      content: lines.slice(start, end).join('\n'),
    });

    if (end >= total) break;
    start = Math.max(end - overlapLines, start + 1);
  }

  return chunks;
}

/** Embedding input text fed to the local model — see services/ai/embedding.service.ts. */
export function buildEmbeddingInput(relativePath: string, chunk: Chunk): string {
  return `${relativePath}\n${chunk.heading ?? ''}\n\n${chunk.content}`;
}
