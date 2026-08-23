// Vozes do navegador/SO (speechSynthesis) — de graça, sem cadastro.
// No Windows, as vozes neurais da Microsoft ("Natural"/"Online") são bem
// mais naturais que a voz padrão offline; elas aparecem aqui no topo da
// lista. Ver também utils/falar.ts, que cuida da pronúncia e da cadência.

const NOMES_FEMININOS = ["francisca", "maria", "camila", "fernanda", "leticia", "letícia", "helena", "isabela", "female", "feminin"];
const NOMES_MASCULINOS = ["antonio", "antônio", "daniel", "fabio", "fábio", "giovanni", "humberto", "male", "masculin"];

export type GeneroVoz = "feminina" | "masculina" | "indefinido";

export interface VozDisponivel {
  voiceURI: string;
  nome: string;
  genero: GeneroVoz;
  natural: boolean;
  voice: SpeechSynthesisVoice;
}

function detectarGenero(nome: string): GeneroVoz {
  const n = nome.toLowerCase();
  if (NOMES_FEMININOS.some((f) => n.includes(f))) return "feminina";
  if (NOMES_MASCULINOS.some((m) => n.includes(m))) return "masculina";
  return "indefinido";
}

/** Lista as vozes em português disponíveis, com as "Natural/Online" (melhor qualidade) primeiro. */
export function listarVozesDisponiveis(): VozDisponivel[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const todas = window.speechSynthesis.getVoices();
  const portugues = todas.filter((v) => v.lang.toLowerCase().startsWith("pt"));
  const lista = (portugues.length > 0 ? portugues : todas).map((v) => ({
    voiceURI: v.voiceURI,
    nome: v.name,
    genero: detectarGenero(v.name),
    natural: /natural|online|neural/i.test(v.name),
    voice: v,
  }));
  return lista.sort((a, b) => Number(b.natural) - Number(a.natural));
}

/**
 * As vozes ficam disponíveis de forma assíncrona em alguns navegadores —
 * essa função espera o evento `voiceschanged` se a lista ainda estiver vazia.
 */
export function aguardarVozes(): Promise<VozDisponivel[]> {
  return new Promise((resolve) => {
    const imediatas = listarVozesDisponiveis();
    if (imediatas.length > 0) {
      resolve(imediatas);
      return;
    }
    const handler = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(listarVozesDisponiveis());
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    setTimeout(() => resolve(listarVozesDisponiveis()), 1000);
  });
}
