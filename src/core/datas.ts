// Aritmética de datas em ISO (YYYY-MM-DD), sem fuso horário envolvido.
//
// Por que não usar `new Date(iso)` direto: essa forma interpreta a string
// como UTC, e num fuso negativo (o Brasil todo) "2026-03-10" volta como
// 09/03 às 21h local. Todo cálculo de vencimento erraria por um dia.
// Aqui só se trabalha com os números do calendário.

import type { Frequencia } from "../types/entities";

export const FREQUENCIAS: Array<{ valor: Frequencia; label: string; meses?: number; dias?: number }> = [
  { valor: "diaria", label: "Todo dia", dias: 1 },
  { valor: "semanal", label: "Toda semana", dias: 7 },
  { valor: "quinzenal", label: "A cada 15 dias", dias: 15 },
  { valor: "mensal", label: "Todo mês", meses: 1 },
  { valor: "bimestral", label: "A cada 2 meses", meses: 2 },
  { valor: "trimestral", label: "A cada 3 meses", meses: 3 },
  { valor: "semestral", label: "A cada 6 meses", meses: 6 },
  { valor: "anual", label: "Todo ano", meses: 12 },
];

export function labelFrequencia(f: string | null | undefined): string {
  return FREQUENCIAS.find((x) => x.valor === f)?.label ?? "—";
}

/** Data de hoje em ISO, no calendário local (não UTC). */
export function hoje(): string {
  const d = new Date();
  return isoDe(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function isoDe(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function partes(iso: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return { ano, mes, dia };
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

/** Soma dias corridos a uma data ISO. */
export function somarDias(iso: string, dias: number): string {
  const { ano, mes, dia } = partes(iso);
  const d = new Date(ano, mes - 1, dia + dias);
  return isoDe(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Soma meses preservando o dia sempre que possível. Dia 31 + 1 mês em
 * fevereiro cai no dia 28/29, não "transborda" pra março — que é o
 * comportamento correto pra vencimento de conta e parcela.
 */
export function somarMeses(iso: string, meses: number, diaPreferido?: number | null): string {
  const p = partes(iso);
  const alvoDia = diaPreferido ?? p.dia;
  const total = p.mes - 1 + meses;
  const ano = p.ano + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12 + 1;
  return isoDe(ano, mes, Math.min(alvoDia, diasNoMes(ano, mes)));
}

/** Avança uma data conforme a frequência. Base de todo o motor de recorrência. */
export function proximaData(iso: string, frequencia: Frequencia, diaReferencia?: number | null): string {
  const def = FREQUENCIAS.find((f) => f.valor === frequencia);
  if (!def) return somarMeses(iso, 1, diaReferencia);
  if (def.dias) return somarDias(iso, def.dias);
  return somarMeses(iso, def.meses ?? 1, diaReferencia);
}

/** Diferença em dias (b - a). Positivo = b está no futuro. */
export function diferencaDias(a: string, b: string): number {
  const pa = partes(a);
  const pb = partes(b);
  const da = Date.UTC(pa.ano, pa.mes - 1, pa.dia);
  const db = Date.UTC(pb.ano, pb.mes - 1, pb.dia);
  return Math.round((db - da) / 86400000);
}

/** Dias de hoje até a data (negativo = atrasado). */
export function diasRestantes(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return diferencaDias(hoje(), iso.slice(0, 10));
}

export function primeiroDiaDoMes(iso = hoje()): string {
  const { ano, mes } = partes(iso);
  return isoDe(ano, mes, 1);
}

export function ultimoDiaDoMes(iso = hoje()): string {
  const { ano, mes } = partes(iso);
  return isoDe(ano, mes, diasNoMes(ano, mes));
}

/** Chave "2026-08" — usada para deduplicar alertas por ciclo mensal. */
export function chaveMes(iso = hoje()): string {
  return iso.slice(0, 7);
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function labelMesCurto(iso: string): string {
  const { ano, mes } = partes(iso);
  return `${MESES_CURTOS[mes - 1]}/${String(ano).slice(2)}`;
}

/** Texto humano de prazo — "hoje" comunica melhor que "0 dias". */
export function textoPrazo(dias: number | null): string {
  if (dias === null) return "—";
  if (dias < -1) return `${Math.abs(dias)} dias em atraso`;
  if (dias === -1) return "venceu ontem";
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias < 30) return `em ${dias} dias`;
  const meses = Math.round(dias / 30);
  return meses === 1 ? "em 1 mês" : `em ${meses} meses`;
}
