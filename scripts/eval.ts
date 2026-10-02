/**
 * Offline evaluation with the real embedding model (same fp16 MiniLM as the browser):
 * for every labelled question in the two example documents and every setting, is the
 * passage holding the answer in the top 3, and when the verdict says "passage N", is it right?
 *
 *   npx tsx scripts/eval.ts
 */
import { CORPORA, corpusText } from "../src/data/index.ts";
import type { PassageSize, SearchBy } from "../src/lib/config.ts";
import { check } from "../src/lib/pipeline.ts";
import { nodeEmbedder } from "./nodeEmbedder.ts";

const SIZES: PassageSize[] = ["small", "medium", "large"];
const MODES: SearchBy[] = ["words", "meaning", "both"];

const { emb, save } = await nodeEmbedder();
const rows: string[] = [];
const verdictCounts: Record<string, number> = {};
let splitTP = 0;
let splitFP = 0;
let splitFN = 0;
let foundRight = 0;
let foundTotal = 0;
for (const size of SIZES) {
  for (const searchBy of MODES) {
    let hits = 0;
    let n = 0;
    for (const c of CORPORA) {
      const text = corpusText(c);
      for (const q of c.questions) {
        const r = await check(text, q.text, { size, searchBy }, emb);
        const quote = q.expected[0].quote;
        const start = text.indexOf(quote);
        const holds = (p: (typeof r.top)[number]) => p.chunk.start <= start + quote.length * 0.1 && p.chunk.end >= start + quote.length * 0.9;
        const hit = r.top.some(holds);
        hits += hit ? 1 : 0;
        n++;
        verdictCounts[r.verdict.kind] = (verdictCounts[r.verdict.kind] ?? 0) + 1;
        const trulySplit = !r.index.chunks.some((ch) => ch.start <= start && ch.end >= start + quote.length);
        if (r.verdict.kind === "split") {
          if (trulySplit) splitTP++;
          else splitFP++;
        }
        else if (trulySplit && hit === false) splitFN++;
        if (r.verdict.kind === "found") {
          foundTotal++;
          if (holds(r.top[r.verdict.passages[0] - 1])) foundRight++;
        }
      }
    }
    rows.push(`| ${size} | ${searchBy} | ${hits}/${n} (${Math.round((hits / n) * 100)}%) |`);
  }
}
save();
console.log("| Passage size | Search by | Answer in top 3 |\n|---|---|---|\n" + rows.join("\n"));
console.log(`\n"found" verdicts pointing at the right passage: ${foundRight}/${foundTotal}`);
console.log("verdict mix:", verdictCounts);
console.log(`split verdicts: ${splitTP} correct, ${splitFP} false alarms, ${splitFN} truly-split misses not flagged`);
