export interface Doc {
  id: string;
  title: string;
  text: string;
}

export interface Span {
  start: number;
  end: number;
  text: string;
}

export interface Chunk extends Span {
  /** Stable id: `${docId}#${index}` */
  id: string;
  docId: string;
  /** Position of the passage inside its document. */
  index: number;
}

export type RetrieverKind = "dense" | "bm25" | "hybrid";

export interface RetrievalConfig {
  mode: RetrieverKind;
  k: number;
  /** Maximal Marginal Relevance re-ranking to suppress near-duplicates. */
  mmr: boolean;
  mmrLambda: number;
  /** Reciprocal Rank Fusion constant. */
  rrfK: number;
}

export interface Hit {
  chunkId: string;
  /** 1-based rank in this list. */
  rank: number;
  score: number;
}

export interface RetrievalResult {
  query: string;
  dense: Hit[];
  bm25: Hit[];
  hybrid: Hit[];
  /** The list the configured retriever actually returns, full length. */
  final: Hit[];
  /** Dense cosine score per chunk id. */
  denseScore: Map<string, number>;
  bm25Score: Map<string, number>;
  /** Query terms (stemmed) that matched each chunk lexically. */
  matchedTerms: Map<string, string[]>;
}

/** A labelled answer location (used by the offline evaluation and tests). */
export interface Expectation {
  docId: string;
  quote: string;
}

export interface Question {
  id: string;
  text: string;
  expected: Expectation[];
}

export interface Corpus {
  id: string;
  name: string;
  description: string;
  docs: Doc[];
  questions: Question[];
}
