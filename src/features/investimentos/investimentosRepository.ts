import { queryAll } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import { encontrarOuCriarCategoria, criarTransacao, excluirTransacao } from "../financeiro/financeiroRepository";
import type { Investimento, MovimentoInvestimento, TipoInvestimento, TipoMovimentoInvestimento } from "../../types/entities";

export const TIPOS_INVESTIMENTO: Array<{ valor: TipoInvestimento; label: string }> = [
  { valor: "reserva_emergencia", label: "Reserva de emergência" },
  { valor: "renda_fixa", label: "Renda fixa" },
  { valor: "renda_variavel", label: "Renda variável" },
  { valor: "fundo", label: "Fundo" },
  { valor: "previdencia", label: "Previdência" },
  { valor: "outro", label: "Outro" },
];

const CATEGORIA_APORTES = "Aportes e resgates";

export function listarInvestimentos(): Investimento[] {
  return queryAll<Investimento>("SELECT * FROM investimentos ORDER BY tipo, nome COLLATE NOCASE");
}

export function buscarInvestimento(id: string): Investimento | null {
  return queryAll<Investimento>("SELECT * FROM investimentos WHERE id = ?", [id])[0] ?? null;
}

export type InvestimentoInput = {
  nome: string;
  tipo: TipoInvestimento;
  valor_atual?: number;
  meta_valor?: number | null;
  instituicao?: string | null;
  pessoa_id?: string | null;
  observacoes?: string | null;
};

export async function criarInvestimento(input: InvestimentoInput): Promise<string> {
  return inserir("investimentos", { valor_atual: 0, ...input });
}

export async function atualizarInvestimento(id: string, input: Partial<InvestimentoInput>): Promise<void> {
  await atualizar("investimentos", id, input);
}

export async function excluirInvestimento(id: string): Promise<void> {
  await excluir("investimentos", id);
}

export function valorTotalInvestimentos(): number {
  const rows = queryAll<{ total: number }>("SELECT COALESCE(SUM(valor_atual), 0) as total FROM investimentos");
  return rows[0]?.total ?? 0;
}

// --- Movimentos (aporte / resgate / rendimento) -----------------------------

export function listarMovimentos(investimentoId: string): MovimentoInvestimento[] {
  return queryAll<MovimentoInvestimento>(
    "SELECT * FROM movimentos_investimento WHERE investimento_id = ? ORDER BY data DESC, criado_em DESC",
    [investimentoId],
  );
}

/**
 * Registra um movimento e atualiza o valor_atual do investimento de acordo
 * (aporte/rendimento somam, resgate subtrai). Quando é aporte ou resgate
 * (não rendimento), exige a conta de origem/destino e cria automaticamente
 * o lançamento correspondente no Financeiro — o saldo daquela conta é
 * debitado (aporte) ou creditado (resgate) igual a uma transferência real.
 * Rendimento não mexe em conta nenhuma, porque é valorização do próprio
 * investimento, não dinheiro saindo/entrando de uma conta sua.
 */
export async function registrarMovimento(
  investimentoId: string,
  tipo: TipoMovimentoInvestimento,
  valor: number,
  data: string,
  contaId?: string | null,
  observacoes?: string | null,
): Promise<void> {
  const investimento = buscarInvestimento(investimentoId);
  if (!investimento) return;

  let transacaoId: string | null = null;
  if (tipo !== "rendimento" && contaId) {
    const categoriaId = await encontrarOuCriarCategoria(CATEGORIA_APORTES, tipo === "aporte" ? "despesa" : "receita");
    transacaoId = await criarTransacao({
      tipo: tipo === "aporte" ? "despesa" : "receita",
      descricao: `${tipo === "aporte" ? "Aporte" : "Resgate"} — ${investimento.nome}`,
      valor,
      data,
      categoria_id: categoriaId,
      conta_id: contaId,
      investimento_id: investimentoId,
      natureza: "investimento",
    });
  }

  await inserir("movimentos_investimento", {
    investimento_id: investimentoId,
    tipo,
    valor,
    data,
    conta_id: contaId || null,
    transacao_id: transacaoId,
    observacoes: observacoes || null,
  });

  const delta = tipo === "resgate" ? -valor : valor;
  await atualizar("investimentos", investimentoId, { valor_atual: investimento.valor_atual + delta });
}

export async function excluirMovimento(id: string, investimentoId: string): Promise<void> {
  const movimento = queryAll<MovimentoInvestimento>("SELECT * FROM movimentos_investimento WHERE id = ?", [id])[0];
  await excluir("movimentos_investimento", id);
  if (!movimento) return;

  // desfaz o lançamento financeiro vinculado, se houver
  if (movimento.transacao_id) {
    await excluirTransacao(movimento.transacao_id);
  }

  const investimento = buscarInvestimento(investimentoId);
  if (!investimento) return;
  const delta = movimento.tipo === "resgate" ? movimento.valor : -movimento.valor;
  await atualizar("investimentos", investimentoId, { valor_atual: investimento.valor_atual + delta });
}
