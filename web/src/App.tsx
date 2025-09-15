import { useEffect, useMemo, useState } from "react";
import { startJob, connectProgress, downloadFile } from "./api";
import type { Questao } from "./types";

const DEFAULT_COUNTS = {
    "Matemática": 3,
    "Ciências da Natureza": 3,
    "Linguagens": 3,
    "Inglês": 3,
    "Espanhol": 3,
    "Ciências Humanas": 3,
};
// const URL = "https://ultimateenimen.onrender.com/models";
const URL = "http://localhost:3001/models";

type Mode = "online" | "pdf";

export default function App() {
    const [apiKey, setApiKey] = useState(
        () => localStorage.getItem("openrouter_api_key") || ""
    );
    const [model, setModel] = useState(
        () => localStorage.getItem("modelName") || ""
    );
    const [mode, setMode] = useState<Mode>("online");
    const [counts, setCounts] = useState(
        JSON.parse(
            localStorage.getItem("defaultCounts") ||
            JSON.stringify(DEFAULT_COUNTS)
        )
    );
    const [status, setStatus] = useState<string>("");
    const [progress, setProgress] = useState<{ current?: number; total?: number }>(
        {}
    );
    const [quiz, setQuiz] = useState<Record<string, Questao[]>>({});
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [downloadUrl, setDownloadUrl] = useState<string>("");
    const [models, setModels] = useState<any[]>([]);
    const [isAnswered, setIsAnswered] = useState(false);

    useEffect(() => {
        if (!apiKey) return;
        fetch(URL, {
            headers: { Authorization: `Bearer ${apiKey}` },
        })
            .then((res) => res.json())
            .then((data) => setModels(data))
            .catch(() => setModels([]));
    }, [apiKey]);

    function onAnswer(area: string, idx: number, alt: string) {
        setAnswers((prev) => ({ ...prev, [`${area}:${idx}`]: alt }));
    }

    const score = useMemo(() => {
        let correct = 0,
            total = 0;
        const respostas = {};
        for (const [area, qs] of Object.entries(quiz)) {
            respostas[area] = [];
            let all = [];
            qs.forEach((q, i) => {
                total++;
                const ans = answers[`${area}:${i}`];
                if (ans && ans === q.resposta_correta) correct++;
                all.push(q.resposta_correta);
            });
            respostas[area].push(all);
        }
        return { correct, total, respostas };
    }, [answers, quiz]);

    async function handleStart() {
        setStatus("Iniciando geração...");
        setQuiz({});
        setAnswers({});
        setDownloadUrl("");

        const { jobId } = await startJob({ apiKey, model, counts, mode });
        setStatus(`Job iniciado: ${jobId}`);

        connectProgress(jobId, (ev) => {
            if (ev.type === "status") {
                setStatus(ev.message);
                setProgress({ current: ev.current, total: ev.total });
            } else if (ev.type === "quiz") {
                setQuiz(ev.quiz);
            } else if (ev.type === "file") {
                setDownloadUrl(ev.path);
            } else if (ev.type === "error") {
                setStatus(`Erro: ${ev.message}`);
            } else if (ev.type === "done") {
                setStatus("Concluído.");
            }
        });
    }

    useEffect(() => {
        if (apiKey) fetchModels(apiKey);
    }, [apiKey]);

    function handleApiKeyChange(value: string) {
        setApiKey(value);
        localStorage.setItem("openrouter_api_key", value);
    }

    async function fetchModels(key: string) {
        if (!key) return;
        try {
            const res = await fetch(URL, {
                headers: { Authorization: `Bearer ${key}` },
            });
            const data = await res.json();
            setModels(data);
        } catch (e) {
            console.error("Erro ao buscar modelos", e);
            setModels([]);
        }
    }

    function handleModel(modelName) {
        setModel(modelName);
        localStorage.setItem("modelName", modelName);
    }

    useEffect(() => {
        localStorage.setItem("defaultCounts", JSON.stringify(counts));
    }, [counts]);

    function verifyResults() {
        setIsAnswered(true);
    }

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-bold">Gerador de Simulados ENEM</h1>
            
            <h2 className="text-xl font-bold">usando o <b>OpenRouter</b> se ainda não tem uma conta, <a target="_blank" className="text-emerald-600 hover:font-extrabold" href="https://openrouter.ai/">Clique aqui</a> </h2>
            <h2 className="text-xl font-bold">Gere uma chave de api e cole-a no campo abaixo.</h2>

            <div className="grid gap-3">
                <input
                    className="border p-2 rounded"
                    placeholder="API Key do OpenRouter"
                    value={apiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    type={"password"}
                />
                <select
                    className="border p-2 rounded"
                    value={model}
                    onChange={(e) => handleModel(e.target.value)}
                    disabled={!models?.length}
                >
                    {models?.length > 0 ? (
                        models?.map((m) => (
                            <option key={m?.id} value={m?.id}>
                                {m.id}
                            </option>
                        ))
                    ) : (
                        <option disabled>Nenhum modelo carregado</option>
                    )}
                </select>

                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2">
                        <input
                            type="radio"
                            name="mode"
                            checked={mode === "online"}
                            onChange={() => setMode("online")}
                        />
                        Simulado na plataforma
                    </label>
                    <label className="flex items-center gap-2">
                        <input
                            type="radio"
                            name="mode"
                            checked={mode === "pdf"}
                            onChange={() => setMode("pdf")}
                        />
                        Baixar PDF
                    </label>
                </div>

                <div className="md:grid grid-cols-2 gap-2">
                    {Object.entries(counts)?.map(([k, v]) => (
                        <label
                            key={k + v}
                            className="flex items-center justify-between border p-2 rounded"
                        >
                            <span>{k}</span>
                            <input
                                type="number"
                                className="w-20 border p-1 rounded"
                                value={Number(v) > 0 ? Number(v).toString() : 0}
                                min={0}
                                onChange={(e) =>
                                    setCounts((prev) => ({
                                        ...prev,
                                        [k]:
                                            Number(e.target.value) <= 45
                                                ? Number(e.target.value)
                                                : 45,
                                    }))
                                }
                            />
                        </label>
                    ))}
                </div>

                <button
                    className={status.includes("Gerando") ? "bg-gray-800 text-white px-4 py-2 rounded" : "bg-black text-white px-4 py-2 rounded"}
                    onClick={handleStart}
                    disabled={status.includes("Gerando")}
                >
                    {status.includes("Gerando") ? "Gerando..." : "Gerar"}
                </button>

                <div className="text-sm text-gray-700">
                    {status}
                    {progress.total ? (
                        <div className="w-full bg-gray-200 h-2 rounded mt-2">
                            <div
                                className="bg-gray-800 h-2 rounded"
                                style={{
                                    width: `${Math.round(
                                        ((progress.current || 0) / (progress.total || 1)) * 100
                                    )}%`,
                                }}
                            />
                        </div>
                    ) : null}
                </div>

                {downloadUrl && (
                    <a
                        className="text-blue-600 underline"
                        href={downloadUrl}
                        onClick={(e) => {
                            e.preventDefault();
                            downloadFile(downloadUrl);
                        }}
                    >
                        Baixar PDF
                    </a>
                )}
            </div>

            {mode === "online" && Object.keys(quiz).length > 0 && (
                <div className="space-y-6">
                    {Object.entries(quiz).map(([area, qs]) => qs.length > 0 &&(
                        <div key={area} className="border rounded p-4">
                            <h2 className="font-semibold text-lg mb-2">{area}</h2>
                            <div className="space-y-4">
                                {qs.map((q, i) => (
                                    <div key={i} className="border rounded p-3">
                                        <div className="font-medium mb-2">Questão {i + 1}</div>
                                        <p className="mb-2 whitespace-pre-wrap">{q.questao}</p>
                                        <ul className="space-y-1">
                                            {Object.entries(q.opcoes).map(([alt, txt]) => (
                                                <li key={alt}>
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="radio"
                                                            name={`${area}:${i}`}
                                                            value={alt}
                                                            onChange={() => onAnswer(area, i, alt)}
                                                        />
                                                        <span className="font-semibold">{alt})</span>
                                                        <span>{txt}</span>
                                                    </label>
                                                </li>
                                            ))}
                                        </ul>
                                        {answers[`${area}:${i}`] && (
                                            <div className="text-sm mt-2">
                                                Sua resposta: <b>{answers[`${area}:${i}`]}</b>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={verifyResults}
                        disabled={
                            Object.keys(quiz).length > 0 &&
                            Object.keys(quiz).length !== Object.keys(score.respostas).length &&
                            !isAnswered
                        }
                        className={Object.keys(quiz).length > 0 &&
                            Object.keys(quiz).length !== Object.keys(score.respostas).length &&
                            !isAnswered ? "bg-gray-800 text-white px-4 py-2 rounded" : "bg-black text-white px-4 py-2 rounded"}
                    >
                        Verificar resultados
                    </button>

                    {isAnswered && (
                        <div className="border rounded p-4 mt-5">
                            <div>
                                {Object.entries(quiz).map(([area, qs]) => (
                                    <div key={area}>
                                        <div className="border rounded p-4">
                                            <h2 className="font-semibold text-lg mb-2">{area}</h2>
                                            <div className="space-y-4">
                                                {qs.map((q, i) => (
                                                    <div key={i} className="border rounded p-3">
                                                        <div className="font-medium mb-2">
                                                            Questão {i + 1}
                                                        </div>
                                                        <p className="mb-2 whitespace-pre-wrap">
                                                            {q.questao}
                                                        </p>
                                                        <ul className="space-y-1">
                                                            <li>
                                                                <label className="flex justify-center gap-2 flex-col">
                                                                    <span
                                                                        className={
                                                                            "font-semibold " +
                                                                            (answers[`${area}:${i}`] ===
                                                                                q.resposta_correta
                                                                                ? "text-green-600"
                                                                                : "text-red-600")
                                                                        }
                                                                    >
                                                                        Sua resposta: {answers[`${area}:${i}`]}){" "}
                                                                        {
                                                                            q.opcoes[
                                                                            answers[`${area}:${i}`]
                                                                            ]
                                                                        }
                                                                    </span>
                                                                    <span className="font-semibold">
                                                                        Resposta correta: {q.resposta_correta})
                                                                    </span>{" "}
                                                                    <span>
                                                                        {q.opcoes[q.resposta_correta]}
                                                                    </span>
                                                                </label>
                                                            </li>
                                                        </ul>
                                                        {answers[`${area}:${i}`] && (
                                                            <div className="text-sm mt-2">
                                                                Sua resposta está:{" "}
                                                                <b
                                                                    className={
                                                                        answers[`${area}:${i}`] ===
                                                                            q.resposta_correta
                                                                            ? "text-green-600"
                                                                            : "text-red-600"
                                                                    }
                                                                >
                                                                    {answers[`${area}:${i}`] ===
                                                                        q.resposta_correta ? "Correta" : "Errada"}
                                                                </b>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="text-lg">
                                    Resultado: <b>{score.correct}</b> / {score.total}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
