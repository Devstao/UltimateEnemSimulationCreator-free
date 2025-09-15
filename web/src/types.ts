export type Questao = {
    questao: string;
    opcoes: { A: string; B: string; C: string; D: string; E: string };
    resposta_correta: "A" | "B" | "C" | "D" | "E";
};