import { queryAll } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import { cifrar, decifrar } from "../../utils/cofre";
import type { SenhaGuardada } from "../../types/entities";

export const CATEGORIAS_SENHA = [
  "Banco", "E-mail", "Compras", "Trabalho", "Streaming", "Governo", "Redes sociais", "Outro",
];

export function listarSenhas(): SenhaGuardada[] {
  return queryAll<SenhaGuardada>("SELECT * FROM senhas ORDER BY titulo COLLATE NOCASE");
}

export type SenhaInput = {
  titulo: string;
  usuario?: string | null;
  senha: string;
  url?: string | null;
  categoria?: string | null;
  pessoa_id?: string | null;
  observacoes?: string | null;
};

export async function criarSenha(input: SenhaInput): Promise<void> {
  const { senha, ...resto } = input;
  await inserir("senhas", { ...resto, senha_cifrada: await cifrar(senha) });
}

export async function atualizarSenha(id: string, input: Partial<SenhaInput>): Promise<void> {
  const { senha, ...resto } = input;
  const dados: Record<string, unknown> = { ...resto };
  // Só re-cifra se a senha realmente foi alterada no formulário.
  if (senha !== undefined && senha !== "") dados.senha_cifrada = await cifrar(senha);
  await atualizar("senhas", id, dados);
}

export async function excluirSenha(id: string): Promise<void> {
  await excluir("senhas", id);
}

export async function revelarSenha(registro: SenhaGuardada): Promise<string> {
  return decifrar(registro.senha_cifrada);
}
