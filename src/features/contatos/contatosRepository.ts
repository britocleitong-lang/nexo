import { queryAll } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import type { Contato, CategoriaContato } from "../../types/entities";

export const CATEGORIAS_CONTATO: Array<{ valor: CategoriaContato; label: string }> = [
  { valor: "medico", label: "Médico" },
  { valor: "mecanico", label: "Mecânico" },
  { valor: "contador", label: "Contador" },
  { valor: "seguro", label: "Corretor de seguro" },
  { valor: "advogado", label: "Advogado" },
  { valor: "outro", label: "Outro" },
];

export function listarContatos(): Contato[] {
  return queryAll<Contato>("SELECT * FROM contatos ORDER BY categoria, nome COLLATE NOCASE");
}

export function buscarContato(id: string): Contato | null {
  return queryAll<Contato>("SELECT * FROM contatos WHERE id = ?", [id])[0] ?? null;
}

export type ContatoInput = {
  nome: string;
  categoria: CategoriaContato;
  especialidade?: string | null;
  empresa?: string | null;
  telefone?: string | null;
  email?: string | null;
  pessoa_id?: string | null;
  observacoes?: string | null;
};

export async function criarContato(input: ContatoInput): Promise<string> {
  return inserir("contatos", input);
}

export async function atualizarContato(id: string, input: Partial<ContatoInput>): Promise<void> {
  await atualizar("contatos", id, input);
}

export async function excluirContato(id: string): Promise<void> {
  await excluir("contatos", id);
}
