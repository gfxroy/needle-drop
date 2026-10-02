import { describe, expect, it } from "vitest";
import { estimateTokens, hashString, identifiersIn, jaccard, numbersIn, shingles, splitSentences, stem, tokenize, tokenizeWithOffsets } from "./text";

describe("splitSentences", () => {
  it("splits on terminal punctuation and keeps offsets exact", () => {
    const text = "Hello world. This is Needle Drop! Is it fun? Yes.";
    const s = splitSentences(text);
    expect(s.map((x) => x.text)).toEqual(["Hello world.", "This is Needle Drop!", "Is it fun?", "Yes."]);
    for (const x of s) expect(text.slice(x.start, x.end)).toBe(x.text);
  });
  it("does not split decimals, versions, domains or abbreviations", () => {
    const s = splitSentences("Version 3.5 shipped, e.g. on example.com today. Next one.");
    expect(s).toHaveLength(2);
    expect(s[0].text).toBe("Version 3.5 shipped, e.g. on example.com today.");
  });
  it("treats line breaks as boundaries (headings, bullets)", () => {
    const s = splitSentences("# Title\n- item one\n- item two");
    expect(s.map((x) => x.text)).toEqual(["# Title", "- item one", "- item two"]);
  });
  it("handles empty input", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   \n  ")).toEqual([]);
  });
});

describe("tokenize & stem", () => {
  it("lowercases, drops stopwords and stems", () => {
    expect(tokenize("The policies are changing")).toEqual(["policy", "chang"]);
  });
  it("keeps identifiers intact", () => {
    expect(tokenize("Error E4021 and E5003")).toEqual(["error", "e4021", "e5003"]);
  });
  it("stems consistently", () => {
    expect(stem("days")).toBe(stem("day"));
    expect(stem("requests")).toBe(stem("request"));
    expect(stem("retries")).toBe("retry");
  });
  it("returns offsets that point at raw tokens", () => {
    const text = "Webhooks retry 8 times";
    for (const t of tokenizeWithOffsets(text)) expect(text.slice(t.start, t.end)).toBe(t.raw);
  });
});

describe("misc text helpers", () => {
  it("hashString is deterministic and spreads", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
    expect(hashString("abc")).not.toBe(hashString("abd"));
  });
  it("jaccard + shingles detect near-duplicates", () => {
    const a = shingles("All systems nominal. Crew morale good.");
    const b = shingles("All systems nominal. Crew morale great.");
    const c = shingles("Code ORCHID means the hull is breached.");
    expect(jaccard(a, b)).toBeGreaterThan(0.6);
    expect(jaccard(a, c)).toBeLessThan(0.1);
    expect(jaccard(new Set(), new Set())).toBe(1);
  });
  it("extracts numbers and identifiers", () => {
    expect(numbersIn("carry over 5 days, up to $1,500 or 97%")).toEqual(["5", "$1500", "97%"]);
    expect(identifiersIn("What does E4021 mean vs AMBER-2?")).toEqual(["E4021", "AMBER-2"]);
    expect(identifiersIn("plain words only")).toEqual([]);
  });
  it("estimates tokens", () => {
    expect(estimateTokens("abcd".repeat(10))).toBe(10);
  });
});
