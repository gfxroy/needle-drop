import { dot, type Vec } from "./vector";

export interface FusedItem {
  id: string;
  score: number;
  /** Per-input-list contribution 1/(k+rank) (0 if absent). */
  contributions: number[];
}

/**
 * Reciprocal Rank Fusion (Cormack et al., 2009): score(d) = Σ w_i / (k + rank_i(d)).
 * `rankings` are ordered id lists (best first). Ties broken by best single rank, then id.
 */
export function reciprocalRankFusion(rankings: string[][], k = 60, weights?: number[]): FusedItem[] {
  const acc = new Map<string, FusedItem>();
  const bestRank = new Map<string, number>();
  rankings.forEach((list, li) => {
    const w = weights?.[li] ?? 1;
    list.forEach((id, idx) => {
      const c = w / (k + idx + 1);
      let item = acc.get(id);
      if (!item) {
        item = { id, score: 0, contributions: rankings.map(() => 0) };
        acc.set(id, item);
      }
      item.score += c;
      item.contributions[li] = c;
      bestRank.set(id, Math.min(bestRank.get(id) ?? Infinity, idx + 1));
    });
  });
  return [...acc.values()].sort(
    (a, b) => b.score - a.score || (bestRank.get(a.id)! - bestRank.get(b.id)!) || a.id.localeCompare(b.id),
  );
}

/**
 * Maximal Marginal Relevance: greedily pick items maximizing
 * λ·rel(d) − (1−λ)·max_{s∈selected} sim(d, s). Returns ids in selection order.
 * Embeddings are assumed L2-normalized so dot = cosine.
 */
export function mmr(
  candidates: { id: string; relevance: number; embedding: Vec }[],
  lambda: number,
  topN = candidates.length,
): string[] {
  const remaining = [...candidates];
  const selected: typeof candidates = [];
  while (remaining.length && selected.length < topN) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    remaining.forEach((c, i) => {
      const redundancy = selected.length ? Math.max(...selected.map((s) => dot(s.embedding, c.embedding))) : 0;
      const val = lambda * c.relevance - (1 - lambda) * redundancy;
      if (val > bestVal) {
        bestVal = val;
        bestIdx = i;
      }
    });
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }
  return selected.map((s) => s.id);
}
