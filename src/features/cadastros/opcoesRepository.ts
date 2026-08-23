import { queryAll } from "../../database/db";
import { inserir, excluir } from "../../database/crud";
import { GRUPO_DOCUMENTO_CATEGORIA, GRUPO_EVENTO_TIPO, GRUPO_BEM_CATEGORIA } from "../../database/schema";

export { GRUPO_DOCUMENTO_CATEGORIA, GRUPO_EVENTO_TIPO, GRUPO_BEM_CATEGORIA };

export interface Opcao {
  id: string;
  grupo: string;
  valor: string;
}

export function listarOpcoes(grupo: string): Opcao[] {
  return queryAll<Opcao>("SELECT * FROM opcoes_personalizadas WHERE grupo = ? ORDER BY valor COLLATE NOCASE", [grupo]);
}

/** Cria uma opção nova, evitando duplicar se já existir uma igual (case-insensitive). */
export async function criarOpcao(grupo: string, valorBruto: string): Promise<string> {
  const valor = valorBruto.trim();
  const existente = queryAll<Opcao>(
    "SELECT * FROM opcoes_personalizadas WHERE grupo = ? AND valor = ? COLLATE NOCASE",
    [grupo, valor],
  )[0];
  if (existente) return existente.valor;

  await inserir("opcoes_personalizadas", { grupo, valor });
  return valor;
}

export async function excluirOpcao(id: string): Promise<void> {
  await excluir("opcoes_personalizadas", id);
}
