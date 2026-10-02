import type { Chunk, Span } from "./types";

const DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " ", ""];

function trimSpan(text: string, start: number, end: number): Span | null {
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return end > start ? { start, end, text: text.slice(start, end) } : null;
}

/** Split [start, end) into pieces no longer than `size`, preferring coarse separators. */
function splitRecursive(text: string, start: number, end: number, size: number, seps: string[]): Span[] {
  if (end - start <= size) return [{ start, end, text: text.slice(start, end) }];
  const sepIdx = seps.findIndex((sep) => sep === "" || text.slice(start, end).includes(sep));
  const sep = seps[sepIdx] ?? "";
  const rest = seps.slice(sepIdx + 1);
  const parts: Span[] = [];
  if (sep === "") {
    for (let i = start; i < end; i += size) parts.push({ start: i, end: Math.min(end, i + size), text: text.slice(i, Math.min(end, i + size)) });
    return parts;
  }
  let cursor = start;
  const segment = text.slice(start, end);
  let idx = segment.indexOf(sep);
  while (idx !== -1) {
    const pieceEnd = start + idx + sep.length; // keep separator attached to the left piece
    parts.push({ start: cursor, end: pieceEnd, text: text.slice(cursor, pieceEnd) });
    cursor = pieceEnd;
    idx = segment.indexOf(sep, idx + sep.length);
  }
  if (cursor < end) parts.push({ start: cursor, end, text: text.slice(cursor, end) });
  return parts.flatMap((p) => (p.end - p.start > size ? splitRecursive(text, p.start, p.end, size, rest) : [p]));
}

/**
 * Greedily merge ordered pieces into chunks of at most `size` chars, carrying
 * trailing pieces totalling at most `overlap` chars into the next chunk.
 */
export function mergePieces(text: string, pieces: Span[], size: number, overlap: number): Span[] {
  const out: Span[] = [];
  const cur: Span[] = [];
  const width = (arr: Span[]) => (arr.length ? arr[arr.length - 1].end - arr[0].start : 0);
  const emit = () => {
    if (!cur.length) return;
    const span = trimSpan(text, cur[0].start, cur[cur.length - 1].end);
    if (span && (!out.length || span.end > out[out.length - 1].end)) out.push(span);
  };
  for (const piece of pieces) {
    if (cur.length && piece.end - cur[0].start > size) {
      emit();
      // keep a tail of at most `overlap` chars, and make sure the new piece will fit
      while (cur.length && (width(cur) > overlap || piece.end - cur[0].start > size)) cur.shift();
    }
    cur.push(piece);
  }
  emit();
  return out;
}

export function recursiveChunks(text: string, size: number, overlap: number, separators = DEFAULT_SEPARATORS): Span[] {
  const s = Math.max(1, Math.floor(size));
  const pieces = splitRecursive(text, 0, text.length, s, separators);
  return mergePieces(text, pieces, s, Math.max(0, Math.min(overlap, s - 1)));
}

/** Split a document into passages (paragraph-first recursive splitting, no overlap). */
export function chunkText(text: string, size: number, docId = "doc"): Chunk[] {
  return recursiveChunks(text, size, 0).map((s, index) => ({ ...s, id: `${docId}#${index}`, docId, index }));
}
