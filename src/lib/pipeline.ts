import { chunkText } from "./chunkers";
import { PASSAGE_CHARS, RETRIEVER, TOP_K, type ModelId, type Settings } from "./config";
import { buildSearchIndex, retrieve, type SearchIndex } from "./retrieve";
import { hashString } from "./text";
import type { RetrievalResult } from "./types";
import { judge, type Passage, type Verdict } from "./verdict";

export type RawEmbedFn = (texts: string[]) => Promise<{ vectors: Float32Array[]; tokens: number[] }>;

export interface CacheEntry {
  v: Float32Array;
  t: number;
}

export interface EmbedProgress {
  done: number;
  total: number;
}

/**
 * Wraps a raw embedding function with a content-addressed cache (text → vector),
 * so changing the passage size only embeds passages that actually changed.
 */
export class CachedEmbedder {
  readonly model: ModelId;
  private readonly raw: RawEmbedFn;
  private readonly cache = new Map<string, CacheEntry>();
  /** Optional persistent store hooks (IndexedDB in the browser, disk in Node). */
  persist?: { get(keys: string[]): Promise<(CacheEntry | undefined)[]>; set(entries: [string, CacheEntry][]): Promise<void> };

  constructor(model: ModelId, raw: RawEmbedFn) {
    this.model = model;
    this.raw = raw;
  }

  private key(text: string) {
    return `${this.model}:${hashString(text)}:${text.length}`;
  }

  async embed(texts: string[], onProgress?: (p: EmbedProgress) => void): Promise<{ vectors: Float32Array[]; tokens: number[] }> {
    const keys = texts.map((t) => this.key(t));
    const missing = [...new Set(texts.filter((_, i) => !this.cache.has(keys[i])))];
    if (missing.length && this.persist) {
      const stored = await this.persist.get(missing.map((t) => this.key(t)));
      stored.forEach((v, i) => {
        if (v) this.cache.set(this.key(missing[i]), v);
      });
    }
    const todo = [...new Set(texts.filter((_, i) => !this.cache.has(keys[i])))];
    const BATCH = 8;
    const fresh: [string, CacheEntry][] = [];
    for (let i = 0; i < todo.length; i += BATCH) {
      const batch = todo.slice(i, i + BATCH);
      const out = await this.raw(batch);
      batch.forEach((t, j) => {
        const entry = { v: out.vectors[j], t: out.tokens[j] };
        this.cache.set(this.key(t), entry);
        fresh.push([this.key(t), entry]);
      });
      onProgress?.({ done: Math.min(todo.length, i + BATCH), total: todo.length });
    }
    if (fresh.length && this.persist) void this.persist.set(fresh).catch(() => undefined);
    return { vectors: keys.map((k) => this.cache.get(k)!.v), tokens: keys.map((k) => this.cache.get(k)!.t) };
  }

  async embedQuery(query: string): Promise<Float32Array> {
    return (await this.embed([query])).vectors[0];
  }
}

export interface CheckResult {
  index: SearchIndex;
  result: RetrievalResult;
  /** The top passages the retriever hands to the model, best first. */
  top: Passage[];
  verdict: Verdict;
  settings: Settings;
}

/** Split → embed → retrieve → judge. Everything the app shows comes from here. */
export async function check(text: string, question: string, settings: Settings, embedder: CachedEmbedder, onProgress?: (p: EmbedProgress) => void): Promise<CheckResult> {
  const chunks = chunkText(text, PASSAGE_CHARS[settings.size]);
  if (!chunks.length) throw new Error("The document is empty.");
  const { vectors } = await embedder.embed(
    chunks.map((c) => c.text),
    onProgress,
  );
  const index = buildSearchIndex(chunks, vectors);
  const q = await embedder.embedQuery(question);
  const result = retrieve(index, question, q, { mode: RETRIEVER[settings.searchBy], k: TOP_K, mmr: false, mmrLambda: 0.7, rrfK: 60 });
  const { top, verdict } = judge(index, result, settings, text);
  return { index, result, top, verdict, settings };
}
