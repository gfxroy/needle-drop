/** Node-side embedder for offline evaluation (same tokenizer/model/pooling as the browser worker). */
import * as tf from "@huggingface/transformers";
import fs from "node:fs";
import path from "node:path";
import { MODEL, type ModelId } from "../src/lib/config.ts";
import { loadEmbedder, POOLING } from "../src/lib/embedCore.ts";
import { CachedEmbedder, type CacheEntry } from "../src/lib/pipeline.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
tf.env.cacheDir = path.join(ROOT, ".cache/models");

export async function nodeEmbedder(model: ModelId = MODEL.id, dtype: "fp16" | "fp32" | "q8" = "fp16") {
  const core = await loadEmbedder(tf, model, { device: "cpu", dtype, maxTokens: MODEL.maxTokens, pooling: POOLING[model] });
  const emb = new CachedEmbedder(model, (texts) => core.embed(texts));
  const file = path.join(ROOT, ".cache", `emb-${model.replace("/", "_")}-${dtype}.json`);
  const disk: Record<string, { v: number[]; t: number }> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  let dirty = false;
  emb.persist = {
    async get(keys) {
      return keys.map((k) => (disk[k] ? ({ v: Float32Array.from(disk[k].v), t: disk[k].t } as CacheEntry) : undefined));
    },
    async set(entries) {
      for (const [k, e] of entries) disk[k] = { v: Array.from(e.v, (x) => Math.round(x * 1e6) / 1e6), t: e.t };
      dirty = true;
    },
  };
  const save = () => {
    if (!dirty) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(disk));
    dirty = false;
  };
  return { emb, save };
}
