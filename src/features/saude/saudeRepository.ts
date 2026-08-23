import { queryAll } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import type { RegistroSaude, TipoRegistroSaude } from "../../types/entities";

export const TIPOS_SAUDE: Array<{ valor: TipoRegistroSaude; label: string }> = [
  { valor: "consulta", label: "Consulta" },
  { valor: "exame", label: "Exame" },
  { valor: "vacina", label: "Vacina" },
  { valor: "medicamento", label: "Medicamento" },
  { valor: "procedimento", label: "Procedimento" },
];

export function listarRegistrosSaude(): RegistroSaude[] {
  return queryAll<RegistroSaude>("SELECT * FROM registros_saude ORDER BY data DESC");
}

export type RegistroSaudeInput = {
  tipo: TipoRegistroSaude;
  nome: string;
  pessoa_id?: string | null;
  data: string;
  profissional?: string | null;
  local?: string | null;
  resultado?: string | null;
  valor_numerico?: number | null;
  unidade?: string | null;
  dose?: string | null;
  frequencia?: string | null;
  proxima_data?: string | null;
  observacoes?: string | null;
};

export async function criarRegistroSaude(input: RegistroSaudeInput): Promise<void> {
  await inserir("registros_saude", input);
}

export async function atualizarRegistroSaude(id: string, input: Partial<RegistroSaudeInput>): Promise<void> {
  await atualizar("registros_saude", id, input);
}

export async function excluirRegistroSaude(id: string): Promise<void> {
  await excluir("registros_saude", id);
}

/** Histórico de um mesmo tipo de exame pra uma pessoa (ex: "Colesterol" ao longo dos anos). */
export function historicoPorNome(pessoaId: string, nome: string): RegistroSaude[] {
  return queryAll<RegistroSaude>(
    "SELECT * FROM registros_saude WHERE pessoa_id = ? AND nome = ? ORDER BY data ASC",
    [pessoaId, nome],
  );
}

/**
 * Lista os nomes de exame que têm pelo menos 2 valores numéricos registrados
 * pra uma pessoa — esses são os que valem a pena mostrar num gráfico de
 * evolução (ex: Colesterol, Glicose, Pressão).
 */
export function nomesComEvolucao(pessoaId: string): Array<{ nome: string; total: number; unidade: string | null }> {
  return queryAll<{ nome: string; total: number; unidade: string | null }>(
    `SELECT nome, COUNT(*) as total, MAX(unidade) as unidade
     FROM registros_saude
     WHERE pessoa_id = ? AND valor_numerico IS NOT NULL
     GROUP BY nome
     HAVING COUNT(*) >= 2
     ORDER BY nome COLLATE NOCASE`,
    [pessoaId],
  );
}

export function proximosCompromissosSaude(dias = 60): RegistroSaude[] {
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);
  const limiteStr = limite.toISOString().slice(0, 10);
  return queryAll<RegistroSaude>(
    "SELECT * FROM registros_saude WHERE proxima_data IS NOT NULL AND proxima_data <= ? ORDER BY proxima_data ASC",
    [limiteStr],
  );
}

/**
 * Gastos com a categoria "Saúde" no Financeiro, agrupados por pessoa —
 * o cruzamento entre os dois módulos: cadastre a consulta/exame aqui,
 * lance a despesa no Financeiro marcando a categoria Saúde e a pessoa,
 * e o total aparece automaticamente.
 */
export function gastosSaudePorPessoa(): Array<{ pessoa_nome: string; total: number }> {
  return queryAll<{ pessoa_nome: string; total: number }>(
    `SELECT COALESCE(p.nome, 'Sem pessoa') as pessoa_nome, SUM(t.valor) as total
     FROM transacoes t
     JOIN categorias c ON c.id = t.categoria_id
     LEFT JOIN pessoas p ON p.id = t.pessoa_id
     WHERE c.nome = 'Saúde' AND t.tipo = 'despesa'
     GROUP BY pessoa_nome ORDER BY total DESC`,
  );
}

export function gastoTotalSaude(): number {
  const rows = queryAll<{ total: number }>(
    `SELECT COALESCE(SUM(t.valor), 0) as total FROM transacoes t
     JOIN categorias c ON c.id = t.categoria_id
     WHERE c.nome = 'Saúde' AND t.tipo = 'despesa'`,
  );
  return rows[0]?.total ?? 0;
}
