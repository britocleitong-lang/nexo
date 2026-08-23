import { useEffect } from "react";

// =====================================================================
// Atalho de busca
// ---------------------------------------------------------------------
// Este arquivo já teve 24 atalhos em sequência ("g f" para Financeiro,
// "n l" para novo lançamento) e uma tela inteira para ensiná-los.
//
// Ambos saíram, e a razão vale registrar: um atalho que precisa de uma
// tela de ajuda para ser lembrado não está economizando o tempo de
// ninguém. Sobrou o que funciona sem aprendizado — ⌘K/Ctrl+K para a busca
// global, que é convenção universal, e Escape para fechar.
//
// A busca já navega para qualquer lugar do app. Ela é o atalho.
// =====================================================================

/** O foco está num lugar onde a pessoa está digitando? */
export function digitandoEmCampo(alvo: EventTarget | null): boolean {
  const el = alvo as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable === true;
}

export function useAtalhoBusca(aoAbrir: () => void, aoFechar: () => void): void {
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        aoAbrir();
        return;
      }
      if (e.key === "Escape") aoFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoAbrir, aoFechar]);
}
