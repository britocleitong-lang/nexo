import { queryAll } from "../../database/db";
import type { Bem, Divida, Veiculo, Imovel, Investimento } from "../../types/entities";

// =====================================================================
// Exportação para a declaração de Imposto de Renda
// ---------------------------------------------------------------------
// AVISO QUE A TELA REPETE: isto NÃO gera um arquivo importável pelo
// programa da Receita. O formato .DEC é fechado, não documentado, e um
// arquivo malformado corromperia a declaração inteira. Ninguém deveria
// aceitar esse risco vindo de um app pessoal.
//
// O que isto FAZ é resolver a parte que realmente consome tempo:
// organizar os dados NA ORDEM E COM OS CÓDIGOS das fichas da declaração,
// prontos pra copiar campo a campo. Cada linha traz o código do grupo, o
// código do bem e a discriminação já escrita no formato que a Receita
// espera. O trabalho braçal vira Ctrl+C.
//
// Os códigos abaixo seguem a tabela de Bens e Direitos vigente nas
// últimas declarações. A Receita revisa a tabela; a tela avisa pra
// conferir o código no programa do ano corrente antes de usar.
// =====================================================================

export interface LinhaBensDireitos {
  grupo: string;
  grupoCodigo: string;
  codigo: string;
  descricaoCodigo: string;
  discriminacao: string;
  situacaoAnterior: number;
  situacaoAtual: number;
  origem: string;
}

const GRUPO_IMOVEIS = { codigo: "01", nome: "Bens Imóveis" };
const GRUPO_MOVEIS = { codigo: "02", nome: "Bens Móveis" };
const GRUPO_APLICACOES = { codigo: "04", nome: "Aplicações e Investimentos" };
const GRUPO_DEPOSITOS = { codigo: "06", nome: "Depósito à Vista e Numerário" };

const CODIGO_IMOVEL: Record<string, { codigo: string; nome: string }> = {
  casa: { codigo: "12", nome: "Casa" },
  apartamento: { codigo: "11", nome: "Apartamento" },
  terreno: { codigo: "13", nome: "Terreno" },
  outro: { codigo: "19", nome: "Outros bens imóveis" },
};

const CODIGO_INVESTIMENTO: Record<string, { codigo: string; nome: string; grupo: typeof GRUPO_APLICACOES }> = {
  reserva_emergencia: { codigo: "02", nome: "Títulos públicos e privados sujeitos à tributação", grupo: GRUPO_APLICACOES },
  renda_fixa: { codigo: "02", nome: "Títulos públicos e privados sujeitos à tributação", grupo: GRUPO_APLICACOES },
  renda_variavel: { codigo: "01", nome: "Ações (inclusive as listadas em bolsa)", grupo: GRUPO_APLICACOES },
  fundo: { codigo: "03", nome: "Fundos de investimento", grupo: GRUPO_APLICACOES },
  previdencia: { codigo: "36", nome: "Previdência complementar (VGBL/PGBL)", grupo: GRUPO_APLICACOES },
  outro: { codigo: "99", nome: "Outras aplicações e investimentos", grupo: GRUPO_APLICACOES },
};

function formatarValorIR(valor: number | null | undefined): number {
  return valor ? Math.round(valor * 100) / 100 : 0;
}

/**
 * Discriminação é o campo em texto livre da ficha. O que se escreve nele é
 * o que evita malha fina: identificação inequívoca do bem. Estas montagens
 * seguem o que a Receita pede em cada caso.
 */
function discriminacaoVeiculo(v: Veiculo): string {
  const partes = [`${v.marca} ${v.modelo}`.trim()];
  if (v.ano) partes.push(`ano ${v.ano}`);
  if (v.placa) partes.push(`placa ${v.placa}`);
  if (v.renavam) partes.push(`RENAVAM ${v.renavam}`);
  if (v.data_compra) partes.push(`adquirido em ${v.data_compra.slice(8, 10)}/${v.data_compra.slice(5, 7)}/${v.data_compra.slice(0, 4)}`);
  return partes.join(", ") + ".";
}

function discriminacaoImovel(i: Imovel): string {
  const partes = [`${i.tipo} ${i.apelido}`.trim()];
  if (i.endereco) partes.push(`situado em ${i.endereco}`);
  if (i.area_m2) partes.push(`área de ${i.area_m2} m²`);
  if (i.data_compra) partes.push(`adquirido em ${i.data_compra.slice(8, 10)}/${i.data_compra.slice(5, 7)}/${i.data_compra.slice(0, 4)}`);
  return partes.join(", ") + ".";
}

/**
 * Regra que quase todo mundo erra: bem declarado pelo CUSTO DE AQUISIÇÃO,
 * não pelo valor de mercado. A tabela FIPE que o app busca serve pra saber
 * quanto o carro vale hoje — mas na declaração vai o que foi pago. Por isso
 * a coluna usa valor_compra e só cai pro valor atual quando não há custo
 * registrado (aí a tela avisa que o número precisa ser conferido).
 */
export function montarBensDireitos(ano: number): LinhaBensDireitos[] {
  const linhas: LinhaBensDireitos[] = [];

  for (const i of queryAll<Imovel>("SELECT * FROM imoveis ORDER BY apelido")) {
    const cod = CODIGO_IMOVEL[i.tipo] ?? CODIGO_IMOVEL.outro;
    const custo = formatarValorIR(i.valor_compra ?? i.valor_atual);
    linhas.push({
      grupo: GRUPO_IMOVEIS.nome, grupoCodigo: GRUPO_IMOVEIS.codigo,
      codigo: cod.codigo, descricaoCodigo: cod.nome,
      discriminacao: discriminacaoImovel(i),
      situacaoAnterior: custo, situacaoAtual: custo,
      origem: "Imóveis",
    });
  }

  for (const v of queryAll<Veiculo>("SELECT * FROM veiculos ORDER BY marca, modelo")) {
    const custo = formatarValorIR(v.valor_compra ?? v.valor_atual);
    linhas.push({
      grupo: GRUPO_MOVEIS.nome, grupoCodigo: GRUPO_MOVEIS.codigo,
      codigo: "01", descricaoCodigo: "Veículo automotor terrestre",
      discriminacao: discriminacaoVeiculo(v),
      situacaoAnterior: custo, situacaoAtual: custo,
      origem: "Veículos",
    });
  }

  for (const inv of queryAll<Investimento>("SELECT * FROM investimentos ORDER BY nome")) {
    const cod = CODIGO_INVESTIMENTO[inv.tipo] ?? CODIGO_INVESTIMENTO.outro;
    // Saldo em 31/12 do ano-base é o que a ficha pede.
    const saldoAnterior = saldoInvestimentoEm(inv.id, `${ano - 1}-12-31`);
    const saldoAtual = saldoInvestimentoEm(inv.id, `${ano}-12-31`);
    linhas.push({
      grupo: cod.grupo.nome, grupoCodigo: cod.grupo.codigo,
      codigo: cod.codigo, descricaoCodigo: cod.nome,
      discriminacao: `${inv.nome}${inv.instituicao ? ` — ${inv.instituicao}` : ""}. Saldo em 31/12/${ano}.`,
      situacaoAnterior: formatarValorIR(saldoAnterior),
      situacaoAtual: formatarValorIR(saldoAtual || inv.valor_atual),
      origem: "Investimentos",
    });
  }

  for (const b of queryAll<Bem>("SELECT * FROM bens ORDER BY descricao")) {
    // Bens de Veículos e Imóveis já entraram acima pelas tabelas próprias.
    if (b.categoria === "Veículo" || b.categoria === "Imóvel") continue;
    const custo = formatarValorIR(b.valor_aquisicao ?? b.valor_atual);
    linhas.push({
      grupo: GRUPO_MOVEIS.nome, grupoCodigo: GRUPO_MOVEIS.codigo,
      codigo: "99", descricaoCodigo: "Outros bens móveis",
      discriminacao: `${b.descricao}${b.data_aquisicao ? `, adquirido em ${b.data_aquisicao.slice(8, 10)}/${b.data_aquisicao.slice(5, 7)}/${b.data_aquisicao.slice(0, 4)}` : ""}.`,
      situacaoAnterior: custo, situacaoAtual: custo,
      origem: "Patrimônio",
    });
  }

  const contas = queryAll<{ nome: string; instituicao: string | null; saldo: number }>(
    `SELECT c.nome, c.instituicao,
            c.saldo_inicial + COALESCE((
              SELECT SUM(CASE WHEN t.tipo = 'receita' THEN t.valor ELSE -t.valor END)
              FROM transacoes t WHERE t.conta_id = c.id AND t.pago = 1 AND t.data <= ?
            ), 0) as saldo
     FROM contas c WHERE c.tipo != 'investimento'`, [`${ano}-12-31`],
  );
  for (const c of contas) {
    if (Math.abs(c.saldo) < 0.01) continue;
    linhas.push({
      grupo: GRUPO_DEPOSITOS.nome, grupoCodigo: GRUPO_DEPOSITOS.codigo,
      codigo: "01", descricaoCodigo: "Depósito em conta corrente ou conta pagamento",
      discriminacao: `${c.nome}${c.instituicao ? ` — ${c.instituicao}` : ""}. Saldo em 31/12/${ano}.`,
      situacaoAnterior: 0, situacaoAtual: formatarValorIR(c.saldo),
      origem: "Contas",
    });
  }

  return linhas;
}

function saldoInvestimentoEm(investimentoId: string, data: string): number {
  const rows = queryAll<{ total: number }>(
    `SELECT COALESCE(SUM(CASE WHEN tipo = 'resgate' THEN -valor ELSE valor END), 0) as total
     FROM movimentos_investimento WHERE investimento_id = ? AND data <= ?`,
    [investimentoId, data],
  );
  return rows[0]?.total ?? 0;
}

export interface LinhaDividas {
  codigo: string;
  descricaoCodigo: string;
  discriminacao: string;
  situacaoAnterior: number;
  situacaoAtual: number;
}

const CODIGO_DIVIDA: Record<string, { codigo: string; nome: string }> = {
  financiamento: { codigo: "11", nome: "Estabelecimento bancário comercial" },
  emprestimo: { codigo: "11", nome: "Estabelecimento bancário comercial" },
  cartao: { codigo: "11", nome: "Estabelecimento bancário comercial" },
  outro: { codigo: "16", nome: "Outras dívidas e ônus reais" },
};

export function montarDividasOnus(ano: number): LinhaDividas[] {
  return queryAll<Divida>("SELECT * FROM dividas ORDER BY descricao").map((d) => {
    const cod = CODIGO_DIVIDA[d.tipo] ?? CODIGO_DIVIDA.outro;
    const saldoDevedor = Math.max(0, d.valor_total - d.valor_pago);
    return {
      codigo: cod.codigo, descricaoCodigo: cod.nome,
      discriminacao: `${d.descricao}${d.parcelas_totais ? ` — ${d.parcelas_pagas ?? 0} de ${d.parcelas_totais} parcelas pagas` : ""}. Saldo devedor em 31/12/${ano}.`,
      situacaoAnterior: formatarValorIR(d.valor_total),
      situacaoAtual: formatarValorIR(saldoDevedor),
    };
  });
}

// --- Saída em CSV ----------------------------------------------------------

function escapar(v: unknown): string {
  const t = String(v ?? "");
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function moeda(v: number): string {
  // Vírgula decimal e sem separador de milhar: é assim que o campo da
  // declaração aceita colar sem reformatar.
  return v.toFixed(2).replace(".", ",");
}

export function gerarCsvBensDireitos(ano: number): string {
  const cabecalho = ["Grupo", "Cód. grupo", "Código", "Descrição do código", "Discriminação", `Situação 31/12/${ano - 1}`, `Situação 31/12/${ano}`, "Origem no Nexo"];
  const linhas = montarBensDireitos(ano).map((l) => [
    l.grupo, l.grupoCodigo, l.codigo, l.descricaoCodigo, l.discriminacao,
    moeda(l.situacaoAnterior), moeda(l.situacaoAtual), l.origem,
  ].map(escapar).join(";"));
  return [cabecalho.join(";"), ...linhas].join("\n");
}

export function gerarCsvDividas(ano: number): string {
  const cabecalho = ["Código", "Descrição do código", "Discriminação", `Situação 31/12/${ano - 1}`, `Situação 31/12/${ano}`];
  const linhas = montarDividasOnus(ano).map((l) => [
    l.codigo, l.descricaoCodigo, l.discriminacao, moeda(l.situacaoAnterior), moeda(l.situacaoAtual),
  ].map(escapar).join(";"));
  return [cabecalho.join(";"), ...linhas].join("\n");
}

export function baixarCsvIR(ano: number, tipo: "bens" | "dividas"): void {
  const csv = tipo === "bens" ? gerarCsvBensDireitos(ano) : gerarCsvDividas(ano);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nexo-ir-${ano}-${tipo}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export const AVISO_IR =
  "Isto organiza os dados no formato das fichas da declaração, pra copiar campo a campo. "
  + "Não gera arquivo importável pelo programa da Receita — esse formato é fechado e um "
  + "arquivo malformado corromperia a declaração. Confira os códigos no programa do ano "
  + "corrente: a Receita revisa a tabela. Bens vão pelo custo de aquisição, não pelo valor "
  + "de mercado. Isto não substitui um contador.";
