import type { Corpus } from "../lib/types";
import { nimbus } from "./nimbus";
import { northwind } from "./northwind";

export const CORPORA: Corpus[] = [northwind, nimbus];

export interface Example {
  id: string;
  label: string;
  title: string;
  text: string;
  question: string;
}

/** A corpus flattened into one pasted-style document. */
export function corpusText(c: Corpus): string {
  return c.docs.map((d) => d.text.trim()).join("\n\n");
}

export const EXAMPLES: Example[] = [
  {
    id: "handbook",
    label: "Employee handbook",
    title: "Northwind employee handbook",
    text: corpusText(northwind),
    question: "How many vacation days do I get after 7 years at the company?",
  },
  {
    id: "api",
    label: "API docs",
    title: "Nimbus API reference",
    text: corpusText(nimbus),
    question: "What does error E4021 mean?",
  },
];
