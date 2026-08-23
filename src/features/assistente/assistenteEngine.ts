import { queryAll } from "../../database/db";
import { listarPessoas } from "../pessoas/pessoasRepository";
import { listarVeiculos } from "../veiculos/veiculosRepository";
import {
  listarCategorias, listarContas, saldoConta, saldoTotalGeral, totaisPeriodo, despesasPorNatureza,
} from "../financeiro/financeiroRepository";
import { listarDocumentos, documentosProximosVencimento } from "../documentos/documentosRepository";
import { listarTarefas } from "../tarefas/tarefasRepository";
import { proximosEventos } from "../agenda/agendaRepository";
import { calcularPatrimonioLiquido } from "../patrimonio/patrimonioRepository";
import { listarInvestimentos, valorTotalInvestimentos, TIPOS_INVESTIMENTO } from "../investimentos/investimentosRepository";
import { listarAnexos } from "../anexos/anexosRepository";
import { listarContatos, CATEGORIAS_CONTATO } from "../contatos/contatosRepository";
import { formatarData, formatarMoeda, hojeISO } from "../../utils/format";
import { reconhecerIntencao, normalizar } from "./reconhecimento";
import { tentarConversa } from "./conversa";
import { responderConsulta } from "./consultas";
import { temAncoraNoSistema } from "./vocabulario";

export interface AnexoSugerido {
  id: string;
  nome: string;
}

export interface RespostaAssistente {
  texto: string;
  anexos?: AnexoSugerido[];
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Interpreta expressões de período em português — cobre bem mais casos que antes. */
function periodoDoTexto(p: string): { inicio: string; fim: string; label: string } {
  const hoje = new Date();

  if (/\bhoje\b/.test(p)) {
    return { inicio: hojeISO(), fim: hojeISO(), label: "hoje" };
  }
  if (/\bontem\b/.test(p)) {
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    return { inicio: iso(ontem), fim: iso(ontem), label: "ontem" };
  }
  if (/semana passada/.test(p)) {
    const fimSemanaPassada = new Date(hoje);
    fimSemanaPassada.setDate(hoje.getDate() - hoje.getDay() - 1);
    const inicioSemanaPassada = new Date(fimSemanaPassada);
    inicioSemanaPassada.setDate(fimSemanaPassada.getDate() - 6);
    return { inicio: iso(inicioSemanaPassada), fim: iso(fimSemanaPassada), label: "na semana passada" };
  }
  if (/esta semana|essa semana/.test(p)) {
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    return { inicio: iso(inicioSemana), fim: hojeISO(), label: "esta semana" };
  }
  if (/m[eê]s passado/.test(p)) {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    return { inicio: iso(inicio), fim: iso(fim), label: "no mês passado" };
  }
  const matchMeses = p.match(/[uú]ltimos?\s+(\d+)\s+meses/);
  if (matchMeses) {
    const n = Number(matchMeses[1]);
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - n, 1);
    return { inicio: iso(inicio), fim: hojeISO(), label: `nos últimos ${n} meses` };
  }
  // "em março", "de janeiro", "março de 2025"
  for (let i = 0; i < MESES.length; i++) {
    const regexMes = new RegExp(`\\b${MESES[i]}\\b`);
    if (regexMes.test(p)) {
      const matchAno = p.match(/\b(20\d{2})\b/);
      const ano = matchAno ? Number(matchAno[1]) : hoje.getFullYear();
      const inicio = new Date(ano, i, 1);
      const fim = new Date(ano, i + 1, 0);
      return { inicio: iso(inicio), fim: iso(fim), label: `em ${MESES[i]}${matchAno ? `/${ano}` : ""}` };
    }
  }
  if (/este ano|no ano|neste ano/.test(p)) {
    const inicio = new Date(hoje.getFullYear(), 0, 1);
    return { inicio: iso(inicio), fim: hojeISO(), label: "este ano" };
  }
  if (/ano passado/.test(p)) {
    const inicio = new Date(hoje.getFullYear() - 1, 0, 1);
    const fim = new Date(hoje.getFullYear() - 1, 11, 31);
    return { inicio: iso(inicio), fim: iso(fim), label: "no ano passado" };
  }
  // padrão: mês atual
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return { inicio: iso(inicio), fim: hojeISO(), label: "este mês" };
}

const PALAVRAS_IGNORADAS = new Set([
  "o", "a", "os", "as", "de", "do", "da", "dos", "das", "meu", "minha", "meus", "minhas",
  "documento", "documentos", "envie", "envia", "manda", "mande", "mostre", "mostra",
  "me", "por", "favor", "com", "gastei", "gasto", "gastos", "quanto", "qual", "quais",
]);

function extrairPalavrasChave(p: string): string[] {
  return p
    .replace(/[?!.,]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !PALAVRAS_IGNORADAS.has(w));
}

function buscarDocumentoMencionado(p: string) {
  const documentos = listarDocumentos();
  const palavras = extrairPalavrasChave(p);
  for (const doc of documentos) {
    const nomeLower = doc.nome.toLowerCase();
    if (palavras.some((w) => nomeLower.includes(w) || w.includes(nomeLower))) return doc;
  }
  return null;
}

function buscarVeiculoMencionado(p: string) {
  return listarVeiculos().find((v) => p.includes(v.marca.toLowerCase()) || p.includes(v.modelo.toLowerCase())) ?? null;
}

function buscarPessoaMencionada(p: string) {
  return listarPessoas().find((pessoa) => p.includes(pessoa.nome.toLowerCase())) ?? null;
}

function buscarCategoriaMencionada(p: string) {
  // ordena por nome mais longo primeiro, pra "combustível" não perder pra uma palavra menor por acidente
  return [...listarCategorias()].sort((a, b) => b.nome.length - a.nome.length).find((c) => p.includes(c.nome.toLowerCase())) ?? null;
}

function buscarContaMencionada(p: string) {
  return listarContas().find((c) => p.includes(c.nome.toLowerCase())) ?? null;
}

function buscarContatoMencionado(p: string) {
  const contatos = listarContatos();
  const porNome = contatos.find((c) => p.includes(c.nome.toLowerCase()));
  if (porNome) return porNome;
  for (const cat of CATEGORIAS_CONTATO) {
    if (p.includes(cat.label.toLowerCase()) || p.includes(cat.valor)) {
      const encontrado = contatos.find((c) => c.categoria === cat.valor);
      if (encontrado) return encontrado;
    }
  }
  return null;
}

function gastoFinanceiroVeiculo(veiculoId: string, inicio: string, fim: string): number {
  const rows = queryAll<{ total: number }>(
    "SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE veiculo_id = ? AND tipo = 'despesa' AND data >= ? AND data <= ?",
    [veiculoId, inicio, fim],
  );
  return rows[0]?.total ?? 0;
}

function gastoFinanceiroPessoa(pessoaId: string, inicio: string, fim: string): number {
  const rows = queryAll<{ total: number }>(
    "SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE pessoa_id = ? AND tipo = 'despesa' AND data >= ? AND data <= ?",
    [pessoaId, inicio, fim],
  );
  return rows[0]?.total ?? 0;
}

function gastoFinanceiroCategoria(categoriaId: string, inicio: string, fim: string): number {
  const rows = queryAll<{ total: number }>(
    "SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE categoria_id = ? AND tipo = 'despesa' AND data >= ? AND data <= ?",
    [categoriaId, inicio, fim],
  );
  return rows[0]?.total ?? 0;
}

function receitaTotal(inicio: string, fim: string): number {
  return totaisPeriodo(inicio, fim).receitas;
}

const EXEMPLOS_AJUDA = [
  "Qual meu maior gasto este mês?",
  "Compare meus gastos com o mês passado",
  "Quanto gasto por mês em média com mercado?",
  "Quais minhas maiores categorias de gasto?",
  "Quantos documentos eu tenho?",
  "Quanto gastei com mercado esse mês?",
  "Quanto gastei com o Gol em março?",
  "Quanto foi meu gasto fixo esse mês?",
  "Quanto foi meu gasto variável esse mês?",
  "Quanto investi esse mês?",
  "Quanto recebi este mês?",
  "Qual meu patrimônio líquido?",
  "Qual o saldo da minha conta corrente?",
  "Quais documentos estão vencendo?",
  "Me envie o documento CNH",
  "Quais minhas tarefas pendentes?",
  "O que tenho na agenda essa semana?",
  "Quanto tenho investido?",
  "Qual minha taxa de poupança esse mês?",
];

export function responderPergunta(perguntaOriginal: string): RespostaAssistente {
  const p = perguntaOriginal.toLowerCase().trim();

  // Conversa comum primeiro: cumprimento, cortesia, data, contas simples.
  // Se não for nada disso, segue para a busca nos dados.
  const conversa = tentarConversa(perguntaOriginal);
  if (conversa) return { texto: conversa };

  if (/o que voc[eê] (faz|sabe)|como (voc[eê] )?funciona|ajuda|exemplos?/.test(p)) {
    return {
      texto: `Eu busco respostas nos seus próprios dados cadastrados no Nexo. Alguns exemplos do que perguntar:\n\n${EXEMPLOS_AJUDA.map((e) => `• ${e}`).join("\n")}`,
    };
  }

  // --- 1. Pedido de documento / anexo -------------------------------------
  if (/documento|anexo|contrato|ap[oó]lice|comprovante|nota fiscal|certid[aã]o|carteira|cnh|\brg\b/.test(p) &&
      /(envie|envia|manda|mande|mostre|mostra|abra|abre|cad[eê]|onde est[aá]|preciso d[oa])/.test(p)) {
    const doc = buscarDocumentoMencionado(p);
    if (!doc) {
      return { texto: "Não achei nenhum documento com esse nome. Confira o nome exato na aba Documentos." };
    }
    const anexos = listarAnexos("documento", doc.id);
    if (anexos.length === 0) {
      return { texto: `Encontrei o documento "${doc.nome}", mas não há nenhum arquivo anexado a ele ainda.` };
    }
    return {
      texto: `Encontrei "${doc.nome}". Aqui está${anexos.length > 1 ? "ão os arquivos anexados" : " o arquivo anexado"}:`,
      anexos: anexos.map((a) => ({ id: a.id, nome: a.nome_arquivo })),
    };
  }

  // --- Consultas compostas: entende assunto + operação + período + entidade
  // numa frase só ("quanto a Ana gastou com saúde nos últimos 3 meses").
  const composta = responderConsulta(perguntaOriginal);
  if (composta) return { texto: composta };

  // --- 2. Gasto fixo / variável / investido (metodologia) -----------------
  if (/(gasto|despesa)s?\s+fix/.test(p) || /fixo/.test(p) && /gast|despes/.test(p)) {
    const periodo = periodoDoTexto(p);
    const { fixo } = despesasPorNatureza(periodo.inicio, periodo.fim);
    return { texto: `Seus gastos fixos foram ${formatarMoeda(fixo)} ${periodo.label}.` };
  }
  if (/(gasto|despesa)s?\s+vari[aá]v/.test(p) || (/vari[aá]vel/.test(p) && /gast|despes/.test(p))) {
    const periodo = periodoDoTexto(p);
    const { variavel } = despesasPorNatureza(periodo.inicio, periodo.fim);
    return { texto: `Seus gastos variáveis foram ${formatarMoeda(variavel)} ${periodo.label}.` };
  }
  if (/quanto (investi|guardei|apliquei)/.test(p)) {
    const periodo = periodoDoTexto(p);
    const { investimento } = despesasPorNatureza(periodo.inicio, periodo.fim);
    return { texto: `Você investiu ${formatarMoeda(investimento)} ${periodo.label}.` };
  }
  if (/taxa de poupan[çc]a|quanto sobrou/.test(p)) {
    const periodo = periodoDoTexto(p);
    const { receitas, despesas } = totaisPeriodo(periodo.inicio, periodo.fim);
    const sobra = receitas - despesas;
    const taxa = receitas > 0 ? (sobra / receitas) * 100 : null;
    return {
      texto: taxa != null
        ? `${periodo.label === "este mês" ? "Este mês" : `Considerando ${periodo.label}`}, sobraram ${formatarMoeda(sobra)} (${taxa.toFixed(0)}% da sua receita).`
        : `Não encontrei receita registrada ${periodo.label} pra calcular a taxa de poupança.`,
    };
  }

  // --- 3. Gasto com veículo -------------------------------------------------
  const veiculoMencionado = buscarVeiculoMencionado(p);
  if (veiculoMencionado && /gast|custo|despes/.test(p)) {
    const periodo = periodoDoTexto(p);
    const total = gastoFinanceiroVeiculo(veiculoMencionado.id, periodo.inicio, periodo.fim);
    return { texto: `Você gastou ${formatarMoeda(total)} com o ${veiculoMencionado.marca} ${veiculoMencionado.modelo} ${periodo.label}.` };
  }
  if (/quantos ve[ií]culos|meus ve[ií]culos|liste (os |meus )?ve[ií]culos/.test(p)) {
    const veiculos = listarVeiculos();
    if (veiculos.length === 0) return { texto: "Você ainda não tem nenhum veículo cadastrado." };
    return { texto: `Você tem ${veiculos.length} veículo(s): ${veiculos.map((v) => `${v.marca} ${v.modelo}`).join(", ")}.` };
  }

  // --- 4. Gasto/aniversário de uma pessoa -----------------------------------
  const pessoaMencionada = buscarPessoaMencionada(p);
  if (pessoaMencionada && /anivers[aá]rio|nasc/.test(p)) {
    if (!pessoaMencionada.data_nascimento) {
      return { texto: `Não tenho a data de nascimento de ${pessoaMencionada.nome} cadastrada.` };
    }
    return { texto: `${pessoaMencionada.nome} nasceu em ${formatarData(pessoaMencionada.data_nascimento)}.` };
  }
  if (pessoaMencionada && /gast|custo|despes|sa[uú]de/.test(p)) {
    const periodo = periodoDoTexto(p);
    const total = gastoFinanceiroPessoa(pessoaMencionada.id, periodo.inicio, periodo.fim);
    return { texto: `${pessoaMencionada.nome} teve ${formatarMoeda(total)} em despesas ${periodo.label}.` };
  }

  // --- 5. Receita ------------------------------------------------------------
  if (/quanto (recebi|ganhei)|minha receita/.test(p)) {
    const periodo = periodoDoTexto(p);
    const total = receitaTotal(periodo.inicio, periodo.fim);
    return { texto: `Você recebeu ${formatarMoeda(total)} ${periodo.label}.` };
  }

  // --- 6. Gasto por categoria / geral ----------------------------------------
  if (/gast|quanto/.test(p)) {
    const categoria = buscarCategoriaMencionada(p);
    const periodo = periodoDoTexto(p);
    if (categoria) {
      const total = gastoFinanceiroCategoria(categoria.id, periodo.inicio, periodo.fim);
      return { texto: `Você gastou ${formatarMoeda(total)} com ${categoria.nome} ${periodo.label}.` };
    }
    if (/gastei|gasto|despes/.test(p)) {
      const { despesas } = totaisPeriodo(periodo.inicio, periodo.fim);
      return { texto: `No total, você gastou ${formatarMoeda(despesas)} ${periodo.label}.` };
    }
  }

  // --- 7. Saldo (geral ou de uma conta específica) ---------------------------
  const contaMencionada = buscarContaMencionada(p);
  if (contaMencionada && /saldo/.test(p)) {
    return { texto: `O saldo da conta ${contaMencionada.nome} é ${formatarMoeda(saldoConta(contaMencionada.id))}.` };
  }
  if (/quantas contas|minhas contas|liste (as )?contas/.test(p)) {
    const contas = listarContas();
    if (contas.length === 0) return { texto: "Você ainda não tem nenhuma conta cadastrada." };
    const linhas = contas.map((c) => `${c.nome}: ${formatarMoeda(saldoConta(c.id))}`).join(" · ");
    return { texto: linhas };
  }
  if (/saldo/.test(p)) {
    return { texto: `Seu saldo total em contas é ${formatarMoeda(saldoTotalGeral())}.` };
  }

  // --- 8. Patrimônio líquido --------------------------------------------------
  if (/patrim[oô]nio/.test(p)) {
    const { ativos, passivos, liquido } = calcularPatrimonioLiquido();
    return {
      texto: `Seu patrimônio líquido é ${formatarMoeda(liquido)} (ativos de ${formatarMoeda(ativos)} menos passivos de ${formatarMoeda(passivos)}).`,
    };
  }

  // --- 9. Investimentos / reserva de emergência --------------------------------
  if (/investi|reserva de emerg[eê]ncia|aport|resgat/.test(p)) {
    const investimentos = listarInvestimentos();
    if (investimentos.length === 0) {
      return { texto: "Você ainda não tem nenhum investimento cadastrado." };
    }
    const total = valorTotalInvestimentos();
    const linhas = investimentos
      .map((i) => `${i.nome} (${TIPOS_INVESTIMENTO.find((t) => t.valor === i.tipo)?.label}): ${formatarMoeda(i.valor_atual)}`)
      .join(" · ");
    return { texto: `Você tem ${formatarMoeda(total)} investidos no total. ${linhas}` };
  }

  // --- 10. Documentos vencendo --------------------------------------------------
  if (/vencendo|vencimento|vence\b/.test(p)) {
    const docs = documentosProximosVencimento(90);
    if (docs.length === 0) return { texto: "Nenhum documento vencendo nos próximos 90 dias. Tudo em dia!" };
    const linhas = docs.map((d) => `${d.nome} (${formatarData(d.data_validade)})`).join(", ");
    return { texto: `Documentos vencendo em breve: ${linhas}.` };
  }

  // --- 11. Tarefas pendentes -----------------------------------------------------
  if (/tarefa|preciso fazer|pend[eê]ncia/.test(p)) {
    const pendentes = listarTarefas().filter((t) => t.status !== "concluida");
    if (pendentes.length === 0) return { texto: "Nenhuma tarefa pendente — tudo em dia!" };
    const linhas = pendentes.slice(0, 8).map((t) => t.titulo).join(", ");
    return { texto: `Você tem ${pendentes.length} tarefa(s) pendente(s): ${linhas}.` };
  }

  // --- 12. Agenda / compromissos -------------------------------------------------
  if (/compromisso|agenda|evento/.test(p)) {
    const dias = /hoje/.test(p) ? 1 : /esta semana|essa semana/.test(p) ? 7 : 30;
    const eventos = proximosEventos(dias);
    if (eventos.length === 0) return { texto: `Nenhum compromisso ${dias === 1 ? "hoje" : dias === 7 ? "essa semana" : "nos próximos 30 dias"}.` };
    const linhas = eventos.slice(0, 8).map((e) => `${e.titulo} (${formatarData(e.data_hora)})`).join(", ");
    return { texto: `Próximos compromissos: ${linhas}.` };
  }

  // --- 13. Contatos (médico, mecânico, contador...) ---------------------------
  if (/telefone|contato|quem [eé] meu|quem [eé] minha|e-?mail/.test(p)) {
    const contato = buscarContatoMencionado(p);
    if (contato) {
      const partes = [
        contato.telefone && `telefone ${contato.telefone}`,
        contato.email && `e-mail ${contato.email}`,
      ].filter(Boolean);
      return {
        texto: `${contato.nome}${contato.empresa ? ` (${contato.empresa})` : ""}${contato.especialidade ? ` — ${contato.especialidade}` : ""}: ${partes.join(", ") || "sem telefone/e-mail cadastrado"}.`,
      };
    }
    return { texto: "Não encontrei esse contato. Cadastre em Contatos, ou tente perguntar pelo nome ou pela categoria (médico, mecânico, contador...)." };
  }

  // --- Rede de segurança: se as regras acima não pegaram, tenta entender
  // por aproximação. É o que salva pergunta escrita com pressa, sem acento
  // ou abreviada ("qnt gastei", "cade meu documento").
  const { intencao, confianca } = reconhecerIntencao(perguntaOriginal);
  if (intencao && confianca > 0.35) {
    const periodo = periodoDoTexto(p);
    switch (intencao) {
      case "gasto_total": {
        const { despesas } = totaisPeriodo(periodo.inicio, periodo.fim);
        return { texto: `No total, você gastou ${formatarMoeda(despesas)} ${periodo.label}.` };
      }
      case "gasto_fixo": {
        const { fixo } = despesasPorNatureza(periodo.inicio, periodo.fim);
        return { texto: `Seus gastos fixos foram ${formatarMoeda(fixo)} ${periodo.label}.` };
      }
      case "gasto_variavel": {
        const { variavel } = despesasPorNatureza(periodo.inicio, periodo.fim);
        return { texto: `Seus gastos variáveis foram ${formatarMoeda(variavel)} ${periodo.label}.` };
      }
      case "receita":
        return { texto: `Você recebeu ${formatarMoeda(receitaTotal(periodo.inicio, periodo.fim))} ${periodo.label}.` };
      case "saldo":
      case "saldo_conta":
        return { texto: `Seu saldo total em contas é ${formatarMoeda(saldoTotalGeral())}.` };
      case "patrimonio": {
        const { ativos, passivos, liquido } = calcularPatrimonioLiquido();
        return { texto: `Seu patrimônio líquido é ${formatarMoeda(liquido)} (ativos de ${formatarMoeda(ativos)} menos passivos de ${formatarMoeda(passivos)}).` };
      }
      case "investimento": {
        const total = valorTotalInvestimentos();
        return { texto: total === 0 ? "Você ainda não tem nenhum investimento cadastrado." : `Você tem ${formatarMoeda(total)} investidos no total.` };
      }
      case "poupanca": {
        const { receitas, despesas } = totaisPeriodo(periodo.inicio, periodo.fim);
        const sobra = receitas - despesas;
        return {
          texto: receitas > 0
            ? `Sobraram ${formatarMoeda(sobra)} ${periodo.label} — ${((sobra / receitas) * 100).toFixed(0)}% da sua receita.`
            : `Não encontrei receita registrada ${periodo.label} pra calcular isso.`,
        };
      }
      case "documentos_vencendo": {
        const docs = documentosProximosVencimento(90);
        if (docs.length === 0) return { texto: "Nenhum documento vencendo nos próximos 90 dias." };
        return { texto: `Documentos vencendo em breve: ${docs.map((d) => `${d.nome} (${formatarData(d.data_validade)})`).join(", ")}.` };
      }
      case "tarefas": {
        const pendentes = listarTarefas().filter((t) => t.status !== "concluida");
        return { texto: pendentes.length === 0 ? "Nenhuma tarefa pendente." : `Você tem ${pendentes.length} tarefa(s) pendente(s): ${pendentes.slice(0, 8).map((t) => t.titulo).join(", ")}.` };
      }
      case "agenda": {
        const eventos = proximosEventos(30);
        return { texto: eventos.length === 0 ? "Nenhum compromisso nos próximos 30 dias." : `Próximos compromissos: ${eventos.slice(0, 8).map((e) => `${e.titulo} (${formatarData(e.data_hora)})`).join(", ")}.` };
      }
      case "veiculos": {
        const vs = listarVeiculos();
        return { texto: vs.length === 0 ? "Nenhum veículo cadastrado." : `Você tem ${vs.length} veículo(s): ${vs.map((v) => `${v.marca} ${v.modelo}`).join(", ")}.` };
      }
      case "contas": {
        const cs = listarContas();
        return { texto: cs.length === 0 ? "Nenhuma conta cadastrada." : cs.map((c) => `${c.nome}: ${formatarMoeda(saldoConta(c.id))}`).join(" · ") };
      }
      case "contato": {
        const contato = buscarContatoMencionado(normalizar(perguntaOriginal));
        if (contato) {
          const partes = [contato.telefone && `telefone ${contato.telefone}`, contato.email && `e-mail ${contato.email}`].filter(Boolean);
          return { texto: `${contato.nome}: ${partes.join(", ") || "sem telefone/e-mail cadastrado"}.` };
        }
        return { texto: "Não encontrei esse contato. Cadastre em Contatos, ou tente pelo nome ou pela categoria." };
      }
      case "saudacao":
        return { texto: "Oi! Pode perguntar sobre seus gastos, documentos, tarefas ou investimentos." };
      case "agradecimento":
        return { texto: "De nada! Qualquer coisa é só chamar." };
      case "licao":
        return { texto: "Quer aprender sobre finanças? Troque para o **modo Professor** no topo desta tela — lá eu vou por lições curtas, usando os seus próprios números como exemplo." };
      case "ajuda":
      default:
        return { texto: `Posso responder coisas como:\n\n${EXEMPLOS_AJUDA.map((e) => `• ${e}`).join("\n")}` };
    }
  }

  // Se a frase não tem nenhuma âncora no app, o problema não é de escrita —
  // é de assunto. Vale dizer isso em vez de sugerir que reformule.
  if (!temAncoraNoSistema(perguntaOriginal)) {
    return {
      texto:
        "Essa eu não sei responder — eu só enxergo o que está cadastrado aqui no Nexo: gastos, contas, " +
        "investimentos, dívidas, veículos, imóveis, documentos, saúde, tarefas, agenda, contatos e senhas. " +
        "Para assuntos fora disso eu não tenho como ajudar.",
    };
  }

  return {
    texto:
      "Entendi o assunto, mas não a pergunta. Tente de outro jeito — por exemplo: \"quanto gastei com mercado esse mês\", " +
      "\"qual meu maior gasto em março\", \"quanto a Ana gastou com saúde\" ou \"compare meus gastos com o mês passado\". " +
      "Digite \"ajuda\" para ver mais exemplos.",
  };
}
