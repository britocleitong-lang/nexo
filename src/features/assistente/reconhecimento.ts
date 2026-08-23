import Fuse from "fuse.js";

/**
 * Reconhecimento de intenção tolerante a erro de escrita.
 *
 * Antes, o assistente dependia de expressões regulares exatas: "quanto
 * gastei" funcionava, "qnt gastei" ou "quanto gastei" sem acento não. Como
 * ninguém digita com cuidado num campo de conversa, isso derrubava boa
 * parte das perguntas.
 *
 * Agora cada intenção tem várias formas de ser dita (incluindo abreviações
 * e erros comuns), e o Fuse.js faz a comparação aproximada. O texto é
 * normalizado antes: sem acento, minúsculo, sem pontuação.
 */

export type Intencao =
  | "gasto_total" | "gasto_categoria" | "gasto_fixo" | "gasto_variavel"
  | "receita" | "saldo" | "saldo_conta" | "patrimonio" | "investimento"
  | "poupanca" | "documentos_vencendo" | "documento_enviar" | "tarefas"
  | "agenda" | "contato" | "veiculos" | "contas" | "ajuda" | "saudacao"
  | "agradecimento" | "licao";

interface Frase { intencao: Intencao; texto: string }

/** Formas de dizer cada coisa — inclui abreviação e erro comum de digitação. */
const FRASES: Frase[] = [
  ...["quanto gastei", "quanto eu gastei", "qnt gastei", "quanto sai", "total de gastos",
      "quanto de despesa", "minhas despesas", "quanto foi de gasto", "quanto torrei",
      "quanto gastei no total", "gastos do mes"].map((t) => ({ intencao: "gasto_total" as const, texto: t })),

  ...["quanto gastei com", "gasto com", "quanto foi em", "despesa com", "quanto gastei em"]
      .map((t) => ({ intencao: "gasto_categoria" as const, texto: t })),

  ...["gasto fixo", "gastos fixos", "despesa fixa", "quanto de fixo", "custo fixo", "conta fixa"]
      .map((t) => ({ intencao: "gasto_fixo" as const, texto: t })),

  ...["gasto variavel", "gastos variaveis", "despesa variavel", "quanto de variavel"]
      .map((t) => ({ intencao: "gasto_variavel" as const, texto: t })),

  ...["quanto recebi", "quanto ganhei", "minha receita", "quanto entrou", "meu salario",
      "receitas do mes", "quanto eu recebi"].map((t) => ({ intencao: "receita" as const, texto: t })),

  ...["qual meu saldo", "quanto tenho", "quanto eu tenho", "saldo total", "quanto tem na conta",
      "meu saldo", "quanto sobrou na conta", "tenho quanto"].map((t) => ({ intencao: "saldo" as const, texto: t })),

  ...["saldo da conta", "quanto tem no banco", "saldo do banco", "quanto tem na conta corrente"]
      .map((t) => ({ intencao: "saldo_conta" as const, texto: t })),

  ...["meu patrimonio", "patrimonio liquido", "quanto eu valho", "quanto tenho no total",
      "meus bens", "patrimonio total"].map((t) => ({ intencao: "patrimonio" as const, texto: t })),

  ...["quanto tenho investido", "meus investimentos", "quanto investi", "reserva de emergencia",
      "quanto guardei", "quanto apliquei"].map((t) => ({ intencao: "investimento" as const, texto: t })),

  ...["taxa de poupanca", "quanto sobrou", "quanto consegui guardar", "sobrou quanto"]
      .map((t) => ({ intencao: "poupanca" as const, texto: t })),

  ...["documentos vencendo", "o que esta vencendo", "documento vencido", "vence quando",
      "algum documento vencendo", "vencimentos"].map((t) => ({ intencao: "documentos_vencendo" as const, texto: t })),

  ...["me envia o documento", "me manda o documento", "quero ver o documento", "cade meu documento",
      "abre o documento", "manda a cnh", "preciso do documento"].map((t) => ({ intencao: "documento_enviar" as const, texto: t })),

  ...["minhas tarefas", "o que tenho pra fazer", "tarefas pendentes", "o que falta fazer",
      "tarefa aberta", "pendencias"].map((t) => ({ intencao: "tarefas" as const, texto: t })),

  ...["minha agenda", "meus compromissos", "o que tenho hoje", "proximos eventos",
      "compromisso essa semana"].map((t) => ({ intencao: "agenda" as const, texto: t })),

  ...["telefone do", "contato do", "numero do medico", "qual o telefone", "email do",
      "quem e meu medico", "contato mecanico"].map((t) => ({ intencao: "contato" as const, texto: t })),

  ...["meus veiculos", "meus carros", "quantos carros tenho", "lista de veiculos"]
      .map((t) => ({ intencao: "veiculos" as const, texto: t })),

  ...["minhas contas", "quais contas tenho", "lista de contas", "meus bancos"]
      .map((t) => ({ intencao: "contas" as const, texto: t })),

  ...["ajuda", "o que voce faz", "como funciona", "me ajuda", "o que posso perguntar",
      "exemplos", "socorro"].map((t) => ({ intencao: "ajuda" as const, texto: t })),

  ...["oi", "ola", "e ai", "bom dia", "boa tarde", "boa noite", "opa", "fala"]
      .map((t) => ({ intencao: "saudacao" as const, texto: t })),

  ...["obrigado", "obrigada", "valeu", "vlw", "brigado", "tchau", "ate mais"]
      .map((t) => ({ intencao: "agradecimento" as const, texto: t })),

  ...["me ensina", "quero aprender", "licao", "aula", "educacao financeira",
      "me explica financas", "quero estudar"].map((t) => ({ intencao: "licao" as const, texto: t })),
];

/** Tira acento, pontuação e caixa — "Quanto Gastei?" e "quanto gastei" viram o mesmo. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const fuse = new Fuse(FRASES.map((f) => ({ ...f, normalizado: normalizar(f.texto) })), {
  keys: ["normalizado"],
  // 0 = idêntico, 1 = qualquer coisa. 0.45 tolera erro de digitação sem
  // sair casando com frases que não têm nada a ver.
  threshold: 0.45,
  ignoreLocation: true,
  minMatchCharLength: 3,
});

export interface Reconhecimento {
  intencao: Intencao | null;
  confianca: number;
}

export function reconhecerIntencao(pergunta: string): Reconhecimento {
  const texto = normalizar(pergunta);
  if (!texto) return { intencao: null, confianca: 0 };

  const achados = fuse.search(texto, { limit: 1 });
  if (achados.length === 0) return { intencao: null, confianca: 0 };

  const melhor = achados[0];
  const score = melhor.score ?? 1;
  return { intencao: melhor.item.intencao, confianca: 1 - score };
}
