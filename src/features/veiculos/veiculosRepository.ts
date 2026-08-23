import { queryAll } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import { encontrarOuCriarCategoria, criarTransacao } from "../financeiro/financeiroRepository";
import type { Veiculo, Manutencao, Modificacao, RegistroKm, Transacao } from "../../types/entities";

export function listarVeiculos(): Veiculo[] {
  return queryAll<Veiculo>("SELECT * FROM veiculos ORDER BY marca COLLATE NOCASE, modelo COLLATE NOCASE");
}

export function buscarVeiculo(id: string): Veiculo | null {
  return queryAll<Veiculo>("SELECT * FROM veiculos WHERE id = ?", [id])[0] ?? null;
}

export type VeiculoInput = {
  pessoa_id?: string | null;
  marca: string;
  modelo: string;
  ano?: string | null;
  placa?: string | null;
  renavam?: string | null;
  km_atual?: number | null;
  data_compra?: string | null;
  valor_compra?: number | null;
  valor_atual?: number | null;
  combustivel?: string | null;
  cor?: string | null;
  foto_url?: string | null;
  observacoes?: string | null;
  /** Consumo de fábrica (km/l), para comparar com o consumo real medido. */
  consumo_referencia?: number | null;
  fipe_marca_codigo?: string | null;
  fipe_modelo_codigo?: string | null;
  fipe_ano_codigo?: string | null;
  fipe_atualizado_em?: string | null;
};

export async function criarVeiculo(input: VeiculoInput): Promise<string> {
  return inserir("veiculos", { ...input, pessoa_id: input.pessoa_id || null, cor: input.cor || "#2f6fed" });
}

export async function atualizarVeiculo(id: string, input: Partial<VeiculoInput>): Promise<void> {
  await atualizar("veiculos", id, input);
}

export async function excluirVeiculo(id: string): Promise<void> {
  await excluir("veiculos", id);
}

/** Atualiza só a cor — usado no seletor rápido da tela de detalhe. */
export async function atualizarCorVeiculo(id: string, cor: string): Promise<void> {
  await atualizar("veiculos", id, { cor });
}

/** Define ou remove a foto real do veículo (link colado pelo usuário). */
export async function atualizarFotoVeiculo(id: string, fotoUrl: string | null): Promise<void> {
  await atualizar("veiculos", id, { foto_url: fotoUrl });
}

/** Grava os dados vindos da consulta FIPE (valor + códigos, pra permitir atualizar depois). */
export async function atualizarFipeVeiculo(
  id: string,
  dados: { valor_atual: number; fipe_marca_codigo: string; fipe_modelo_codigo: string; fipe_ano_codigo: string },
): Promise<void> {
  await atualizar("veiculos", id, { ...dados, fipe_atualizado_em: new Date().toISOString() });
}

// --- Manutenções ---------------------------------------------------------

export function listarManutencoes(veiculoId: string): Manutencao[] {
  return queryAll<Manutencao>("SELECT * FROM manutencoes WHERE veiculo_id = ? ORDER BY data DESC", [veiculoId]);
}

export type ManutencaoInput = {
  veiculo_id: string;
  tipo: string;
  data: string;
  km?: number | null;
  valor?: number | null;
  oficina?: string | null;
  observacoes?: string | null;
  proxima_data?: string | null;
  proximo_km?: number | null;
};

/**
 * Registra a manutenção E, se houver valor, cria automaticamente um
 * lançamento correspondente no Financeiro — assim o gasto aparece nos
 * relatórios gerais sem precisar cadastrar a mesma coisa duas vezes.
 */
export async function criarManutencao(input: ManutencaoInput): Promise<void> {
  await inserir("manutencoes", input);
  if (input.valor) {
    const categoriaId = await encontrarOuCriarCategoria("Manutenção", "despesa");
    await criarTransacao({
      tipo: "despesa",
      descricao: `Manutenção — ${input.tipo}`,
      valor: input.valor,
      data: input.data,
      categoria_id: categoriaId,
      veiculo_id: input.veiculo_id,
      natureza: "variavel",
    });
  }
}

export async function atualizarManutencao(id: string, input: Partial<ManutencaoInput>): Promise<void> {
  await atualizar("manutencoes", id, input);
}

export async function excluirManutencao(id: string): Promise<void> {
  await excluir("manutencoes", id);
}

/** Próximas manutenções previstas (por data), olhando todos os veículos. */
export function proximasManutencoes(dias = 30): Array<Manutencao & { veiculo_nome: string }> {
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);
  const limiteStr = limite.toISOString().slice(0, 10);
  return queryAll<Manutencao & { veiculo_nome: string }>(
    `SELECT m.*, (v.marca || ' ' || v.modelo) as veiculo_nome
     FROM manutencoes m JOIN veiculos v ON v.id = m.veiculo_id
     WHERE m.proxima_data IS NOT NULL AND m.proxima_data <= ?
     ORDER BY m.proxima_data ASC`,
    [limiteStr],
  );
}

// --- Modificações ---------------------------------------------------------

export function listarModificacoes(veiculoId: string): Modificacao[] {
  return queryAll<Modificacao>("SELECT * FROM modificacoes WHERE veiculo_id = ? ORDER BY data DESC", [veiculoId]);
}

export type ModificacaoInput = {
  veiculo_id: string;
  descricao: string;
  data: string;
  valor?: number | null;
  observacoes?: string | null;
};

/** Mesma lógica da manutenção: com valor, cria o lançamento correspondente no Financeiro. */
export async function criarModificacao(input: ModificacaoInput): Promise<void> {
  await inserir("modificacoes", input);
  if (input.valor) {
    const categoriaId = await encontrarOuCriarCategoria("Modificações do veículo", "despesa");
    await criarTransacao({
      tipo: "despesa",
      descricao: `Modificação — ${input.descricao}`,
      valor: input.valor,
      data: input.data,
      categoria_id: categoriaId,
      veiculo_id: input.veiculo_id,
      natureza: "variavel",
    });
  }
}

export async function atualizarModificacao(id: string, input: Partial<ModificacaoInput>): Promise<void> {
  await atualizar("modificacoes", id, input);
}

export async function excluirModificacao(id: string): Promise<void> {
  await excluir("modificacoes", id);
}

// --- Histórico de quilometragem -------------------------------------------

export function listarKmRegistros(veiculoId: string): RegistroKm[] {
  return queryAll<RegistroKm>("SELECT * FROM km_registros WHERE veiculo_id = ? ORDER BY data ASC", [veiculoId]);
}

/** Registra uma nova leitura de km E atualiza o km_atual "cache" do veículo. */
export async function registrarKm(veiculoId: string, data: string, km: number, observacoes?: string): Promise<void> {
  await inserir("km_registros", { veiculo_id: veiculoId, data, km, observacoes: observacoes || null });
  await atualizar("veiculos", veiculoId, { km_atual: km });
}

export async function excluirKmRegistro(id: string): Promise<void> {
  await excluir("km_registros", id);
}

/** Média de km rodados por dia, com base no primeiro e último registro. */
export function mediaKmPorDia(veiculoId: string): number | null {
  const registros = listarKmRegistros(veiculoId);
  if (registros.length < 2) return null;
  const primeiro = registros[0];
  const ultimo = registros[registros.length - 1];
  const dias = (new Date(ultimo.data).getTime() - new Date(primeiro.data).getTime()) / (1000 * 60 * 60 * 24);
  if (dias <= 0) return null;
  return (ultimo.km - primeiro.km) / dias;
}

// --- Cruzamento com o Financeiro -------------------------------------------
// Em vez de manter um controle de combustível/consumo separado (que na
// prática quase ninguém mantém disciplinado o suficiente pra ser preciso),
// o veículo mostra diretamente os lançamentos financeiros vinculados a ele
// — de qualquer categoria: manutenção, combustível, seguro, IPVA, o que for.

export function listarLancamentosFinanceirosVeiculo(veiculoId: string): Transacao[] {
  return queryAll<Transacao>(
    "SELECT * FROM transacoes WHERE veiculo_id = ? ORDER BY data DESC",
    [veiculoId],
  );
}

export function gastoFinanceiroTotalVeiculo(veiculoId: string): number {
  const rows = queryAll<{ total: number }>(
    "SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE veiculo_id = ? AND tipo = 'despesa'",
    [veiculoId],
  );
  return rows[0]?.total ?? 0;
}


// =====================================================================
// Ciclo de vida do veículo (v14)
// ---------------------------------------------------------------------
// Vender não é excluir. O carro vendido continua respondendo perguntas
// legítimas: quanto ele custou no total, quanto rodou, quanto de IPVA foi
// pago naquele ano, e — o mais concreto — ele precisa aparecer na
// declaração de IR do ano em que a venda aconteceu, com o valor de venda.
// Apagar o registro destruiria tudo isso.
// =====================================================================

export function listarVeiculosPorStatus(status?: "ativo" | "vendido"): Veiculo[] {
  return status
    ? queryAll<Veiculo>("SELECT * FROM veiculos WHERE status = ? ORDER BY marca, modelo", [status])
    : queryAll<Veiculo>("SELECT * FROM veiculos ORDER BY status, marca, modelo");
}

export async function venderVeiculo(
  id: string,
  dados: { data_venda: string; valor_venda: number | null; lancarReceita?: boolean; conta_id?: string | null },
): Promise<void> {
  await atualizar("veiculos", id, {
    status: "vendido",
    data_venda: dados.data_venda,
    valor_venda: dados.valor_venda,
  });

  // A venda é uma entrada de dinheiro de verdade. Lançar no Financeiro é
  // opcional porque nem sempre o valor cai numa conta cadastrada (troca
  // com volta, pagamento parcelado pelo comprador), e um lançamento errado
  // é pior do que nenhum.
  if (dados.lancarReceita && dados.valor_venda && dados.valor_venda > 0) {
    const veiculo = buscarVeiculo(id);
    await inserir("transacoes", {
      tipo: "receita",
      descricao: `Venda do veículo ${veiculo?.marca ?? ""} ${veiculo?.modelo ?? ""}`.trim(),
      valor: dados.valor_venda,
      data: dados.data_venda,
      conta_id: dados.conta_id ?? null,
      veiculo_id: id,
      recorrente: 0,
      pago: 1,
    });
  }
}

/** Desfaz a venda — para quando o negócio não se concretizou. */
export async function reativarVeiculo(id: string): Promise<void> {
  await atualizar("veiculos", id, { status: "ativo", data_venda: null, valor_venda: null });
}
