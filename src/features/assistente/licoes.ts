import { totaisPeriodo, despesasPorNatureza } from "../financeiro/financeiroRepository";
import { valorTotalInvestimentos, listarInvestimentos } from "../investimentos/investimentosRepository";
import { listarDividas } from "../patrimonio/patrimonioRepository";
import { formatarMoeda, hojeISO } from "../../utils/format";

/**
 * Modo professor — lições curtas de educação financeira.
 *
 * O que diferencia de um texto qualquer da internet: cada lição termina
 * olhando os SEUS números e dizendo onde você está em relação ao conceito.
 * Sem isso, seria só conteúdo genérico.
 *
 * Regra de conteúdo: as lições ensinam a ORGANIZAR dinheiro (como decidir,
 * o que priorizar, como medir). Nenhuma indica produto, corretora ou onde
 * aplicar — isso dependeria do perfil de risco de cada um e não cabe aqui.
 */

import type { ChaveIlustracao } from "./IlustracaoLicao";

export type Trilha = "Fundamentos" | "Dívidas" | "Reserva e proteção" | "Planejamento" | "Comportamento" | "Longo prazo";

export interface Licao {
  id: string;
  titulo: string;
  trilha: Trilha;
  ilustracao: ChaveIlustracao;
  duracao: string;
  conteudo: string[];
  /** Olha os dados reais e devolve uma leitura da situação atual. */
  diagnostico?: () => string | null;
}

const CHAVE_PROGRESSO = "nexo:licoes-concluidas";

export function licoesConcluidas(): string[] {
  try { return JSON.parse(localStorage.getItem(CHAVE_PROGRESSO) ?? "[]"); }
  catch { return []; }
}

export function marcarLicaoConcluida(id: string): void {
  const atuais = new Set(licoesConcluidas());
  atuais.add(id);
  localStorage.setItem(CHAVE_PROGRESSO, JSON.stringify([...atuais]));
}

export function reiniciarProgresso(): void {
  localStorage.removeItem(CHAVE_PROGRESSO);
}

function periodoUltimosMeses(n: number) {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - (n - 1), 1);
  return { inicio: inicio.toISOString().slice(0, 10), fim: hojeISO() };
}

export const LICOES: Licao[] = [
  {
    id: "1-para-onde-vai",
    trilha: "Fundamentos",
    ilustracao: "mapa",
    titulo: "Para onde seu dinheiro está indo",
    duracao: "2 min",
    conteudo: [
      "A primeira coisa em organização financeira não é cortar gasto — é enxergar. A maioria das pessoas erra ao estimar quanto gasta por mês, geralmente para menos.",
      "Por isso o Nexo separa cada despesa em fixa, variável ou investimento. Fixa é o que se repete quase igual todo mês (aluguel, mensalidade, assinatura). Variável muda conforme suas escolhas (mercado, lazer, pedido de comida). Investimento é dinheiro que você guardou, não consumiu.",
      "Essa separação importa porque cada tipo pede uma ação diferente: gasto fixo se resolve renegociando ou cancelando, uma vez. Gasto variável se resolve com hábito, todo dia.",
    ],
    diagnostico() {
      const p = periodoUltimosMeses(3);
      const n = despesasPorNatureza(p.inicio, p.fim);
      const total = n.fixo + n.variavel + n.investimento + n.naoClassificado;
      if (total === 0) return "Você ainda não tem despesas lançadas. Comece registrando os gastos de um mês — sem isso, qualquer conselho aqui é chute.";
      if (n.naoClassificado / total > 0.3) {
        return `Atenção: ${formatarMoeda(n.naoClassificado)} dos seus gastos (${Math.round((n.naoClassificado / total) * 100)}%) estão sem classificação. Classifique-os no Financeiro para as próximas lições fazerem sentido.`;
      }
      const pctFixo = Math.round((n.fixo / total) * 100);
      return `Nos últimos 3 meses: ${formatarMoeda(n.fixo)} em gastos fixos (${pctFixo}%) e ${formatarMoeda(n.variavel)} em variáveis. ${pctFixo > 60 ? "Um peso alto de gasto fixo deixa pouco espaço de manobra quando a renda cai." : "Boa proporção — você tem espaço de manobra se precisar apertar."}`;
    },
  },
  {
    id: "2-taxa-de-poupanca",
    trilha: "Fundamentos",
    ilustracao: "escada",
    titulo: "Taxa de poupança: o número que mais importa",
    duracao: "2 min",
    conteudo: [
      "Ganhar mais não deixa ninguém rico se o gasto sobe junto. O que constrói patrimônio é a diferença entre o que entra e o que sai — a taxa de poupança.",
      "A conta é simples: (receitas − despesas) ÷ receitas. Se você ganha 5.000 e gasta 4.000, sua taxa é 20%.",
      "Não existe número mágico, mas serve de referência: abaixo de 10% o patrimônio cresce muito devagar; acima de 20% já dá para pensar em objetivos de médio prazo. O importante é acompanhar a tendência ao longo dos meses, não o valor de um mês isolado.",
    ],
    diagnostico() {
      const p = periodoUltimosMeses(3);
      const { receitas, despesas } = totaisPeriodo(p.inicio, p.fim);
      if (receitas === 0) return "Ainda não há receitas lançadas nos últimos 3 meses, então não dá para calcular sua taxa.";
      const taxa = ((receitas - despesas) / receitas) * 100;
      if (taxa < 0) return `Nos últimos 3 meses você gastou ${formatarMoeda(despesas - receitas)} a mais do que recebeu. Esse é o ponto a atacar antes de qualquer outro.`;
      return `Sua taxa de poupança nos últimos 3 meses foi de ${taxa.toFixed(0)}%. ${taxa < 10 ? "Vale olhar os gastos fixos primeiro — eles rendem economia recorrente." : taxa < 20 ? "Está num caminho razoável. Subir isso alguns pontos acelera bastante no longo prazo." : "Está acima da faixa que costuma ser sugerida como referência."}`;
    },
  },
  {
    id: "3-reserva-de-emergencia",
    trilha: "Reserva e proteção",
    ilustracao: "escudo",
    titulo: "Reserva de emergência vem antes de investir",
    duracao: "3 min",
    conteudo: [
      "Reserva de emergência é dinheiro parado de propósito, para você não precisar se endividar quando algo quebra, adoece ou some.",
      "A referência mais usada é de 3 a 6 meses do seu custo de vida — mais perto de 6 (ou acima) se sua renda é instável, como autônomo ou comissionado; 3 pode bastar para quem tem emprego estável e outras proteções.",
      "O ponto que mais confunde: a reserva não precisa render muito, precisa estar disponível hoje. Rendimento alto costuma vir junto com prazo de resgate ou risco de perder valor na hora errada — exatamente o que você não pode ter numa emergência.",
      "Ela vem antes de qualquer outro investimento porque é ela que impede a dívida cara, e dívida cara desfaz rendimento muito mais rápido do que qualquer aplicação constrói.",
    ],
    diagnostico() {
      const p = periodoUltimosMeses(3);
      const { despesas } = totaisPeriodo(p.inicio, p.fim);
      const mensal = despesas / 3;
      const reservas = listarInvestimentos().filter((i) => i.tipo === "reserva_emergencia");
      const guardado = reservas.reduce((s, i) => s + i.valor_atual, 0);
      if (mensal === 0) return "Sem despesas registradas, não dá para dimensionar sua reserva. Registre um mês de gastos primeiro.";
      const meses = guardado / mensal;
      const alvo = mensal * 6;
      if (guardado === 0) return `Seu custo de vida médio é ${formatarMoeda(mensal)}/mês. Uma reserva de 6 meses seria ${formatarMoeda(alvo)}. Hoje você não tem nada marcado como reserva de emergência no Nexo.`;
      return `Você tem ${formatarMoeda(guardado)} em reserva — cobre cerca de ${meses.toFixed(1)} ${meses === 1 ? "mês" : "meses"} do seu custo de vida (${formatarMoeda(mensal)}/mês). ${meses >= 6 ? "Já está na faixa de 6 meses." : `Para chegar a 6 meses faltariam ${formatarMoeda(alvo - guardado)}.`}`;
    },
  },
  {
    id: "4-dividas",
    trilha: "Dívidas",
    ilustracao: "corrente",
    titulo: "Nem toda dívida é igual",
    duracao: "2 min",
    conteudo: [
      "O que separa uma dívida cara de uma barata é a taxa de juros, não o valor. Uma dívida de 50 mil num financiamento imobiliário costuma custar muito menos por ano do que 5 mil no rotativo do cartão.",
      "Por isso a ordem de ataque normalmente é: primeiro as de juros mais altos (rotativo do cartão, cheque especial, crédito pessoal), depois as intermediárias, e por último as de juros baixos e prazo longo.",
      "Existe um caso em que vale pagar dívida antes até de investir: quando os juros que você paga são maiores que o rendimento que você conseguiria. Quitar uma dívida de 12% ao ano equivale a um retorno garantido de 12% ao ano.",
      "O Nexo não sabe as taxas que você paga a menos que você as registre — vale preencher o campo de juros em cada dívida no módulo Patrimônio.",
    ],
    diagnostico() {
      const dividas = listarDividas();
      if (dividas.length === 0) return "Você não tem dívidas cadastradas. Se tiver alguma fora do app, vale registrar em Patrimônio → Dívidas para acompanhar.";
      const aberto = dividas.reduce((s, d) => s + (d.valor_total - d.valor_pago), 0);
      const semTaxa = dividas.filter((d) => d.taxa_juros == null).length;
      return `Você tem ${formatarMoeda(aberto)} em dívidas em aberto.${semTaxa > 0 ? ` ${semTaxa} dela(s) está(ão) sem a taxa de juros preenchida — sem isso não dá para saber qual atacar primeiro.` : ""}`;
    },
  },
  {
    id: "5-patrimonio",
    trilha: "Fundamentos",
    ilustracao: "balanca",
    titulo: "Patrimônio líquido: o placar de verdade",
    duracao: "2 min",
    conteudo: [
      "Saldo em conta diz como está o seu mês. Patrimônio líquido diz como está a sua vida financeira. É a conta: tudo que você tem menos tudo que você deve.",
      "Ele é mais honesto que o saldo porque inclui o que costuma ficar escondido: o carro que vale menos a cada ano, o financiamento que ainda falta pagar, o dinheiro parado num investimento que você esqueceu.",
      "O número em si importa menos que a direção. Um patrimônio negativo que sobe todo mês é uma situação melhor que um positivo que cai.",
      "Acompanhe trimestralmente, não diariamente — variação de curto prazo é ruído e só gera ansiedade.",
    ],
    diagnostico() {
      const investido = valorTotalInvestimentos();
      const dividas = listarDividas().reduce((s, d) => s + (d.valor_total - d.valor_pago), 0);
      if (investido === 0 && dividas === 0) return "Cadastre seus bens, investimentos e dívidas em Patrimônio para o Nexo acompanhar essa evolução ao longo do tempo.";
      return `Hoje você tem ${formatarMoeda(investido)} investidos e ${formatarMoeda(dividas)} em dívidas. O gráfico completo, incluindo bens e contas, está no módulo Patrimônio.`;
    },
  },
  {
    id: "6-orcamento",
    trilha: "Planejamento",
    ilustracao: "bussola",
    titulo: "Orçamento que funciona é o que você consegue manter",
    duracao: "2 min",
    conteudo: [
      "Orçamento detalhado demais é abandonado na segunda semana. O erro comum é criar 30 categorias e tentar prever cada centavo.",
      "Uma abordagem que costuma se sustentar: defina limite apenas para as 3 ou 4 categorias onde você realmente perde controle. O resto, apenas acompanhe.",
      "Outro ponto: orçamento não é punição. Se você estourou uma categoria, o dado útil não é a culpa — é descobrir se o limite era irreal ou se foi um mês atípico.",
      "No Nexo você define limites por categoria em Financeiro → Orçamento, e a barra mostra quanto já foi consumido no mês.",
    ],
    diagnostico() {
      const p = periodoUltimosMeses(1);
      const n = despesasPorNatureza(p.inicio, p.fim);
      if (n.variavel === 0) return "Sem gastos variáveis registrados este mês ainda.";
      return `Este mês você já tem ${formatarMoeda(n.variavel)} em gastos variáveis — é aí que um limite costuma fazer mais diferença, porque depende de decisão diária.`;
    },
  },

  // ---------------- Fundamentos ----------------
  {
    id: "7-renda-liquida",
    trilha: "Fundamentos",
    ilustracao: "mapa",
    titulo: "O salário que importa é o líquido",
    duracao: "2 min",
    conteudo: [
      "Muita gente planeja a vida com o salário bruto na cabeça — o número do contrato. Mas o dinheiro que chega na conta é outro: já saíram INSS, imposto de renda na fonte, plano de saúde, vale, adiantamentos.",
      "Planejar pelo bruto é a origem de um erro clássico: parcelar algo com base numa renda que você nunca teve de fato.",
      "Se você é autônomo ou PJ, o cuidado é maior ainda: parte do que entra não é seu. Precisa sair dali o imposto, a contribuição previdenciária e a reserva dos meses fracos. O líquido real costuma ser bem menor que o faturamento.",
      "Regra prática: só considere renda aquilo que sobra depois de tirar tudo que é obrigatório e recorrente.",
    ],
  },
  {
    id: "8-custo-de-vida",
    trilha: "Fundamentos",
    ilustracao: "relogio",
    titulo: "Descobrindo seu custo de vida real",
    duracao: "3 min",
    conteudo: [
      "Custo de vida não é o quanto você gastou no mês passado. É o quanto você precisa gastar num mês normal para manter sua vida funcionando.",
      "A diferença aparece nas despesas que não são mensais: IPVA, IPTU, seguro, material escolar, presente de fim de ano, manutenção do carro. Elas chegam de uma vez e parecem imprevistos — mas não são, você sabia que viriam.",
      "O jeito de resolver é dividir essas despesas anuais por doze e tratar o resultado como custo mensal. Um seguro de 2.400 por ano é 200 por mês, mesmo que você pague de uma vez.",
      "Feito isso, seu custo de vida real quase sempre é maior do que você imaginava — e é esse número que serve de base pra reserva de emergência e pra qualquer meta.",
    ],
    diagnostico() {
      const p = periodoUltimosMeses(6);
      const { despesas } = totaisPeriodo(p.inicio, p.fim);
      if (despesas === 0) return "Sem despesas registradas ainda. Registre alguns meses para o cálculo ficar confiável — quanto mais meses, menos um gasto atípico distorce a média.";
      return `Sua média dos últimos 6 meses é ${formatarMoeda(despesas / 6)}/mês. Seis meses já diluem bem os gastos que não são mensais.`;
    },
  },
  {
    id: "9-inflacao",
    trilha: "Fundamentos",
    ilustracao: "relogio",
    titulo: "Por que dinheiro parado encolhe",
    duracao: "2 min",
    conteudo: [
      "Inflação é a perda de poder de compra ao longo do tempo. Se os preços sobem 5% no ano e seu dinheiro ficou parado na conta corrente, você consegue comprar 5% menos com ele — mesmo o saldo não tendo mudado.",
      "É por isso que “guardar dinheiro embaixo do colchão” é uma perda garantida, não uma escolha segura. O risco existe, ele só é invisível.",
      "Isso também muda como se lê um rendimento. O que importa é o ganho real: o quanto rendeu menos a inflação do período. Um rendimento de 8% num ano de 6% de inflação significa 2% de ganho real.",
      "Para dinheiro que você vai usar em semanas, isso não muda quase nada. Para dinheiro parado por anos, muda tudo.",
    ],
  },

  // ---------------- Dívidas ----------------
  {
    id: "10-juros-compostos",
    trilha: "Dívidas",
    ilustracao: "semente",
    titulo: "Juros compostos jogam nos dois times",
    duracao: "3 min",
    conteudo: [
      "Juro composto é juro sobre juro. Ele faz o dinheiro investido crescer cada vez mais rápido — e faz a dívida não paga crescer exatamente do mesmo jeito.",
      "O detalhe cruel é a velocidade. Uma dívida a 14% ao mês (rotativo do cartão não é incomum nessa faixa) dobra em cerca de cinco meses. Não é que ela cresça um pouco: ela dobra.",
      "É por isso que a mesma pessoa pode estar investindo com disciplina e ainda assim perdendo dinheiro — se ela carrega uma dívida cara ao mesmo tempo, a dívida cresce mais rápido que o investimento.",
      "Consequência prática: quitar uma dívida cara é matematicamente melhor que qualquer investimento de risco parecido. Não tem imposto, não tem incerteza, e o retorno é exatamente a taxa que você deixa de pagar.",
    ],
  },
  {
    id: "11-rotativo",
    trilha: "Dívidas",
    ilustracao: "corrente",
    titulo: "Rotativo e parcelamento do cartão",
    duracao: "2 min",
    conteudo: [
      "Quando você paga menos que o total da fatura, o restante entra no rotativo — historicamente uma das linhas de crédito mais caras do mercado brasileiro.",
      "O banco costuma oferecer, no mês seguinte, trocar isso por um parcelamento com juros menores. Não é generosidade: o parcelamento é caro, só é menos caro que o rotativo. Aceitar costuma ser melhor que ficar, mas ambos são ruins.",
      "O erro mais comum: pagar o mínimo achando que “está em dia”. Você está em dia com o banco e em guerra com o seu futuro — o saldo cresce enquanto isso.",
      "Se a fatura chegou impagável, o caminho normalmente é trocar por uma dívida mais barata (crédito pessoal, consignado se houver, empréstimo com garantia) e cortar o cartão do orçamento até estabilizar.",
    ],
    diagnostico() {
      const cartoes = listarDividas().filter((d) => d.tipo === "cartao");
      if (cartoes.length === 0) return "Você não tem dívida de cartão cadastrada — se houver alguma fora do app, vale registrar em Patrimônio → Dívidas.";
      const total = cartoes.reduce((s, d) => s + (d.valor_total - d.valor_pago), 0);
      return `Você tem ${formatarMoeda(total)} em dívida de cartão registrada. Essa costuma ser a primeira da fila para quitar.`;
    },
  },
  {
    id: "12-bola-de-neve",
    trilha: "Dívidas",
    ilustracao: "escada",
    titulo: "Duas formas de sair das dívidas",
    duracao: "3 min",
    conteudo: [
      "Existem duas estratégias conhecidas para quitar várias dívidas ao mesmo tempo, e elas otimizam coisas diferentes.",
      "A avalanche: você paga o mínimo de todas e joga o dinheiro que sobra na de maior taxa de juros. É a mais barata no total — matematicamente, é a resposta certa.",
      "A bola de neve: você paga o mínimo de todas e ataca a de menor saldo primeiro. Custa um pouco mais no fim, mas você elimina uma dívida logo e sente que está funcionando.",
      "Qual escolher depende do que está te derrubando. Se o problema é dinheiro, use avalanche. Se o problema é desânimo — já tentou antes e desistiu —, a bola de neve tem mais chance de você chegar ao fim. A estratégia que você abandona no meio é a pior das duas.",
    ],
  },
  {
    id: "13-bom-uso-credito",
    trilha: "Dívidas",
    ilustracao: "ponte",
    titulo: "Quando fazer dívida faz sentido",
    duracao: "2 min",
    conteudo: [
      "Nem toda dívida é erro. Financiamento imobiliário, por exemplo, troca um aluguel por uma parcela e constrói patrimônio no caminho — com juros que costumam estar entre os mais baixos disponíveis para pessoa física.",
      "O critério útil é: a dívida está comprando algo que dura mais que o prazo do pagamento? Casa, formação, equipamento de trabalho tendem a passar nesse teste. Viagem, roupa e jantar não — você termina de pagar muito depois do fim da experiência.",
      "O segundo critério é a parcela caber no orçamento com folga, não no limite. Parcela que cabe “justinho” quebra no primeiro imprevisto.",
      "E o terceiro: prefira dívida com taxa fixa e conhecida. Dívida com juros variáveis exige acompanhamento que a maioria das pessoas não faz.",
    ],
  },

  // ---------------- Reserva e proteção ----------------
  {
    id: "14-onde-deixar-reserva",
    trilha: "Reserva e proteção",
    ilustracao: "escudo",
    titulo: "Três coisas que a reserva precisa ter",
    duracao: "2 min",
    conteudo: [
      "A reserva de emergência tem três exigências, nessa ordem: estar disponível hoje, não perder valor, e só então render alguma coisa.",
      "Disponível hoje significa resgate no mesmo dia, sem carência. De nada adianta uma aplicação excelente que leva 30 dias para cair na conta quando o problema é agora.",
      "Não perder valor significa que ela não pode oscilar. Qualquer coisa que sobe e desce serve para outros objetivos, não para esse — porque a emergência não escolhe o dia, e pode chegar justamente quando estiver em baixa.",
      "Só depois disso vem o rendimento. Aceitar um rendimento menor na reserva é o preço da tranquilidade, e é um preço justo. O erro clássico é buscar rendimento aqui e descobrir tarde que o dinheiro não estava acessível.",
    ],
  },
  {
    id: "15-seguros",
    trilha: "Reserva e proteção",
    ilustracao: "guardachuva",
    titulo: "Seguro é para o que você não consegue pagar",
    duracao: "3 min",
    conteudo: [
      "A pergunta certa antes de contratar um seguro não é “qual a chance de acontecer?”, e sim “se acontecer, eu consigo pagar do meu bolso?”.",
      "Perdeu o celular de 2 mil? Dói, mas se resolve. Bateu o carro e precisa indenizar terceiros? Isso pode custar dezenas ou centenas de milhares — está fora do alcance da maioria. É exatamente aí que o seguro faz sentido.",
      "Por isso seguro de garantia estendida em eletrodoméstico costuma ser mau negócio, enquanto seguro de responsabilidade civil no carro costuma ser bom: um cobre o que você aguenta, o outro cobre o que te quebraria.",
      "O mesmo raciocínio vale para seguro de vida: ele importa quando outras pessoas dependem financeiramente de você. Se ninguém depende, a prioridade normalmente é outra.",
    ],
  },
  {
    id: "16-imprevistos",
    trilha: "Reserva e proteção",
    ilustracao: "guardachuva",
    titulo: "O imprevisto que sempre acontece",
    duracao: "2 min",
    conteudo: [
      "Todo mês acontece “algo fora do previsto”. Se isso acontece todo mês, não é imprevisto — é um custo que você ainda não reconheceu.",
      "Uma forma prática de lidar: criar uma linha no orçamento chamada exatamente isso, com um valor fixo mensal. O dinheiro que sobra dela acumula para o mês em que o pneu fura.",
      "Isso muda a experiência psicológica: em vez de “estourei o mês de novo”, vira “usei a verba que existe para isso”. O gasto é o mesmo; a sensação de descontrole, não.",
      "É diferente da reserva de emergência. A reserva é para eventos grandes e raros (desemprego, cirurgia). Essa linha é para os pequenos e frequentes.",
    ],
  },

  // ---------------- Planejamento ----------------
  {
    id: "17-metas",
    trilha: "Planejamento",
    ilustracao: "bussola",
    titulo: "Meta sem prazo é desejo",
    duracao: "2 min",
    conteudo: [
      "“Quero juntar dinheiro” não é meta. “Quero 12 mil em 18 meses para a entrada do carro” é — porque dá para calcular: 667 por mês.",
      "Ter o valor mensal muda a decisão do dia a dia. Sem ele, você compara o gasto com o saldo da conta (que parece grande). Com ele, você compara com a meta (que fica visivelmente mais longe).",
      "Também vale separar metas por prazo, porque prazos diferentes pedem tratamentos diferentes: até 1 ano precisa de liquidez, acima de 5 anos permite oscilação, no meio fica o meio-termo.",
      "E metas competem entre si. Ter oito metas simultâneas normalmente significa não avançar em nenhuma. Duas ou três de cada vez costuma render mais.",
    ],
  },
  {
    id: "18-50-30-20",
    trilha: "Planejamento",
    ilustracao: "escada",
    titulo: "A regra dos 50/30/20 (e onde ela falha)",
    duracao: "3 min",
    conteudo: [
      "É uma referência conhecida: 50% da renda líquida para necessidades, 30% para desejos, 20% para poupar e quitar dívidas.",
      "O valor dela não está nos números exatos — está em obrigar você a separar necessidade de desejo, uma distinção que quase ninguém faz conscientemente.",
      "Onde ela falha: em renda baixa, só as necessidades já consomem bem mais que 50%, e a regra vira fonte de culpa em vez de ferramenta. Em renda alta, os 30% de desejo podem ser gastos sem sentido — dá para poupar muito mais.",
      "Use como ponto de partida para comparar sua realidade, não como meta a atingir. Se seus fixos estão em 70%, o dado útil é esse, não o fracasso em relação ao 50.",
    ],
    diagnostico() {
      const p = periodoUltimosMeses(3);
      const { receitas } = totaisPeriodo(p.inicio, p.fim);
      const n = despesasPorNatureza(p.inicio, p.fim);
      if (receitas === 0) return "Sem receitas registradas nos últimos 3 meses para comparar as proporções.";
      const pf = Math.round((n.fixo / receitas) * 100);
      const pv = Math.round((n.variavel / receitas) * 100);
      const pi = Math.round((n.investimento / receitas) * 100);
      return `Nos últimos 3 meses, em relação à sua receita: ${pf}% em gastos fixos, ${pv}% em variáveis e ${pi}% em investimento. A referência clássica seria 50 / 30 / 20.`;
    },
  },
  {
    id: "19-fluxo-do-mes",
    trilha: "Planejamento",
    ilustracao: "ponte",
    titulo: "Organize o mês pelas datas, não só pelos valores",
    duracao: "2 min",
    conteudo: [
      "Dois orçamentos idênticos podem dar resultados opostos por causa das datas. Se todas as contas vencem no dia 5 e o salário cai no dia 10, você vive no limite mesmo tendo dinheiro suficiente no mês.",
      "Boa parte dos boletos permite mudar a data de vencimento com um pedido simples. Concentrar os vencimentos logo depois da entrada de dinheiro elimina uma classe inteira de aperto.",
      "O cartão tem uma lógica própria: compras feitas logo depois do fechamento da fatura só serão pagas em torno de 40 dias. Saber sua data de fechamento é mais útil que saber a de vencimento.",
      "Isso não é dica de economizar — é de reduzir estresse. Você gasta o mesmo, mas para de operar no vermelho temporário.",
    ],
  },
  {
    id: "20-revisao",
    trilha: "Planejamento",
    ilustracao: "relogio",
    titulo: "A revisão mensal de 15 minutos",
    duracao: "2 min",
    conteudo: [
      "Sistema financeiro que exige atenção diária é abandonado. O que costuma se sustentar é uma revisão curta, uma vez por mês, sempre no mesmo dia.",
      "Um roteiro que funciona: conferir se todos os lançamentos entraram, olhar o total por categoria, comparar com o mês anterior e escolher um único ajuste para o mês seguinte.",
      "Um ajuste. Não cinco. Mudança financeira funciona como treino: consistência vence intensidade, e quem muda tudo de uma vez volta ao normal em três semanas.",
      "No Nexo, a aba Análise dá esses números prontos, e o modo Planilha ajuda a lançar em série o que ficou atrasado.",
    ],
  },

  // ---------------- Comportamento ----------------
  {
    id: "21-custo-em-horas",
    trilha: "Comportamento",
    ilustracao: "relogio",
    titulo: "Converta preço em horas de trabalho",
    duracao: "2 min",
    conteudo: [
      "Um fone de 900 reais é caro ou barato? Depende de um número que quase ninguém calcula: quanto vale a sua hora.",
      "Divida sua renda líquida mensal pelas horas que você realmente trabalha (incluindo deslocamento e trabalho levado para casa). Se der 30 reais a hora, aquele fone custa 30 horas da sua vida.",
      "Essa conversão não serve para se privar de tudo. Serve para separar o que vale a pena do que não vale — algumas coisas continuam valendo 30 horas, outras claramente não.",
      "Funciona especialmente bem contra compras por impulso, porque o impulso trabalha com o preço e a razão trabalha com o custo.",
    ],
  },
  {
    id: "22-pequenos-gastos",
    trilha: "Comportamento",
    ilustracao: "cofrinho",
    titulo: "O mito (e a verdade) dos pequenos gastos",
    duracao: "2 min",
    conteudo: [
      "Existe um conselho famoso de que cortar o cafezinho te deixa rico. É exagero: cortar 10 reais por dia dá 300 por mês, o que raramente resolve um problema estrutural.",
      "Mas há uma verdade embutida. Pequenos gastos recorrentes são difíceis de perceber justamente por serem pequenos, e somados costumam representar bem mais do que a pessoa imagina.",
      "A diferença está em atacar o recorrente, não o eventual. Uma assinatura de 40 reais que você não usa custa 480 por ano e exige um único cancelamento. Um jantar de 200 custa 200 e exigiu uma decisão.",
      "Ordem prática: primeiro os recorrentes que você não usa, depois os fixos que dá para renegociar, e só por último o corte de prazeres pontuais — que é o que mais dói e menos rende.",
    ],
  },
  {
    id: "23-inflacao-do-estilo",
    trilha: "Comportamento",
    ilustracao: "escada",
    titulo: "Quando o salário sobe e nada sobra",
    duracao: "2 min",
    conteudo: [
      "Existe um padrão que se repete: a pessoa recebe um aumento e, seis meses depois, está tão apertada quanto antes. O gasto subiu junto — carro melhor, aluguel maior, restaurantes mais caros.",
      "O ponto não é que subir de padrão seja errado. É que subir automaticamente, sem decidir, faz o aumento desaparecer sem ter comprado nada que você escolheu conscientemente.",
      "Uma prática simples: quando a renda aumentar, direcione uma parte definida do aumento (metade, por exemplo) para poupança ou dívidas antes de ajustar o padrão de vida. O resto você usa à vontade.",
      "Isso funciona porque você nunca chegou a se acostumar com aquele dinheiro. É muito mais fácil não incorporar do que cortar depois.",
    ],
    diagnostico() {
      const atual = totaisPeriodo(periodoUltimosMeses(1).inicio, hojeISO());
      const p3 = periodoUltimosMeses(3);
      const tri = totaisPeriodo(p3.inicio, p3.fim);
      if (tri.receitas === 0) return "Ainda não há histórico de receitas suficiente para comparar a evolução.";
      const mediaDespesa = tri.despesas / 3;
      if (mediaDespesa === 0) return "Ainda não há histórico de despesas suficiente para comparar.";
      const variacao = ((atual.despesas - mediaDespesa) / mediaDespesa) * 100;
      return `Sua despesa deste mês está ${variacao >= 0 ? `${variacao.toFixed(0)}% acima` : `${Math.abs(variacao).toFixed(0)}% abaixo`} da média dos últimos 3 meses.`;
    },
  },
  {
    id: "24-decisoes-grandes",
    trilha: "Comportamento",
    ilustracao: "balanca",
    titulo: "Decisões grandes merecem tempo",
    duracao: "2 min",
    conteudo: [
      "Quanto maior o valor, maior costuma ser a pressa criada em cima de você. Isso não é coincidência — pressa reduz comparação, e comparação reduz preço.",
      "Uma regra que evita muito arrependimento: para compras acima de um valor que você define (digamos, uma semana de renda), espere 72 horas antes de decidir. Se ainda fizer sentido depois, provavelmente faz mesmo.",
      "Para decisões realmente grandes — imóvel, carro, troca de emprego, sociedade — vale escrever num papel o que você espera que aconteça e o que faria você desistir. Escrito, antes. Depois é fácil racionalizar qualquer coisa.",
      "Nenhuma oportunidade legítima morre porque você levou três dias para pensar. As que morrem eram pressão de venda.",
    ],
  },

  // ---------------- Longo prazo ----------------
  {
    id: "25-aposentadoria",
    trilha: "Longo prazo",
    ilustracao: "farol",
    titulo: "Aposentadoria começa cedo demais para parecer urgente",
    duracao: "3 min",
    conteudo: [
      "Aposentadoria é o objetivo mais fácil de adiar, porque o custo de adiar não aparece hoje — aparece daqui a trinta anos, quando não dá mais para corrigir.",
      "O motivo matemático: o tempo faz mais trabalho que o valor. Guardar uma quantia modesta durante 30 anos costuma superar guardar bem mais durante 10, porque o juro composto precisa de tempo para acelerar.",
      "No Brasil, quem depende só do INSS costuma ter uma queda relevante de renda ao se aposentar, e existe teto para o benefício. Vale consultar seu extrato no Meu INSS para saber de onde você está partindo, em vez de supor.",
      "O primeiro passo não é escolher onde aplicar — é descobrir de quanto você precisaria por mês e a que distância está disso. Sem esse número, qualquer aplicação é chute.",
    ],
  },
  {
    id: "26-patrimonio-tempo",
    trilha: "Longo prazo",
    ilustracao: "semente",
    titulo: "Por que os primeiros anos parecem não render",
    duracao: "2 min",
    conteudo: [
      "Nos primeiros anos de qualquer acumulação, quase todo o crescimento vem do quanto você deposita, não do rendimento. Isso desanima muita gente, que conclui que “não está funcionando”.",
      "A virada acontece quando o montante fica grande o bastante para o rendimento superar o aporte. A partir daí o crescimento muda de natureza — deixa de depender só do seu esforço mensal.",
      "Consequência prática: no começo, aumentar o aporte rende muito mais que buscar rendimento maior. Depois de anos, o inverso passa a valer.",
      "Isso também explica por que constância vence acerto. Quem aporta pouco todo mês por muitos anos costuma terminar à frente de quem aporta muito de forma esporádica.",
    ],
    diagnostico() {
      const investido = valorTotalInvestimentos();
      if (investido === 0) return "Você ainda não tem investimentos cadastrados no Nexo. O primeiro passo costuma ser separar a reserva de emergência.";
      return `Você tem ${formatarMoeda(investido)} acumulados. O gráfico de evolução do patrimônio mostra a direção — que importa mais que o valor de hoje.`;
    },
  },
  {
    id: "27-heranca-familia",
    trilha: "Longo prazo",
    ilustracao: "ponte",
    titulo: "O que sua família precisa saber",
    duracao: "3 min",
    conteudo: [
      "Existe um risco que quase ninguém planeja: você organiza tudo, e ninguém mais sabe onde está. Se algo acontecer com você, a família pode levar meses para descobrir contas, apólices e dívidas.",
      "O básico é uma lista com onde estão as coisas: quais bancos, quais seguros, quais dívidas, onde ficam os documentos, e como acessar o que estiver digital. Não precisa conter senhas no mesmo lugar — precisa conter o mapa.",
      "Vale também conversar sobre isso enquanto está tudo bem. Conversa sobre dinheiro em família costuma ser adiada até virar emergência, e emergência é o pior momento para decidir.",
      "No Nexo, o backup do banco de dados contém quase todo esse mapa. Vale garantir que alguém de confiança saiba que ele existe e como abrir.",
    ],
  },
];

export function proximaLicao(): Licao | null {
  const feitas = new Set(licoesConcluidas());
  return LICOES.find((l) => !feitas.has(l.id)) ?? null;
}
