import { listarAlertas, resumoAlertas, type Alerta } from "../../core/alertas/alertasEngine";
import { ocorrenciasPendentes, totalMensalRecorrente } from "../../core/recorrencia/recorrenciaRepository";
import { detectarApertos, comprometimentoMesAtual, mediaVariavelMensal } from "../financeiro/projecaoRepository";
import { listarOrcamentosComGasto, totaisPeriodo } from "../financeiro/financeiroRepository";
import { dosesEmAtraso } from "../saude/vacinasRepository";
import { primeiroDiaDoMes, hoje, chaveMes } from "../../core/datas";

// =====================================================================
// Assistente proativo
// ---------------------------------------------------------------------
// O assistente já respondia bem. O que ele não fazia era FALAR PRIMEIRO —
// e ele é o único módulo que enxerga todas as áreas ao mesmo tempo.
//
// Continua sendo motor de regras, e isso segue dito com todas as letras
// na tela. Nada aqui é inferência estatística: cada observação abaixo tem
// uma condição escrita que dá pra ler e discordar. É exatamente por isso
// que ele pode ser proativo sem virar adivinhação.
//
// Regra de edição que mantém isso útil: no máximo 5 observações, ordenadas
// por peso. Um resumo de 15 itens não é resumo, é outra lista de tarefas.
// =====================================================================

export type PesoObservacao = "critico" | "atencao" | "informativo" | "elogio";

export interface Observacao {
  chave: string;
  texto: string;
  detalhe?: string;
  peso: PesoObservacao;
  destino?: string;
  acaoLabel?: string;
}

const ORDEM: Record<PesoObservacao, number> = { critico: 0, atencao: 1, informativo: 2, elogio: 3 };

function frasear(n: number, singular: string, plural: string): string {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`;
}

// --- Observadores ----------------------------------------------------------

function observarAtrasos(alertas: Alerta[]): Observacao[] {
  const atrasados = alertas.filter((a) => a.severidade === "atrasado");
  if (atrasados.length === 0) return [];
  const primeiro = atrasados[0];
  return [{
    chave: "atrasos",
    texto: atrasados.length === 1
      ? `${primeiro.titulo} está em atraso.`
      : `${frasear(atrasados.length, "item está atrasado", "itens estão atrasados")} — o mais antigo é ${primeiro.titulo}.`,
    detalhe: primeiro.detalhe,
    peso: "critico",
    destino: primeiro.destino,
    acaoLabel: "Ver",
  }];
}

function observarRecorrenciasPendentes(): Observacao[] {
  const pendentes = ocorrenciasPendentes().filter((o) => o.recorrencia.lancar_automatico === 0);
  if (pendentes.length === 0) return [];
  const total = pendentes.reduce((s, o) => s + o.recorrencia.valor, 0);
  return [{
    chave: "recorrencias-pendentes",
    texto: `${frasear(pendentes.length, "lançamento recorrente espera", "lançamentos recorrentes esperam")} confirmação.`,
    detalhe: `Somam R$ ${total.toFixed(2).replace(".", ",")}. Enquanto não confirmar, o saldo mostrado está desatualizado.`,
    peso: "atencao",
    destino: "/financeiro",
    acaoLabel: "Confirmar",
  }];
}

function observarProjecao(): Observacao[] {
  const apertos = detectarApertos();
  if (apertos.length === 0) return [];
  const primeiro = apertos[0];
  if (primeiro.tipo === "negativo") {
    return [{
      chave: "projecao-negativa",
      texto: `Do jeito que está, o saldo fica negativo em ${primeiro.label}.`,
      detalhe: "A projeção usa o que já está agendado mais a média dos seus gastos variáveis. Se algo mudar, o número muda.",
      peso: "critico",
      destino: "/projecao",
      acaoLabel: "Ver projeção",
    }];
  }
  return [{
    chave: "projecao-aperto",
    texto: `${primeiro.label} deve ficar apertado.`,
    detalhe: "O saldo previsto cai abaixo de meio mês de despesa média.",
    peso: "atencao",
    destino: "/projecao",
    acaoLabel: "Ver projeção",
  }];
}

function observarOrcamento(): Observacao[] {
  const estourados = listarOrcamentosComGasto().filter((o) => o.valor_limite > 0 && o.gasto_mes_atual > o.valor_limite);
  if (estourados.length === 0) return [];
  const pior = estourados.sort((a, b) => (b.gasto_mes_atual / b.valor_limite) - (a.gasto_mes_atual / a.valor_limite))[0];
  const pct = Math.round((pior.gasto_mes_atual / pior.valor_limite) * 100);
  return [{
    chave: `orcamento-${chaveMes()}`,
    texto: estourados.length === 1
      ? `${pior.categoria_nome} passou do orçamento (${pct}%).`
      : `${estourados.length} categorias passaram do orçamento este mês. A pior é ${pior.categoria_nome}, em ${pct}%.`,
    peso: "atencao",
    destino: "/financeiro",
    acaoLabel: "Ver gastos",
  }];
}

function observarComprometimento(): Observacao[] {
  const c = comprometimentoMesAtual();
  // 70% é o limite onde o orçamento deixa de ter folga pra imprevisto.
  if (c.receita <= 0 || c.percentual < 70) return [];
  return [{
    chave: `comprometimento-${chaveMes()}`,
    texto: `${Math.round(c.percentual)}% da sua renda deste mês já está comprometida com contas fixas e parcelas.`,
    detalhe: "Sobra pouco espaço pra imprevisto. Vale olhar o que dá pra encerrar.",
    peso: c.percentual >= 90 ? "critico" : "atencao",
    destino: "/projecao",
    acaoLabel: "Ver detalhes",
  }];
}

function observarVacinas(): Observacao[] {
  const atrasadas = dosesEmAtraso();
  if (atrasadas.length === 0) return [];
  const primeira = atrasadas[0];
  return [{
    chave: "vacinas-atraso",
    texto: atrasadas.length === 1
      ? `Falta uma dose na carteirinha de ${primeira.pessoa.nome}: ${primeira.item.vacina.nome}.`
      : `${atrasadas.length} doses estão em atraso na família — a primeira é ${primeira.item.vacina.nome}, de ${primeira.pessoa.nome}.`,
    detalhe: "Conferência pelo calendário do PNI. Quem decide o esquema é o profissional de saúde.",
    peso: "atencao",
    destino: "/saude",
    acaoLabel: "Ver carteirinha",
  }];
}

function observarSaldoDoMes(): Observacao[] {
  const { receitas, despesas } = totaisPeriodo(primeiroDiaDoMes(), hoje());
  if (receitas <= 0) return [];
  const sobra = receitas - despesas;
  if (sobra <= 0) return [];
  const proporcao = sobra / receitas;
  // Guardar 20% ou mais da renda é o patamar que a literatura de finanças
  // pessoais trata como saudável. Vale reconhecer quando acontece.
  if (proporcao < 0.2) return [];
  return [{
    chave: `sobra-${chaveMes()}`,
    texto: `Este mês você está guardando ${Math.round(proporcao * 100)}% do que entrou.`,
    detalhe: "Bom ritmo. Se ainda não tem destino, a reserva de emergência é o primeiro lugar.",
    peso: "elogio",
    destino: "/investimentos",
    acaoLabel: "Ver investimentos",
  }];
}

function observarGastoAcimaDaMedia(): Observacao[] {
  const media = mediaVariavelMensal();
  if (media <= 0) return [];
  const { despesas } = totaisPeriodo(primeiroDiaDoMes(), hoje());
  const diaDoMes = Number(hoje().slice(8, 10));
  // Compara o ritmo, não o total: no dia 10 gastar metade da média mensal
  // já é sinal, mesmo o total ainda estando abaixo dela.
  const ritmoEsperado = (media / 30) * diaDoMes;
  if (despesas < ritmoEsperado * 1.4) return [];
  return [{
    chave: `ritmo-${chaveMes()}`,
    texto: `O gasto deste mês está bem acima do ritmo habitual até o dia ${diaDoMes}.`,
    detalhe: `Já saíram R$ ${despesas.toFixed(2).replace(".", ",")}, contra os R$ ${ritmoEsperado.toFixed(2).replace(".", ",")} que seriam o normal a esta altura.`,
    peso: "atencao",
    destino: "/analise",
    acaoLabel: "Ver análise",
  }];
}

// --- Composição ------------------------------------------------------------

export function gerarObservacoes(limite = 5): Observacao[] {
  const alertas = listarAlertas();
  const todas = [
    ...observarAtrasos(alertas),
    ...observarProjecao(),
    ...observarComprometimento(),
    ...observarRecorrenciasPendentes(),
    ...observarOrcamento(),
    ...observarGastoAcimaDaMedia(),
    ...observarVacinas(),
    ...observarSaldoDoMes(),
  ];
  return todas.sort((a, b) => ORDEM[a.peso] - ORDEM[b.peso]).slice(0, limite);
}

export interface Briefing {
  saudacao: string;
  frasePrincipal: string;
  observacoes: Observacao[];
  totalAlertas: number;
}

export function montarBriefing(): Briefing {
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const observacoes = gerarObservacoes();
  const resumo = resumoAlertas();
  const recorrente = totalMensalRecorrente();

  let frasePrincipal: string;
  if (observacoes.length === 0 && resumo.total === 0) {
    frasePrincipal = "Não achei nada que precise de você agora.";
  } else if (resumo.atrasados > 0) {
    frasePrincipal = `${frasear(resumo.atrasados, "coisa está atrasada", "coisas estão atrasadas")}.`;
  } else if (resumo.urgentes > 0) {
    frasePrincipal = `${frasear(resumo.urgentes, "item vence", "itens vencem")} nos próximos dias.`;
  } else if (recorrente.despesas > 0) {
    frasePrincipal = "Tudo em dia. Vale só conferir o que está previsto pra frente.";
  } else {
    frasePrincipal = "Tudo em dia por aqui.";
  }

  return { saudacao, frasePrincipal, observacoes, totalAlertas: resumo.total };
}

export const TOM_PESO: Record<PesoObservacao, "danger" | "warn" | "muted" | "success"> = {
  critico: "danger",
  atencao: "warn",
  informativo: "muted",
  elogio: "success",
};
