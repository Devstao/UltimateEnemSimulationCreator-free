const URL = "http://localhost:3001";
// const URL = "http://ultimateenimen.onrender.com";

export async function startJob(payload: any) {
  const res = await fetch(`${URL}/generate-quiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export function connectProgress(jobId: string, onMessage: (ev: any) => void) {
  const es = new EventSource(`${URL}/progress/${jobId}`);
  es.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };
  es.onerror = () => es.close();
  return () => es.close();
}

// api.ts
export async function downloadFile(file: string) {
  try {
    const res = await fetch(`${URL}${file}`, {
      method: "GET",
    });

    if (!res.ok) throw new Error("Erro ao baixar PDF");

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    // cria um link "virtual" para baixar
    const a = document.createElement("a");
    a.href = url;
    a.download = file; // usa o mesmo nome do servidor
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Erro ao baixar arquivo:", e);
  }
}
