# ENEM Simulado – Backend Express + UI (OpenRouter + Embeddings leves)

Plataforma completa para gerar simulados no estilo **ENEM**, com opção de **baixar PDF** ou realizar o **simulado interativo online**. Utiliza **OpenRouter** para geração de questões e **embeddings locais leves** com `@xenova/transformers` ou `text-embedding-qwen3-embedding-8b` para contextualização (RAG simples).

---

## 🚀 Funcionalidades

* Integração com **LM STUDIO**.
* **Embeddings locais** com `all-MiniLM-L6-v2` (roda em GPU).
* Geração de **PDF em duas colunas** com gabarito final.
* Modo **Simulado online** com respostas interativas e resultado.
* **Progresso em tempo real** via SSE (mostra geração das questões passo a passo).

---

## 📁 Estrutura

```
.
├─ server/                  # Backend Express
│  ├─ index.ts              # Rotas principais (quiz, PDF, SSE)
│  ├─ services/             # Lógica de LLM, embeddings, quiz e PDF
│  ├─ utils/                # Funções auxiliares
│  └─ types.ts              # Tipos compartilhados
├─ enem_questoes/           # Arquivos .txt para contextualização (opcional)
├─ output/                  # PDFs gerados
├─ web/                     # Frontend React (Vite)
│  ├─ src/
│  │  ├─ App.tsx           # Interface principal
│  │  ├─ api.ts            # Comunicação com backend
│  │  └─ types.ts          # Tipos compartilhados
│  ├─ index.html
│  └─ vite.config.ts
├─ package.json             # Workspaces raiz
├─ tsconfig.json            # Configuração TS global
└─ .env.example             # Variáveis de ambiente
```

---

## 🔐 Configuração

Crie um arquivo `.env` na raiz do projeto:

```bash
PORT=3001
# Opcional: pode inserir a chave aqui, mas normalmente o usuário fornece na UI
OPENROUTER_API_KEY=sk-xxxx
```

Na UI, você também pode colar sua **chave do OpenRouter** diretamente.

---

## ▶️ Execução

### 1. Instale dependências

```bash
pnpm i
pnpm -F enem-simulado-server i
pnpm -F enem-simulado-web i
```

### 2. Rode backend e frontend em paralelo

```bash
pnpm dev:server   # API em http://localhost:3001
pnpm dev:web      # UI em http://localhost:5173
```

Ou use:

```bash
pnpm dev
```

### 3. Uso

1. Acesse `http://localhost:5173`.
2. Insira sua **API Key do OpenRouter**.
3. Escolha **modelo** (ex.: `qwen/qwen3-4b`, `mistral/mistral-7b`, etc.).
4. Configure quantidades de questões por área.
5. Selecione **Simulado Online** ou **Baixar PDF**.
6. Clique em **Gerar** e acompanhe o progresso.

---

## 📄 Modos de uso

### PDF

* Questões geradas em duas colunas.
* Gabarito listado ao final.
* Link de download aparece automaticamente quando pronto.

### Online

* Questões exibidas na interface.
* Usuário responde diretamente na plataforma.
* Resultado (acertos/total) exibido ao final.

---

## 🧠 Embeddings locais

* Utiliza [`@xenova/transformers`](https://github.com/xenova/transformers.js).
* Modelo padrão: `Xenova/all-MiniLM-L6-v2`.
* Baixa os pesos apenas na primeira execução e depois cacheia.

---

## 🧰 Tecnologias

* **Backend**: Node.js + Express + SSE
* **LLM**: OpenRouter (via OpenAI SDK)
* **Embeddings**: @xenova/transformers
* **PDF**: pdfkit
* **Frontend**: React + Vite + Tailwind (UI minimalista)

---

## 📌 Roadmap / Extensões

* [ ] Salvar histórico de provas e resultados.
* [ ] Suporte a autenticação de usuários.
* [ ] Deploy em Docker.
* [ ] Integração com banco de dados (para salvar tentativas e placares).

---

## 📝 Licença

MIT
