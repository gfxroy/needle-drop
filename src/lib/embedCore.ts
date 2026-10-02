/**
 * Shared embedding core used by both the browser Web Worker and the Node puzzle-verification script.
 * We call the tokenizer + model directly (instead of the feature-extraction pipeline) so that we can
 * (1) truncate at the model's *trained* window, (2) report real token counts, (3) pick the pooling.
 */
import type * as Transformers from "@huggingface/transformers";

export type Pooling = "mean" | "cls";

export interface LoadOptions {
  device: "webgpu" | "wasm" | "cpu";
  dtype: "fp32" | "fp16" | "q8";
  maxTokens: number;
  pooling: Pooling;
  progress_callback?: (p: unknown) => void;
}

export interface EmbedOutput {
  vectors: Float32Array[];
  /** Untruncated token count per text (including special tokens). */
  tokens: number[];
}

export interface EmbedderCore {
  embed(texts: string[]): Promise<EmbedOutput>;
}

export const POOLING: Record<string, Pooling> = {
  "Xenova/all-MiniLM-L6-v2": "mean",
  "Xenova/bge-small-en-v1.5": "cls",
};

export async function loadEmbedder(tf: typeof Transformers, modelId: string, opts: LoadOptions): Promise<EmbedderCore> {
  const tokenizer = await tf.AutoTokenizer.from_pretrained(modelId, { progress_callback: opts.progress_callback as never });
  const model = await tf.AutoModel.from_pretrained(modelId, {
    device: opts.device,
    dtype: opts.dtype,
    progress_callback: opts.progress_callback as never,
  });

  async function embedBatch(texts: string[]): Promise<Float32Array[]> {
    const inputs = tokenizer(texts, { padding: true, truncation: true, max_length: opts.maxTokens });
    const output = await model(inputs);
    const hidden = (output.last_hidden_state ?? output.token_embeddings) as Transformers.Tensor;
    const [B, T, H] = hidden.dims as number[];
    const data = hidden.data as Float32Array;
    const mask = inputs.attention_mask.data as BigInt64Array | number[];
    const vectors: Float32Array[] = [];
    for (let b = 0; b < B; b++) {
      const v = new Float32Array(H);
      if (opts.pooling === "cls") {
        v.set(data.subarray(b * T * H, b * T * H + H));
      } else {
        let count = 0;
        for (let t = 0; t < T; t++) {
          if (Number(mask[b * T + t]) === 0) continue;
          count++;
          const off = (b * T + t) * H;
          for (let h = 0; h < H; h++) v[h] += data[off + h];
        }
        for (let h = 0; h < H; h++) v[h] /= count || 1;
      }
      let n = 0;
      for (let h = 0; h < H; h++) n += v[h] * v[h];
      n = Math.sqrt(n) || 1;
      for (let h = 0; h < H; h++) v[h] /= n;
      vectors.push(v);
    }
    return vectors;
  }

  return {
    async embed(texts: string[]) {
      const vectors: Float32Array[] = [];
      // q8 models quantize activations dynamically per *batch*, so batch composition changes the vectors.
      // Embedding one text at a time keeps every vector a pure function of its text (cacheable, reproducible).
      const BATCH = opts.dtype === "q8" ? 1 : 16;
      for (let i = 0; i < texts.length; i += BATCH) vectors.push(...(await embedBatch(texts.slice(i, i + BATCH))));
      const tokens = texts.map((t) => (tokenizer.encode(t) as number[]).length);
      return { vectors, tokens };
    },
  };
}
