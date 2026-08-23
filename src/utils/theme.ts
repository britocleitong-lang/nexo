const KEY = "nexo:theme";
export type Tema = "light" | "dark";

export function obterTemaSalvo(): Tema {
  return (localStorage.getItem(KEY) as Tema) || "light";
}

export function aplicarTema(tema: Tema): void {
  document.documentElement.setAttribute("data-theme", tema);
  localStorage.setItem(KEY, tema);
}
