import fs from "fs";
import path from "path";
import { franc } from "franc";

// Caminho raiz onde estão os diretórios com as questões do ENEM
const rootDir = "./public_descrito";
const outDir = "C:\\Users\\youmi\\Documents\\enimen\\server\\enem_questoes";
const allLangs = {
  "eng": "Inglês",
  "spa": "Espanhol",
  "por": "Português"
}
// Função recursiva para encontrar todos os arquivos detail.json
function findJsonFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findJsonFiles(filePath, fileList);
    } else if (file === "details.json") {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Função para processar cada JSON
function processJson(filePath) {
  try {
    const rawData = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(rawData);
    // Pega disciplina
    const discipline = data.discipline;
    
    if (!discipline) return;
    
    // Extrai os campos necessários
    const { correctAlternative, alternatives, context, title, alternativesIntroduction } = data;
    let language = "";
    if(discipline == "linguagens"){
      language = allLangs[franc(context + alternativesIntroduction)]
    }

    // Monta um bloco de texto organizado
    let block = "";
    block += `${discipline == "linguagens" ? "Linguagem: " + language : ""}\n`;
    block += `Título: ${title || "N/A"}\n`;
    block += `Enunciado: ${context || "N/A"}\n`;
    block += `Introdução das Alternativas: ${alternativesIntroduction || "N/A"}\n`;
    block += `Alternativas:\n`;
    if (alternatives && Array.isArray(alternatives)) {
      alternatives.forEach((alt) => {
        block += `  ${alt.letter}) ${alt.text} ${alt.isCorrect ? "(Correta)" : ""}\n`;
      });
    }

    block += `Resposta Correta: ${correctAlternative || "N/A"}\n`;
    block += "-------------------------------------------\n\n";

    return { discipline, block };
  } catch (err) {
    console.error("Erro ao processar:", filePath, err);
    return null;
  }
}

// Função principal
function main() {
  const files = findJsonFiles(rootDir);

  const grouped = {};

  files.forEach((file) => {
    const result = processJson(file);
    if (result) {
      if (!grouped[result.discipline]) {
        grouped[result.discipline] = [];
      }
      grouped[result.discipline].push(result.block);
    }
  });

  // Gera um arquivo por disciplina
  for (const [discipline, blocks] of Object.entries(grouped)) {
    const safeName = discipline.replace(/\s+/g, "_").toLowerCase(); // Ex: Ciências Humanas -> ciencias_humanas
    const outputPath = path.join(outDir, `${safeName}.txt`);

    const content = `===== ${discipline.toUpperCase()} =====\n\n` + blocks.join("\n");
    fs.writeFileSync(outputPath, content, "utf8");

    console.log(`Arquivo gerado: ${outputPath}`);
  }
}

main();
