import fs from "fs";
import path from "path";
import { pipeline } from "@xenova/transformers";
import { cosineSim } from "../utils/text";
import OpenAI from "openai";
import crypto from "crypto";

export type IndexedChunk = { id: string; text: string; embedding: number[] };

const CACHE_FILE = path.resolve("embeddings_cache.json");
let cache: Record<string, number[]> = {};

let embedderPromise: Promise<any> | null = null;
function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return embedderPromise;
}

// carrega cache se existir
if (fs.existsSync(CACHE_FILE)) {
  cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
}

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || "lm-studio",
  baseURL: "http://localhost:1234/v1",
});

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const res = await client.embeddings.create({
    model: process.env.EMBED_MODEL || "text-embedding-qwen3-embedding-8b",
    input: texts,
  });
  return res.data.map(d => d.embedding);
}


export function splitIntoChunksSmart(text: string): string[] {
  // Pequeno helper para fatiar arquivos longos (~200-400 tokens por chunk)
  const para = text.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";
  for (const p of para) {
    if ((buf + "\n\n" + p).length > 1200) {
      if (buf) chunks.push(buf);
      buf = p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export async function buildIndexFromTxts(dir: string, cacheFile = "indices_cache.json") {
  const absDir = path.resolve(dir);
  const cacheFileResolved = path.join(dir, cacheFile);
  const files = fs.readdirSync(absDir).filter(f => f.endsWith(".txt"));
  const indices: Record<string, IndexedChunk[]> = {};
  for (const file of files) {
    const rawName = path.basename(file, ".txt");
    const disc = rawName
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "_");
    const text = fs.readFileSync(path.join(absDir, file), "utf8");
    const chunks = splitIntoChunksSmart(text);
    const vecs = await embedTexts(chunks);
    indices[disc] = chunks.map((t, i) => ({ id: `${disc}-${i}`, text: t, embedding: vecs[i] }));
  }
  fs.writeFileSync(cacheFileResolved, JSON.stringify(indices), "utf8");
  return indices;
}

export async function retrieveContext(query: string, index: IndexedChunk[] | null, k = 5) {
  if (!index || !index.length) return "";
  const [qVec] = await embedTexts([query]);
  return index
    .map(it => ({ ...it, score: cosineSim(qVec, it.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(s => s.text)
    .join("\n\n");
}