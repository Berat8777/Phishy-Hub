/**
 * Slack-style `<@uuid>` mention token format (repo-wide agreed convention —
 * see task brief / api/CONTRACT.md §9 point 7: the server stores `body` as
 * raw text and does not parse mentions, so all of this is client-only).
 */

const UUID_PATTERN = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const MENTION_RE = new RegExp(`<@(${UUID_PATTERN})>`, 'g');
const URL_RE = /(https?:\/\/[^\s<]+)/g;

export function mentionToken(userId: string): string {
  return `<@${userId}>`;
}

export type BodySegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; userId: string }
  | { type: 'link'; url: string };

/**
 * Splits a raw message body into text/mention/link segments in a single
 * left-to-right pass. Mentions take priority over link matching (a mention
 * token never contains a URL), so this first splits on mentions, then
 * re-splits each resulting text run on URLs.
 */
export function parseBodySegments(body: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let lastIndex = 0;
  MENTION_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = MENTION_RE.exec(body)) !== null) {
    if (match.index > lastIndex) {
      segments.push(...splitLinks(body.slice(lastIndex, match.index)));
    }
    segments.push({ type: 'mention', userId: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) {
    segments.push(...splitLinks(body.slice(lastIndex)));
  }
  return segments;
}

function splitLinks(text: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let lastIndex = 0;
  URL_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'link', url: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}
