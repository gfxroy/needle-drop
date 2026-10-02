import { describe, expect, it } from "vitest";
import { CORPORA, EXAMPLES, corpusText } from "./index";

describe("example documents", () => {
  for (const c of CORPORA) {
    it(`${c.name}: every labelled answer appears verbatim in the flattened document`, () => {
      const text = corpusText(c);
      for (const q of c.questions) for (const e of q.expected) expect(text.includes(e.quote), `${q.id}: ${e.quote}`).toBe(true);
    });
    it(`${c.name}: unique ids`, () => {
      expect(new Set(c.docs.map((d) => d.id)).size).toBe(c.docs.length);
      expect(new Set(c.questions.map((q) => q.id)).size).toBe(c.questions.length);
    });
  }
  it("ships two one-click examples with a question each", () => {
    expect(EXAMPLES).toHaveLength(2);
    for (const e of EXAMPLES) {
      expect(e.text.length).toBeGreaterThan(2000);
      expect(e.question.endsWith("?")).toBe(true);
    }
  });
});
