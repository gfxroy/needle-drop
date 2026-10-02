import { useRef, useState } from "react";
import { ModelLine } from "./components/ModelLine";
import { PassageCard } from "./components/PassageCard";
import { EXAMPLES } from "./data";
import { DEFAULT_SETTINGS, MODEL, type PassageSize, type SearchBy, type Settings } from "./lib/config";
import { check, type CheckResult } from "./lib/pipeline";
import { useEngine, useEngineStatus } from "./state/engine";

function Choice<T extends string>({ label, hint, value, options, onChange, testId }: { label: string; hint: string; value: T; options: [T, string][]; onChange: (v: T) => void; testId: string }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted">{label}</span>
        <div className="flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label={label} data-testid={testId}>
          {options.map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={v === value}
              data-value={v}
              onClick={() => onChange(v)}
              className={`rounded-md px-3 py-1.5 text-[13px] transition-colors duration-150 ${v === value ? "bg-fg/10 text-fg" : "text-faint hover:text-muted"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[13px] leading-snug text-faint">{hint}</p>
    </div>
  );
}

export default function App() {
  const engine = useEngine();
  const status = useEngineStatus();
  const [text, setText] = useState("");
  const [question, setQuestion] = useState("");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const seq = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const run = async (opts: { text?: string; question?: string; settings?: Settings; scroll?: boolean } = {}) => {
    const t = opts.text ?? text;
    const q = (opts.question ?? question).trim();
    const s = opts.settings ?? settings;
    if (!t.trim() || !q) return;
    const id = ++seq.current;
    setBusy(true);
    setError(null);
    try {
      if (engine.status.phase !== "ready") {
        setNote(`Loading the model (${MODEL.sizeMB} MB, first visit only)…`);
        await engine.ready();
      }
      setNote(null);
      const r = await check(t, q, s, engine.embedder, (p) => {
        if (id === seq.current && p.total > 8) setNote(`Reading passages… ${p.done} of ${p.total}`);
      });
      if (id !== seq.current) return;
      setResult(r);
      setNote(null);
      if (opts.scroll) requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      if (id === seq.current) setError(String((e as Error)?.message ?? e));
    } finally {
      if (id === seq.current) setBusy(false);
    }
  };

  const changeSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (result) void run({ settings: next });
  };

  const loadExample = (i: number) => {
    const ex = EXAMPLES[i];
    setText(ex.text);
    setQuestion(ex.question);
    setResult(null);
    void run({ text: ex.text, question: ex.question });
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(txt|md|markdown)$/i.test(file.name) && !file.type.startsWith("text/")) {
      setError("Only .txt and .md files are supported.");
      return;
    }
    setText((await file.text()).replace(/\r\n/g, "\n"));
    setResult(null);
    setError(null);
  };

  const loadingModel = status.phase !== "ready" && status.phase !== "error";
  const canCheck = !!text.trim() && !!question.trim() && !busy;

  return (
    <div className="flex min-h-screen flex-col">
      <ModelLine />
      <header className="mx-auto flex w-full max-w-[640px] items-center justify-between px-5 pt-8 sm:pt-10">
        <span className="text-[15px] font-semibold tracking-tight">Needle Drop</span>
        <a href="https://github.com/gfxroy/needle-drop" className="text-[13px] text-faint transition-colors duration-150 hover:text-fg">
          GitHub
        </a>
      </header>

      <main className="mx-auto w-full max-w-[640px] flex-1 px-5 pt-16 pb-24 sm:pt-24">
        <h1 className="text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance sm:text-[40px]">Paste a document. Ask a question. See what an AI would actually read.</h1>

        <p className="mt-6 text-[14px] text-faint">
          Try an example:{" "}
          {EXAMPLES.map((ex, i) => (
            <span key={ex.id}>
              {i > 0 && <span className="mx-1.5">·</span>}
              <button onClick={() => loadExample(i)} className="text-muted underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-fg hover:decoration-fg" data-testid={`example-${ex.id}`}>
                {ex.label}
              </button>
            </span>
          ))}
        </p>

        <form
          className="mt-10 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ scroll: true });
          }}
        >
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void readFile(e.dataTransfer.files[0]);
              }}
              placeholder="Paste a document here, or drop a .txt or .md file."
              spellCheck={false}
              aria-label="Document"
              data-testid="doc-input"
              className={`block h-56 w-full resize-y rounded-lg border bg-transparent px-4 py-3.5 text-[14px] leading-relaxed text-fg transition-colors duration-150 outline-none sm:h-64 ${dragging ? "border-fg" : "border-line focus:border-line-strong"}`}
            />
            <div className="mt-2 flex items-center justify-between text-[12px] text-faint">
              <button type="button" onClick={() => fileInput.current?.click()} className="transition-colors duration-150 hover:text-muted">
                Open a file
              </button>
              <input ref={fileInput} type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" className="hidden" onChange={(e) => void readFile(e.target.files?.[0])} />
              <span className="tabular-nums">{text ? `${text.length.toLocaleString("en-US")} characters` : ""}</span>
            </div>
          </div>

          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about it"
            aria-label="Question"
            data-testid="question-input"
            className="block h-12 w-full rounded-lg border border-line bg-transparent px-4 text-[15px] text-fg transition-colors duration-150 outline-none focus:border-line-strong"
          />

          <div className="flex items-center gap-5 pt-1">
            <button
              type="submit"
              disabled={!canCheck}
              data-testid="check-button"
              className="h-11 rounded-lg bg-fg px-6 text-[14px] font-medium text-bg transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {busy ? "Checking…" : "Check"}
            </button>
            <button type="button" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings} data-testid="settings-toggle" className="text-[13px] text-faint transition-colors duration-150 hover:text-muted">
              Settings
            </button>
          </div>
          {(note || (loadingModel && busy)) && <p className="text-[13px] text-faint" data-testid="status-note">{note}</p>}
          {error && <p className="text-[13px] text-muted">{error}</p>}

          {showSettings && (
            <div className="animate-fade space-y-6 rounded-lg border border-line p-5" data-testid="settings">
              <Choice<PassageSize>
                label="Passage size"
                hint="Documents are cut into passages before searching. Small passages are precise but can cut an answer in half."
                value={settings.size}
                options={[
                  ["small", "Small"],
                  ["medium", "Medium"],
                  ["large", "Large"],
                ]}
                onChange={(size) => changeSettings({ size })}
                testId="setting-size"
              />
              <Choice<SearchBy>
                label="Search by"
                hint="Words finds exact terms and codes. Meaning finds paraphrases. Both combines the two."
                value={settings.searchBy}
                options={[
                  ["words", "Words"],
                  ["meaning", "Meaning"],
                  ["both", "Both"],
                ]}
                onChange={(searchBy) => changeSettings({ searchBy })}
                testId="setting-search"
              />
            </div>
          )}
        </form>

        {result && (
          <section ref={resultsRef} className={`mt-16 scroll-mt-8 transition-opacity duration-200 ${busy ? "opacity-50" : "opacity-100"}`} data-testid="results" aria-live="polite">
            <p key={result.verdict.text} className="animate-fade text-[19px] leading-snug font-medium tracking-[-0.01em] text-fg sm:text-[21px]" data-testid="verdict" data-kind={result.verdict.kind}>
              {result.verdict.text}
            </p>
            {result.verdict.suggestion && (
              <button onClick={() => changeSettings(result.verdict.suggestion!)} className="mt-3 text-[14px] text-muted underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-fg hover:decoration-fg" data-testid="suggestion">
                {result.verdict.suggestionLabel}
              </button>
            )}
            <div className="mt-10 mb-4 flex items-baseline justify-between text-[12px] tracking-[0.08em] text-faint uppercase">
              <span>What the AI would read</span>
              <span className="tracking-normal normal-case">
                top {result.top.length} of {result.index.chunks.length} passages
              </span>
            </div>
            <div className="space-y-3">
              {result.top.map((p, i) => (
                <PassageCard key={p.chunk.id} passage={p} total={result.index.chunks.length} query={result.result.query} emphasized={result.verdict.passages.includes(p.rank)} delay={i * 50} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="mx-auto w-full max-w-[640px] px-5 pb-10 text-[12px] leading-relaxed text-faint">
        Runs entirely in your browser. No API key, nothing uploaded.{" "}
        <span className="whitespace-nowrap">
          {MODEL.label}
          {status.device ? ` · ${status.device === "webgpu" ? "WebGPU" : "WASM"}` : ""}
        </span>
      </footer>
    </div>
  );
}
