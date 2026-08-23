import { obterVoiceURISalvo, obterVelocidade, obterTom } from "./vozConfig";
import { listarVozesDisponiveis } from "./voz";

/**
 * Leitura em voz alta.
 *
 * O motor de voz do sistema já é razoável — o que soa robótico num app
 * financeiro é O TEXTO. "R$ 1.234,56" vira "erre cifrão um ponto dois três
 * quatro vírgula cinco seis". "16/08/2026" vira uma sequência de números.
 *
 * Então antes de falar a gente reescreve o texto do jeito que uma pessoa
 * leria em voz alta, e fala frase por frase com uma pausa curta entre
 * elas — que é o que dá a impressão de cadência em vez de rajada.
 */

const UNIDADES = ["zero","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez",
  "onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
const DEZENAS = ["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
const CENTENAS = ["","cento","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];

/** Escreve um número inteiro por extenso (até bilhões, que já cobre patrimônio). */
export function porExtenso(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n < 0) return `menos ${porExtenso(Math.abs(n))}`;
  if (n < 20) return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10), r = n % 10;
    return r === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${UNIDADES[r]}`;
  }
  if (n === 100) return "cem";
  if (n < 1000) {
    const c = Math.floor(n / 100), r = n % 100;
    return r === 0 ? CENTENAS[c] : `${CENTENAS[c]} e ${porExtenso(r)}`;
  }
  if (n < 1_000_000) {
    const m = Math.floor(n / 1000), r = n % 1000;
    const prefixo = m === 1 ? "mil" : `${porExtenso(m)} mil`;
    if (r === 0) return prefixo;
    // "mil e duzentos" soa certo; "mil duzentos e trinta" também
    return r < 100 || r % 100 === 0 ? `${prefixo} e ${porExtenso(r)}` : `${prefixo} ${porExtenso(r)}`;
  }
  if (n < 1_000_000_000) {
    const mi = Math.floor(n / 1_000_000), r = n % 1_000_000;
    const prefixo = mi === 1 ? "um milhão" : `${porExtenso(mi)} milhões`;
    return r === 0 ? prefixo : `${prefixo} e ${porExtenso(r)}`;
  }
  const bi = Math.floor(n / 1_000_000_000), r = n % 1_000_000_000;
  const prefixo = bi === 1 ? "um bilhão" : `${porExtenso(bi)} bilhões`;
  return r === 0 ? prefixo : `${prefixo} e ${porExtenso(r)}`;
}

function valorPorExtenso(reais: number, centavos: number): string {
  const extenso = porExtenso(reais);
  // "um milhão DE reais", não "um milhão reais" — a preposição entra quando
  // o número termina exatamente em milhão/bilhão.
  const pedeDe = /(milh(ão|ões)|bilh(ão|ões))$/.test(extenso);
  const parteReais = reais === 1 ? "um real" : `${extenso}${pedeDe ? " de" : ""} reais`;
  if (centavos === 0) return parteReais;
  const parteCentavos = centavos === 1 ? "um centavo" : `${porExtenso(centavos)} centavos`;
  if (reais === 0) return parteCentavos;
  return `${parteReais} e ${parteCentavos}`;
}

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

/** Abreviações que a voz lê letra por letra ou erra a sílaba tônica. */
const SUBSTITUICOES: Array<[RegExp, string]> = [
  [/\bkm\/l\b/gi, "quilômetros por litro"],
  [/\bkm\b/gi, "quilômetros"],
  [/\bm²/gi, "metros quadrados"],
  [/\bIPVA\b/g, "I P V A"],
  [/\bIPTU\b/g, "I P T U"],
  [/\bCNH\b/g, "C N H"],
  [/\bCPF\b/g, "C P F"],
  [/\bRG\b/g, "erre gê"],
  [/\bCRLV\b/g, "C R L V"],
  [/\bINSS\b/g, "I N S S"],
  [/\bCTPS\b/g, "C T P S"],
  [/\bSUS\b/g, "S U S"],
  [/\bIR\b/g, "imposto de renda"],
  [/\bFIPE\b/gi, "fipe"],
  [/\bnº\s*/gi, "número "],
  [/\betc\.?/gi, "etcétera"],
  [/\bex:/gi, "por exemplo:"],
  [/\bvs\.?\b/gi, "versus"],
  [/\bR\$\s*0,00\b/g, "zero reais"],
  [/✅|⚠️|→|•|★/g, " "],
  [/\*\*/g, ""],
];

/** Reescreve o texto do jeito que uma pessoa leria em voz alta. */
export function prepararParaFala(texto: string): string {
  let t = texto;

  // Valores em reais: R$ 1.234,56 → mil duzentos e trinta e quatro reais e cinquenta e seis centavos
  t = t.replace(/R\$\s*(-?[\d.]+)(?:,(\d{1,2}))?/g, (_m, inteiro: string, dec?: string) => {
    const negativo = inteiro.trim().startsWith("-");
    const reais = parseInt(inteiro.replace(/[.\-]/g, ""), 10) || 0;
    const centavos = dec ? parseInt(dec.padEnd(2, "0"), 10) : 0;
    const texto = valorPorExtenso(reais, centavos);
    return negativo ? `menos ${texto}` : texto;
  });

  // Datas: 16/08/2026 → dezesseis de agosto de 2026
  t = t.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (_m, d: string, m: string, a: string) => {
    const mes = MESES[parseInt(m, 10) - 1] ?? m;
    return `${porExtenso(parseInt(d, 10))} de ${mes} de ${a}`;
  });
  // Datas curtas: 16/08 → dezesseis de agosto
  t = t.replace(/\b(\d{1,2})\/(\d{1,2})\b/g, (_m, d: string, m: string) => {
    const mes = MESES[parseInt(m, 10) - 1];
    return mes ? `${porExtenso(parseInt(d, 10))} de ${mes}` : `${d} de ${m}`;
  });

  // Porcentagem: 65% → sessenta e cinco por cento
  t = t.replace(/(-?\d+(?:[.,]\d+)?)\s*%/g, (_m, n: string) => {
    const num = parseFloat(n.replace(",", "."));
    return Number.isInteger(num) ? `${porExtenso(num)} por cento` : `${n.replace(".", ",")} por cento`;
  });

  // Números grandes com separador de milhar: 41.250 → quarenta e um mil duzentos e cinquenta
  t = t.replace(/\b(\d{1,3}(?:\.\d{3})+)\b/g, (_m, n: string) => porExtenso(parseInt(n.replace(/\./g, ""), 10)));

  for (const [de, para] of SUBSTITUICOES) t = t.replace(de, para);

  return t.replace(/\s{2,}/g, " ").trim();
}

/** Quebra em frases para falar com pausa entre elas. */
function emFrases(texto: string): string[] {
  return texto
    .split(/(?<=[.!?:])\s+|\n+/)
    .map((f) => f.trim())
    .filter(Boolean);
}

let cancelado = false;

export function pararFala(): void {
  cancelado = true;
  window.speechSynthesis?.cancel();
}

/**
 * Fala o texto com preparo de pronúncia e pausa entre frases.
 * A pausa curta é o que mais aproxima do ritmo de alguém falando.
 */
export async function falarTexto(texto: string): Promise<void> {
  if (!("speechSynthesis" in window)) return;

  cancelado = false;
  window.speechSynthesis.cancel();

  const vozes = listarVozesDisponiveis();
  const uriSalvo = obterVoiceURISalvo();
  const voz = (uriSalvo && vozes.find((v) => v.voiceURI === uriSalvo)?.voice)
    // sem escolha salva, prefere a de melhor qualidade disponível
    ?? vozes.find((v) => v.natural)?.voice
    ?? vozes[0]?.voice;

  const velocidade = obterVelocidade();
  const tom = obterTom();

  for (const frase of emFrases(prepararParaFala(texto))) {
    if (cancelado) return;
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(frase);
      u.lang = "pt-BR";
      if (voz) u.voice = voz;
      u.rate = velocidade;
      u.pitch = tom;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
    // respiro entre frases
    if (!cancelado) await new Promise((r) => setTimeout(r, 160));
  }
}
