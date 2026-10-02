import { tokenize } from "./text";

export interface BM25Options {
  k1?: number;
  b?: number;
}

/** Okapi BM25 over pre-tokenized documents. */
export class BM25 {
  readonly k1: number;
  readonly b: number;
  readonly docs: string[][];
  readonly avgdl: number;
  private readonly df = new Map<string, number>();
  private readonly tf: Map<string, number>[];

  constructor(docs: string[][], opts: BM25Options = {}) {
    this.k1 = opts.k1 ?? 1.2;
    this.b = opts.b ?? 0.75;
    this.docs = docs;
    this.avgdl = docs.reduce((s, d) => s + d.length, 0) / (docs.length || 1);
    this.tf = docs.map((d) => {
      const m = new Map<string, number>();
      for (const t of d) m.set(t, (m.get(t) ?? 0) + 1);
      for (const t of m.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      return m;
    });
  }

  static fromTexts(texts: string[], opts?: BM25Options): BM25 {
    return new BM25(texts.map(tokenize), opts);
  }

  get size(): number {
    return this.docs.length;
  }

  /** Robertson–Spärck Jones IDF with +1 smoothing (always positive). */
  idf(term: string): number {
    const n = this.df.get(term) ?? 0;
    return Math.log(1 + (this.docs.length - n + 0.5) / (n + 0.5));
  }

  scoreDoc(i: number, queryTerms: string[]): number {
    const tf = this.tf[i];
    const dl = this.docs[i].length;
    let s = 0;
    for (const q of new Set(queryTerms)) {
      const f = tf.get(q);
      if (!f) continue;
      s += (this.idf(q) * (f * (this.k1 + 1))) / (f + this.k1 * (1 - this.b + (this.b * dl) / (this.avgdl || 1)));
    }
    return s;
  }

  scores(queryTerms: string[]): number[] {
    return this.docs.map((_, i) => this.scoreDoc(i, queryTerms));
  }

  matchedTerms(i: number, queryTerms: string[]): string[] {
    const tf = this.tf[i];
    return [...new Set(queryTerms)].filter((q) => tf.has(q));
  }
}
