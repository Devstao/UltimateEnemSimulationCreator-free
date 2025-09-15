import fs from "fs";
import path from "path";

// normaliza nome dos arquivos para chave do índice
function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tira acentos
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function splitIntoChunks(text) {
  // tenta vários tipos de separador
  const byDashes = text.split(/\n-{3,}\n/).map(s => s.trim()).filter(Boolean);
  if (byDashes.length > 1) return byDashes;

  const byMarkers = text.split(/\n(?=(Quest(ã|a)o\s*\d+|Titulo:|Título:|Enunciado:))/gi)
    .map(s => s.trim()).filter(Boolean);
  if (byMarkers.length > 1) return byMarkers;

  const byBlank = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  return byBlank;
}

async function buildIndexFromTxts(dir) {
  const absDir = path.resolve(dir); // resolve caminho absoluto
  if (!fs.existsSync(absDir)) {
    console.warn(`⚠️ Diretório não encontrado: ${absDir}`);
    return {};
  }

  const files = fs.readdirSync(absDir).filter(f => f.endsWith(".txt"));
  if (!files.length) {
    console.warn(`⚠️ Nenhum .txt encontrado em ${absDir}`);
    return {};
  }

  console.log("📄 Arquivos encontrados:", files.join(", "));

  const indices = {};
  for (const file of files) {
    const rawName = path.basename(file, ".txt");
    const disc = normalizeName(rawName);

    const text = fs.readFileSync(path.join(absDir, file), "utf8");
    const chunks = splitIntoChunks(text);

    if (!chunks.length) {
      console.warn(`⚠️ ${file} não gerou chunks (verifique separadores ou conteúdo)`);
      continue;
    }

    const embeddings = [];
    const BATCH = 8;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const vecs = await embedTexts(batch); // usa sua função existente
      embeddings.push(
        ...vecs.map((v, j) => ({
          id: `${disc}-${i + j}`,
          text: batch[j],
          embedding: v,
        }))
      );
    }

    indices[disc] = embeddings;
    console.log(`✅ índice criado: ${disc} (${embeddings.length} trechos)`);
  }

  console.log("🗂️ Disciplinas indexadas:", Object.keys(indices));
  return indices;
}
