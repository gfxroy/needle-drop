import type { Span } from "./types";

const ABBREVIATIONS = new Set([
  "e.g", "i.e", "etc", "vs", "dr", "mr", "mrs", "ms", "prof", "inc", "ltd", "no", "fig", "approx", "dept", "st", "jr", "sr", "u.s",
]);

/**
 * Split text into sentence spans with character offsets.
 * Breaks on terminal punctuation followed by whitespace, and on line breaks
 * (so headings and list items become their own "sentences").
 */
export function splitSentences(text: string): Span[] {
  const spans: Span[] = [];
  let start = 0;
  const push = (s: number, e: number) => {
    // trim whitespace inside [s, e)
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e > s) spans.push({ start: s, end: e, text: text.slice(s, e) });
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\n") {
      push(start, i);
      start = i + 1;
      continue;
    }
    if (ch === "." || ch === "!" || ch === "?") {
      // consume closing quotes/brackets
      let j = i + 1;
      while (j < text.length && /["')\]”’]/.test(text[j])) j++;
      if (j < text.length && !/\s/.test(text[j])) continue; // e.g. "3.5", "v1.2", "example.com"
      if (ch === ".") {
        const wordMatch = /([A-Za-z.]+)$/.exec(text.slice(Math.max(0, i - 12), i));
        const word = wordMatch ? wordMatch[1].toLowerCase() : "";
        if (ABBREVIATIONS.has(word) || /^[a-z]$/i.test(word)) continue;
      }
      push(start, j);
      start = j;
      i = j - 1;
    }
  }
  push(start, text.length);
  return spans;
}

export const STOPWORDS = new Set(
  (
    "a an and are as at be been being but by can could did do does doing for from had has have having he her hers him his how i if in into is it its " +
    "itself just me more most my no nor not of off on once only or other our ours out over own same she should so some such than that the their theirs them " +
    "then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours " +
    "about above after again against all am any because before below between both down during each few further here s t don now ll re ve d m o y ain aren " +
    "couldn didn doesn hadn hasn haven isn ma mightn mustn needn shan shouldn wasn weren won wouldn get got also may might must shall"
  ).split(/\s+/),
);

/** Very small, deterministic suffix-stripping stemmer (good enough for BM25 on English docs). */
export function stem(word: string): string {
  let w = word;
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.endsWith("ies") && w.length > 4) w = w.slice(0, -3) + "y";
  else if (w.endsWith("sses")) w = w.slice(0, -2);
  else if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) w = w.slice(0, -1);
  if (w.endsWith("ing") && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith("ed") && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith("ly") && w.length > 4) w = w.slice(0, -2);
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

export interface Token {
  term: string;
  raw: string;
  start: number;
  end: number;
}

/** Tokenize with offsets; returns stemmed, stopword-filtered terms. */
export function tokenizeWithOffsets(text: string): Token[] {
  const out: Token[] = [];
  const re = /[A-Za-z0-9]+(?:['’][A-Za-z]+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const lower = raw.toLowerCase().replace(/['’].*$/, "");
    if (!lower || STOPWORDS.has(lower)) continue;
    out.push({ term: stem(lower), raw, start: m.index, end: m.index + raw.length });
  }
  return out;
}

export function tokenize(text: string): string[] {
  return tokenizeWithOffsets(text).map((t) => t.term);
}

/** Rough WordPiece token estimate (≈4 chars per token for English prose). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** cyrb53: fast, well-distributed 53-bit string hash. */
export function hashString(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Character shingles for near-duplicate detection. */
export function shingles(text: string, n = 5): Set<string> {
  const norm = text.toLowerCase().replace(/\s+/g, " ").trim();
  const out = new Set<string>();
  for (let i = 0; i + n <= norm.length; i++) out.add(norm.slice(i, i + n));
  return out;
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Numbers mentioned in a text (normalized), used to detect conflicting near-duplicates. */
export function numbersIn(text: string): string[] {
  return Array.from(text.matchAll(/\$?\d[\d,]*(?:\.\d+)?%?/g), (m) => m[0].replace(/,/g, ""));
}

/** Identifier-like tokens: error codes, versions, SKUs (contain both letters and digits, or long digit runs). */
export function identifiersIn(text: string): string[] {
  return Array.from(text.matchAll(/\b(?=[A-Za-z_-]*\d)(?=\d*[A-Za-z_])[A-Za-z0-9_-]{3,}\b|\b\d{4,}\b/g), (m) => m[0]);
}
