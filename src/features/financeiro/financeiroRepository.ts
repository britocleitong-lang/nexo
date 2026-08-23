import { queryAll, runAndPersist } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import { hoje as hojeCore, somarDias } from "../../core/datas";
import type { Conta, Cartao, Categoria, Transacao, TipoCategoria } from "../../types/entities";

// --- Contas ----------------------------------------------------------------

export function listarContas(): Conta[] {
  return queryAll<Conta>("SELECT * FROM contas ORDER BY nome COLLATE NOCASE");
}

export type ContaInput = {
  nome: string;
  tipo: Conta["tipo"];
  saldo_inicial: number;
  instituicao?: string | null;
  observacoes?: string | null;
};

export async function criarConta(input: ContaInput): Promise<void> {
  await inserir("contas", input);
}

export async function atualizarConta(id: string, input: Partial<ContaInput>): Promise<void> {
  await atualizar("contas", id, input);
}

export async function excluirConta(id: string): Promise<void> {
  await excluir("contas", id);
}

/**
 * Saldo atual de uma conta = saldo inicial + receitas - despesas EFETIVADAS.
 *
 * O filtro `pago = 1` é a mudança que sustenta parcelamento e contas a pagar:
 * uma parcela de dezembro já está cadastrada em agosto, mas o dinheiro ainda
 * está na conta. Sem esse filtro, projetar o futuro estragaria o presente.
 * Lançamentos antigos foram migrados com pago = 1, então nada muda de valor.
 */
export function saldoConta(contaId: string): number {
  const conta = queryAll<Conta>("SELECT * FROM contas WHERE id = ?", [contaId])[0];
  if (!conta) return 0;
  const rows = queryAll<{ total: number }>(
    `SELECT COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END), 0) as total
     FROM transacoes WHERE conta_id = ? AND pago = 1`,
    [contaId],
  );
  return conta.saldo_inicial + (rows[0]?.total ?? 0);
}

/** Saldo previsto: o efetivado mais tudo que já está agendado até a data. */
export function saldoPrevistoConta(contaId: string, ateData: string): number {
  const rows = queryAll<{ total: number }>(
    `SELECT COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END), 0) as total
     FROM transacoes WHERE conta_id = ? AND pago = 0 AND COALESCE(data_vencimento, data) <= ?`,
    [contaId, ateData],
  );
  return saldoConta(contaId) + (rows[0]?.total ?? 0);
}

export function saldoTotalGeral(): number {
  return listarContas().reduce((soma, c) => soma + saldoConta(c.id), 0);
}

// --- Cartões ----------------------------------------------------------------

export function listarCartoes(): Cartao[] {
  return queryAll<Cartao>("SELECT * FROM cartoes ORDER BY nome COLLATE NOCASE");
}

export type CartaoInput = {
  nome: string;
  limite?: number | null;
  dia_fechamento?: number | null;
  dia_vencimento?: number | null;
  instituicao?: string | null;
  observacoes?: string | null;
};

export async function criarCartao(input: CartaoInput): Promise<void> {
  await inserir("cartoes", input);
}

export async function atualizarCartao(id: string, input: Partial<CartaoInput>): Promise<void> {
  await atualizar("cartoes", id, input);
}

export async function excluirCartao(id: string): Promise<void> {
  await excluir("cartoes", id);
}

// --- Categorias ---------------------------------------------------------------

export function listarCategorias(tipo?: TipoCategoria): Categoria[] {
  return tipo
    ? queryAll<Categoria>("SELECT * FROM categorias WHERE tipo = ? ORDER BY nome COLLATE NOCASE", [tipo])
    : queryAll<Categoria>("SELECT * FROM categorias ORDER BY tipo, nome COLLATE NOCASE");
}

// --- Transações ---------------------------------------------------------------

export function listarTransacoes(limite = 200): Transacao[] {
  return queryAll<Transacao>("SELECT * FROM transacoes ORDER BY data DESC, criado_em DESC LIMIT ?", [limite]);
}

export type TransacaoInput = {
  tipo: TipoCategoria;
  descricao: string;
  valor: number;
  data: string;
  categoria_id?: string | null;
  conta_id?: string | null;
  cartao_id?: string | null;
  pessoa_id?: string | null;
  veiculo_id?: string | null;
  investimento_id?: string | null;
  natureza?: "fixo" | "variavel" | "investimento" | null;
  recorrente?: number;
  observacoes?: string | null;
  /** 0 = previsto (a pagar/a receber), 1 = efetivado. Padrão: 1. */
  pago?: number;
  data_vencimento?: string | null;
  recorrencia_id?: string | null;
  parcelamento_id?: string | null;
  parcela_numero?: number | null;
  parcelas_totais?: number | null;
  fitid?: string | null;
  importado_em?: string | null;
};

export async function criarTransacao(input: TransacaoInput): Promise<string> {
  const id = await inserir("transacoes", { recorrente: 0, pago: 1, ...input });
  return id;
}

/** Marca um lançamento previsto como efetivado (ou desfaz). */
export async function definirPago(id: string, pago: boolean, dataEfetiva?: string): Promise<void> {
  const dados: Record<string, unknown> = { pago: pago ? 1 : 0 };
  // Ao confirmar, a data do lançamento passa a ser a data real do pagamento,
  // preservando o vencimento original em data_vencimento. É o que faz o
  // relatório do mês bater com o extrato do banco.
  if (pago && dataEfetiva) dados.data = dataEfetiva;
  await atualizar("transacoes", id, dados);
}

/** Lançamentos previstos (não efetivados) em ordem de vencimento. */
export function listarPrevistos(dias = 60): Transacao[] {
  const limite = somarDias(hojeCore(), dias);
  return queryAll<Transacao>(
    `SELECT * FROM transacoes WHERE pago = 0 AND COALESCE(data_vencimento, data) <= ?
     ORDER BY COALESCE(data_vencimento, data) ASC`,
    [limite],
  );
}

/** Total a pagar e a receber já agendado no período. */
export function totaisPrevistos(dias = 30): { aPagar: number; aReceber: number } {
  const limite = somarDias(hojeCore(), dias);
  const rows = queryAll<{ tipo: string; total: number }>(
    `SELECT tipo, COALESCE(SUM(valor), 0) as total FROM transacoes
     WHERE pago = 0 AND COALESCE(data_vencimento, data) <= ? GROUP BY tipo`,
    [limite],
  );
  return {
    aPagar: rows.find((r) => r.tipo === "despesa")?.total ?? 0,
    aReceber: rows.find((r) => r.tipo === "receita")?.total ?? 0,
  };
}

export async function atualizarTransacao(id: string, input: Partial<TransacaoInput>): Promise<void> {
  await atualizar("transacoes", id, input);
}

export async function excluirTransacao(id: string): Promise<void> {
  await excluir("transacoes", id);
}

/** Total de despesas e receitas dentro de um intervalo de datas (ISO). */
export function totaisPeriodo(inicioIso: string, fimIso: string): { receitas: number; despesas: number } {
  const rows = queryAll<{ tipo: TipoCategoria; total: number }>(
    `SELECT tipo, COALESCE(SUM(valor), 0) as total FROM transacoes
     WHERE data >= ? AND data <= ? AND pago = 1 GROUP BY tipo`,
    [inicioIso, fimIso],
  );
  const receitas = rows.find((r) => r.tipo === "receita")?.total ?? 0;
  const despesas = rows.find((r) => r.tipo === "despesa")?.total ?? 0;
  return { receitas, despesas };
}

/** Gastos do mês atual, agrupados por categoria — base pro gráfico do dashboard. */
export function despesasPorCategoriaMesAtual(): Array<{ categoria: string; total: number }> {
  const agora = new Date();
  const inicioMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-01`;
  return queryAll<{ categoria: string; total: number }>(
    `SELECT COALESCE(c.nome, 'Sem categoria') as categoria, SUM(t.valor) as total
     FROM transacoes t LEFT JOIN categorias c ON c.id = t.categoria_id
     WHERE t.tipo = 'despesa' AND t.pago = 1 AND t.data >= ?
     GROUP BY categoria ORDER BY total DESC`,
    [inicioMes],
  );
}

/** Cria uma nova categoria (usado pelo botão "+ Adicionar" embutido no formulário). */
export async function criarCategoria(nome: string, tipo: TipoCategoria): Promise<string> {
  const id = crypto.randomUUID();
  await runAndPersist("INSERT INTO categorias (id, nome, tipo) VALUES (?, ?, ?)", [id, nome.trim(), tipo]);
  return id;
}

export async function excluirCategoria(id: string): Promise<void> {
  await excluir("categorias", id);
}

/** Acha uma categoria pelo nome (e tipo), ou cria se ainda não existir — usado por outros módulos (veículos, investimentos) que precisam de uma categoria "de sistema". */
export async function encontrarOuCriarCategoria(nome: string, tipo: TipoCategoria): Promise<string> {
  const existente = listarCategorias(tipo).find((c) => c.nome.toLowerCase() === nome.toLowerCase());
  if (existente) return existente.id;
  return criarCategoria(nome, tipo);
}

// --- Análise financeira: metodologia fixo / variável / investimento ---------

export interface ResumoNatureza {
  fixo: number;
  variavel: number;
  investimento: number;
  naoClassificado: number;
}

/** Soma as despesas do período, agrupadas pela natureza (fixo/variável/investimento). */
export function despesasPorNatureza(inicioIso: string, fimIso: string): ResumoNatureza {
  const rows = queryAll<{ natureza: string | null; total: number }>(
    `SELECT natureza, COALESCE(SUM(valor), 0) as total FROM transacoes
     WHERE tipo = 'despesa' AND pago = 1 AND data >= ? AND data <= ? GROUP BY natureza`,
    [inicioIso, fimIso],
  );
  const resumo: ResumoNatureza = { fixo: 0, variavel: 0, investimento: 0, naoClassificado: 0 };
  for (const r of rows) {
    if (r.natureza === "fixo") resumo.fixo = r.total;
    else if (r.natureza === "variavel") resumo.variavel = r.total;
    else if (r.natureza === "investimento") resumo.investimento = r.total;
    else resumo.naoClassificado += r.total;
  }
  return resumo;
}

/** Receitas do ano, agrupadas por pessoa — base da seção "Rendimentos" do IR. */
export function rendimentosPorPessoaAno(ano: number): Array<{ pessoa_nome: string; total: number }> {
  return queryAll<{ pessoa_nome: string; total: number }>(
    `SELECT COALESCE(p.nome, 'Sem pessoa') as pessoa_nome, SUM(t.valor) as total
     FROM transacoes t LEFT JOIN pessoas p ON p.id = t.pessoa_id
     WHERE t.tipo = 'receita' AND t.data >= ? AND t.data <= ?
     GROUP BY pessoa_nome ORDER BY total DESC`,
    [`${ano}-01-01`, `${ano}-12-31`],
  );
}

/** Despesas de Saúde/Educação do ano, por pessoa — base da seção "Pagamentos dedutíveis" do IR. */
export function pagamentosDedutiveisPorPessoaAno(ano: number): Array<{ pessoa_nome: string; categoria: string; total: number }> {
  return queryAll<{ pessoa_nome: string; categoria: string; total: number }>(
    `SELECT COALESCE(p.nome, 'Sem pessoa') as pessoa_nome, c.nome as categoria, SUM(t.valor) as total
     FROM transacoes t
     JOIN categorias c ON c.id = t.categoria_id
     LEFT JOIN pessoas p ON p.id = t.pessoa_id
     WHERE t.tipo = 'despesa' AND c.nome IN ('Saúde', 'Educação') AND t.data >= ? AND t.data <= ?
     GROUP BY pessoa_nome, categoria ORDER BY pessoa_nome, categoria`,
    [`${ano}-01-01`, `${ano}-12-31`],
  );
}
export function evolucaoMensal(nMeses = 6): Array<{
  mes: string; receitas: number; despesasFixas: number; despesasVariaveis: number; investido: number;
}> {
  const hoje = new Date();
  const resultado: Array<{ mes: string; receitas: number; despesasFixas: number; despesasVariaveis: number; investido: number }> = [];

  for (let i = nMeses - 1; i >= 0; i--) {
    const referencia = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const inicio = referencia.toISOString().slice(0, 10);
    const fimData = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
    const fim = fimData.toISOString().slice(0, 10);
    const label = referencia.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

    const rows = queryAll<{ tipo: string; natureza: string | null; total: number }>(
      `SELECT tipo, natureza, COALESCE(SUM(valor), 0) as total FROM transacoes
       WHERE data >= ? AND data <= ? AND pago = 1 GROUP BY tipo, natureza`,
      [inicio, fim],
    );

    let receitas = 0, despesasFixas = 0, despesasVariaveis = 0, investido = 0;
    for (const r of rows) {
      if (r.tipo === "receita") receitas += r.total;
      else if (r.natureza === "fixo") despesasFixas += r.total;
      else if (r.natureza === "investimento") investido += r.total;
      else despesasVariaveis += r.total; // variavel + não classificado entram como variável na análise
    }
    resultado.push({ mes: label, receitas, despesasFixas, despesasVariaveis, investido });
  }
  return resultado;
}

// --- Orçamento mensal por categoria (ao estilo YNAB/Monarch) ------------------

export interface OrcamentoComGasto {
  id: string;
  categoria_id: string;
  categoria_nome: string;
  valor_limite: number;
  gasto_mes_atual: number;
}

/** Lista os orçamentos definidos, já cruzados com o gasto real do mês atual. */
export function listarOrcamentosComGasto(): OrcamentoComGasto[] {
  const agora = new Date();
  const inicioMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-01`;
  return queryAll<OrcamentoComGasto>(
    `SELECT o.id, o.categoria_id, c.nome as categoria_nome, o.valor_limite,
            COALESCE((
              SELECT SUM(t.valor) FROM transacoes t
              WHERE t.categoria_id = o.categoria_id AND t.tipo = 'despesa' AND t.pago = 1 AND t.data >= ?
            ), 0) as gasto_mes_atual
     FROM orcamentos o JOIN categorias c ON c.id = o.categoria_id
     ORDER BY c.nome COLLATE NOCASE`,
    [inicioMes],
  );
}

/** Cria (ou atualiza, se já existir orçamento pra essa categoria) o limite mensal. */
export async function definirOrcamento(categoriaId: string, valorLimite: number): Promise<void> {
  const existente = queryAll<{ id: string }>("SELECT id FROM orcamentos WHERE categoria_id = ?", [categoriaId])[0];
  if (existente) {
    await atualizar("orcamentos", existente.id, { valor_limite: valorLimite });
  } else {
    await inserir("orcamentos", { categoria_id: categoriaId, valor_limite: valorLimite });
  }
}

export async function excluirOrcamento(id: string): Promise<void> {
  await excluir("orcamentos", id);
}
