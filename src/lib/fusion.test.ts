import { describe, expect, it } from "vitest";
import { mmr, reciprocalRankFusion } from "./fusion";
import { normalize } from "./vector";

describe("reciprocalRankFusion", () => {
  it("computes Σ 1/(k + rank)", () => {
    const fused = reciprocalRankFusion([["a", "b", "c"], ["b", "a"]], 60);
    const byId = Object.fromEntries(fused.map((f) => [f.id, f.score]));
    expect(byId.a).toBeCloseTo(1 / 61 + 1 / 62);
    expect(byId.b).toBeCloseTo(1 / 62 + 1 / 61);
    expect(byId.c).toBeCloseTo(1 / 63);
  });
  it("rewards agreement between lists", () => {
    const fused = reciprocalRankFusion([["x", "y", "z"], ["z", "q", "y"]], 60);
    // y appears in both (ranks 2 and 3); q only once at rank 2
    const ids = fused.map((f) => f.id);
    expect(ids.indexOf("y")).toBeLessThan(ids.indexOf("q"));
  });
  it("breaks ties deterministically by best single rank then id", () => {
    const fused = reciprocalRankFusion([["a", "b"], ["b", "a"]], 60);
    expect(fused.map((f) => f.id)).toEqual(["a", "b"]);
  });
  it("supports weights and records contributions", () => {
    const fused = reciprocalRankFusion([["a"], ["b"]], 60, [2, 1]);
    expect(fused[0].id).toBe("a");
    expect(fused[0].contributions).toEqual([2 / 61, 0]);
  });
  it("handles empty lists", () => {
    expect(reciprocalRankFusion([[], []])).toEqual([]);
  });
});

describe("mmr", () => {
  const e = (x: number, y: number) => normalize([x, y]);
  const cands = [
    { id: "dup1", relevance: 1.0, embedding: e(1, 0) },
    { id: "dup2", relevance: 0.99, embedding: e(1, 0.01) },
    { id: "other", relevance: 0.8, embedding: e(0, 1) },
  ];
  it("with λ=1 it is a pure relevance sort", () => {
    expect(mmr(cands, 1)).toEqual(["dup1", "dup2", "other"]);
  });
  it("promotes diverse items over near-duplicates", () => {
    expect(mmr(cands, 0.5)).toEqual(["dup1", "other", "dup2"]);
  });
  it("respects topN", () => {
    expect(mmr(cands, 0.5, 2)).toHaveLength(2);
  });
});
