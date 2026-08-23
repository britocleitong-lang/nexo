import { queryAll, runAndPersist } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import { saldoTotalGeral } from "../financeiro/financeiroRepository";
import { valorTotalInvestimentos } from "../investimentos/investimentosRepository";
import type { Bem, CategoriaBem, Divida, TipoDivida, PatrimonioHistorico } from "../../types/entities";

/**
 * Valor de veículos e imóveis — importados de forma "tardia" (via require
 * dinâmico não é necessário aqui, apenas import direto) pra somar no
 * patrimônio automaticamente. Veículo usa o valor consultado na FIPE;
 * imóvel usa o valor que você mesmo informou. Nenhum dos dois precisa ser
 * duplicado manualmente na lista de Bens.
 */
/**
 * O filtro por status é o que corrige um erro silencioso: um carro vendido
 * continua no banco (de propósito — o histórico vale), mas ele não é mais
 * seu. Sem o filtro, o patrimônio contava um bem que já não existe e o
 * número inflava a cada venda, justamente quando deveria cair.
 *
 * O dinheiro da venda entra pelo outro lado, como saldo em conta — então a
 * troca aparece corretamente: sai o bem, entra o valor.
 */
function valorTotalVeiculos(): number {
  const rows = queryAll<{ total: number }>(
    "SELECT COALESCE(SUM(valor_atual), 0) as total FROM veiculos WHERE status != 'vendido'",
  );
  return rows[0]?.total ?? 0;
}

function valorTotalImoveisAtivo(): number {
  const rows = queryAll<{ total: number }>(
    "SELECT COALESCE(SUM(valor_atual), 0) as total FROM imoveis WHERE COALESCE(status, 'ativo') != 'vendido'",
  );
  return rows[0]?.total ?? 0;
}

export function listarBens(): Bem[] {
  return queryAll<Bem>("SELECT * FROM bens ORDER BY categoria, descricao COLLATE NOCASE");
}

export type BemInput = {
  descricao: string;
  categoria: CategoriaBem;
  valor_aquisicao?: number | null;
  valor_atual?: number | null;
  data_aquisicao?: string | null;
  pessoa_id?: string | null;
  observacoes?: string | null;
};

export async function criarBem(input: BemInput): Promise<void> {
  await inserir("bens", input);
}

export async function atualizarBem(id: string, input: Partial<BemInput>): Promise<void> {
  await atualizar("bens", id, input);
}

export async function excluirBem(id: string): Promise<void> {
  await excluir("bens", id);
}

export function valorBens(): number {
  const rows = queryAll<{ total: number }>("SELECT COALESCE(SUM(valor_atual), 0) as total FROM bens");
  return rows[0]?.total ?? 0;
}

/** @deprecated use valorAtivos() — mantido pra não quebrar chamadas existentes. */
export function patrimonioTotal(): number {
  return valorBens();
}

// --- Dívidas / Passivos -------------------------------------------------------

export const TIPOS_DIVIDA: Array<{ valor: TipoDivida; label: string }> = [
  { valor: "emprestimo", label: "Empréstimo" },
  { valor: "financiamento", label: "Financiamento" },
  { valor: "cartao", label: "Cartão de crédito" },
  { valor: "outro", label: "Outro" },
];

export function listarDividas(): Divida[] {
  return queryAll<Divida>("SELECT * FROM dividas ORDER BY (data_vencimento_final IS NULL), data_vencimento_final ASC");
}

export type DividaInput = {
  descricao: string;
  tipo: TipoDivida;
  valor_total: number;
  valor_pago?: number;
  parcelas_totais?: number | null;
  parcelas_pagas?: number | null;
  taxa_juros?: number | null;
  data_inicio?: string | null;
  data_vencimento_final?: string | null;
  pessoa_id?: string | null;
  observacoes?: string | null;
};

export async function criarDivida(input: DividaInput): Promise<void> {
  await inserir("dividas", { valor_pago: 0, ...input });
}

export async function atualizarDivida(id: string, input: Partial<DividaInput>): Promise<void> {
  await atualizar("dividas", id, input);
}

export async function excluirDivida(id: string): Promise<void> {
  await excluir("dividas", id);
}

/** Soma do saldo devedor (valor_total - valor_pago) de todas as dívidas em aberto. */
export function valorPassivos(): number {
  const rows = queryAll<{ total: number }>(
    "SELECT COALESCE(SUM(valor_total - valor_pago), 0) as total FROM dividas",
  );
  return rows[0]?.total ?? 0;
}

// --- Patrimônio líquido = ativos (bens + saldo em contas) - passivos ---------

export interface PatrimonioLiquido {
  ativos: number;
  passivos: number;
  liquido: number;
}

export function calcularPatrimonioLiquido(): PatrimonioLiquido {
  const ativos = valorBens() + saldoTotalGeral() + valorTotalInvestimentos() + valorTotalVeiculos() + valorTotalImoveisAtivo();
  const passivos = valorPassivos();
  return { ativos, passivos, liquido: ativos - passivos };
}

/** Bens "automáticos" — vêm de outros módulos (veículos, imóveis) sem precisar cadastrar de novo aqui. */
export interface BemAutomatico {
  id: string;
  descricao: string;
  categoria: string;
  valor_atual: number;
  origem: "veiculo" | "imovel";
}

export function listarBensAutomaticos(): BemAutomatico[] {
  const veiculos = queryAll<{ id: string; marca: string; modelo: string; valor_atual: number | null }>(
    `SELECT id, marca, modelo, valor_atual FROM veiculos
     WHERE valor_atual IS NOT NULL AND valor_atual > 0 AND status != 'vendido'`,
  );
  const imoveis = queryAll<{ id: string; apelido: string; valor_atual: number | null }>(
    `SELECT id, apelido, valor_atual FROM imoveis
     WHERE valor_atual IS NOT NULL AND valor_atual > 0 AND COALESCE(status, 'ativo') != 'vendido'`,
  );
  return [
    ...veiculos.map((v) => ({
      id: v.id, descricao: `${v.marca} ${v.modelo}`, categoria: "Veículo", valor_atual: v.valor_atual ?? 0, origem: "veiculo" as const,
    })),
    ...imoveis.map((i) => ({
      id: i.id, descricao: i.apelido, categoria: "Imóvel", valor_atual: i.valor_atual ?? 0, origem: "imovel" as const,
    })),
  ];
}

/**
 * Registra (ou atualiza) o snapshot de patrimônio do dia de hoje — chamado
 * sempre que a tela de Patrimônio é aberta. Ao longo do tempo isso forma o
 * histórico de evolução, sem precisar de nenhum job em segundo plano.
 */
export async function registrarSnapshotHoje(): Promise<void> {
  const hoje = new Date().toISOString().slice(0, 10);
  const { ativos, passivos, liquido } = calcularPatrimonioLiquido();
  const existente = queryAll<{ id: string }>("SELECT id FROM patrimonio_historico WHERE data = ?", [hoje])[0];
  if (existente) {
    await runAndPersist(
      "UPDATE patrimonio_historico SET valor_ativos = ?, valor_passivos = ?, valor_liquido = ? WHERE id = ?",
      [ativos, passivos, liquido, existente.id],
    );
  } else {
    await runAndPersist(
      "INSERT INTO patrimonio_historico (id, data, valor_ativos, valor_passivos, valor_liquido, criado_em) VALUES (?, ?, ?, ?, ?, ?)",
      [crypto.randomUUID(), hoje, ativos, passivos, liquido, new Date().toISOString()],
    );
  }
}

export function listarHistoricoPatrimonio(limite = 90): PatrimonioHistorico[] {
  return queryAll<PatrimonioHistorico>(
    "SELECT * FROM patrimonio_historico ORDER BY data ASC LIMIT ?",
    [limite],
  );
}
