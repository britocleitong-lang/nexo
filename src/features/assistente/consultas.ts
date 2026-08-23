import { queryAll } from "../../database/db";
import { extrairContexto, periodoAnterior, type Contexto, type Periodo } from "./vocabulario";
import { totaisPeriodo, despesasPorNatureza, saldoTotalGeral, saldoConta, listarContas } from "../financeiro/financeiroRepository";
import { listarVeiculos } from "../veiculos/veiculosRepository";
import { listarImoveis } from "../imoveis/imoveisRepository";
import { listarInvestimentos, valorTotalInvestimentos } from "../investimentos/investimentosRepository";
import { listarDividas, calcularPatrimonioLiquido } from "../patrimonio/patrimonioRepository";
import { listarDocumentos, documentosProximosVencimento } from "../documentos/documentosRepository";
import { listarTarefas } from "../tarefas/tarefasRepository";
import { proximosEventos } from "../agenda/agendaRepository";
import { listarPessoas } from "../pessoas/pessoasRepository";
import { listarContatos } from "../contatos/contatosRepository";
import { listarRegistrosSaude } from "../saude/saudeRepository";
import { formatarData, formatarMoeda } from "../../utils/format";

/**
 * Consultas compostas.
 *
 * Enquanto o motor antigo respondia perguntas fixas, aqui a resposta é
 * MONTADA a partir do contexto: assunto + operação + período + entidade.
 * Isso faz combinações que ninguém precisou prever uma a uma, do tipo
 * "quanto a Ana gastou com saúde nos últimos 3 meses" ou "qual meu maior
 * gasto em março".
 */

function somaDespesas(p: Periodo, filtros: { pessoa?: string; veiculo?: string; categoria?: string; conta?: string; natureza?: string }): number {
  const cond: string[] = ["tipo = 'despesa'", "data >= ?", "data <= ?"];
  const args: unknown[] = [p.inicio, p.fim];
  if (filtros.pessoa) { cond.push("pessoa_id = ?"); args.push(filtros.pessoa); }
  if (filtros.veiculo) { cond.push("veiculo_id = ?"); args.push(filtros.veiculo); }
  if (filtros.categoria) { cond.push("categoria_id = ?"); args.push(filtros.categoria); }
  if (filtros.conta) { cond.push("conta_id = ?"); args.push(filtros.conta); }
  if (filtros.natureza) { cond.push("natureza = ?"); args.push(filtros.natureza); }
  const r = queryAll<{ t: number }>(`SELECT COALESCE(SUM(valor),0) t FROM transacoes WHERE ${cond.join(" AND ")}`, args);
  return r[0]?.t ?? 0;
}

function rankingCategorias(p: Periodo, limite = 5, ascendente = false) {
  return queryAll<{ nome: string; total: number }>(
    `SELECT COALESCE(c.nome,'Sem categoria') nome, SUM(t.valor) total
     FROM transacoes t LEFT JOIN categorias c ON c.id = t.categoria_id
     WHERE t.tipo='despesa' AND t.data >= ? AND t.data <= ?
     GROUP BY nome ORDER BY total ${ascendente ? "ASC" : "DESC"} LIMIT ?`,
    [p.inicio, p.fim, limite],
  );
}

function maiorLancamento(p: Periodo, ascendente = false) {
  return queryAll<{ descricao: string; valor: number; data: string }>(
    `SELECT descricao, valor, data FROM transacoes
     WHERE tipo='despesa' AND data >= ? AND data <= ?
     ORDER BY valor ${ascendente ? "ASC" : "DESC"} LIMIT 1`,
    [p.inicio, p.fim],
  )[0];
}

function mesesNoPeriodo(p: Periodo): number {
  const ini = new Date(p.inicio + "T00:00:00");
  const fim = new Date(p.fim + "T00:00:00");
  const dias = Math.max(1, (fim.getTime() - ini.getTime()) / 86400000 + 1);
  return Math.max(1, dias / 30.4);
}

function descreverFiltro(ctx: Contexto): string {
  const partes: string[] = [];
  if (ctx.categoria) partes.push(`com ${ctx.categoria.nome}`);
  if (ctx.veiculo) partes.push(`com o ${ctx.veiculo.nome}`);
  if (ctx.imovel) partes.push(`com o imóvel ${ctx.imovel.nome}`);
  if (ctx.pessoa) partes.push(`de ${ctx.pessoa.nome}`);
  if (ctx.conta) partes.push(`na conta ${ctx.conta.nome}`);
  if (ctx.natureza) partes.push(`${ctx.natureza === "fixo" ? "fixos" : ctx.natureza === "variavel" ? "variáveis" : "de investimento"}`);
  return partes.length ? " " + partes.join(" ") : "";
}

/** Devolve null quando não souber responder — aí o fluxo antigo assume. */
export function responderConsulta(pergunta: string): string | null {
  const ctx = extrairContexto(pergunta);
  const { periodo: p, operacao, assuntos } = ctx;
  const assunto = assuntos[0];

  const filtros = {
    pessoa: ctx.pessoa?.id, veiculo: ctx.veiculo?.id,
    categoria: ctx.categoria?.id, conta: ctx.conta?.id,
    natureza: ctx.natureza ?? undefined,
  };

  const temFiltroEspecifico = !!(ctx.categoria || ctx.veiculo || ctx.pessoa || ctx.conta || ctx.natureza);
  const pergLower = pergunta.toLowerCase();
  const falaDeGasto = /gast|despes|paguei|custo|comprei|quanto foi/.test(pergLower);

  // Saldo é sobre a conta em si, não sobre gastos naquela conta.
  if (/saldo|quanto tem na|quanto tem no/.test(pergLower)) {
    if (ctx.conta) return `A conta ${ctx.conta.nome} tem ${formatarMoeda(saldoConta(ctx.conta.id))}.`;
    const contas = listarContas();
    if (contas.length === 0) return "Você ainda não tem contas cadastradas.";
    return `Seu saldo total é ${formatarMoeda(saldoTotalGeral())} — ${contas.map((c) => `${c.nome} ${formatarMoeda(saldoConta(c.id))}`).join(" · ")}.`;
  }

  // "me fala sobre o Civic" pede um resumo da entidade, não o gasto dela.
  if (!falaDeGasto && ctx.veiculo) {
    const v = listarVeiculos().find((x) => x.id === ctx.veiculo!.id);
    if (v) {
      const gasto = somaDespesas({ inicio: "1900-01-01", fim: p.fim, label: "" }, { veiculo: v.id });
      const partes = [
        v.ano ? `ano ${v.ano}` : null,
        v.placa ? `placa ${v.placa}` : null,
        v.valor_atual ? `valor de mercado ${formatarMoeda(v.valor_atual)}` : null,
        v.km_atual ? `${v.km_atual.toLocaleString("pt-BR")} km` : null,
        gasto > 0 ? `${formatarMoeda(gasto)} em gastos acumulados` : null,
      ].filter(Boolean);
      return `${v.marca} ${v.modelo}${partes.length ? ` — ${partes.join(", ")}` : " (sem outros dados cadastrados)"}.`;
    }
  }

  if (!falaDeGasto && ctx.imovel) {
    const im = listarImoveis().find((x) => x.id === ctx.imovel!.id);
    if (im) {
      const partes = [
        im.endereco, im.area_m2 ? `${im.area_m2} m²` : null,
        im.valor_atual ? `valor ${formatarMoeda(im.valor_atual)}` : null,
      ].filter(Boolean);
      return `${im.apelido}${partes.length ? ` — ${partes.join(", ")}` : " (sem outros dados cadastrados)"}.`;
    }
  }

  // ---- Contagens -------------------------------------------------------------
  if (operacao === "contagem") {
    switch (assunto) {
      case "veiculo": {
        const v = listarVeiculos();
        return v.length === 0 ? "Você não tem veículos cadastrados." : `Você tem ${v.length} veículo(s): ${v.map((x) => `${x.marca} ${x.modelo}`).join(", ")}.`;
      }
      case "imovel": {
        const i = listarImoveis();
        return i.length === 0 ? "Você não tem imóveis cadastrados." : `Você tem ${i.length} imóvel(is): ${i.map((x) => x.apelido).join(", ")}.`;
      }
      case "documento": {
        const d = listarDocumentos();
        const doPessoa = ctx.pessoa ? d.filter((x) => x.pessoa_id === ctx.pessoa!.id) : d;
        return `${doPessoa.length} documento(s) cadastrado(s)${ctx.pessoa ? ` para ${ctx.pessoa.nome}` : ""}.`;
      }
      case "tarefa": {
        const abertas = listarTarefas().filter((t) => t.status !== "concluida");
        return `Você tem ${abertas.length} tarefa(s) em aberto.`;
      }
      case "pessoa": {
        const ps = listarPessoas();
        return `${ps.length} pessoa(s) cadastrada(s): ${ps.map((x) => x.nome).join(", ")}.`;
      }
      case "contato": {
        const cs = listarContatos();
        return `${cs.length} contato(s) cadastrado(s).`;
      }
      case "investimento": {
        const inv = listarInvestimentos();
        return `${inv.length} investimento(s) cadastrado(s), somando ${formatarMoeda(valorTotalInvestimentos())}.`;
      }
      case "divida": {
        const ds = listarDividas();
        return `${ds.length} dívida(s) cadastrada(s).`;
      }
      case "saude": {
        return `${listarRegistrosSaude().length} registro(s) de saúde cadastrado(s).`;
      }
      case "financeiro": {
        const n = queryAll<{ t: number }>("SELECT COUNT(*) t FROM transacoes WHERE data >= ? AND data <= ?", [p.inicio, p.fim])[0]?.t ?? 0;
        return `${n} lançamento(s) ${p.label}.`;
      }
      default: return null;
    }
  }

  // ---- Maior / menor ---------------------------------------------------------
  if ((operacao === "maior" || operacao === "menor") && (assunto === "financeiro" || assunto === "investimento" || !assunto)) {
    const asc = operacao === "menor";
    if (/categoria|onde|com o que|em que/.test(pergunta.toLowerCase())) {
      const r = rankingCategorias(p, 5, asc);
      if (r.length === 0) return `Não encontrei despesas ${p.label}.`;
      const linhas = r.map((x, i) => `${i + 1}. ${x.nome} — ${formatarMoeda(x.total)}`).join("\n");
      return `Suas ${asc ? "menores" : "maiores"} categorias de gasto ${p.label}:\n\n${linhas}`;
    }
    const m = maiorLancamento(p, asc);
    if (!m) return `Não encontrei lançamentos ${p.label}.`;
    return `Seu ${asc ? "menor" : "maior"} gasto ${p.label} foi "${m.descricao}", de ${formatarMoeda(m.valor)}, em ${formatarData(m.data)}.`;
  }

  // ---- Ranking pedido como lista ----------------------------------------------
  if (operacao === "lista" && assunto === "financeiro") {
    const r = rankingCategorias(p, 8);
    if (r.length === 0) return `Nenhuma despesa registrada ${p.label}.`;
    return `Gastos por categoria ${p.label}:\n\n${r.map((x) => `• ${x.nome} — ${formatarMoeda(x.total)}`).join("\n")}`;
  }

  // ---- Comparação entre períodos ------------------------------------------------
  if (operacao === "comparar" && (assunto === "financeiro" || temFiltroEspecifico)) {
    const anterior = periodoAnterior(p);
    const atual = somaDespesas(p, filtros);
    const antes = somaDespesas(anterior, filtros);
    const alvo = descreverFiltro(ctx);
    if (antes === 0 && atual === 0) return `Não encontrei gastos${alvo} nem ${p.label} nem no período anterior — sem dados para comparar.`;
    if (antes === 0) return `Você gastou ${formatarMoeda(atual)}${alvo} ${p.label}, e nada no período anterior.`;
    const dif = atual - antes;
    const pct = (dif / antes) * 100;
    return `${p.label.charAt(0).toUpperCase() + p.label.slice(1)} você gastou ${formatarMoeda(atual)}${alvo}, contra ${formatarMoeda(antes)} no período anterior — ${dif >= 0 ? "aumento" : "redução"} de ${Math.abs(pct).toFixed(0)}% (${formatarMoeda(Math.abs(dif))}).`;
  }

  // ---- Média -----------------------------------------------------------------
  if (operacao === "media" && (assunto === "financeiro" || temFiltroEspecifico)) {
    const total = somaDespesas(p, filtros);
    const meses = mesesNoPeriodo(p);
    if (total === 0) return `Não encontrei gastos${descreverFiltro(ctx)} ${p.label}.`;
    return `Média de ${formatarMoeda(total / meses)} por mês${descreverFiltro(ctx)}, considerando ${p.label} (total de ${formatarMoeda(total)}).`;
  }

  // ---- Total com filtro específico ---------------------------------------------
  if (temFiltroEspecifico && (assunto === "financeiro" || assunto === "veiculo" || assunto === "saude" || assunto === "imovel" || !assunto)) {
    const total = somaDespesas(p, filtros);
    const alvo = descreverFiltro(ctx);
    if (total === 0) return `Não encontrei gastos${alvo} ${p.label}.`;
    return `Você gastou ${formatarMoeda(total)}${alvo} ${p.label}.`;
  }

  // ---- Totais por assunto --------------------------------------------------------
  switch (assunto) {
    case "financeiro": {
      if (/saldo/.test(pergunta.toLowerCase())) {
        if (ctx.conta) return `A conta ${ctx.conta.nome} tem ${formatarMoeda(saldoConta(ctx.conta.id))}.`;
        const contas = listarContas();
        if (contas.length === 0) return "Você ainda não tem contas cadastradas.";
        return `Seu saldo total é ${formatarMoeda(saldoTotalGeral())}, distribuído em: ${contas.map((c) => `${c.nome} ${formatarMoeda(saldoConta(c.id))}`).join(" · ")}.`;
      }
      if (/recebi|receita|ganhei|entrou|salario/.test(pergunta.toLowerCase())) {
        const { receitas } = totaisPeriodo(p.inicio, p.fim);
        return `Você recebeu ${formatarMoeda(receitas)} ${p.label}.`;
      }
      if (/sobr|poupanca|guardei/.test(pergunta.toLowerCase())) {
        const { receitas, despesas } = totaisPeriodo(p.inicio, p.fim);
        const sobra = receitas - despesas;
        return receitas === 0
          ? `Não encontrei receitas ${p.label} para calcular quanto sobrou.`
          : `${p.label.charAt(0).toUpperCase() + p.label.slice(1)}: entrou ${formatarMoeda(receitas)}, saiu ${formatarMoeda(despesas)}, ${sobra >= 0 ? "sobrou" : "faltou"} ${formatarMoeda(Math.abs(sobra))} (${((sobra / receitas) * 100).toFixed(0)}% da receita).`;
      }
      const nat = despesasPorNatureza(p.inicio, p.fim);
      const { despesas } = totaisPeriodo(p.inicio, p.fim);
      if (despesas === 0) return `Não encontrei despesas ${p.label}.`;
      return `Você gastou ${formatarMoeda(despesas)} ${p.label} — ${formatarMoeda(nat.fixo)} em fixos, ${formatarMoeda(nat.variavel)} em variáveis${nat.investimento > 0 ? ` e ${formatarMoeda(nat.investimento)} em investimento` : ""}.`;
    }

    case "patrimonio": {
      const { ativos, passivos, liquido } = calcularPatrimonioLiquido();
      return `Seu patrimônio líquido é ${formatarMoeda(liquido)} — ${formatarMoeda(ativos)} em ativos menos ${formatarMoeda(passivos)} em dívidas.`;
    }

    case "investimento": {
      const inv = listarInvestimentos();
      if (inv.length === 0) return "Você ainda não tem investimentos cadastrados.";
      if (ctx.investimento) {
        const alvo = inv.find((i) => i.id === ctx.investimento!.id)!;
        const meta = alvo.meta_valor ? ` — ${((alvo.valor_atual / alvo.meta_valor) * 100).toFixed(0)}% da meta de ${formatarMoeda(alvo.meta_valor)}` : "";
        return `${alvo.nome}: ${formatarMoeda(alvo.valor_atual)}${meta}.`;
      }
      return `Você tem ${formatarMoeda(valorTotalInvestimentos())} investidos: ${inv.map((i) => `${i.nome} ${formatarMoeda(i.valor_atual)}`).join(" · ")}.`;
    }

    case "divida": {
      const ds = listarDividas();
      if (ds.length === 0) return "Você não tem dívidas cadastradas.";
      const aberto = ds.reduce((s, d) => s + (d.valor_total - d.valor_pago), 0);
      return `Você tem ${formatarMoeda(aberto)} em dívidas: ${ds.map((d) => `${d.descricao} ${formatarMoeda(d.valor_total - d.valor_pago)}`).join(" · ")}.`;
    }

    case "documento": {
      const vencendo = documentosProximosVencimento(90);
      if (/venc/.test(pergunta.toLowerCase())) {
        return vencendo.length === 0
          ? "Nenhum documento vencendo nos próximos 90 dias."
          : `Vencendo em breve: ${vencendo.map((d) => `${d.nome} (${formatarData(d.data_validade)})`).join(", ")}.`;
      }
      const docs = ctx.pessoa ? listarDocumentos().filter((d) => d.pessoa_id === ctx.pessoa!.id) : listarDocumentos();
      if (docs.length === 0) return `Nenhum documento cadastrado${ctx.pessoa ? ` para ${ctx.pessoa.nome}` : ""}.`;
      return `${docs.length} documento(s)${ctx.pessoa ? ` de ${ctx.pessoa.nome}` : ""}: ${docs.slice(0, 10).map((d) => d.nome).join(", ")}.`;
    }

    case "tarefa": {
      const abertas = listarTarefas().filter((t) => t.status !== "concluida");
      if (abertas.length === 0) return "Nenhuma tarefa pendente.";
      return `Você tem ${abertas.length} tarefa(s) pendente(s): ${abertas.slice(0, 8).map((t) => t.titulo).join(", ")}.`;
    }

    case "agenda": {
      const dias = /hoje/.test(pergunta.toLowerCase()) ? 1 : /semana/.test(pergunta.toLowerCase()) ? 7 : 30;
      const evs = proximosEventos(dias);
      if (evs.length === 0) return `Nenhum compromisso ${dias === 1 ? "hoje" : dias === 7 ? "nesta semana" : "nos próximos 30 dias"}.`;
      return `Compromissos: ${evs.slice(0, 8).map((e) => `${e.titulo} (${formatarData(e.data_hora)})`).join(", ")}.`;
    }

    case "veiculo": {
      const vs = listarVeiculos();
      if (vs.length === 0) return "Você não tem veículos cadastrados.";
      if (ctx.veiculo) {
        const gasto = somaDespesas({ inicio: "1900-01-01", fim: p.fim, label: "" }, { veiculo: ctx.veiculo.id });
        const v = vs.find((x) => x.id === ctx.veiculo!.id)!;
        return `${ctx.veiculo.nome}: valor de mercado ${formatarMoeda(v.valor_atual ?? 0)}, ${formatarMoeda(gasto)} em gastos acumulados${v.km_atual ? `, ${v.km_atual.toLocaleString("pt-BR")} km` : ""}.`;
      }
      return `Seus veículos: ${vs.map((v) => `${v.marca} ${v.modelo}${v.valor_atual ? ` (${formatarMoeda(v.valor_atual)})` : ""}`).join(" · ")}.`;
    }

    case "imovel": {
      const is = listarImoveis();
      if (is.length === 0) return "Você não tem imóveis cadastrados.";
      return `Seus imóveis: ${is.map((i) => `${i.apelido}${i.valor_atual ? ` (${formatarMoeda(i.valor_atual)})` : ""}`).join(" · ")}.`;
    }

    case "saude": {
      const regs = listarRegistrosSaude();
      const doPessoa = ctx.pessoa ? regs.filter((r) => r.pessoa_id === ctx.pessoa!.id) : regs;
      if (doPessoa.length === 0) return `Nenhum registro de saúde${ctx.pessoa ? ` para ${ctx.pessoa.nome}` : ""}.`;
      const ultimo = doPessoa[0];
      return `${doPessoa.length} registro(s) de saúde${ctx.pessoa ? ` de ${ctx.pessoa.nome}` : ""}. O mais recente: ${ultimo.nome} em ${formatarData(ultimo.data)}.`;
    }

    case "pessoa": {
      const ps = listarPessoas();
      if (ctx.pessoa) {
        const alvo = ps.find((x) => x.id === ctx.pessoa!.id)!;
        const partes = [
          alvo.parentesco, alvo.profissao,
          alvo.data_nascimento ? `nascido(a) em ${formatarData(alvo.data_nascimento)}` : null,
          alvo.telefone, alvo.email,
        ].filter(Boolean);
        return `${alvo.nome}${partes.length ? ` — ${partes.join(", ")}` : " (sem outros dados cadastrados)"}.`;
      }
      return `Pessoas cadastradas: ${ps.map((x) => x.nome).join(", ")}.`;
    }

    case "contato": {
      const cs = listarContatos();
      if (cs.length === 0) return "Nenhum contato cadastrado.";
      return `Você tem ${cs.length} contato(s): ${cs.slice(0, 10).map((c) => `${c.nome} (${c.categoria})`).join(", ")}.`;
    }

    default:
      return null;
  }
}
