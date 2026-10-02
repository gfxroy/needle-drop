import { Fragment } from "react";
import { tokenize, tokenizeWithOffsets } from "../lib/text";
import type { Passage } from "../lib/verdict";

/** Passage text with the question's words underlined (white on gray, no colour). */
function Underlined({ text, query }: { text: string; query: string }) {
  const terms = new Set(tokenize(query));
  const hits = tokenizeWithOffsets(text).filter((t) => terms.has(t.term));
  const out: React.ReactNode[] = [];
  let at = 0;
  for (const h of hits) {
    if (h.start > at) out.push(<Fragment key={`t${at}`}>{text.slice(at, h.start)}</Fragment>);
    out.push(
      <span key={`h${h.start}`} className="text-fg underline decoration-fg/50 decoration-1 underline-offset-[3px]">
        {text.slice(h.start, h.end)}
      </span>,
    );
    at = h.end;
  }
  if (at < text.length) out.push(<Fragment key={`t${at}`}>{text.slice(at)}</Fragment>);
  return <>{out}</>;
}

export function PassageCard({ passage, total, query, emphasized, delay }: { passage: Passage; total: number; query: string; emphasized: boolean; delay: number }) {
  const pct = Math.round(passage.match * 100);
  return (
    <article
      data-testid="passage"
      data-rank={passage.rank}
      data-emphasized={emphasized ? "true" : "false"}
      className={`animate-fade rounded-lg border p-5 transition-colors duration-200 ${emphasized ? "border-fg/45" : "border-line"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <header className="mb-3 flex items-center gap-3 text-[13px]">
        <span className={emphasized ? "font-medium text-fg" : "font-medium text-muted"}>Passage {passage.rank}</span>
        <span className="text-faint">
          {passage.chunk.index + 1} of {total} in the document
        </span>
        <span className="ml-auto flex items-center gap-2.5 text-faint" title="How strongly this passage matches your question">
          <span className="relative h-[2px] w-16 overflow-hidden rounded-full bg-line sm:w-20">
            <span className="absolute inset-y-0 left-0 rounded-full bg-fg/80" style={{ width: `${pct}%` }} />
          </span>
          <span className="w-8 text-right tabular-nums">{pct}%</span>
        </span>
      </header>
      <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-muted">
        <Underlined text={passage.chunk.text} query={query} />
      </p>
    </article>
  );
}
