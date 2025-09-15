export function sanitizeText(text?: string) {
  if (!text) return "";
  return text.replace(/<br\s*\/?>(?=\n|$)/gi, "\n").replace(/<.*?>/g, "").trim();
}

export function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function splitIntoChunks(text: string): string[] {
  const byDashes = text.split(/\n-{3,}\n/).map(s => s.trim()).filter(Boolean);
  if (byDashes.length > 1) return byDashes;
  const byMarkers = text
    .split(/\n(?=(Quest(ã|a)o\s*\d+|Titulo:|Título:|Enunciado:))/gi)
    .map(s => s.trim())
    .filter(Boolean);
  if (byMarkers.length > 1) return byMarkers;
  const byBlank = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  return byBlank;
}

export function cosineSim(a: number[], b: number[]) {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (na * nb + 1e-12);
}