import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// Configuração do cliente LM Studio
const client = new OpenAI({
  apiKey: process.env.OPEN_ROUTER_API_KEY || "lm-studio",
  baseURL: "https://openrouter.io/api/v1",
});

// Modelos
// const CHAT_MODEL = "qwen/qwen3-4b-thinking-2507";
const CHAT_MODEL = "z-ai/glm-4-32b";
const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-qwen3-embedding-8b";
const PDF_OUTPUT_PATH = "./output"

if(!fs.existsSync(PDF_OUTPUT_PATH)) fs.mkdirSync(PDF_OUTPUT_PATH)
  
// ================== Utils ==================
function sanitizeText(text) {
  if (!text) return "";
  return text.replace(/<br\s*\/?>/gi, "\n").replace(/<.*?>/g, "").trim();
}
function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_");
}
function dot(a, b) { return a.reduce((s, v, i) => s + v * b[i], 0); }
function norm(a) { return Math.sqrt(a.reduce((s, v) => s + v * v, 0)); }
function cosineSim(a, b) { return dot(a, b) / (norm(a) * norm(b) + 1e-12); }

// ================== Embeddings ==================
async function embedTexts(texts) {
  const res = await client.embeddings.create({
    model: EMBED_MODEL,
    input: texts,
  });
  return res.data.map(d => d.embedding);
}

function splitIntoChunks(text) {
  const byDashes = text.split(/\n-{3,}\n/).map(s => s.trim()).filter(Boolean);
  if (byDashes.length > 1) return byDashes;
  const byMarkers = text.split(/\n(?=(Quest(ã|a)o\s*\d+|Titulo:|Título:|Enunciado:))/gi)
    .map(s => s.trim()).filter(Boolean);
  if (byMarkers.length > 1) return byMarkers;
  const byBlank = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  return byBlank;
}

async function buildIndexFromTxts(dir, cacheFile = "indices_cache.json") {
  const absDir = path.resolve(dir);
  
  // Se já existe cache, carrega e retorna
  if (fs.existsSync(cacheFile)) {
    console.log(`📂 Reutilizando índices do cache: ${cacheFile}`);
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  }

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
      console.warn(`⚠️ ${file} não gerou chunks`);
      continue;
    }

    const embeddings = [];
    const BATCH = 8;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const vecs = await embedTexts(batch);
      embeddings.push(...vecs.map((v, j) => ({
        id: `${disc}-${i + j}`,
        text: batch[j],
        embedding: v,
      })));
    }

    indices[disc] = embeddings;
    console.log(`✅ índice criado: ${disc} (${embeddings.length} trechos)`);
  }

  fs.writeFileSync(cacheFile, JSON.stringify(indices), "utf8");
  console.log(`💾 Cache salvo em ${cacheFile}`);
  return indices;
}

async function retrieveContext(query, index, k = 5) {
  if (!index || !Array.isArray(index) || index.length === 0) {
    console.warn("⚠️ índice não encontrado ou vazio");
    return "";
  }
  const qVec = (await embedTexts([query]))[0];
  return index
    .map(it => ({ ...it, score: cosineSim(qVec, it.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(s => s.text)
    .join("\n\n");
}

function getIndex(indices, ...aliases) {
  const keys = Object.keys(indices);
  for (const a of aliases) {
    const key = normalizeName(a);
    if (indices[key]?.length) return indices[key];
    const fuzzy = keys.find(k => k.includes(key) || key.includes(k));
    if (fuzzy && indices[fuzzy]?.length) return indices[fuzzy];
  }
  console.warn(`⚠️ Índice não encontrado: ${aliases.join(", ")}. Disponíveis: [${keys.join(", ")}]`);
  return null;
}

// ================== Questões ENEM ==================
async function gerarQuestao(area, contextoExtra = "") {
  const resp = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: "system", content: "Você é um gerador de questões do ENEM e deve sempre responder em JSON válido." },
      {
        role: "user",
        content: `Gere uma questão inédita de ${area}, estilo ENEM.\n\nContexto:\n${contextoExtra}\n\nFormato JSON:\n{\n "questao": "...",\n "opcoes": {"A":"...","B":"...","C":"...","D":"...","E":"..."},\n "resposta_correta": "A"|"B"|"C"|"D"|"E"\n}`
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "questao_enem",
        schema: {
          type: "object",
          properties: {
            questao: { type: "string" },
            opcoes: {
              type: "object",
              properties: { A: { type: "string" }, B: { type: "string" }, C: { type: "string" }, D: { type: "string" }, E: { type: "string" } },
              required: ["A", "B", "C", "D", "E"],
            },
            resposta_correta: { type: "string", enum: ["A", "B", "C", "D", "E"] },
          },
          required: ["questao", "opcoes", "resposta_correta"],
        },
      },
    },
  });
  return JSON.parse(resp.choices[0].message.content);
}

async function corrigirQuestao(questao, respostaAluno) {
  const prompt = `Questão: ${questao.questao}\nOpções: ${JSON.stringify(questao.opcoes)}\nGabarito: ${questao.resposta_correta}\nAlternativa correta: ${respostaAluno}\n\nResponda em JSON: { "correta": true/false }`;
  const resp = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: "system", content: "Você é um corretor do ENEM e deve sempre responder em JSON válido." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "correta",
        schema: {
          type: "object",
          properties: {
            correta: { type: "boolean" },
          },
          required: ["correta"],
        },
      },
    },
  });
  return JSON.parse(resp.choices[0].message.content);
}

async function gerarVariasQuestoes(area, qtd, contexto = "") {
  const qs = [];
  while (qs.length < qtd) {
    const q = await gerarQuestao(area, contexto);
    let acertos = 0;
    console.log(q)
    for (let i = 0; i < 5; i++) {
      const r = await corrigirQuestao(q, q.resposta_correta);
      console.log(r)
      if (r.correta) acertos++;
    }
    if (acertos >= 3) qs.push(q);
    else console.log(`⚠️ Questão de ${area} inconsistente, regenerando...`);
  }
  console.log(area, qs.length)
  return qs;
}

// ================== PDF (duas colunas) ==================
function gerarPDF(questoesPorArea, nomeArquivo) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(fs.createWriteStream(nomeArquivo));

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = pageWidth / 2 - 20;
  const lineHeight = 14;

  let col = 0;
  let y = doc.page.margins.top;
  let x = doc.page.margins.left;
  let num = 1;
  const gabarito = [];

  function addText(text, fontSize = 10, bold = false) {
    doc.fontSize(fontSize);
    doc.font(bold ? "Helvetica-Bold" : "Helvetica");
    const opts = { width: colWidth, align: "justify" };
    const h = doc.heightOfString(text, opts);
    if (y + h > doc.page.height - doc.page.margins.bottom) {
      if (col === 0) {
        col = 1;
        x = doc.page.margins.left + colWidth + 40;
        y = doc.page.margins.top;
      } else {
        doc.addPage();
        col = 0;
        x = doc.page.margins.left;
        y = doc.page.margins.top;
      }
    }
    doc.text(text, x, y, opts);
    y += h + lineHeight;
  }

  for (const [area, questoes] of Object.entries(questoesPorArea)) {
    addText(`=== ${area} ===`, 12, true);
    for (const q of questoes) {
      addText(`Questão ${num}`, 11, true);
      addText(sanitizeText(q.questao));
      for (const [letra, txt] of Object.entries(q.opcoes)) {
        addText(`${letra}) ${sanitizeText(txt)}`);
      }
      gabarito.push({ num, resp: q.resposta_correta });
      num++;
      y += lineHeight;
    }
  }

  doc.addPage();
  y = doc.page.margins.top;
  x = doc.page.margins.left;
  col = 0;
  addText("=== GABARITO ===", 12, true);
  for (const g of gabarito) {
    addText(`Questão ${g.num}: ${g.resp}`);
  }

  doc.end();
  console.log(`📄 PDF salvo: ${nomeArquivo}`);
}

// ================== MAIN ==================
async function main() {
  const questoes_pt = 5;
  const questoes_ing = 5;
  const demais = 5;

  const indices = await buildIndexFromTxts("./enem_questoes", "indices_cache.json");

  const ctxMat = await retrieveContext("questões de Matemática ENEM", getIndex(indices, "matematica"));
  const ctxNat = await retrieveContext("questões de Ciências da Natureza ENEM", getIndex(indices, "ciencias-natureza"));
  const ctxLing = await retrieveContext("questões de Linguagens ENEM", getIndex(indices, "linguagens"));
  const ctxIng = await retrieveContext("questões de Inglês ENEM", getIndex(indices, "ingles", "linguagens"));
  const ctxHum = await retrieveContext("questões de Ciências Humanas ENEM", getIndex(indices, "ciencias-humanas"));

  // Prova 1
  const qMat = await gerarVariasQuestoes("Matemática", demais, ctxMat);
  const qNat = await gerarVariasQuestoes("Ciências da Natureza", demais, ctxNat);
  gerarPDF({ "Matemática": qMat, "Ciências da Natureza": qNat }, path.join(PDF_OUTPUT_PATH, "simulado_prova1.pdf"));
  console.log("✅ Prova 1 gerada");

  // Prova 2
  const qLing = await gerarVariasQuestoes("Linguagens", questoes_pt, ctxLing);
  const qIng = await gerarVariasQuestoes("Inglês", questoes_ing, ctxIng);
  const qHum = await gerarVariasQuestoes("Ciências Humanas", demais, ctxHum);
  gerarPDF({ "Linguagens": [...qLing, ...qIng], "Ciências Humanas": qHum }, path.join(PDF_OUTPUT_PATH, "simulado_prova2.pdf"));
  console.log("✅ Prova 2 gerada");
}

main().catch(err => console.error("Erro:", err));
