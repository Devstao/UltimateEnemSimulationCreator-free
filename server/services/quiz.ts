import path from "path";
import fs from "fs";
import { chatJSON, openRouterClient } from "./llm";
import { buildIndexFromTxts, retrieveContext } from "./embeddings";
import type { Questao, Area } from "../types";

export type ProgressEvent = { type: string; message: string; current?: number; total?: number };

const AREAS: Area[] = [
  "Matemática",
  "Ciências da Natureza",
  "Linguagens",
  "Inglês",
  "Espanhol",
  "Ciências Humanas",
];

export async function generateQuiz(
  apiKey: string,
  model: string,
  counts: Partial<Record<Area, number>>,
  onProgress: (ev: ProgressEvent) => void
) {
  const client = apiKey;
  const indices = await buildIndexFromTxts(path.join(process.cwd(), "enem_questoes"), "indices_cache.json");
  const result: Record<Area, Questao[]> = {
    "Matemática": [],
    "Ciências da Natureza": [],
    "Linguagens": [],
    "Inglês": [],
    "Espanhol": [],
    "Ciências Humanas": [],
  };

  for (const area of AREAS) {
    const n = counts[area] ?? 0;
    if (!n) continue;
    if (n > 45 || n < 0) continue

    const getIndex = (aliases: string[]) => {
      const keys = Object.keys(indices);
      for (const a of aliases) {
        const key = a
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "_");
        if (indices[key]?.length) return indices[key];
        const fuzzy = keys.find(k => k.includes(key) || key.includes(k));
        if (fuzzy && indices[fuzzy]?.length) return indices[fuzzy];
      }
      return null;
    };

    const idx = getIndex([
      area,
      area === "Ciências da Natureza" ? "ciencias-natureza" : area,
      area === "Ciências Humanas" ? "ciencias-humanas" : area,
      area === "Linguagens" ? "linguagens" : area,
      area === "Matemática" ? "matematica" : area,
      area === "Inglês" ? "ingles" : area,
      area === "Espanhol" ? "espanhol" : area,
    ]);


    const ctx = await retrieveContext(`questões de ${area} estilo ENEM`, idx);
    console.log("chega aqui")

    const qs = await chatJSON(
      client,
      model,
      "Você é um gerador de questões do ENEM e deve SEMPRE responder em JSON válido.",
      `Gere ${n > 1 ? n + " questões inéditas" : "UMA Questão inédita"} de ${area}, no estilo ENEM.\n\nContexto:\n${ctx}\n\nFormato JSON:\n{\n "questao": "...",\n "opcoes": {"A":"...","B":"...","C":"...","D":"...","E":"..."},\n "resposta_correta": "A"|"B"|"C"|"D"|"E"\n}`
    );

    if (qs?.filter(qs=> !qs?.questao || !qs?.opcoes || !qs?.resposta_correta).length > 0) {
      continue;
    }
    result[area] = qs;
  }

  onProgress({ type: "done", message: "Questionário gerado" });
  return result;
}