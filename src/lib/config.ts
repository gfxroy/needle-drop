import type { RetrieverKind } from "./types";

export type PassageSize = "small" | "medium" | "large";
export type SearchBy = "words" | "meaning" | "both";

export interface Settings {
  size: PassageSize;
  searchBy: SearchBy;
}

export const DEFAULT_SETTINGS: Settings = { size: "medium", searchBy: "meaning" };

/**
 * Passage sizes in characters. "large" stays under the embedding model's 256-token
 * window (~1,000 chars of English) so nothing is silently truncated before embedding.
 */
export const PASSAGE_CHARS: Record<PassageSize, number> = { small: 300, medium: 600, large: 1000 };

export const RETRIEVER: Record<SearchBy, RetrieverKind> = { words: "bm25", meaning: "dense", both: "hybrid" };

export const TOP_K = 3;

export const MODEL = {
  id: "Xenova/all-MiniLM-L6-v2",
  label: "all-MiniLM-L6-v2",
  maxTokens: 256,
  sizeMB: 45,
} as const;

export type ModelId = typeof MODEL.id;
