import { queryAll } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import { hoje, proximaData, diasRestantes, somarDias } from "../datas";
import type { Recorrencia, Frequencia, TipoCategoria, NaturezaTransacao } from "../../types/entities";

// =====================================================================
// Motor de recorrência
// ---------------------------------------------------------------------
// O campo `recorrente` que já existia na tabela transacoes era só um selo:
// marcava que aquele lançamento se repetia, mas nada acontecia por causa
// disso. Aqui a recorrência passa a ser uma entidade própria — um MOLDE —
// e o motor materializa os lançamentos que faltam.
//
// Regra de ouro: o motor nunca inventa passado. Ele materializa da
// proxima_ocorrencia até hoje (inclusive), o que significa que se o app
// ficar duas semanas fechado, ao abrir ele repõe exatamente as ocorrências
// perdidas, uma por vez, sem duplicar e sem pular.
// =====================================================================

export type RecorrenciaInput = {
  tipo: TipoCategoria;
  descricao: string;
  valor: number;
  frequencia: Frequencia;
  dia_referencia?: number | null;
  data_inicio: string;
  data_fim?: string | null;
  categoria_id?: string | null;
  conta_id?: string | null;
  cartao_id?: string | null;
  pessoa_id?: string | null;
  veiculo_id?: string | null;
  natureza?: NaturezaTransacao | null;
  lancar_automatico?: number;
  observacoes?: string | null;
};

export function listarRecorrencias(incluirInativas = false): Recorrencia[] {
  const sql = incluirInativas
    ? "SELECT * FROM recorrencias ORDER BY ativa DESC, proxima_ocorrencia ASC"
    : "SELECT * FROM recorrencias WHERE ativa = 1 ORDER BY proxima_ocorrencia ASC";
  return queryAll<Recorrencia>(sql);
}

export function buscarRecorrencia(id: string): Recorrencia | null {
  return queryAll<Recorrencia>("SELECT * FROM recorrencias WHERE id = ?", [id])[0] ?? null;
}

export async function criarRecorrencia(input: RecorrenciaInput): Promise<string> {
  const id = await inserir("recorrencias", {
    ...input,
    dia_referencia: input.dia_referencia ?? Number(input.data_inicio.slice(8, 10)),
    proxima_ocorrencia: input.data_inicio,
    lancar_automatico: input.lancar_automatico ?? 0,
    ativa: 1,
  });
  return id;
}

export async function atualizarRecorrencia(id: string, input: Partial<RecorrenciaInput> & { ativa?: number }): Promise<void> {
  await atualizar("recorrencias", id, input);
}

export async function excluirRecorrencia(id: string): Promise<void> {
  await excluir("recorrencias", id);
}

/** Pausa/retoma sem perder o histórico nem a data de referência. */
export async function alternarAtiva(id: string): Promise<void> {
  const r = buscarRecorrencia(id);
  if (!r) return;
  await atualizar("recorrencias", id, { ativa: r.ativa ? 0 : 1 });
}

// --- Materialização --------------------------------------------------------

export interface OcorrenciaPendente {
  recorrencia: Recorrencia;
  data: string;
  /** Quantas ocorrências dessa mesma recorrência estão pendentes. */
  indice: number;
}

/**
 * Lista tudo que deveria ter sido lançado e ainda não foi, sem gravar nada.
 * A tela usa isso pra perguntar antes ("lançar as 4 previstas?"), o que
 * respeita a regra de nunca escrever no banco sem o usuário saber.
 */
export function ocorrenciasPendentes(ateData = hoje()): OcorrenciaPendente[] {
  const pendentes: OcorrenciaPendente[] = [];
  for (const r of listarRecorrencias()) {
    let cursor = r.proxima_ocorrencia;
    let indice = 0;
    // Trava de segurança: no máximo 60 reposições por molde numa passada.
    // Protege contra um molde com data_inicio muito antiga travar o app.
    while (cursor <= ateData && indice < 60) {
      if (r.data_fim && cursor > r.data_fim) break;
      indice += 1;
      pendentes.push({ recorrencia: r, data: cursor, indice });
      cursor = proximaData(cursor, r.frequencia, r.dia_referencia);
    }
  }
  return pendentes.sort((a, b) => a.data.localeCompare(b.data));
}

/** Recorrências que vencem nos próximos `dias` — alimenta alertas e projeção. */
export function ocorrenciasFuturas(dias = 30): OcorrenciaPendente[] {
  const limite = somarDias(hoje(), dias);
  const futuras: OcorrenciaPendente[] = [];
  for (const r of listarRecorrencias()) {
    let cursor = r.proxima_ocorrencia;
    let indice = 0;
    while (cursor <= limite && indice < 60) {
      if (r.data_fim && cursor > r.data_fim) break;
      if (cursor > hoje()) {
        indice += 1;
        futuras.push({ recorrencia: r, data: cursor, indice });
      }
      cursor = proximaData(cursor, r.frequencia, r.dia_referencia);
    }
  }
  return futuras.sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Grava as ocorrências informadas como transações reais e avança o molde.
 * `pago` entra como 1 porque uma recorrência confirmada representa algo que
 * de fato aconteceu (o salário caiu, a assinatura debitou).
 */
export async function materializar(ocorrencias: OcorrenciaPendente[]): Promise<number> {
  let criadas = 0;
  const avancos = new Map<string, string>();

  for (const oc of ocorrencias) {
    const r = oc.recorrencia;
    await inserir("transacoes", {
      tipo: r.tipo,
      descricao: r.descricao,
      valor: r.valor,
      data: oc.data,
      data_vencimento: oc.data,
      categoria_id: r.categoria_id,
      conta_id: r.conta_id,
      cartao_id: r.cartao_id,
      pessoa_id: r.pessoa_id,
      veiculo_id: r.veiculo_id,
      natureza: r.natureza,
      recorrente: 1,
      recorrencia_id: r.id,
      pago: 1,
      observacoes: r.observacoes,
    });
    criadas += 1;
    avancos.set(r.id, proximaData(oc.data, r.frequencia, r.dia_referencia));
  }

  for (const [recorrenciaId, novaData] of avancos) {
    await atualizar("recorrencias", recorrenciaId, {
      proxima_ocorrencia: novaData,
      ultima_geracao: new Date().toISOString(),
    });
  }

  if (criadas > 0) {
  }
  return criadas;
}

/** Materializa apenas as recorrências marcadas como automáticas. */
export async function materializarAutomaticas(): Promise<number> {
  const auto = ocorrenciasPendentes().filter((o) => o.recorrencia.lancar_automatico === 1);
  if (auto.length === 0) return 0;
  return materializar(auto);
}

/** Pula uma ocorrência (ex: o mês que o serviço não foi cobrado) sem lançá-la. */
export async function pularProxima(recorrenciaId: string): Promise<void> {
  const r = buscarRecorrencia(recorrenciaId);
  if (!r) return;
  await atualizar("recorrencias", recorrenciaId, {
    proxima_ocorrencia: proximaData(r.proxima_ocorrencia, r.frequencia, r.dia_referencia),
  });
}

/** Total mensal comprometido com recorrências ativas (normalizado pra mês). */
export function totalMensalRecorrente(): { receitas: number; despesas: number } {
  let receitas = 0;
  let despesas = 0;
  for (const r of listarRecorrencias()) {
    const porMes = valorMensalizado(r);
    if (r.tipo === "receita") receitas += porMes;
    else despesas += porMes;
  }
  return { receitas, despesas };
}

/** Converte qualquer frequência para o equivalente mensal, pra poder somar. */
export function valorMensalizado(r: Recorrencia): number {
  switch (r.frequencia) {
    case "diaria": return r.valor * 30;
    case "semanal": return (r.valor * 52) / 12;
    case "quinzenal": return r.valor * 2;
    case "mensal": return r.valor;
    case "bimestral": return r.valor / 2;
    case "trimestral": return r.valor / 3;
    case "semestral": return r.valor / 6;
    case "anual": return r.valor / 12;
    default: return r.valor;
  }
}

/** Recorrências vencendo em breve, para a lista de alertas. */
export function recorrenciasVencendo(dias = 7): Array<{ recorrencia: Recorrencia; dias: number }> {
  return listarRecorrencias()
    .map((r) => ({ recorrencia: r, dias: diasRestantes(r.proxima_ocorrencia) ?? 999 }))
    .filter((x) => x.dias <= dias)
    .sort((a, b) => a.dias - b.dias);
}
