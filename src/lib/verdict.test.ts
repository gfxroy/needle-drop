import { describe, expect, it } from "vitest";
import { buildSearchIndex } from "./retrieve";
import type { Chunk } from "./types";
import { matchStrength, verdictFor, type Passage } from "./verdict";

const chunk = (index: number, text: string): Chunk => ({ id: `doc#${index}`, docId: "doc", index, start: index * 100, end: index * 100 + text.length, text });
const vec = () => new Float32Array([1, 0]);

function setup(texts: string[]) {
  const chunks = texts.map((t, i) => chunk(i, t));
  return { chunks, index: buildSearchIndex(chunks, chunks.map(vec)) };
}
const p = (c: Chunk, rank: number, cosine = 0.6, coverage = 0.6, match = 0.6): Passage => ({ chunk: c, rank, cosine, coverage, match });

describe("matchStrength", () => {
  it("depends on the search mode", () => {
    expect(matchStrength(0.7, 0.2, "meaning")).toBeCloseTo(1);
    expect(matchStrength(0.7, 0.2, "words")).toBeCloseTo(0.2);
    expect(matchStrength(0.7, 0.2, "both")).toBeCloseTo(0.6);
    expect(matchStrength(0.0, 0, "meaning")).toBe(0);
  });
});

describe("verdictFor", () => {
  it("points at the strongest passage when things look fine", () => {
    const { chunks, index } = setup(["Parental leave is 16 weeks.", "Laptops are replaced every 3 years.", "Holidays are published in December.", "Other."]);
    const v = verdictFor(index, "How long is parental leave?", [p(chunks[0], 1, 0.7, 1, 0.9), p(chunks[2], 2, 0.4, 0, 0.4), p(chunks[1], 3, 0.35, 0, 0.3)], { size: "medium", searchBy: "meaning" }, "");
    expect(v.kind).toBe("found");
    expect(v.text).toBe("Your answer is most likely in passage 1.");
  });

  it("flags neighbouring passages as a split answer and suggests larger passages", () => {
    const { chunks, index } = setup(["Intro text.", "Employees with six or more years", "accrue 25 days of PTO per year.", "Other."]);
    const v = verdictFor(index, "PTO after 7 years?", [p(chunks[1], 1), p(chunks[3], 2), p(chunks[2], 3)], { size: "small", searchBy: "meaning" }, "");
    expect(v.kind).toBe("split");
    expect(v.passages).toEqual([1, 3]);
    expect(v.suggestion).toEqual({ size: "medium" });
  });

  it("does not call a split when passages are already large", () => {
    const { chunks, index } = setup(["a", "Employees with six or more years", "accrue 25 days of PTO per year.", "b"]);
    const v = verdictFor(index, "PTO after 7 years?", [p(chunks[1], 1), p(chunks[2], 2), p(chunks[0], 3)], { size: "large", searchBy: "meaning" }, "");
    expect(v.kind).toBe("found");
  });

  it("notices an exact code that exists but was not retrieved", () => {
    const { chunks, index } = setup(["Errors are returned as JSON.", "Retry with backoff.", "Rate limits apply.", "E4021 means the idempotency key was reused."]);
    const v = verdictFor(index, "What does error E4021 mean?", [p(chunks[0], 1), p(chunks[1], 2), p(chunks[2], 3)], { size: "medium", searchBy: "meaning" }, "");
    expect(v.kind).toBe("keyword");
    expect(v.text).toContain("E4021");
    expect(v.suggestion).toEqual({ searchBy: "both" });
  });

  it("detects near-duplicate passages with different numbers", () => {
    const a = "Employees in their first two years of service accrue 15 days of paid time off per year, rising later.";
    const b = "Employees in their first two years of service accrue 12 days of paid time off per year, rising later.";
    const { chunks, index } = setup([a, "Unrelated.", b]);
    const v = verdictFor(index, "How much PTO in year one?", [p(chunks[0], 1), p(chunks[2], 2), p(chunks[1], 3)], { size: "medium", searchBy: "meaning" }, "");
    expect(v.kind).toBe("duplicate");
    expect(v.text).toContain("different numbers");
  });

  it("says when nothing matches", () => {
    const { chunks, index } = setup(["Bananas are yellow.", "The sky is blue.", "Grass is green."]);
    const v = verdictFor(index, "What is the refund policy?", chunks.map((c, i) => p(c, i + 1, 0.1, 0, 0)), { size: "medium", searchBy: "meaning" }, "");
    expect(v.kind).toBe("weak");
  });

  it("suggests Meaning when no words match in Words mode", () => {
    const { chunks, index } = setup(["Bananas are yellow.", "The sky is blue.", "Grass is green."]);
    const v = verdictFor(index, "refund policy", chunks.map((c, i) => p(c, i + 1, 0.5, 0, 0)), { size: "medium", searchBy: "words" }, "");
    expect(v.kind).toBe("no-words");
    expect(v.suggestion).toEqual({ searchBy: "meaning" });
  });
});
