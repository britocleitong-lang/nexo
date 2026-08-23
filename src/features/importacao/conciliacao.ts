import { queryAll } from "../../database/db";
import { inserir, atualizar } from "../../database/crud";
import { diferencaDias } from "../../core/datas";
import { registrarAuditoria } from "../../core/auditoria/auditoria";
import { classificar, contabilizarUso, listarRegras } from "../financeiro/regrasRepository";
import type { LancamentoExtrato } from "./extratoParser";
import type { Transacao } from "../../types/entities";

// =====================================================================
// Conciliação
// ---------------------------------------------------------------------
// Importar extrato sem conciliar é a pior das duas opções: duplica tudo
// que já foi lançado à mão. Então cada linha do extrato entra numa de
// quatro classificações, e o usuário decide o que fazer com cada grupo:
//
//   JA_IMPORTADO  — mesmo FITID já está no banco. Ignora, silenciosamente.
//   CONFERE       — achou um lançamento manual equivalente. Vincula (grava
//                   o FITID nele) em vez de criar outro.
//   CONFIRMA      — achou um lançamento PREVISTO (pago=0) equivalente.
//                   Efetiva ele: é a parcela/conta que caiu de verdade.
//   NOVO          — não existe. Cria, já com a categoria sugerida.
//
// A tolerância de data é de 5 dias porque a data que o banco registra e a
// data que a pessoa digita raramente coincidem (compra na sexta, debita na
// segunda). Valor tem que ser exato até o centavo — aí não há margem.
// =====================================================================

export type SituacaoConciliacao = "ja_importado" | "confere" | "confirma" | "novo";

export interface ItemConciliado {
  extrato: LancamentoExtrato;
  situacao: SituacaoConciliacao;
  /** Transação existente que casou, quando houver. */
  correspondente: Transacao | null;
  /** Sugestão de categoria vinda das regras. */
  categoria_id: string | null;
  categoria_nome: string | null;
  natureza: "fixo" | "variavel" | "investimento" | null;
  regra_id: string | null;
  /** Marcado pra importar — o usuário pode desmarcar item a item. */
  selecionado: boolean;
}

const TOLERANCIA_DIAS = 5;

function normalizarTexto(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}

/** Semelhança de descrição por palavras em comum (0 a 1). */
function semelhanca(a: string, b: string): number {
  const pa = new Set(normalizarTexto(a).split(/\s+/).filter((p) => p.length > 2));
  const pb = new Set(normalizarTexto(b).split(/\s+/).filter((p) => p.length > 2));
  if (pa.size === 0 || pb.size === 0) return 0;
  let comuns = 0;
  for (const p of pa) if (pb.has(p)) comuns += 1;
  return comuns / Math.min(pa.size, pb.size);
}

function fitidsExistentes(): Set<string> {
  const rows = queryAll<{ fitid: string }>("SELECT fitid FROM transacoes WHERE fitid IS NOT NULL");
  return new Set(rows.map((r) => r.fitid));
}

/**
 * Candidatos a correspondência: mesmo valor exato, mesmo tipo, data dentro
 * da tolerância. Prioriza os previstos (pago = 0) porque confirmar uma conta
 * agendada é mais útil do que vincular um lançamento já efetivado.
 */
function candidatos(lanc: LancamentoExtrato, contaId: string | null): Transacao[] {
  const valorCentavos = Math.round(lanc.valor * 100);
  const rows = queryAll<Transacao>(
    `SELECT * FROM transacoes
     WHERE tipo = ? AND CAST(ROUND(valor * 100) AS INTEGER) = ? AND fitid IS NULL
     ORDER BY pago ASC, data ASC`,
    [lanc.tipo, valorCentavos],
  );
  return rows.filter((t) => {
    const base = t.data_vencimento ?? t.data;
    if (Math.abs(diferencaDias(base.slice(0, 10), lanc.data)) > TOLERANCIA_DIAS) return false;
    // Se o extrato é de uma conta específica, um lançamento amarrado a OUTRA
    // conta não pode ser o mesmo fato. Lançamento sem conta ainda pode ser.
    if (contaId && t.conta_id && t.conta_id !== contaId) return false;
    return true;
  });
}

export function conciliar(
  lancamentos: LancamentoExtrato[],
  contaId: string | null,
): ItemConciliado[] {
  const jaImportados = fitidsExistentes();
  const regras = listarRegras();
  const categorias = new Map(
    queryAll<{ id: string; nome: string }>("SELECT id, nome FROM categorias").map((c) => [c.id, c.nome]),
  );
  // Um lançamento existente só pode casar com UMA linha do extrato.
  const jaUsados = new Set<string>();
  const resultado: ItemConciliado[] = [];

  for (const lanc of lancamentos) {
    const sugestao = classificar(lanc.descricao, regras);
    const base = {
      extrato: lanc,
      categoria_id: sugestao?.categoria_id ?? null,
      categoria_nome: sugestao?.categoria_id ? categorias.get(sugestao.categoria_id) ?? null : null,
      natureza: sugestao?.natureza ?? null,
      regra_id: sugestao?.regra_id ?? null,
    };

    if (lanc.fitid && jaImportados.has(lanc.fitid)) {
      resultado.push({ ...base, situacao: "ja_importado", correspondente: null, selecionado: false });
      continue;
    }

    const possiveis = candidatos(lanc, contaId).filter((t) => !jaUsados.has(t.id));
    // Sem FITID (CSV), exige semelhança mínima de descrição pra não casar
    // duas compras diferentes de mesmo valor no mesmo dia.
    const casado = possiveis.find((t) =>
      lanc.fitid ? true : semelhanca(t.descricao, lanc.descricao) >= 0.4,
    ) ?? possiveis[0] ?? null;

    if (casado) {
      jaUsados.add(casado.id);
      resultado.push({
        ...base,
        situacao: casado.pago === 0 ? "confirma" : "confere",
        correspondente: casado,
        selecionado: true,
      });
    } else {
      resultado.push({ ...base, situacao: "novo", correspondente: null, selecionado: true });
    }
  }

  return resultado;
}

export interface ResultadoImportacao {
  criados: number;
  confirmados: number;
  vinculados: number;
  ignorados: number;
}

/** Aplica no banco só os itens selecionados. */
export async function aplicarConciliacao(
  itens: ItemConciliado[],
  contaId: string | null,
): Promise<ResultadoImportacao> {
  const agora = new Date().toISOString();
  const res: ResultadoImportacao = { criados: 0, confirmados: 0, vinculados: 0, ignorados: 0 };
  const regrasUsadas: string[] = [];

  for (const item of itens) {
    if (!item.selecionado || item.situacao === "ja_importado") {
      res.ignorados += 1;
      continue;
    }

    if (item.situacao === "confirma" && item.correspondente) {
      // O lançamento previsto virou fato: efetiva, carimba o FITID (pra não
      // reimportar) e ajusta a data pra do extrato — a real.
      await atualizar("transacoes", item.correspondente.id, {
        pago: 1,
        data: item.extrato.data,
        fitid: item.extrato.fitid,
        importado_em: agora,
      });
      res.confirmados += 1;
      continue;
    }

    if (item.situacao === "confere" && item.correspondente) {
      // Já estava lançado à mão e efetivado. Só marca o FITID pra travar a
      // duplicata numa próxima importação. Não sobrescreve nada do usuário.
      await atualizar("transacoes", item.correspondente.id, {
        fitid: item.extrato.fitid,
        importado_em: agora,
      });
      res.vinculados += 1;
      continue;
    }

    await inserir("transacoes", {
      tipo: item.extrato.tipo,
      descricao: item.extrato.descricao,
      valor: item.extrato.valor,
      data: item.extrato.data,
      data_vencimento: item.extrato.data,
      categoria_id: item.categoria_id,
      conta_id: contaId,
      natureza: item.natureza ?? (item.extrato.tipo === "despesa" ? "variavel" : null),
      recorrente: 0,
      pago: 1,
      fitid: item.extrato.fitid,
      importado_em: agora,
      observacoes: item.extrato.memo ?? null,
    });
    if (item.regra_id) regrasUsadas.push(item.regra_id);
    res.criados += 1;
  }

  await contabilizarUso(regrasUsadas);
  await registrarAuditoria({
    tabela: "transacoes", registro_id: "importacao", acao: "criar",
    resumo: `Importação de extrato: ${res.criados} novo(s), ${res.confirmados} confirmado(s), ${res.vinculados} vinculado(s), ${res.ignorados} ignorado(s)`,
  });
  return res;
}

/** Divergências: o que está no app e não apareceu no extrato do período. */
export function divergenciasNoPeriodo(
  contaId: string,
  inicio: string,
  fim: string,
  lancamentos: LancamentoExtrato[],
): Transacao[] {
  const doApp = queryAll<Transacao>(
    `SELECT * FROM transacoes WHERE conta_id = ? AND pago = 1 AND data >= ? AND data <= ?
     ORDER BY data ASC`,
    [contaId, inicio, fim],
  );
  return doApp.filter((t) => {
    if (t.fitid) return false; // já conciliado antes
    const valorCentavos = Math.round(t.valor * 100);
    return !lancamentos.some(
      (l) => Math.round(l.valor * 100) === valorCentavos
        && l.tipo === t.tipo
        && Math.abs(diferencaDias(t.data.slice(0, 10), l.data)) <= TOLERANCIA_DIAS,
    );
  });
}

export const LABEL_SITUACAO: Record<SituacaoConciliacao, string> = {
  ja_importado: "Já importado",
  confere: "Confere com lançamento existente",
  confirma: "Confirma um previsto",
  novo: "Novo lançamento",
};
