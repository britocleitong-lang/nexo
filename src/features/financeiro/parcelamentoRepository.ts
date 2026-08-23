import { queryAll } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import { somarMeses, hoje, chaveMes } from "../../core/datas";
import type { Parcelamento, Transacao } from "../../types/entities";

// =====================================================================
// Compra parcelada
// ---------------------------------------------------------------------
// Antes, uma compra em 12x no cartão só existia se a pessoa lançasse 12
// linhas na mão — e na prática ninguém lança, então o orçamento dos meses
// seguintes ficava cego pra algo já comprometido.
//
// Aqui a compra gera as 12 transações de uma vez, todas com pago = 0
// (previstas) e data_vencimento nos meses corretos. Elas não afetam o
// saldo atual, mas aparecem na projeção, no alerta de vencimento e no
// orçamento do mês em que caem.
//
// O rateio das parcelas usa centavos inteiros: a diferença de
// arredondamento vai toda na PRIMEIRA parcela, que é como as operadoras
// de cartão fazem. R$ 100 em 3x = 33,34 + 33,33 + 33,33.
// =====================================================================

export type ParcelamentoInput = {
  descricao: string;
  valor_total: number;
  parcelas_totais: number;
  data_primeira: string;
  categoria_id?: string | null;
  cartao_id?: string | null;
  conta_id?: string | null;
  pessoa_id?: string | null;
  veiculo_id?: string | null;
  observacoes?: string | null;
};

/** Divide o total em N parcelas de centavos inteiros, sem sobra nem falta. */
export function ratearParcelas(valorTotal: number, parcelas: number): number[] {
  const totalCentavos = Math.round(valorTotal * 100);
  const base = Math.floor(totalCentavos / parcelas);
  const resto = totalCentavos - base * parcelas;
  return Array.from({ length: parcelas }, (_, i) => (i === 0 ? base + resto : base) / 100);
}

export function listarParcelamentos(): Parcelamento[] {
  return queryAll<Parcelamento>("SELECT * FROM parcelamentos ORDER BY data_primeira DESC");
}

export function buscarParcelamento(id: string): Parcelamento | null {
  return queryAll<Parcelamento>("SELECT * FROM parcelamentos WHERE id = ?", [id])[0] ?? null;
}

export function parcelasDo(parcelamentoId: string): Transacao[] {
  return queryAll<Transacao>(
    "SELECT * FROM transacoes WHERE parcelamento_id = ? ORDER BY parcela_numero ASC",
    [parcelamentoId],
  );
}

/**
 * Cria o parcelamento e materializa todas as parcelas de uma vez.
 * A primeira parcela nasce paga quando a data já passou ou é hoje — é o
 * caso normal de "comprei agora, a primeira já debitou".
 */
export async function criarParcelamento(input: ParcelamentoInput): Promise<string> {
  const parcelamentoId = await inserir("parcelamentos", input);
  const valores = ratearParcelas(input.valor_total, input.parcelas_totais);
  const diaPreferido = Number(input.data_primeira.slice(8, 10));

  for (let i = 0; i < input.parcelas_totais; i++) {
    const vencimento = i === 0 ? input.data_primeira : somarMeses(input.data_primeira, i, diaPreferido);
    await inserir("transacoes", {
      tipo: "despesa",
      descricao: `${input.descricao} (${i + 1}/${input.parcelas_totais})`,
      valor: valores[i],
      data: vencimento,
      data_vencimento: vencimento,
      categoria_id: input.categoria_id ?? null,
      cartao_id: input.cartao_id ?? null,
      conta_id: input.conta_id ?? null,
      pessoa_id: input.pessoa_id ?? null,
      veiculo_id: input.veiculo_id ?? null,
      natureza: "fixo",
      recorrente: 0,
      parcelamento_id: parcelamentoId,
      parcela_numero: i + 1,
      parcelas_totais: input.parcelas_totais,
      pago: i === 0 && vencimento <= hoje() ? 1 : 0,
      observacoes: input.observacoes ?? null,
    });
  }

  return parcelamentoId;
}

/** Exclui o parcelamento e TODAS as parcelas ainda não pagas. */
export async function excluirParcelamento(id: string, incluirPagas = false): Promise<number> {
  const parcelas = parcelasDo(id);
  let removidas = 0;
  for (const p of parcelas) {
    if (!incluirPagas && p.pago === 1) continue;
    await excluir("transacoes", p.id);
    removidas += 1;
  }
  // O registro pai só sai se não sobrou nenhuma parcela órfã — assim o
  // histórico de uma compra parcialmente paga não perde a referência.
  if (parcelasDo(id).length === 0) await excluir("parcelamentos", id);

  return removidas;
}

export async function atualizarParcelamento(id: string, input: Partial<ParcelamentoInput>): Promise<void> {
  await atualizar("parcelamentos", id, input);
}

export interface ResumoParcelamento {
  parcelamento: Parcelamento;
  pagas: number;
  restantes: number;
  valorPago: number;
  valorRestante: number;
  proximoVencimento: string | null;
}

export function resumirParcelamentos(): ResumoParcelamento[] {
  return listarParcelamentos().map((p) => {
    const parcelas = parcelasDo(p.id);
    const pagas = parcelas.filter((x) => x.pago === 1);
    const abertas = parcelas.filter((x) => x.pago === 0);
    return {
      parcelamento: p,
      pagas: pagas.length,
      restantes: abertas.length,
      valorPago: pagas.reduce((s, x) => s + x.valor, 0),
      valorRestante: abertas.reduce((s, x) => s + x.valor, 0),
      proximoVencimento: abertas[0]?.data_vencimento ?? abertas[0]?.data ?? null,
    };
  });
}

/** Quanto das parcelas cai num mês específico ("2026-09"). */
export function comprometidoNoMes(mes = chaveMes()): number {
  const rows = queryAll<{ total: number }>(
    `SELECT COALESCE(SUM(valor), 0) as total FROM transacoes
     WHERE parcelamento_id IS NOT NULL AND substr(COALESCE(data_vencimento, data), 1, 7) = ?`,
    [mes],
  );
  return rows[0]?.total ?? 0;
}

/** Total ainda devido em todas as compras parceladas em aberto. */
export function totalParceladoEmAberto(): number {
  const rows = queryAll<{ total: number }>(
    `SELECT COALESCE(SUM(valor), 0) as total FROM transacoes
     WHERE parcelamento_id IS NOT NULL AND pago = 0`,
  );
  return rows[0]?.total ?? 0;
}
