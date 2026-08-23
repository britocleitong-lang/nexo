const KEY = "nexo:dias-alerta-documentos";
const PADRAO = 30;

export function obterDiasAlerta(): number {
  const valor = localStorage.getItem(KEY);
  return valor ? Number(valor) : PADRAO;
}

export function definirDiasAlerta(dias: number): void {
  localStorage.setItem(KEY, String(dias));
}
