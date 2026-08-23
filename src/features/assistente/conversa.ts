import { normalizar } from "./reconhecimento";
import { obterNomeAssistente } from "../../utils/vozConfig";
import { pessoaPrincipal } from "../pessoas/pessoasRepository";

/**
 * Conversa geral.
 *
 * O assistente é um mecanismo de regras sobre os dados do app — mas isso
 * não precisa significar que ele engasgue num "oi, tudo bem?". Esta camada
 * cuida da conversa comum: cumprimento, cortesia, perguntas sobre ele
 * mesmo, data e hora, e algumas contas simples.
 *
 * Ela roda ANTES da busca nos dados, e só responde quando tem certeza
 * razoável. Qualquer coisa fora disso segue o fluxo normal.
 */

interface Regra {
  testar: RegExp;
  responder: () => string;
}

function primeiroNome(): string {
  const p = pessoaPrincipal();
  return p ? p.nome.split(" ")[0] : "";
}

function saudacaoDoDia(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function comNome(frase: string): string {
  const nome = primeiroNome();
  return nome ? `${frase}, ${nome}` : frase;
}

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const DIAS = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];

/** Contas simples digitadas direto: "quanto é 15% de 3200", "45 + 12". */
function tentarCalculo(texto: string): string | null {
  const pct = texto.match(/(\d+(?:[.,]\d+)?)\s*(?:%|por ?cento)\s*de\s*(\d+(?:[.,]\d+)?)/);
  if (pct) {
    const p = parseFloat(pct[1].replace(",", "."));
    const v = parseFloat(pct[2].replace(",", "."));
    const r = (p / 100) * v;
    return `${p}% de ${v.toLocaleString("pt-BR")} é ${r.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
  }
  const conta = texto.match(/^\s*(\d+(?:[.,]\d+)?)\s*([+\-*x/])\s*(\d+(?:[.,]\d+)?)\s*$/);
  if (conta) {
    const a = parseFloat(conta[1].replace(",", "."));
    const b = parseFloat(conta[3].replace(",", "."));
    const op = conta[2];
    const r = op === "+" ? a + b : op === "-" ? a - b : op === "/" ? (b === 0 ? NaN : a / b) : a * b;
    if (!Number.isFinite(r)) return "Não dá para dividir por zero.";
    return `${r.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}`;
  }
  return null;
}

const REGRAS: Regra[] = [
  // --- Cumprimentos e cortesia ------------------------------------------
  {
    testar: /^(oi+|ola|ol[aá]|e a[ií]|opa|fala|salve|hey|hi)\b/,
    responder: () => `${comNome(saudacaoDoDia())}! Em que posso ajudar?`,
  },
  {
    testar: /^(bom dia|boa tarde|boa noite|boa madrugada)/,
    responder: () => `${comNome(saudacaoDoDia())}! Como posso ajudar?`,
  },
  {
    testar: /(tudo bem|como vai|como voce esta|como esta voce|beleza|de boa|tudo certo|tudo joia)/,
    responder: () => "Tudo certo por aqui! Eu não canso e não esqueço de nada — o que já é bastante coisa. E você, como está?",
  },
  {
    testar: /^(estou bem|to bem|tudo bem sim|to otimo|estou otimo|tudo tranquilo|to de boa)/,
    responder: () => "Que bom saber! Quer dar uma olhada em alguma coisa das suas finanças?",
  },
  {
    testar: /(estou mal|to mal|dia ruim|to cansado|estou cansado|to estressado|dia dificil)/,
    responder: () => "Sinto por isso. Se ajudar, posso resolver alguma pendência rápida agora — às vezes tirar uma coisa da cabeça já alivia um pouco.",
  },
  {
    testar: /(obrigad|valeu|vlw|brigad|agradec|show|otimo|perfeito|legal|massa|boa)/,
    responder: () => "De nada! Estou por aqui.",
  },
  {
    testar: /(tchau|ate mais|ate logo|falou|adeus|boa noite pra voce|xau)/,
    responder: () => comNome("Até mais") + "! Qualquer coisa é só chamar.",
  },
  {
    testar: /(desculp|foi mal|perdao)/,
    responder: () => "Sem problema nenhum. Vamos seguir.",
  },

  // --- Sobre o assistente -------------------------------------------------
  {
    testar: /(qual (e |eh )?(o )?seu nome|como voce se chama|quem e voce|quem es voce|voce tem nome)/,
    responder: () => {
      const nome = obterNomeAssistente();
      return `Me chamo ${nome}. Cuido dos seus dados aqui no app — gastos, documentos, tarefas, investimentos. Você pode trocar meu nome em Configurações.`;
    },
  },
  {
    testar: /(voce e (uma )?(ia|inteligencia artificial|rob[oô]|humano|pessoa)|voce pensa|voce e real)/,
    responder: () =>
      "Sou um programa que lê os seus dados aqui do app e responde com base neles. Não sou um modelo de linguagem conversando — reconheço padrões de pergunta e busco a resposta no seu banco local.",
  },
  {
    testar: /(o que voce (faz|sabe fazer)|voce serve pra que|para que voce serve|suas funcoes)/,
    responder: () =>
      "Consigo responder sobre gastos, receitas, saldo, patrimônio, investimentos, documentos, tarefas, agenda e contatos. Também lanço despesas e receitas por aqui, e no modo Professor dou lições de finanças usando os seus números.",
  },
  {
    testar: /(voce guarda|voce envia|meus dados vao|isso vai pra nuvem|e seguro|privacidade)/,
    responder: () =>
      "Seus dados ficam neste dispositivo, num banco local. Eu não envio nada para servidor. A exceção é o microfone, quando você usa: o reconhecimento de voz é do navegador e costuma processar o áudio pela internet.",
  },
  {
    testar: /(voce aprende|voce vai melhorando|voce lembra de mim)/,
    responder: () =>
      "Eu não aprendo sozinho — respondo com base nas regras que tenho e nos dados que você cadastra. O que muda com o tempo são os seus números, não eu.",
  },

  // --- Data, hora, coisas básicas ------------------------------------------
  {
    testar: /(que horas|hora agora|horario agora)/,
    responder: () => `São ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
  },
  {
    testar: /(que dia (e |eh )?hoje|data de hoje|hoje e que dia|dia da semana)/,
    responder: () => {
      const d = new Date();
      return `Hoje é ${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}.`;
    },
  },
  {
    testar: /(que mes|mes atual|em que mes)/,
    responder: () => `Estamos em ${MESES[new Date().getMonth()]} de ${new Date().getFullYear()}.`,
  },
  {
    testar: /(quanto falta pro? fim do mes|fim do mes|acaba o mes)/,
    responder: () => {
      const hoje = new Date();
      const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
      const faltam = ultimo - hoje.getDate();
      return faltam === 0 ? "Hoje é o último dia do mês." : `Faltam ${faltam} ${faltam === 1 ? "dia" : "dias"} para o fim do mês.`;
    },
  },

  // --- Perguntas que eu não devo responder --------------------------------
  {
    testar: /(onde (eu )?(devo )?investir|qual (o )?melhor investimento|que acao comprar|comprar (bitcoin|cripto|acao|acoes)|vale a pena investir em)/,
    responder: () =>
      "Essa eu não respondo — indicar onde aplicar dinheiro depende do seu perfil de risco, prazo e situação, e eu não tenho como avaliar isso com responsabilidade. No modo Professor eu explico como decidir e o que priorizar; para escolha de produto, um profissional certificado é o caminho.",
  },
  {
    testar: /(vou ficar rico|como ficar rico|ficar milionario|dinheiro facil|renda extra rapida)/,
    responder: () =>
      "Não tenho fórmula para isso, e desconfio de quem tem. O que costuma funcionar é menos empolgante: gastar menos do que ganha, quitar dívida cara e manter constância por anos. O modo Professor cobre esse caminho.",
  },
];

export function tentarConversa(perguntaOriginal: string): string | null {
  const texto = normalizar(perguntaOriginal);
  if (!texto) return null;

  // O cálculo usa o texto cru: a normalização remove "%" e sinais de
  // operação, que são justamente o que a conta precisa enxergar.
  const calculo = tentarCalculo(perguntaOriginal.toLowerCase().trim());
  if (calculo) return calculo;

  for (const regra of REGRAS) {
    if (regra.testar.test(texto)) return regra.responder();
  }
  return null;
}
