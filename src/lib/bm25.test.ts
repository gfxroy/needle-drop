import { describe, expect, it } from "vitest";
import { BM25 } from "./bm25";
import { tokenize } from "./text";

const docs = [
  "Webhooks are retried up to 8 times over 24 hours.",
  "Rate limits: 600 requests per minute on the Standard plan.",
  "E4021 quota_exceeded: monthly request quota used up.",
  "Requests over the limit fail with error E4290.",
];

describe("BM25", () => {
  const bm = BM25.fromTexts(docs);

  it("ranks the document containing a rare exact term first", () => {
    const s = bm.scores(tokenize("what is E4021"));
    expect(s.indexOf(Math.max(...s))).toBe(2);
    expect(s[0]).toBe(0);
  });
  it("gives rarer terms higher IDF", () => {
    expect(bm.idf("e4021")).toBeGreaterThan(bm.idf("request"));
    expect(bm.idf("nonexistent")).toBeGreaterThan(bm.idf("request"));
  });
  it("IDF is always positive (smoothed)", () => {
    const common = new BM25([["a"], ["a"], ["a"]]);
    expect(common.idf("a")).toBeGreaterThan(0);
  });
  it("matches a hand-computed score", () => {
    const tiny = new BM25([["cat", "cat", "dog"], ["dog"]], { k1: 1.2, b: 0.75 });
    const idf = Math.log(1 + (2 - 1 + 0.5) / (1 + 0.5));
    const avgdl = 2;
    const expected = (idf * 2 * 2.2) / (2 + 1.2 * (1 - 0.75 + (0.75 * 3) / avgdl));
    expect(tiny.scoreDoc(0, ["cat"])).toBeCloseTo(expected, 10);
  });
  it("saturates term frequency", () => {
    const t = new BM25([["x"], ["x", "x", "x", "x", "x", "x", "x", "x"], ["y"]], { b: 0 });
    const one = t.scoreDoc(0, ["x"]);
    const many = t.scoreDoc(1, ["x"]);
    expect(many).toBeGreaterThan(one);
    expect(many).toBeLessThan(one * 2.3); // bounded by (k1 + 1)
  });
  it("de-duplicates query terms and reports matches", () => {
    expect(bm.scoreDoc(1, ["minut", "minut"])).toBeCloseTo(bm.scoreDoc(1, ["minut"]));
    expect(bm.matchedTerms(1, tokenize("requests per minute plan"))).toEqual(["request", "per", "minut", "plan"]);
  });
  it("handles an empty corpus", () => {
    const empty = new BM25([]);
    expect(empty.scores(["a"])).toEqual([]);
    expect(empty.size).toBe(0);
  });
});
