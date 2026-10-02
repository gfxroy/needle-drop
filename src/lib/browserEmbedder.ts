import { createStore, getMany, setMany } from "idb-keyval";
import { MODEL, type ModelId } from "./config";
import { CachedEmbedder, type CacheEntry } from "./pipeline";
import type { WorkerIn, WorkerOut } from "../worker/embed.worker";

export interface EngineStatus {
  phase: "idle" | "loading" | "ready" | "error";
  model: ModelId;
  message: string;
  /** 0..1 aggregate download progress */
  progress: number;
  loadedBytes: number;
  totalBytes: number;
  device?: string;
  dtype?: string;
  loadMs?: number;
  error?: string;
}

const store = typeof indexedDB !== "undefined" ? createStore("needle-drop-embeddings", "vectors") : undefined;

/** Owns the Web Worker and exposes a cached embedder (memory + IndexedDB). */
export class WorkerEngine {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, { resolve: (v: { vectors: Float32Array[]; tokens: number[] }) => void; reject: (e: Error) => void }>();
  private files = new Map<string, { loaded: number; total: number }>();
  private listeners = new Set<(s: EngineStatus) => void>();
  private readyPromise: Promise<void> | null = null;
  status: EngineStatus;
  embedder: CachedEmbedder;

  constructor(model: ModelId) {
    this.status = { phase: "idle", model, message: "Model not loaded", progress: 0, loadedBytes: 0, totalBytes: 0 };
    this.embedder = this.makeEmbedder(model);
  }

  private makeEmbedder(model: ModelId) {
    const emb = new CachedEmbedder(model, (texts) => this.embedRaw(texts));
    if (store) {
      emb.persist = {
        get: (keys) => getMany<CacheEntry>(keys, store).catch(() => keys.map(() => undefined)),
        set: (entries) => setMany(entries, store),
      };
    }
    return emb;
  }

  subscribe(fn: (s: EngineStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<EngineStatus>) {
    this.status = { ...this.status, ...patch };
    for (const l of this.listeners) l(this.status);
  }

  load(model: ModelId = this.status.model): Promise<void> {
    if (this.readyPromise && model === this.status.model && this.status.phase !== "error") return this.readyPromise;
    this.worker?.terminate();
    this.files.clear();
    for (const p of this.pending.values()) p.reject(new Error("Model reloaded"));
    this.pending.clear();
    if (model !== this.status.model) this.embedder = this.makeEmbedder(model);
    this.set({ phase: "loading", model, message: "Starting worker…", progress: 0, loadedBytes: 0, totalBytes: 0, error: undefined });
    const worker = new Worker(new URL("../worker/embed.worker.ts", import.meta.url), { type: "module" });
    this.worker = worker;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<WorkerOut>) => {
        const m = e.data;
        switch (m.type) {
          case "progress": {
            this.files.set(m.file, { loaded: m.loaded, total: m.total });
            let loaded = 0;
            let total = 0;
            for (const f of this.files.values()) {
              loaded += f.loaded;
              total += f.total;
            }
            this.set({ loadedBytes: loaded, totalBytes: total, progress: total ? loaded / total : 0 });
            break;
          }
          case "status":
            this.set({ message: m.message });
            break;
          case "ready":
            this.set({ phase: "ready", device: m.device, dtype: m.dtype, loadMs: m.ms, progress: 1, message: "Ready" });
            resolve();
            break;
          case "result":
            this.pending.get(m.id)?.resolve({ vectors: m.vectors, tokens: m.tokens });
            this.pending.delete(m.id);
            break;
          case "error":
            if (m.id !== undefined) {
              this.pending.get(m.id)?.reject(new Error(m.message));
              this.pending.delete(m.id);
            } else {
              this.set({ phase: "error", error: m.message, message: m.message });
              reject(new Error(m.message));
            }
        }
      };
      worker.onerror = (e) => {
        this.set({ phase: "error", error: e.message, message: e.message });
        reject(new Error(e.message));
      };
    });
    this.readyPromise.catch(() => undefined);
    const msg: WorkerIn = { type: "load", model, maxTokens: MODEL.maxTokens, device: "auto" };
    worker.postMessage(msg);
    return this.readyPromise;
  }

  ready(): Promise<void> {
    return this.readyPromise ?? this.load();
  }

  private async embedRaw(texts: string[]): Promise<{ vectors: Float32Array[]; tokens: number[] }> {
    await this.ready();
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const msg: WorkerIn = { type: "embed", id, texts };
      this.worker!.postMessage(msg);
    });
  }
}
