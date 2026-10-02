import type { Settings } from "./config";
import type { SearchIndex } from "./retrieve";
import { identifiersIn, jaccard, numbersIn, shingles, tokenize } from "./text";
import type { Chunk, RetrievalResult } from "./types";

export interface Passage {
  chunk: Chunk;
  /** 1-based position in the top list. */
  rank: number;
  /** Simple 0..1 match strength for the bar (depends on the search mode). */
  match: number;
  /** Cosine similarity between question and passage embeddings. */
  cosine: number;
  /** Share of the question's content words that appear in the passage. */
  coverage: number;
}

export type VerdictKind = "found" | "split" | "keyword" | "duplicate" | "weak" | "no-words";

export interface Verdict {
  kind: VerdictKind;
  text: string;
  /** Ranks (1-based) of the passages the verdict points at. */
  passages: number[];
  /** A one-click settings change that should help. */
  suggestion?: Partial<Settings>;
  suggestionLabel?: string;
}

/** Below this cosine (all-MiniLM-L6-v2) a passage is only loosely related to the question. */
export const WEAK_COSINE = 0.3;
/** Character-shingle Jaccard above which two passages count as near-duplicates. */
export const DUPLICATE_JACCARD = 0.5;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function matchStrength(cosine: number, coverage: number, searchBy: Settings["searchBy"]): number {
  const meaning = clamp01((cosine - 0.15) / 0.55);
  if (searchBy === "meaning") return meaning;
  if (searchBy === "words") return clamp01(coverage);
  return (meaning + clamp01(coverage)) / 2;
}

const join = (ranks: number[]) => (ranks.length === 2 ? `${ranks[0]} and ${ranks[1]}` : ranks.join(", "));

/** Turn raw retrieval output into the three passages and one plain-English verdict. */
export function judge(index: SearchIndex, result: RetrievalResult, settings: Settings, docText: string, k = 3): { top: Passage[]; verdict: Verdict } {
  const qTerms = [...new Set(tokenize(result.query))];
  const top: Passage[] = result.final.slice(0, k).map((h, i) => {
    const chunk = index.chunks[index.byId.get(h.chunkId)!];
    const cosine = result.denseScore.get(h.chunkId) ?? 0;
    const coverage = qTerms.length ? (result.matchedTerms.get(h.chunkId)?.length ?? 0) / qTerms.length : 0;
    return { chunk, rank: i + 1, cosine, coverage, match: matchStrength(cosine, coverage, settings.searchBy) };
  });
  return { top, verdict: verdictFor(index, result.query, top, settings, docText) };
}

export function verdictFor(index: SearchIndex, query: string, top: Passage[], settings: Settings, docText: string): Verdict {
  if (!top.length) return { kind: "weak", text: "There is nothing to search yet.", passages: [] };
  const topIds = new Set(top.map((p) => p.chunk.id));

  // 1. Searching by words, but none of the words occur.
  if (settings.searchBy === "words" && top.every((p) => p.coverage === 0)) {
    return {
      kind: "no-words",
      text: "None of the words in your question appear in the document. Try searching by Meaning.",
      passages: [],
      suggestion: { searchBy: "meaning" },
      suggestionLabel: "Search by Meaning",
    };
  }

  // 2. An exact code or number from the question exists in the document but was not retrieved.
  if (settings.searchBy !== "words") {
    const ids = [...new Set(identifiersIn(query).map((s) => s.toLowerCase()))];
    for (const id of ids) {
      const inTop = top.some((p) => p.chunk.text.toLowerCase().includes(id));
      const elsewhere = index.chunks.find((c) => !topIds.has(c.id) && c.text.toLowerCase().includes(id));
      if (!inTop && elsewhere) {
        const original = identifiersIn(query).find((s) => s.toLowerCase() === id) ?? id;
        const next = settings.searchBy === "meaning" ? "both" : "words";
        return {
          kind: "keyword",
          text: `“${original}” appears in the document, but not in these passages. Meaning-based search blurs exact codes — try searching by ${next === "both" ? "Both" : "Words"}.`,
          passages: [],
          suggestion: { searchBy: next },
          suggestionLabel: `Search by ${next === "both" ? "Both" : "Words"}`,
        };
      }
    }
  }

  // 3. Nothing is a good match.
  const bestCos = Math.max(...top.map((p) => p.cosine));
  const bestCov = Math.max(...top.map((p) => p.coverage));
  const weak = settings.searchBy === "words" ? bestCov < 0.34 : bestCos < WEAK_COSINE && bestCov < 0.5;
  if (weak) {
    return { kind: "weak", text: "Nothing here matches the question well. The answer may not be in this document.", passages: [] };
  }

  // 4. Two near-identical passages (e.g. an old and a new version of a policy).
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const a = top[i].chunk.text;
      const b = top[j].chunk.text;
      if (jaccard(shingles(a), shingles(b)) >= DUPLICATE_JACCARD) {
        const differ = numbersIn(a).join() !== numbersIn(b).join();
        return {
          kind: "duplicate",
          text: `Passages ${i + 1} and ${j + 1} are nearly identical${differ ? " but give different numbers" : ""} — maybe an old and a new version. Make sure the AI reads the right one.`,
          passages: [i + 1, j + 1],
        };
      }
    }
  }

  // 5. The answer straddles a boundary: two neighbouring passages are both retrieved, the cut
  //    falls inside a paragraph, and either it cuts a sentence or each side holds different question words.
  if (settings.size !== "large") {
    const qTerms = new Set(tokenize(query));
    const termsIn = (t: string) => new Set(tokenize(t).filter((x) => qTerms.has(x)));
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        const [first, second] = top[i].chunk.index < top[j].chunk.index ? [top[i].chunk, top[j].chunk] : [top[j].chunk, top[i].chunk];
        if (first.docId !== second.docId || second.index - first.index !== 1) continue;
        const gap = docText.slice(first.end, second.start);
        if (gap.includes("\n")) continue;
        const midSentence = !/[.!?:;)"”]$/.test(first.text);
        const a = termsIn(first.text);
        const b = termsIn(second.text);
        const union = new Set([...a, ...b]).size;
        const complementary = qTerms.size > 0 && union - Math.max(a.size, b.size) >= Math.max(1, Math.ceil(qTerms.size * 0.25));
        if (midSentence || complementary) {
          const larger = settings.size === "small" ? "medium" : "large";
          return {
            kind: "split",
            text: `The answer looks split across passages ${join([i + 1, j + 1])}. Try ${larger === "large" ? "Large" : "Medium"} passages.`,
            passages: [i + 1, j + 1],
            suggestion: { size: larger },
            suggestionLabel: `Use ${larger === "large" ? "Large" : "Medium"} passages`,
          };
        }
      }
    }
  }

  // 6. Found: point at the strongest passage.
  const strength = (p: Passage) => matchStrength(p.cosine, p.coverage, "both");
  const best = top.reduce((b, p) => (strength(p) > strength(b) + 1e-9 ? p : b), top[0]);
  return { kind: "found", text: `Your answer is most likely in passage ${best.rank}.`, passages: [best.rank] };
}
