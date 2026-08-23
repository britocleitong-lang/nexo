import { queryAll } from "../../database/db";
import { hoje, somarMeses, primeiroDiaDoMes, ultimoDiaDoMes, labelMesCurto, chaveMes } from "../../core/datas";
import { ocorrenciasFuturas } from "../../core/recorrencia/recorrenciaRepository";
import { saldoTotalGeral } from "./financeiroRepository";

// =====================================================================
// Projeção de fluxo de caixa
// ---------------------------------------------------------------------
// A análise que já existia olhava só pra trás: evolução dos últimos meses.
// Útil, mas não responde a pergunta que faz alguém abrir o app numa
// terça-feira: "dá pra comprar isso?".
//
// A projeção usa três fontes, em ordem de confiança:
//   1. AGENDADO — parcelas e contas a pagar já cadastradas (certeza alta)
//   2. RECORRENTE — moldes de recorrência ativos (certeza alta)
//   3. MÉDIA — média dos gastos variáveis dos últimos 3 meses (estimativa)
//
// Separar as três é o ponto principal. Um número único de "saldo previsto"
// esconde que metade dele é chute. Aqui a tela mostra a faixa: o piso
// (só o que é certo) e a estimativa (com a média variável incluída).
// =====================================================================

export interface MesProjetado {
  mes: string;
  label: string;
  receitasAgendadas: number;
  receitasRecorrentes: number;
  despesasAgendadas: number;
  despesasRecorrentes: number;
  despesasEstimadas: number;
  /** Resultado do mês contando só o que é certo. */
  resultadoCerto: number;
  /** Resultado do mês incluindo a estimativa de variável. */
  resultadoEstimado: number;
  saldoAcumuladoCerto: number;
  saldoAcumuladoEstimado: number;
}

/** Média mensal de despesas variáveis (não recorrentes, não parceladas). */
export function mediaVariavelMensal(meses = 3): number {
  const inicio = primeiroDiaDoMes(somarMeses(hoje(), -meses));
  const fim = ultimoDiaDoMes(somarMeses(hoje(), -1));
  const rows = queryAll<{ total: number }>(
    `SELECT COALESCE(SUM(valor), 0) as total FROM transacoes
     WHERE tipo = 'despesa' AND pago = 1
       AND recorrencia_id IS NULL AND parcelamento_id IS NULL
       AND COALESCE(natureza, 'variavel') != 'fixo'
       AND data >= ? AND data <= ?`,
    [inicio, fim],
  );
  const total = rows[0]?.total ?? 0;
  return meses > 0 ? total / meses : 0;
}

/** Média mensal de receitas não recorrentes — renda extra, freelas. */
export function mediaReceitaVariavelMensal(meses = 3): number {
  const inicio = primeiroDiaDoMes(somarMeses(hoje(), -meses));
  const fim = ultimoDiaDoMes(somarMeses(hoje(), -1));
  const rows = queryAll<{ total: number }>(
    `SELECT COALESCE(SUM(valor), 0) as total FROM transacoes
     WHERE tipo = 'receita' AND pago = 1 AND recorrencia_id IS NULL
       AND data >= ? AND data <= ?`,
    [inicio, fim],
  );
  return meses > 0 ? (rows[0]?.total ?? 0) / meses : 0;
}

/** Lançamentos já agendados (pago = 0) agrupados por mês e tipo. */
function agendadosPorMes(): Map<string, { receitas: number; despesas: number }> {
  const rows = queryAll<{ mes: string; tipo: string; total: number }>(
    `SELECT substr(COALESCE(data_vencimento, data), 1, 7) as mes, tipo,
            COALESCE(SUM(valor), 0) as total
     FROM transacoes WHERE pago = 0
     GROUP BY mes, tipo`,
  );
  const mapa = new Map<string, { receitas: number; despesas: number }>();
  for (const r of rows) {
    const atual = mapa.get(r.mes) ?? { receitas: 0, despesas: 0 };
    if (r.tipo === "receita") atual.receitas += r.total;
    else atual.despesas += r.total;
    mapa.set(r.mes, atual);
  }
  return mapa;
}

/** Ocorrências de recorrência previstas, agrupadas por mês e tipo. */
function recorrentesPorMes(meses: number): Map<string, { receitas: number; despesas: number }> {
  const mapa = new Map<string, { receitas: number; despesas: number }>();
  for (const oc of ocorrenciasFuturas(meses * 31)) {
    const mes = oc.data.slice(0, 7);
    const atual = mapa.get(mes) ?? { receitas: 0, despesas: 0 };
    if (oc.recorrencia.tipo === "receita") atual.receitas += oc.recorrencia.valor;
    else atual.despesas += oc.recorrencia.valor;
    mapa.set(mes, atual);
  }
  return mapa;
}

export function projetarFluxo(meses = 6, incluirEstimativa = true): MesProjetado[] {
  const agendados = agendadosPorMes();
  const recorrentes = recorrentesPorMes(meses);
  const mediaVariavel = incluirEstimativa ? mediaVariavelMensal() : 0;
  const mediaReceita = incluirEstimativa ? mediaReceitaVariavelMensal() : 0;

  let acumuladoCerto = saldoTotalGeral();
  let acumuladoEstimado = acumuladoCerto;
  const resultado: MesProjetado[] = [];

  for (let i = 0; i < meses; i++) {
    const dataMes = somarMeses(hoje(), i, 1);
    const mes = dataMes.slice(0, 7);
    const ag = agendados.get(mes) ?? { receitas: 0, despesas: 0 };
    const rec = recorrentes.get(mes) ?? { receitas: 0, despesas: 0 };

    // No mês corrente, a média variável já foi parcialmente gasta. Aplicar a
    // média cheia contaria duas vezes o que já saiu. Então o mês atual entra
    // com a fração proporcional aos dias que ainda faltam.
    const fatorMesAtual = i === 0 ? fracaoRestanteDoMes() : 1;
    const despesasEstimadas = mediaVariavel * fatorMesAtual;
    const receitasEstimadas = mediaReceita * fatorMesAtual;

    const resultadoCerto = ag.receitas + rec.receitas - ag.despesas - rec.despesas;
    const resultadoEstimado = resultadoCerto + receitasEstimadas - despesasEstimadas;

    acumuladoCerto += resultadoCerto;
    acumuladoEstimado += resultadoEstimado;

    resultado.push({
      mes,
      label: labelMesCurto(dataMes),
      receitasAgendadas: ag.receitas,
      receitasRecorrentes: rec.receitas,
      despesasAgendadas: ag.despesas,
      despesasRecorrentes: rec.despesas,
      despesasEstimadas,
      resultadoCerto,
      resultadoEstimado,
      saldoAcumuladoCerto: acumuladoCerto,
      saldoAcumuladoEstimado: acumuladoEstimado,
    });
  }

  return resultado;
}

function fracaoRestanteDoMes(): number {
  const hojeIso = hoje();
  const dia = Number(hojeIso.slice(8, 10));
  const total = Number(ultimoDiaDoMes(hojeIso).slice(8, 10));
  return Math.max(0, (total - dia + 1) / total);
}

export interface AlertaProjecao {
  mes: string;
  label: string;
  saldo: number;
  tipo: "negativo" | "aperto";
}

/**
 * O ponto da projeção não é o gráfico, é este aviso: em que mês o saldo
 * fica negativo (ou perigosamente baixo) se nada mudar.
 */
export function detectarApertos(projecao = projetarFluxo()): AlertaProjecao[] {
  const avisos: AlertaProjecao[] = [];
  // "Aperto" = saldo abaixo de meio mês de despesa média. Um número
  // arbitrário, mas ancorado em algo real e explicado na tela.
  const piso = mediaVariavelMensal() / 2;
  for (const m of projecao) {
    if (m.saldoAcumuladoEstimado < 0) {
      avisos.push({ mes: m.mes, label: m.label, saldo: m.saldoAcumuladoEstimado, tipo: "negativo" });
    } else if (piso > 0 && m.saldoAcumuladoEstimado < piso) {
      avisos.push({ mes: m.mes, label: m.label, saldo: m.saldoAcumuladoEstimado, tipo: "aperto" });
    }
  }
  return avisos;
}

/** Quanto sobra por mês, em média, considerando só o que é certo. */
export function folgaMensalCerta(): number {
  const projecao = projetarFluxo(3, false);
  if (projecao.length === 0) return 0;
  return projecao.reduce((s, m) => s + m.resultadoCerto, 0) / projecao.length;
}

/** Comprometimento do mês corrente: agendado + recorrente sobre a receita. */
export function comprometimentoMesAtual(): { comprometido: number; receita: number; percentual: number } {
  const mes = chaveMes();
  const projecao = projetarFluxo(1, false)[0];
  const comprometido = (projecao?.despesasAgendadas ?? 0) + (projecao?.despesasRecorrentes ?? 0);
  const receitaRows = queryAll<{ total: number }>(
    `SELECT COALESCE(SUM(valor), 0) as total FROM transacoes
     WHERE tipo = 'receita' AND pago = 1 AND substr(data, 1, 7) = ?`, [mes],
  );
  const receita = (receitaRows[0]?.total ?? 0) + (projecao?.receitasRecorrentes ?? 0);
  return {
    comprometido,
    receita,
    percentual: receita > 0 ? (comprometido / receita) * 100 : 0,
  };
}
