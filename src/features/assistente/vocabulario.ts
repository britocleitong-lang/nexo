import { normalizar } from "./reconhecimento";
import { listarPessoas } from "../pessoas/pessoasRepository";
import { listarVeiculos } from "../veiculos/veiculosRepository";
import { listarImoveis } from "../imoveis/imoveisRepository";
import { listarCategorias, listarContas } from "../financeiro/financeiroRepository";
import { listarInvestimentos } from "../investimentos/investimentosRepository";
import { hojeISO } from "../../utils/format";

/**
 * Vocabulário do sistema.
 *
 * Aqui fica o mapa entre o jeito que as pessoas falam e o que existe no
 * banco. Duas responsabilidades:
 *
 * 1. Dizer se a pergunta é sobre algo que o app conhece (assunto interno)
 *    ou sobre o mundo lá fora — pra ele admitir o limite em vez de chutar.
 * 2. Extrair o CONTEXTO da frase: período, pessoa, veículo, categoria,
 *    conta, e o tipo de operação (total, média, maior, contagem, comparar).
 *
 * O resto do motor usa esse contexto pra montar a resposta.
 */

// --- Assuntos que o app realmente cobre --------------------------------------

export type Assunto =
  | "financeiro" | "investimento" | "divida" | "veiculo" | "imovel"
  | "documento" | "saude" | "educacao" | "tarefa" | "agenda"
  | "contato" | "senha" | "pessoa" | "patrimonio" | "relatorio";

const PALAVRAS_ASSUNTO: Record<Assunto, string[]> = {
  financeiro: ["gasto","gastos","gastei","gastar","despesa","despesas","conta","contas","dinheiro","grana",
    "receita","receitas","salario","salarios","ganho","ganhei","recebi","renda","saldo","extrato","lancamento",
    "lancamentos","pagamento","pagamentos","paguei","fatura","cartao","cartoes","orcamento","custo","custos",
    "entrada","saida","transacao","transacoes","boleto","pix","fixo","variavel","mensal","economia","sobra"],
  investimento: ["investimento","investimentos","investi","investir","aplicacao","aplicacoes","aporte","aportes",
    "aportei","resgate","resgatei","reserva","emergencia","rendimento","rendeu","poupanca","guardado","guardei",
    "tesouro","cdb","renda fixa","renda variavel","fundo","previdencia","carteira"],
  divida: ["divida","dividas","devo","devendo","emprestimo","emprestimos","financiamento","financiamentos",
    "parcela","parcelas","parcelado","juros","rotativo","credito","devedor","quitar","quitei","atrasado"],
  veiculo: ["carro","carros","veiculo","veiculos","moto","motos","automovel","km","quilometragem","combustivel",
    "gasolina","etanol","alcool","diesel","manutencao","revisao","oficina","mecanico","ipva","licenciamento",
    "fipe","pneu","oleo","seguro do carro","placa"],
  imovel: ["imovel","imoveis","casa","apartamento","apto","terreno","aluguel","iptu","condominio","escritura",
    "matricula","reforma","obra","imobiliaria"],
  documento: ["documento","documentos","rg","cpf","cnh","passaporte","certidao","titulo","reservista","carteira",
    "vence","vencendo","vencimento","validade","vencido","papelada","comprovante","anexo","arquivo","digitalizado"],
  saude: ["saude","medico","medica","consulta","consultas","exame","exames","remedio","remedios","medicamento",
    "vacina","vacinacao","dentista","plano de saude","hospital","clinica","laboratorio","colesterol","glicose",
    "pressao","peso","cirurgia","receita medica"],
  educacao: ["educacao","curso","cursos","faculdade","escola","diploma","certificado","formacao","graduacao",
    "pos","mestrado","historico escolar","matricula escolar","mensalidade"],
  // "fazer" sozinho é genérico demais (pegava "me ensina a fazer bolo"),
  // então só entram as formas que realmente indicam pendência.
  tarefa: ["tarefa","tarefas","pendencia","pendencias","pendente","lembrete","lembrar","afazer","afazeres",
    "prazo","concluir","concluido","checklist","subtarefa","preciso fazer","tenho que fazer","o que fazer",
    "tenho pra fazer","falta fazer"],
  agenda: ["agenda","compromisso","compromissos","evento","eventos","reuniao","calendario","marcado","agendado",
    "hoje","amanha","semana","proximo","aniversario"],
  contato: ["contato","contatos","telefone","celular","numero","email","e mail","whatsapp","medico","mecanico",
    "contador","advogado","corretor","profissional","agenda de contatos"],
  senha: ["senha","senhas","login","acesso","cofre","credencial","usuario","password"],
  pessoa: ["pessoa","pessoas","familia","filho","filha","esposa","marido","conjuge","mae","pai","dependente",
    "perfil","meu perfil","idade","aniversario"],
  patrimonio: ["patrimonio","bens","bem","riqueza","liquido","ativo","ativos","passivo","passivos","quanto valho",
    "quanto tenho no total","balanco"],
  relatorio: ["relatorio","relatorios","imposto","imposto de renda","ir","declaracao","grafico","graficos",
    "analise","resumo","exportar","imprimir","pdf"],
};

/** Descobre de quais assuntos do app a frase trata (pode ser mais de um). */
export function assuntosDaFrase(texto: string): Assunto[] {
  const t = ` ${normalizar(texto)} `;
  const achados: Array<{ assunto: Assunto; peso: number }> = [];
  for (const [assunto, palavras] of Object.entries(PALAVRAS_ASSUNTO) as [Assunto, string[]][]) {
    let peso = 0;
    for (const palavra of palavras) {
      if (t.includes(` ${palavra} `) || t.includes(` ${palavra}s `)) peso += palavra.length > 5 ? 2 : 1;
    }
    if (peso > 0) achados.push({ assunto, peso });
  }
  return achados.sort((a, b) => b.peso - a.peso).map((a) => a.assunto);
}

// --- Operação pedida ----------------------------------------------------------

export type Operacao = "total" | "media" | "maior" | "menor" | "contagem" | "lista" | "comparar" | "evolucao";

const PALAVRAS_OPERACAO: Array<[Operacao, RegExp]> = [
  ["media", /\b(media|medio|por mes em media|na media|costumo gastar|geralmente gasto)\b/],
  ["maior", /\b(maior|mais caro|mais alto|top|principal|onde mais|que mais|maiores|piores)\b/],
  ["menor", /\b(menor|mais barato|mais baixo|menores|onde menos|que menos)\b/],
  ["contagem", /\b(quantos|quantas|numero de|quantidade|conta quantos)\b/],
  ["comparar", /\b(compar\w*|versus|vs|em relacao a|contra|diferenca entre|mais que|menos que|melhor que|pior que)\b/],
  ["evolucao", /\b(evolucao|ao longo|historico|tendencia|vem subindo|vem caindo|cresceu|diminuiu|mes a mes)\b/],
  ["lista", /\b(liste|listar|quais|me mostre|mostrar|ver todos|ver todas|relacao de)\b/],
];

export function operacaoDaFrase(texto: string): Operacao {
  const t = normalizar(texto);
  for (const [op, re] of PALAVRAS_OPERACAO) if (re.test(t)) return op;
  return "total";
}

// --- Período -------------------------------------------------------------------

export interface Periodo { inicio: string; fim: string; label: string }

const MESES_NOME = ["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function iso(d: Date) { return d.toISOString().slice(0, 10); }

/** Interpreta expressões de tempo, incluindo formas informais. */
export function periodoDaFrase(texto: string): Periodo {
  const t = normalizar(texto);
  const hoje = new Date();

  if (/\bhoje\b/.test(t)) return { inicio: hojeISO(), fim: hojeISO(), label: "hoje" };
  if (/\bontem\b/.test(t)) {
    const d = new Date(hoje); d.setDate(d.getDate() - 1);
    return { inicio: iso(d), fim: iso(d), label: "ontem" };
  }
  if (/(essa|esta|nessa|nesta) semana/.test(t)) {
    const d = new Date(hoje); d.setDate(hoje.getDate() - hoje.getDay());
    return { inicio: iso(d), fim: hojeISO(), label: "esta semana" };
  }
  if (/semana passada/.test(t)) {
    const fim = new Date(hoje); fim.setDate(hoje.getDate() - hoje.getDay() - 1);
    const ini = new Date(fim); ini.setDate(fim.getDate() - 6);
    return { inicio: iso(ini), fim: iso(fim), label: "na semana passada" };
  }
  if (/m[eê]s passado|mes retrasado/.test(t)) {
    const atras = /retrasado/.test(t) ? 2 : 1;
    const ini = new Date(hoje.getFullYear(), hoje.getMonth() - atras, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() - atras + 1, 0);
    return { inicio: iso(ini), fim: iso(fim), label: atras === 2 ? "no mês retrasado" : "no mês passado" };
  }
  const nMeses = t.match(/ultimos?\s+(\d+)\s+(meses|mes)/);
  if (nMeses) {
    const n = Number(nMeses[1]);
    const ini = new Date(hoje.getFullYear(), hoje.getMonth() - (n - 1), 1);
    return { inicio: iso(ini), fim: hojeISO(), label: `nos últimos ${n} meses` };
  }
  const nDias = t.match(/ultimos?\s+(\d+)\s+dias/);
  if (nDias) {
    const d = new Date(hoje); d.setDate(hoje.getDate() - Number(nDias[1]));
    return { inicio: iso(d), fim: hojeISO(), label: `nos últimos ${nDias[1]} dias` };
  }
  for (let i = 0; i < MESES_NOME.length; i++) {
    if (new RegExp(`\\b${MESES_NOME[i]}\\b`).test(t)) {
      const ano = t.match(/\b(20\d{2})\b/);
      const a = ano ? Number(ano[1]) : hoje.getFullYear();
      return { inicio: iso(new Date(a, i, 1)), fim: iso(new Date(a, i + 1, 0)), label: `em ${MESES_NOME[i]}${ano ? `/${a}` : ""}` };
    }
  }
  if (/ano passado/.test(t)) {
    const a = hoje.getFullYear() - 1;
    return { inicio: `${a}-01-01`, fim: `${a}-12-31`, label: "no ano passado" };
  }
  if (/(esse|este|neste|nesse) ano|no ano/.test(t)) {
    return { inicio: `${hoje.getFullYear()}-01-01`, fim: hojeISO(), label: "este ano" };
  }
  if (/desde sempre|no total geral|de tudo|historico completo/.test(t)) {
    return { inicio: "1900-01-01", fim: hojeISO(), label: "no total" };
  }
  return { inicio: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fim: hojeISO(), label: "este mês" };
}

/** O período imediatamente anterior ao informado — base das comparações. */
export function periodoAnterior(p: Periodo): Periodo {
  const ini = new Date(p.inicio + "T00:00:00");
  const fim = new Date(p.fim + "T00:00:00");
  const dias = Math.max(1, Math.round((fim.getTime() - ini.getTime()) / 86400000) + 1);
  const novoFim = new Date(ini); novoFim.setDate(ini.getDate() - 1);
  const novoIni = new Date(novoFim); novoIni.setDate(novoFim.getDate() - dias + 1);
  return { inicio: iso(novoIni), fim: iso(novoFim), label: "no período anterior" };
}

// --- Entidades citadas na frase --------------------------------------------------

export interface Contexto {
  assuntos: Assunto[];
  operacao: Operacao;
  periodo: Periodo;
  pessoa: { id: string; nome: string } | null;
  veiculo: { id: string; nome: string } | null;
  imovel: { id: string; nome: string } | null;
  categoria: { id: string; nome: string } | null;
  conta: { id: string; nome: string } | null;
  investimento: { id: string; nome: string } | null;
  natureza: "fixo" | "variavel" | "investimento" | null;
}

/** Casa um nome do banco com o texto, tolerando acento e caixa. */
function acharPorNome<T>(texto: string, itens: T[], nomeDe: (i: T) => string): T | null {
  const t = ` ${normalizar(texto)} `;
  const ordenados = [...itens].sort((a, b) => nomeDe(b).length - nomeDe(a).length);
  for (const item of ordenados) {
    const nome = normalizar(nomeDe(item));
    if (nome.length < 3) continue;
    if (t.includes(` ${nome} `) || t.includes(` ${nome}`)) return item;
    // também tenta pela primeira palavra do nome (ex.: "Honda" para "Honda Civic")
    const primeira = nome.split(" ")[0];
    if (primeira.length >= 4 && t.includes(` ${primeira} `)) return item;
  }
  return null;
}

export function extrairContexto(texto: string): Contexto {
  const t = normalizar(texto);

  const pessoa = acharPorNome(texto, listarPessoas(), (p) => p.nome);
  const veiculo = acharPorNome(texto, listarVeiculos(), (v) => `${v.marca} ${v.modelo}`);
  const imovel = acharPorNome(texto, listarImoveis(), (i) => i.apelido);
  // Se a frase fala de gasto, procura só entre categorias de despesa — sem
  // isso, "gastei com aluguel" casava com a categoria de receita "Aluguel
  // recebido" e o total dava zero.
  const falaDeGasto = /\bgast|despes|paguei|pagamento|comprei|custo/.test(t);
  const falaDeReceita = /\brecebi|receita|ganhei|entrou|salario/.test(t);
  const categoriasBusca = falaDeGasto ? listarCategorias("despesa")
    : falaDeReceita ? listarCategorias("receita")
    : listarCategorias();
  const categoria = acharPorNome(texto, categoriasBusca, (c) => c.nome);
  const conta = acharPorNome(texto, listarContas(), (c) => c.nome);
  const investimento = acharPorNome(texto, listarInvestimentos(), (i) => i.nome);

  let natureza: Contexto["natureza"] = null;
  if (/\bfix[oa]s?\b/.test(t)) natureza = "fixo";
  else if (/\bvariave(l|is)\b/.test(t)) natureza = "variavel";
  else if (/\binvestiment/.test(t)) natureza = "investimento";

  return {
    assuntos: assuntosDaFrase(texto),
    operacao: operacaoDaFrase(texto),
    periodo: periodoDaFrase(texto),
    pessoa: pessoa ? { id: pessoa.id, nome: pessoa.nome } : null,
    veiculo: veiculo ? { id: veiculo.id, nome: `${veiculo.marca} ${veiculo.modelo}` } : null,
    imovel: imovel ? { id: imovel.id, nome: imovel.apelido } : null,
    categoria: categoria ? { id: categoria.id, nome: categoria.nome } : null,
    conta: conta ? { id: conta.id, nome: conta.nome } : null,
    investimento: investimento ? { id: investimento.id, nome: investimento.nome } : null,
    natureza,
  };
}

/**
 * A frase tem alguma âncora no mundo do app? Serve pra separar "quanto
 * gastei" (nosso assunto) de "qual a capital da França" (não é).
 */
export function temAncoraNoSistema(texto: string): boolean {
  const ctx = extrairContexto(texto);
  return (
    ctx.assuntos.length > 0 ||
    !!ctx.pessoa || !!ctx.veiculo || !!ctx.imovel ||
    !!ctx.categoria || !!ctx.conta || !!ctx.investimento
  );
}
