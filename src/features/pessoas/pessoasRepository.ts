import { queryAll, runAndPersist } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import type { Pessoa } from "../../types/entities";

export function listarPessoas(): Pessoa[] {
  // A pessoa principal (você) vem sempre primeiro.
  return queryAll<Pessoa>("SELECT * FROM pessoas ORDER BY principal DESC, nome COLLATE NOCASE");
}

/** O perfil principal — quem usa o app. Aparece no topo da barra lateral. */
export function pessoaPrincipal(): Pessoa | null {
  return queryAll<Pessoa>("SELECT * FROM pessoas WHERE principal = 1 LIMIT 1")[0] ?? null;
}

export type PessoaInput = {
  nome: string;
  parentesco?: string | null;
  data_nascimento?: string | null;
  email?: string | null;
  telefone?: string | null;
  profissao?: string | null;
  foto?: string | null;
  observacoes?: string | null;
};

export async function criarPessoa(input: PessoaInput): Promise<string> {
  return inserir("pessoas", {
    nome: input.nome,
    parentesco: input.parentesco || null,
    data_nascimento: input.data_nascimento || null,
    email: input.email || null,
    telefone: input.telefone || null,
    profissao: input.profissao || null,
    foto: input.foto || null,
    observacoes: input.observacoes || null,
    principal: 0,
  });
}

export async function atualizarPessoa(id: string, input: Partial<PessoaInput>): Promise<void> {
  await atualizar("pessoas", id, input);
}

export async function excluirPessoa(id: string): Promise<void> {
  await excluir("pessoas", id);
}

/** Só uma pessoa pode ser a principal — marcar uma desmarca as outras. */
export async function definirComoPrincipal(id: string): Promise<void> {
  await runAndPersist("UPDATE pessoas SET principal = 0", []);
  await runAndPersist("UPDATE pessoas SET principal = 1 WHERE id = ?", [id]);
}

/** Cria o perfil principal na primeira vez que alguém preenche o topo da barra. */
export async function criarPerfilPrincipal(input: PessoaInput): Promise<string> {
  const id = await criarPessoa(input);
  await definirComoPrincipal(id);
  return id;
}

export function idadeDe(pessoa: Pessoa): number | null {
  if (!pessoa.data_nascimento) return null;
  const nasc = new Date(pessoa.data_nascimento + "T00:00:00");
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}
