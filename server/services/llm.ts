import axios from "axios";

export function openRouterClient() {
    return "https://openrouter.ai/api/v1/chat/completions"
}

export async function chatJSON(
    client: string,
    model: string,
    system: string,
    user: string,
    maxRetries = 2
) {
    for (let i = 0; i <= maxRetries; i++) {
        const payload = JSON.stringify({
            model,
            messages: [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "questao_quiz",
                    description: "Estrutura de uma questão de múltipla escolha com alternativas e resposta correta",
                    schema: {
                        type: ["object"],
                        items: {
                            questao: {
                                type: "string",
                                description: "O corpo da questão, com o enunciado dividido em alternativas A a E",
                                additionalProperties: false
                            },
                            opcoes: {
                                type: "object",
                                properties: {
                                    A: { type: "string" },
                                    B: { type: "string" },
                                    C: { type: "string" },
                                    D: { type: "string" },
                                    E: { type: "string" }
                                },
                                required: ["A", "B", "C", "D", "E"],
                                description: "Lista de textos das alternativas (ex: ['A', 'B', 'C']) apresentadas ao usuário",
                                maxItems: 5
                            },
                            resposta_correta: {
                                type: "string",
                                description: "A letra da alternativa correta (ex: 'A', 'B', etc.)",
                                enum: ["A", "B", "C", "D", "E"]
                            }
                        },
                        required: ["questao", "opcoes", "resposta_correta"],
                        additionalProperties: false
                    },
                    strict: true
                }
            },
            temperature: 0.7,
        })
        let resp = await axios.post(openRouterClient(), payload, {
            headers: {
                Authorization: 'Bearer ' + client,
                'Content-Type': 'application/json'
            }
        });
        const content = resp.data.choices[0]?.message?.content?.trim() || "";
        console.log("content ", content)
        try {
            // tenta pegar bloco JSON
            const match = content.match(/```json\s*([\s\S]*?)\s*```/i);
            const raw = match ? match[1] : content;
            return JSON.parse(raw);
        } catch (e) {
            if (i === maxRetries) throw new Error("Falha ao parsear JSON do modelo");
        }
    }
}