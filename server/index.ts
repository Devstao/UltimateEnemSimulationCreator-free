import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { generateQuiz } from "./services/quiz";
import { gerarPDF } from "./services/pdf";
import type { GeneratePayload, Questao, Area } from "./types";
import { randomUUID } from "crypto";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
const OUTPUT_DIR = path.join(process.cwd(), "output");

// Função para apagar arquivos com mais de 30 minutos
function cleanOldFiles() {
  const files = fs.readdirSync(OUTPUT_DIR);

  files.forEach((file) => {
    const filePath = path.join(OUTPUT_DIR, file);
    const stats = fs.statSync(filePath);

    const now = Date.now();
    const createdTime = stats.birthtimeMs; // tempo de criação
    const ageMinutes = (now - createdTime) / 1000 / 60;

    if (ageMinutes > 30) {
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Erro ao deletar ${file}:`, err);
        } else {
          console.log(`Arquivo removido: ${file}`);
        }
      });
    }
  });
}

// roda a cada 5 minutos
setInterval(cleanOldFiles, 5 * 60 * 1000);

// memória simples de conexões SSE por jobId
const sseClients = new Map<string, express.Response>();
app.get("/progress/:jobId", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const { jobId } = req.params;
  sseClients.set(jobId, res);

  req.on("close", () => {
    sseClients.delete(jobId);
  });
});

function sendProgress(jobId: string, payload: any) {
  const res = sseClients.get(jobId);
  if (res) res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

app.post("/generate-quiz", async (req, res) => {
  const body = req.body as GeneratePayload;
  const jobId = randomUUID();
  const counts = body.counts || {};

  // dispara geração sem bloquear a resposta do jobId
  (async () => {
    try {
      console.log("gerando quiz")
      const quiz = await generateQuiz(body.apiKey, body.model, counts, (ev) => {
        sendProgress(jobId, ev);
      });
      console.log("quiz")

      if (body.mode === "pdf") {
        const flat: Questao[] = Object.values(quiz).flat();
        const filename = path.join(process.cwd(), "output", `simulado_${jobId}.pdf`);
        // Organiza por áreas
        const grouped: Record<string, Questao[]> = quiz;

        gerarPDF(grouped, filename);
        sendProgress(jobId, { type: "file", message: "PDF pronto", path: `/download/${path.basename(filename)}` });
      } else {
        sendProgress(jobId, { type: "quiz", message: "Quiz pronto", quiz });
      }
      sendProgress(jobId, { type: "done" });
    } catch (e: any) {
      sendProgress(jobId, { type: "error", message: e?.message || "Erro ao gerar" });
    }
  })();

  res.json({ jobId });
});

app.get("/download/:file", (req, res) => {
  const file = req.params.file;
  const abs = path.join(process.cwd(), "output", file);
  if (!fs.existsSync(abs)) return res.status(404).send("Arquivo não encontrado");
  res.sendFile(abs);
});


app.get("/models", async (req, res) => {
  try {
    const apiKey = req.headers["authorization"]?.replace("Bearer ", "");
    if (!apiKey) {
      return res.status(400).json({ error: "Missing OpenRouter API key" });
    }

    const resp = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!resp.ok) {
      return res.status(resp.status).json({ error: "Failed to fetch models" });
    }

    const data = await resp.json();
    res.json(data.data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));