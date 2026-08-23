import type { TipoCategoria } from "../../types/entities";

/** Detecta se a mensagem parece um pedido pra criar um lançamento (não uma pergunta). */
export function pareceComandoDeLancamento(p: string): boolean {
  return /^\s*(adicion|lan[cç]|registr|gastei|recebi|paguei|criar?\s+(um|uma)?\s*(gasto|despesa|receita|lan[cç])|coloca|insira|inserir)/i.test(p);
}

/** Tenta extrair um valor em reais do texto (várias formas de escrever). */
export function extrairValor(texto: string): number | undefined {
  const limpo = texto.replace(/\./g, "").replace(",", ".");
  const m1 = limpo.match(/(\d+(?:\.\d{1,2})?)\s*reais/i);
  if (m1) return parseFloat(m1[1]);
  const m2 = limpo.match(/r\$\s*(\d+(?:\.\d{1,2})?)/i);
  if (m2) return parseFloat(m2[1]);
  const m3 = limpo.match(/\bde\s+(\d+(?:\.\d{1,2})?)\b/i);
  if (m3) return parseFloat(m3[1]);
  const m4 = limpo.match(/(\d+(?:\.\d{1,2})?)/);
  if (m4) return parseFloat(m4[1]);
  return undefined;
}

/** Tenta inferir se é despesa ou receita a partir de palavras-chave. */
export function extrairTipo(p: string): TipoCategoria {
  if (/receb|receita|ganhei|entrou dinheiro/i.test(p)) return "receita";
  return "despesa";
}
