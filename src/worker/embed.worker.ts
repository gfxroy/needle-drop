/// <reference lib="webworker" />
/**
 * Embedding Web Worker: loads a sentence-embedding model with transformers.js and embeds text off the main thread.
 * Prefers WebGPU (fp16 when the adapter supports shader-f16, else fp32) and falls back to WASM fp16 → fp32.
 */
import * as tf from "@huggingface/transformers";
import { loadEmbedder, POOLING, type EmbedderCore } from "../lib/embedCore";

export type WorkerIn =
  | { type: "load"; model: string; maxTokens: number; device: "auto" | "wasm" | "webgpu" }
  | { type: "embed"; id: number; texts: string[] };

export type WorkerOut =
  | { type: "progress"; file: string; loaded: number; total: number }
  | { type: "status"; message: string }
  | { type: "ready"; device: string; dtype: string; ms: number }
  | { type: "result"; id: number; vectors: Float32Array[]; tokens: number[] }
  | { type: "error"; id?: number; message: string };

declare const self: DedicatedWorkerGlobalScope;

tf.env.allowLocalModels = false;
tf.env.useBrowserCache = true;

let core: EmbedderCore | null = null;
const post = (m: WorkerOut, transfer: Transferable[] = []) => self.postMessage(m, transfer);

async function webgpuDtype(): Promise<"fp16" | "fp32" | null> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
  if (!gpu) return null;
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return null;
    return adapter.features.has("shader-f16") ? "fp16" : "fp32";
  } catch {
    return null;
  }
}

async function load(model: string, maxTokens: number, device: "auto" | "wasm" | "webgpu") {
  const t0 = performance.now();
  const progress_callback = (p: unknown) => {
    const info = p as { status: string; file?: string; loaded?: number; total?: number };
    if (info.status === "progress" && info.file) post({ type: "progress", file: info.file, loaded: info.loaded ?? 0, total: info.total ?? 0 });
  };
  const attempts: { device: "webgpu" | "wasm"; dtype: "fp16" | "fp32" }[] = [];
  if (device !== "wasm") {
    const d = await webgpuDtype();
    if (d) attempts.push({ device: "webgpu", dtype: d });
  }
  attempts.push({ device: "wasm", dtype: "fp16" }, { device: "wasm", dtype: "fp32" });
  let lastErr: unknown;
  for (const a of attempts) {
    try {
      post({ type: "status", message: `Loading ${model.split("/")[1]} (${a.device.toUpperCase()} · ${a.dtype})` });
      const candidate = await loadEmbedder(tf, model, { device: a.device, dtype: a.dtype, maxTokens, pooling: POOLING[model] ?? "mean", progress_callback });
      // smoke test: catches backends that load but cannot execute
      const probe = await candidate.embed(["warm-up"]);
      if (!probe.vectors[0] || Number.isNaN(probe.vectors[0][0])) throw new Error("backend produced NaN");
      core = candidate;
      post({ type: "ready", device: a.device, dtype: a.dtype, ms: Math.round(performance.now() - t0) });
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`[needle-drop] ${a.device}/${a.dtype} failed, falling back`, err);
    }
  }
  post({ type: "error", message: `Could not load the embedding model: ${String((lastErr as Error)?.message ?? lastErr)}` });
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  if (msg.type === "load") {
    core = null;
    await load(msg.model, msg.maxTokens, msg.device);
    return;
  }
  if (msg.type === "embed") {
    if (!core) {
      post({ type: "error", id: msg.id, message: "Model not loaded" });
      return;
    }
    try {
      const out = await core.embed(msg.texts);
      post({ type: "result", id: msg.id, vectors: out.vectors, tokens: out.tokens }, out.vectors.map((v) => v.buffer as ArrayBuffer));
    } catch (err) {
      post({ type: "error", id: msg.id, message: String((err as Error)?.message ?? err) });
    }
  }
};
