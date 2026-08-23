import { queryAll } from "../../database/db";
import { diferencaDias, hoje, somarMeses } from "../../core/datas";
import type { Abastecimento, Manutencao, Veiculo } from "../../types/entities";

// =====================================================================
// Análise do veículo — custo real e consumo real
// ---------------------------------------------------------------------
// O app já guardava abastecimentos e km, mas só listava. Aqui esses dados
// viram as três respostas que fazem alguém abrir a tela do carro:
//
//   1. quanto esse carro me custa por km rodado
//   2. o consumo real bate com o que o fabricante prometeu
//   3. o que vai vencer antes: a data ou a quilometragem
//
// Nota metodológica que muda o número: consumo médio só pode ser calculado
// entre dois abastecimentos de TANQUE CHEIO. Num abastecimento parcial não
// se sabe quanto combustível já havia no tanque, então a divisão
// km/litros dá um valor sem significado. O cálculo aqui ignora os
// parciais — e informa quantos foram ignorados, em vez de fingir precisão.
// =====================================================================

export interface ConsumoTrecho {
  dataInicio: string;
  dataFim: string;
  km: number;
  litros: number;
  kmPorLitro: number;
  custoPorKm: number;
}

export interface AnaliseConsumo {
  trechos: ConsumoTrecho[];
  mediaKmPorLitro: number | null;
  melhorKmPorLitro: number | null;
  piorKmPorLitro: number | null;
  precoMedioLitro: number | null;
  custoCombustivelPorKm: number | null;
  abastecimentosParciaisIgnorados: number;
  /** Comparação com o consumo de referência (fábrica), se cadastrado. */
  desvioPercentualDaReferencia: number | null;
}

export function analisarConsumo(veiculoId: string): AnaliseConsumo {
  const todos = queryAll<Abastecimento>(
    "SELECT * FROM abastecimentos WHERE veiculo_id = ? ORDER BY km ASC, data ASC",
    [veiculoId],
  );
  const cheios = todos.filter((a) => a.tanque_cheio === 1);
  const parciais = todos.length - cheios.length;

  const trechos: ConsumoTrecho[] = [];
  for (let i = 1; i < cheios.length; i++) {
    const anterior = cheios[i - 1];
    const atual = cheios[i];
    const km = atual.km - anterior.km;
    // O litro que interessa é o do abastecimento que FECHOU o trecho: é ele
    // que repôs exatamente o que foi consumido desde o tanque cheio anterior.
    const litros = atual.litros;
    if (km <= 0 || litros <= 0) continue;
    // Filtro de sanidade: 1 a 40 km/l. Fora disso é erro de digitação de km
    // (dígito faltando é o erro mais comum) e um único ponto assim desloca
    // a média inteira.
    const kmPorLitro = km / litros;
    if (kmPorLitro < 1 || kmPorLitro > 40) continue;
    trechos.push({
      dataInicio: anterior.data,
      dataFim: atual.data,
      km,
      litros,
      kmPorLitro,
      custoPorKm: atual.valor_total / km,
    });
  }

  const veiculo = queryAll<Veiculo>("SELECT * FROM veiculos WHERE id = ?", [veiculoId])[0];
  const totalLitros = todos.reduce((s, a) => s + a.litros, 0);
  const totalGasto = todos.reduce((s, a) => s + a.valor_total, 0);

  const medias = trechos.map((t) => t.kmPorLitro);
  const mediaKmPorLitro = medias.length > 0
    // Média ponderada por km, não média das médias: um trecho de 600 km deve
    // pesar mais que um de 80 km.
    ? trechos.reduce((s, t) => s + t.km, 0) / trechos.reduce((s, t) => s + t.litros, 0)
    : null;

  const precoMedioLitro = totalLitros > 0 ? totalGasto / totalLitros : null;
  const custoCombustivelPorKm = mediaKmPorLitro && precoMedioLitro
    ? precoMedioLitro / mediaKmPorLitro : null;

  const referencia = veiculo?.consumo_referencia ?? null;
  const desvio = referencia && mediaKmPorLitro
    ? ((mediaKmPorLitro - referencia) / referencia) * 100 : null;

  return {
    trechos,
    mediaKmPorLitro,
    melhorKmPorLitro: medias.length > 0 ? Math.max(...medias) : null,
    piorKmPorLitro: medias.length > 0 ? Math.min(...medias) : null,
    precoMedioLitro,
    custoCombustivelPorKm,
    abastecimentosParciaisIgnorados: parciais,
    desvioPercentualDaReferencia: desvio,
  };
}

// --- Custo por km rodado ---------------------------------------------------

export interface CustoPorKm {
  kmRodados: number;
  diasDePosse: number | null;
  gastoTotal: number;
  gastoCombustivel: number;
  gastoManutencao: number;
  gastoOutros: number;
  /** O número principal: quanto cada km rodado custou de verdade. */
  custoPorKm: number | null;
  custoPorMes: number | null;
  /** Inclui a depreciação (valor de compra − valor atual). */
  custoPorKmComDepreciacao: number | null;
  depreciacao: number | null;
}

export function calcularCustoPorKm(veiculoId: string): CustoPorKm {
  const veiculo = queryAll<Veiculo>("SELECT * FROM veiculos WHERE id = ?", [veiculoId])[0];

  // Km rodados: do primeiro registro conhecido até o atual. Se só existe o
  // km_atual e um km de compra, usa a diferença; senão, o histórico.
  const registros = queryAll<{ minKm: number; maxKm: number }>(
    "SELECT MIN(km) as minKm, MAX(km) as maxKm FROM km_registros WHERE veiculo_id = ?",
    [veiculoId],
  )[0];
  const abast = queryAll<{ minKm: number; maxKm: number }>(
    "SELECT MIN(km) as minKm, MAX(km) as maxKm FROM abastecimentos WHERE veiculo_id = ?",
    [veiculoId],
  )[0];

  const minKm = Math.min(
    registros?.minKm ?? Number.POSITIVE_INFINITY,
    abast?.minKm ?? Number.POSITIVE_INFINITY,
  );
  const maxKm = Math.max(
    registros?.maxKm ?? 0,
    abast?.maxKm ?? 0,
    veiculo?.km_atual ?? 0,
  );
  const kmRodados = Number.isFinite(minKm) && maxKm > minKm ? maxKm - minKm : 0;

  const combustivel = queryAll<{ total: number }>(
    "SELECT COALESCE(SUM(valor_total), 0) as total FROM abastecimentos WHERE veiculo_id = ?",
    [veiculoId],
  )[0]?.total ?? 0;

  const manutencao = queryAll<{ total: number }>(
    "SELECT COALESCE(SUM(valor), 0) as total FROM manutencoes WHERE veiculo_id = ?",
    [veiculoId],
  )[0]?.total ?? 0;

  // Despesas lançadas no Financeiro e amarradas ao veículo (IPVA, seguro,
  // lavagem). Exclui as que vieram de manutenção pra não contar duas vezes:
  // criarManutencao já gera uma transação espelho.
  const outros = queryAll<{ total: number }>(
    `SELECT COALESCE(SUM(valor), 0) as total FROM transacoes
     WHERE veiculo_id = ? AND tipo = 'despesa' AND pago = 1
       AND descricao NOT LIKE 'Manutenção —%'`,
    [veiculoId],
  )[0]?.total ?? 0;

  const gastoTotal = combustivel + manutencao + outros;
  const diasDePosse = veiculo?.data_compra
    ? Math.max(1, diferencaDias(veiculo.data_compra, hoje())) : null;

  const depreciacao = veiculo?.valor_compra && veiculo?.valor_atual
    ? veiculo.valor_compra - veiculo.valor_atual : null;

  return {
    kmRodados,
    diasDePosse,
    gastoTotal,
    gastoCombustivel: combustivel,
    gastoManutencao: manutencao,
    gastoOutros: outros,
    custoPorKm: kmRodados > 0 ? gastoTotal / kmRodados : null,
    custoPorMes: diasDePosse ? (gastoTotal / diasDePosse) * 30 : null,
    custoPorKmComDepreciacao: kmRodados > 0 && depreciacao !== null
      ? (gastoTotal + Math.max(0, depreciacao)) / kmRodados : null,
    depreciacao,
  };
}

// --- Manutenção preventiva: data OU km, o que vier primeiro ------------------

export interface PrevisaoManutencao {
  manutencao: Manutencao;
  /** Dias até a data prevista (null se só tem previsão por km). */
  diasAteData: number | null;
  /** Km faltando até a previsão por km (null se só tem previsão por data). */
  kmFaltando: number | null;
  /** Estimativa de dias até bater o km, usando a média de rodagem. */
  diasEstimadosAteKm: number | null;
  /** O que chega primeiro. */
  gatilho: "data" | "km" | "ambos" | "indefinido";
  vencida: boolean;
}

/** Média de km/dia dos últimos 6 meses — base da estimativa de quando vence o km. */
export function mediaKmPorDiaRecente(veiculoId: string, meses = 6): number | null {
  const desde = somarMeses(hoje(), -meses);
  const registros = queryAll<{ data: string; km: number }>(
    `SELECT data, km FROM (
       SELECT data, km FROM km_registros WHERE veiculo_id = ? AND data >= ?
       UNION ALL
       SELECT data, km FROM abastecimentos WHERE veiculo_id = ? AND data >= ?
     ) ORDER BY data ASC`,
    [veiculoId, desde, veiculoId, desde],
  );
  if (registros.length < 2) return null;
  const primeiro = registros[0];
  const ultimo = registros[registros.length - 1];
  const dias = diferencaDias(primeiro.data.slice(0, 10), ultimo.data.slice(0, 10));
  if (dias <= 0) return null;
  const km = ultimo.km - primeiro.km;
  return km > 0 ? km / dias : null;
}

export function preverManutencoes(veiculoId: string): PrevisaoManutencao[] {
  const veiculo = queryAll<Veiculo>("SELECT * FROM veiculos WHERE id = ?", [veiculoId])[0];
  const kmAtual = veiculo?.km_atual ?? null;
  const kmPorDia = mediaKmPorDiaRecente(veiculoId);

  const manutencoes = queryAll<Manutencao>(
    `SELECT * FROM manutencoes WHERE veiculo_id = ?
       AND (proxima_data IS NOT NULL OR proximo_km IS NOT NULL)
     ORDER BY data DESC`,
    [veiculoId],
  );

  return manutencoes.map((m) => {
    const diasAteData = m.proxima_data ? diferencaDias(hoje(), m.proxima_data) : null;
    const kmFaltando = m.proximo_km !== null && kmAtual !== null ? m.proximo_km - kmAtual : null;
    const diasEstimadosAteKm = kmFaltando !== null && kmPorDia && kmPorDia > 0
      ? Math.round(kmFaltando / kmPorDia) : null;

    let gatilho: PrevisaoManutencao["gatilho"] = "indefinido";
    if (diasAteData !== null && diasEstimadosAteKm !== null) {
      gatilho = Math.abs(diasAteData - diasEstimadosAteKm) <= 10 ? "ambos"
        : diasAteData < diasEstimadosAteKm ? "data" : "km";
    } else if (diasAteData !== null) gatilho = "data";
    else if (kmFaltando !== null) gatilho = "km";

    return {
      manutencao: m,
      diasAteData,
      kmFaltando,
      diasEstimadosAteKm,
      gatilho,
      vencida: (diasAteData !== null && diasAteData < 0) || (kmFaltando !== null && kmFaltando <= 0),
    };
  }).sort((a, b) => {
    const pa = a.vencida ? -1 : Math.min(a.diasAteData ?? 9999, a.diasEstimadosAteKm ?? 9999);
    const pb = b.vencida ? -1 : Math.min(b.diasAteData ?? 9999, b.diasEstimadosAteKm ?? 9999);
    return pa - pb;
  });
}

/** Ranking de custo entre veículos — responde "qual carro está pesando mais". */
export interface ComparativoVeiculo {
  veiculo: Veiculo;
  custo: CustoPorKm;
  consumo: AnaliseConsumo;
}

export function compararVeiculos(): ComparativoVeiculo[] {
  const veiculos = queryAll<Veiculo>("SELECT * FROM veiculos ORDER BY marca, modelo");
  return veiculos.map((v) => ({
    veiculo: v,
    custo: calcularCustoPorKm(v.id),
    consumo: analisarConsumo(v.id),
  }));
}
