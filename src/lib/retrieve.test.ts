import { describe, expect, it } from "vitest";
import { buildSearchIndex, rankOf, retrieve } from "./retrieve";
import type { Chunk, RetrievalConfig } from "./types";
import { normalize } from "./vector";

const texts = ["error E4021 quota exceeded", "rate limit 600 per minute", "webhook retries eight times", "quota and billing overview"];
const chunks: Chunk[] = texts.map((t, i) => ({ id: `d#${i}`, docId: "d", index: i, start: 0, end: t.length, text: t }));
const embs = [normalize([1, 1, 0]), normalize([1, 0, 0]), normalize([0, 0, 1]), normalize([0.1, 1, 0.05])];
const index = buildSearchIndex(chunks, embs);
const cfg: RetrievalConfig = { mode: "dense", k: 2, mmr: false, mmrLambda: 0.7, rrfK: 60 };

describe("retrieve", () => {
  it("ranks every chunk in all three lists", () => {
    const r = retrieve(index, "E4021 quota", normalize([0, 1, 0]), cfg);
    expect(r.dense).toHaveLength(4);
    expect(r.bm25).toHaveLength(4);
    expect(r.hybrid).toHaveLength(4);
    expect(r.final).toBe(r.dense);
  });
  it("dense uses cosine, bm25 uses terms, hybrid fuses", () => {
    const r = retrieve(index, "E4021", normalize([0.1, 1, 0.05]), { ...cfg, mode: "hybrid" });
    expect(r.dense[0].chunkId).toBe("d#3");
    expect(r.bm25[0].chunkId).toBe("d#0");
    expect(rankOf(r.hybrid, "d#0")).toBeLessThanOrEqual(2);
    expect(r.matchedTerms.get("d#0")).toEqual(["e4021"]);
  });
  it("applies MMR to the final list only", () => {
    const dupIndex = buildSearchIndex(
      [...chunks, { ...chunks[3], id: "d#4", index: 4 }],
      [...embs, embs[3]],
    );
    const plain = retrieve(dupIndex, "quota", normalize([0.1, 1, 0.05]), cfg);
    const diverse = retrieve(dupIndex, "quota", normalize([0.1, 1, 0.05]), { ...cfg, mmr: true, mmrLambda: 0.3 });
    const top2 = (l: typeof plain.final) => l.slice(0, 2).map((h) => h.chunkId);
    expect(top2(plain.final)).toEqual(expect.arrayContaining(["d#3", "d#4"]));
    expect(top2(diverse.final)).not.toEqual(expect.arrayContaining(["d#3", "d#4"]));
    expect(diverse.dense).toEqual(plain.dense);
  });
  it("rejects mismatched inputs", () => {
    expect(() => buildSearchIndex(chunks, embs.slice(1))).toThrow();
  });
});
