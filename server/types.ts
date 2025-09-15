export type Questao = {
  questao: string;
  opcoes: { A: string; B: string; C: string; D: string; E: string };
  resposta_correta: "A" | "B" | "C" | "D" | "E";
};

export type Area =
  | "Matemática"
  | "Ciências da Natureza"
  | "Linguagens"
  | "Inglês"
  | "Espanhol"
  | "Ciências Humanas";

export type GeneratePayload = {
  apiKey: string;
  model: string; // ex: "qwen/qwen3-4b", "mistral/mistral-7b"
  counts: Partial<Record<Area, number>>; // quantas questões por área
  mode: "online" | "pdf";
};