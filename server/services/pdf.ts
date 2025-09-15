import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import type { Questao } from "../types";
import { sanitizeText } from "../utils/text";

export function gerarPDF(questoesPorArea: Record<string, Questao[]>, nomeArquivo: string) {
  const dir = path.dirname(nomeArquivo);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(fs.createWriteStream(nomeArquivo));

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = pageWidth / 2 - 20;
  const lineHeight = 14;

  let col = 0;
  let y = doc.page.margins.top;
  let x = doc.page.margins.left;
  let num = 1;
  const gabarito: { num: number; resp: string }[] = [];

  function addText(text: string, fontSize = 10, bold = false) {
    doc.fontSize(fontSize);
    doc.font(bold ? "Helvetica-Bold" : "Helvetica");
    const opts = { width: colWidth, align: "justify" } as const;
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
    doc.text(text, x, y, opts as any);
    y += h + lineHeight;
  }

  for (const [area, questoes] of Object.entries(questoesPorArea)) {
    if(questoes.length === 0) continue
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
  for (const g of gabarito) addText(`Questão ${g.num}: ${g.resp}`);

  doc.end();
}