import { mascarar } from "./visibilidadeValores";
export function formatarMoeda(valor: number): string {
  const texto = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  // Ponto único de interceptação: qualquer tela que já chama formatarMoeda
  // ganha a máscara de "valores ocultos" automaticamente.
  return mascarar(texto);
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Dias entre hoje e uma data (negativo = já passou). */
export function diasAte(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const alvo = new Date(iso.slice(0, 10) + "T00:00:00");
  const hoje = new Date(hojeISO() + "T00:00:00");
  return Math.round((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}
