import { BM25 } from "./bm25";
import { mmr, reciprocalRankFusion } from "./fusion";
import { tokenize } from "./text";
import type { Chunk, Hit, RetrievalConfig, RetrievalResult } from "./types";
import { dot } from "./vector";

export interface SearchIndex {
  chunks: Chunk[];
  /** L2-normalized embeddings aligned with `chunks`. */
  embeddings: Float32Array[];
  bm25: BM25;
  byId: Map<string, number>;
}

export function buildSearchIndex(chunks: Chunk[], embeddings: Float32Array[]): SearchIndex {
  if (chunks.length !== embeddings.length) throw new Error("chunks/embeddings length mismatch");
  return {
    chunks,
    embeddings,
    bm25: BM25.fromTexts(chunks.map((c) => c.text)),
    byId: new Map(chunks.map((c, i) => [c.id, i])),
  };
}

function toHits(entries: { id: string; score: number }[]): Hit[] {
  return entries.map((e, i) => ({ chunkId: e.id, rank: i + 1, score: e.score }));
}

/** Rank every chunk with dense, BM25 and hybrid (RRF), then apply the configured mode (+ optional MMR). */
export function retrieve(index: SearchIndex, query: string, queryEmbedding: Float32Array, cfg: RetrievalConfig): RetrievalResult {
  const { chunks, embeddings, bm25 } = index;
  const qTerms = tokenize(query);
  const denseScore = new Map<string, number>();
  const bm25Score = new Map<string, number>();
  const matchedTerms = new Map<string, string[]>();
  const lexical = bm25.scores(qTerms);
  chunks.forEach((c, i) => {
    denseScore.set(c.id, dot(queryEmbedding, embeddings[i]));
    bm25Score.set(c.id, lexical[i]);
    matchedTerms.set(c.id, bm25.matchedTerms(i, qTerms));
  });
  const byScore = (m: Map<string, number>) =>
    chunks.map((c) => ({ id: c.id, score: m.get(c.id)! })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const dense = toHits(byScore(denseScore));
  // Chunks with zero lexical overlap are not "retrieved" by BM25, but keep them (rank order) so ranks exist for all.
  const bm25Hits = toHits(byScore(bm25Score));
  const lexicalRanking = bm25Hits.filter((h) => h.score > 0).map((h) => h.chunkId);
  const fused = reciprocalRankFusion([dense.map((h) => h.chunkId), lexicalRanking], cfg.rrfK);
  // append chunks absent from both rankings (impossible for dense, but keep it total)
  const hybrid = toHits(fused.map((f) => ({ id: f.id, score: f.score })));

  const base = cfg.mode === "dense" ? dense : cfg.mode === "bm25" ? bm25Hits : hybrid;
  let final = base;
  if (cfg.mmr && base.length > 1) {
    const poolSize = Math.min(base.length, Math.max(cfg.k * 4, 20));
    const pool = base.slice(0, poolSize);
    const maxS = Math.max(...pool.map((h) => h.score));
    const minS = Math.min(...pool.map((h) => h.score));
    const scale = maxS - minS || 1;
    const order = mmr(
      pool.map((h) => ({ id: h.chunkId, relevance: (h.score - minS) / scale, embedding: embeddings[index.byId.get(h.chunkId)!] })),
      cfg.mmrLambda,
    );
    const scoreOf = new Map(base.map((h) => [h.chunkId, h.score]));
    final = toHits([...order, ...base.slice(poolSize).map((h) => h.chunkId)].map((id) => ({ id, score: scoreOf.get(id)! })));
  }
  return { query, dense, bm25: bm25Hits, hybrid, final, denseScore, bm25Score, matchedTerms };
}

export function rankOf(list: Hit[], chunkId: string): number | null {
  return list.find((h) => h.chunkId === chunkId)?.rank ?? null;
}
