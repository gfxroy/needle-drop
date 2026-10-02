import { useEngineStatus } from "../state/engine";

/** A 1px progress line pinned to the top edge while the embedding model downloads. */
export function ModelLine() {
  const s = useEngineStatus();
  const loading = s.phase === "loading" || s.phase === "idle";
  const value = s.phase === "ready" ? 1 : Math.max(0.03, s.progress);
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-px" data-testid="model-line" data-phase={s.phase} aria-hidden>
      <div className="h-full bg-fg transition-[width,opacity] duration-200 ease-out" style={{ width: `${value * 100}%`, opacity: loading ? 1 : 0 }} />
    </div>
  );
}
