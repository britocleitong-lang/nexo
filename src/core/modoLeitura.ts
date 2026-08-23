import { useSyncExternalStore } from "react";

// =====================================================================
// Modo somente leitura
// ---------------------------------------------------------------------
// O caso de uso concreto: mostrar o Financeiro pro contador, ou o
// Patrimônio pro cônjuge, sem risco de alguém apagar um lançamento com um
// clique errado — e sem expor o cofre de senhas.
//
// O que ele FAZ, exatamente:
//   · esconde todo botão de criar, editar e excluir
//   · bloqueia o módulo Senhas por completo
//   · esconde Configurações (onde ficam backup e restauração)
//
// O que ele NÃO É, e a tela diz isso com todas as letras: NÃO é segurança.
// Quem tem o arquivo .db tem os dados; quem abre o DevTools desliga o modo.
// É uma trava contra ACIDENTE, não contra intenção. Chamar de "proteção"
// seria vender uma garantia que o app não tem como cumprir — a única
// barreira real continua sendo o PIN na entrada e a senha-mestra do cofre.
// =====================================================================

const CHAVE = "nexo:modo-leitura";

const ouvintes = new Set<() => void>();

function notificar(): void {
  for (const fn of ouvintes) fn();
}

export function modoLeituraAtivo(): boolean {
  return localStorage.getItem(CHAVE) === "1";
}

export function definirModoLeitura(ativo: boolean): void {
  localStorage.setItem(CHAVE, ativo ? "1" : "0");
  notificar();
}

export function alternarModoLeitura(): void {
  definirModoLeitura(!modoLeituraAtivo());
}

function inscrever(fn: () => void): () => void {
  ouvintes.add(fn);
  // Muda em outra aba do mesmo app? Reflete aqui também.
  window.addEventListener("storage", fn);
  return () => {
    ouvintes.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

/** Hook: `const somenteLeitura = useModoLeitura()`. */
export function useModoLeitura(): boolean {
  return useSyncExternalStore(inscrever, modoLeituraAtivo, () => false);
}

/** Rotas ocultas no modo leitura. */
export const ROTAS_BLOQUEADAS = new Set(["/senhas", "/configuracoes"]);

export function rotaBloqueada(caminho: string): boolean {
  return modoLeituraAtivo() && ROTAS_BLOQUEADAS.has(caminho);
}

export const AVISO_MODO_LEITURA =
  "Modo somente leitura: os botões de criar, editar e excluir estão escondidos, "
  + "e Senhas e Configurações ficam fora do ar. É uma trava contra clique errado — "
  + "não é segurança. Quem tiver acesso ao navegador consegue desligar.";
