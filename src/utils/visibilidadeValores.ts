import { useSyncExternalStore } from "react";

/**
 * Visibilidade de valores em dinheiro.
 *
 * Por padrão, toda sessão começa com os valores OCULTOS — quem abre o app
 * do lado de alguém não precisa expor saldo, patrimônio ou salário na
 * tela. Um clique no olho revela; fecha o app (ou a aba) e na próxima vez
 * volta a esconder.
 *
 * Uso sessionStorage de propósito, não localStorage: sessionStorage some
 * sozinho quando a aba/janela fecha, então "nova sessão" já reseta pra
 * oculto sem eu precisar fazer nada. Só persiste ENQUANTO a aba está
 * aberta, pra não reesconder toda vez que você navega entre páginas.
 *
 * O ponto de interceptação é central: `formatarMoeda` (utils/format.ts)
 * já checa isso sozinho, então qualquer uma das dezenas de telas que já
 * chamavam formatarMoeda ganhou a máscara de graça, sem precisar editar
 * uma por uma.
 */

const CHAVE = "nexo:valores-visiveis";
const MASCARA = "R$ ••••••";

let visivel = false;
try {
  visivel = sessionStorage.getItem(CHAVE) === "1";
} catch {
  // sessionStorage pode falhar em modo privado/restrito — segue oculto
}

const ouvintes = new Set<() => void>();

export function valoresVisiveis(): boolean {
  return visivel;
}

export function alternarVisibilidadeValores(): void {
  visivel = !visivel;
  try {
    sessionStorage.setItem(CHAVE, visivel ? "1" : "0");
  } catch {
    // sem persistência disponível — funciona só na memória desta sessão
  }
  ouvintes.forEach((fn) => fn());
}

function inscrever(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/** Hook: o componente que chamar isso re-renderiza quando o olho for clicado. */
export function useValoresVisiveis(): boolean {
  return useSyncExternalStore(inscrever, valoresVisiveis);
}

/** Mascara qualquer texto formatado (usado por formatarMoeda e pela planilha). */
export function mascarar(textoFormatado: string): string {
  return visivel ? textoFormatado : MASCARA;
}
