import { describe, expect, it } from "vitest";
import { chunkText, mergePieces, recursiveChunks } from "./chunkers";
import type { Span } from "./types";

const TEXT = `# Paid Time Off

Paid time off accrues every pay period. Employees in their first two years accrue 15 days.

## Carryover

You may carry over up to 5 unused days. Carried-over days expire on March 31 if unused. Unused days beyond the limit are forfeited.

## Sick leave

Sick leave is separate from PTO. Employees receive 10 paid sick days per year.`;

function assertOffsets(text: string, spans: Span[]) {
  for (const s of spans) {
    expect(text.slice(s.start, s.end)).toBe(s.text);
    expect(s.text).toBe(s.text.trim());
    expect(s.text.length).toBeGreaterThan(0);
  }
}

/** Every non-whitespace character must be covered by at least one chunk. */
function assertCoverage(text: string, spans: Span[]) {
  const covered = new Uint8Array(text.length);
  for (const s of spans) covered.fill(1, s.start, s.end);
  for (let i = 0; i < text.length; i++) if (!/\s/.test(text[i])) expect(covered[i], `char ${i} '${text[i]}'`).toBe(1);
}


describe("recursiveChunks", () => {
  it("never exceeds size and covers all text", () => {
    for (const size of [60, 120, 300]) {
      const spans = recursiveChunks(TEXT, size, 0);
      spans.forEach((s) => expect(s.end - s.start).toBeLessThanOrEqual(size));
      assertOffsets(TEXT, spans);
      assertCoverage(TEXT, spans);
    }
  });
  it("prefers paragraph boundaries", () => {
    const spans = recursiveChunks(TEXT, 300, 0);
    expect(spans[0].text.startsWith("# Paid Time Off")).toBe(true);
    expect(spans.some((s) => s.text.startsWith("## Sick leave") || s.text.includes("\n\n## Sick leave"))).toBe(true);
  });
  it("creates overlap between consecutive chunks when requested", () => {
    const spans = recursiveChunks(TEXT, 100, 40);
    const overlapping = spans.slice(1).filter((s, i) => s.start < spans[i].end);
    expect(overlapping.length).toBeGreaterThan(0);
  });
  it("returns a single chunk when text fits", () => {
    expect(recursiveChunks("short text", 100, 10)).toEqual([{ start: 0, end: 10, text: "short text" }]);
  });
});


describe("mergePieces", () => {
  it("drops chunks fully contained in the previous one", () => {
    const text = "aa bb cc";
    const pieces = [
      { start: 0, end: 3, text: "aa " },
      { start: 3, end: 6, text: "bb " },
      { start: 6, end: 8, text: "cc" },
    ];
    const out = mergePieces(text, pieces, 6, 3);
    for (let i = 1; i < out.length; i++) expect(out[i].end).toBeGreaterThan(out[i - 1].end);
  });
});



describe("chunkText", () => {
  it("assigns stable ids and indexes", () => {
    const c = chunkText("Alpha one.\n\nBeta two.\n\nGamma three.", 12);
    expect(c.map((x) => x.id)).toEqual(["doc#0", "doc#1", "doc#2"]);
    expect(c.map((x) => x.index)).toEqual([0, 1, 2]);
    expect(c[1].text).toBe("Beta two.");
  });
});
