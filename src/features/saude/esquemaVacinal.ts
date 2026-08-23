// =====================================================================
// Esquema vacinal — referência do PNI (Programa Nacional de Imunizações)
// ---------------------------------------------------------------------
// Este arquivo é uma REFERÊNCIA DE CONFERÊNCIA, não uma prescrição.
// Serve pra responder "o que falta na carteirinha?" comparando as doses
// registradas com o calendário oficial — a mesma coisa que a enfermeira
// faz olhando o papel, só que sem depender de achar o papel.
//
// Duas ressalvas que a tela repete ao usuário:
//   1. O calendário do PNI muda. As idades aqui refletem o calendário
//      vigente até 2025/2026; mudanças posteriores não estão contempladas.
//   2. Situações específicas (prematuridade, imunossupressão, gestação,
//      viagem internacional, exposição ocupacional) alteram o esquema.
//      Quem decide é o profissional de saúde, não este arquivo.
//
// Por que meses e não datas: o esquema é definido por IDADE. Cruzando com
// a data de nascimento já cadastrada em Família, o app calcula sozinho o
// que está pendente pra cada pessoa, sem pedir nada a mais.
// =====================================================================

export type PublicoVacina = "crianca" | "adolescente" | "adulto" | "idoso" | "gestante";

export interface DoseVacina {
  chave: string;
  rotulo: string;
  /** Idade recomendada em meses. 0 = ao nascer. */
  idadeMeses: number;
  /** Tolerância antes de considerar atrasada, em meses. */
  toleranciaMeses?: number;
}

export interface Vacina {
  chave: string;
  nome: string;
  protegeContra: string;
  publico: PublicoVacina[];
  doses: DoseVacina[];
  /** Reforço periódico, em anos (ex: dT a cada 10 anos). */
  reforcoAnos?: number;
  observacao?: string;
}

const A = 12; // meses por ano, pra deixar as idades legíveis

export const ESQUEMA_VACINAL: Vacina[] = [
  {
    chave: "bcg", nome: "BCG", protegeContra: "Formas graves de tuberculose",
    publico: ["crianca"],
    doses: [{ chave: "unica", rotulo: "Dose única", idadeMeses: 0, toleranciaMeses: 1 }],
    observacao: "Aplicada na maternidade, deixa a cicatriz no braço.",
  },
  {
    chave: "hepatite_b", nome: "Hepatite B", protegeContra: "Hepatite B",
    publico: ["crianca", "adulto"],
    doses: [{ chave: "nascer", rotulo: "Ao nascer", idadeMeses: 0, toleranciaMeses: 1 }],
    observacao: "As doses seguintes vêm dentro da Penta.",
  },
  {
    chave: "penta", nome: "Pentavalente", protegeContra: "Difteria, tétano, coqueluche, Hib e hepatite B",
    publico: ["crianca"],
    doses: [
      { chave: "d1", rotulo: "1ª dose", idadeMeses: 2 },
      { chave: "d2", rotulo: "2ª dose", idadeMeses: 4 },
      { chave: "d3", rotulo: "3ª dose", idadeMeses: 6 },
    ],
  },
  {
    chave: "vip", nome: "Poliomielite (VIP)", protegeContra: "Paralisia infantil",
    publico: ["crianca"],
    doses: [
      { chave: "d1", rotulo: "1ª dose", idadeMeses: 2 },
      { chave: "d2", rotulo: "2ª dose", idadeMeses: 4 },
      { chave: "d3", rotulo: "3ª dose", idadeMeses: 6 },
      { chave: "r1", rotulo: "Reforço", idadeMeses: 15 },
    ],
  },
  {
    chave: "rotavirus", nome: "Rotavírus", protegeContra: "Diarreia por rotavírus",
    publico: ["crianca"],
    doses: [
      { chave: "d1", rotulo: "1ª dose", idadeMeses: 2, toleranciaMeses: 1 },
      { chave: "d2", rotulo: "2ª dose", idadeMeses: 4, toleranciaMeses: 1 },
    ],
    observacao: "Tem limite de idade rígido — depois de 7 meses e meio não pode mais ser aplicada.",
  },
  {
    chave: "pneumo10", nome: "Pneumocócica 10", protegeContra: "Pneumonia, otite e meningite por pneumococo",
    publico: ["crianca"],
    doses: [
      { chave: "d1", rotulo: "1ª dose", idadeMeses: 2 },
      { chave: "d2", rotulo: "2ª dose", idadeMeses: 4 },
      { chave: "r1", rotulo: "Reforço", idadeMeses: 12 },
    ],
  },
  {
    chave: "meningo_c", nome: "Meningocócica C", protegeContra: "Meningite C",
    publico: ["crianca", "adolescente"],
    doses: [
      { chave: "d1", rotulo: "1ª dose", idadeMeses: 3 },
      { chave: "d2", rotulo: "2ª dose", idadeMeses: 5 },
      { chave: "r1", rotulo: "Reforço", idadeMeses: 12 },
    ],
  },
  {
    chave: "febre_amarela", nome: "Febre amarela", protegeContra: "Febre amarela",
    publico: ["crianca", "adulto"],
    doses: [
      { chave: "d1", rotulo: "1ª dose", idadeMeses: 9 },
      { chave: "r1", rotulo: "Reforço", idadeMeses: 4 * A },
    ],
    observacao: "Exigida para viagem a alguns países — o certificado leva 10 dias pra valer.",
  },
  {
    chave: "triple_viral", nome: "Tríplice viral", protegeContra: "Sarampo, caxumba e rubéola",
    publico: ["crianca", "adulto"],
    doses: [
      { chave: "d1", rotulo: "1ª dose", idadeMeses: 12 },
      { chave: "d2", rotulo: "2ª dose (tetraviral)", idadeMeses: 15 },
    ],
  },
  {
    chave: "hepatite_a", nome: "Hepatite A", protegeContra: "Hepatite A",
    publico: ["crianca"],
    doses: [{ chave: "d1", rotulo: "Dose única", idadeMeses: 15 }],
  },
  {
    chave: "dtp", nome: "DTP", protegeContra: "Difteria, tétano e coqueluche",
    publico: ["crianca"],
    doses: [
      { chave: "r1", rotulo: "1º reforço", idadeMeses: 15 },
      { chave: "r2", rotulo: "2º reforço", idadeMeses: 4 * A },
    ],
  },
  {
    chave: "varicela", nome: "Varicela", protegeContra: "Catapora",
    publico: ["crianca"],
    doses: [{ chave: "d1", rotulo: "Dose", idadeMeses: 4 * A }],
  },
  {
    chave: "hpv", nome: "HPV", protegeContra: "Cânceres associados ao HPV",
    publico: ["adolescente"],
    doses: [{ chave: "d1", rotulo: "Dose única", idadeMeses: 9 * A, toleranciaMeses: 60 }],
    observacao: "Rede pública: dose única de 9 a 14 anos, meninas e meninos.",
  },
  {
    chave: "meningo_acwy", nome: "Meningocócica ACWY", protegeContra: "Meningite A, C, W e Y",
    publico: ["adolescente"],
    doses: [{ chave: "d1", rotulo: "Reforço", idadeMeses: 11 * A, toleranciaMeses: 36 }],
  },
  {
    chave: "dt_adulto", nome: "dT / dTpa (adulto)", protegeContra: "Difteria e tétano",
    publico: ["adulto", "idoso", "gestante"],
    doses: [{ chave: "d1", rotulo: "Esquema/reforço", idadeMeses: 20 * A }],
    reforcoAnos: 10,
    observacao: "Reforço a cada 10 anos por toda a vida — é a vacina mais esquecida do calendário adulto.",
  },
  {
    chave: "influenza", nome: "Influenza (gripe)", protegeContra: "Gripe sazonal",
    publico: ["crianca", "adulto", "idoso", "gestante"],
    doses: [{ chave: "anual", rotulo: "Dose anual", idadeMeses: 6 }],
    reforcoAnos: 1,
    observacao: "Anual, porque o vírus circulante muda todo ano.",
  },
  {
    chave: "covid", nome: "Covid-19", protegeContra: "Covid-19",
    publico: ["crianca", "adulto", "idoso", "gestante"],
    doses: [{ chave: "atual", rotulo: "Dose vigente", idadeMeses: 6 }],
    reforcoAnos: 1,
    observacao: "Recomendação de reforço varia por grupo e ano — confira a campanha vigente.",
  },
  {
    chave: "pneumo23", nome: "Pneumocócica 23", protegeContra: "Doença pneumocócica invasiva",
    publico: ["idoso"],
    doses: [{ chave: "d1", rotulo: "Dose", idadeMeses: 60 * A }],
    observacao: "Rede pública: 60+ em instituição de longa permanência, ou por indicação clínica.",
  },
];

export function buscarVacina(chave: string): Vacina | undefined {
  return ESQUEMA_VACINAL.find((v) => v.chave === chave);
}

// --- Conferência por pessoa ------------------------------------------------

export type SituacaoDose = "aplicada" | "pendente" | "atrasada" | "futura";

export interface ItemConferencia {
  vacina: Vacina;
  dose: DoseVacina;
  situacao: SituacaoDose;
  dataAplicacao: string | null;
  /** Quando a dose deveria ter sido/será aplicada, calculado do nascimento. */
  dataPrevista: string | null;
  idadeMesesPessoa: number | null;
}

export function idadeEmMeses(dataNascimento: string | null | undefined, referencia?: string): number | null {
  if (!dataNascimento) return null;
  const [an, mn, dn] = dataNascimento.slice(0, 10).split("-").map(Number);
  if (!an) return null;
  const ref = referencia ? referencia.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const [ar, mr, dr] = ref.split("-").map(Number);
  let meses = (ar - an) * 12 + (mr - mn);
  if (dr < dn) meses -= 1;
  return Math.max(0, meses);
}

function somarMesesData(iso: string, meses: number): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  const total = mes - 1 + meses;
  const novoAno = ano + Math.floor(total / 12);
  const novoMes = ((total % 12) + 12) % 12 + 1;
  const ultimoDia = new Date(novoAno, novoMes, 0).getDate();
  return `${novoAno}-${String(novoMes).padStart(2, "0")}-${String(Math.min(dia, ultimoDia)).padStart(2, "0")}`;
}

/**
 * Confere o esquema de uma pessoa contra o que já foi registrado.
 * `aplicadas` é um Set de "vacinaChave:doseChave".
 */
export function conferirEsquema(
  dataNascimento: string | null,
  aplicadas: Map<string, string>,
): ItemConferencia[] {
  const idade = idadeEmMeses(dataNascimento);
  const itens: ItemConferencia[] = [];

  for (const vacina of ESQUEMA_VACINAL) {
    for (const dose of vacina.doses) {
      const id = `${vacina.chave}:${dose.chave}`;
      const dataAplicacao = aplicadas.get(id) ?? null;
      const dataPrevista = dataNascimento ? somarMesesData(dataNascimento, dose.idadeMeses) : null;

      let situacao: SituacaoDose;
      if (dataAplicacao) situacao = "aplicada";
      else if (idade === null) situacao = "pendente";
      else if (idade < dose.idadeMeses) situacao = "futura";
      else if (idade > dose.idadeMeses + (dose.toleranciaMeses ?? 2)) situacao = "atrasada";
      else situacao = "pendente";

      itens.push({ vacina, dose, situacao, dataAplicacao, dataPrevista, idadeMesesPessoa: idade });
    }
  }

  return itens;
}

export interface ResumoEsquema {
  aplicadas: number;
  atrasadas: number;
  pendentes: number;
  futuras: number;
  /** Percentual do que já era devido e foi cumprido. */
  cobertura: number;
}

export function resumirEsquema(itens: ItemConferencia[]): ResumoEsquema {
  const aplicadas = itens.filter((i) => i.situacao === "aplicada").length;
  const atrasadas = itens.filter((i) => i.situacao === "atrasada").length;
  const pendentes = itens.filter((i) => i.situacao === "pendente").length;
  const futuras = itens.filter((i) => i.situacao === "futura").length;
  const devidas = aplicadas + atrasadas + pendentes;
  return {
    aplicadas, atrasadas, pendentes, futuras,
    cobertura: devidas > 0 ? (aplicadas / devidas) * 100 : 100,
  };
}

/** Filtra o esquema pelo público relevante para a idade da pessoa. */
export function publicoDaIdade(idadeMeses: number | null): PublicoVacina[] {
  if (idadeMeses === null) return ["crianca", "adolescente", "adulto", "idoso"];
  if (idadeMeses < 10 * 12) return ["crianca"];
  if (idadeMeses < 20 * 12) return ["crianca", "adolescente"];
  if (idadeMeses < 60 * 12) return ["adolescente", "adulto"];
  return ["adulto", "idoso"];
}

export const LABEL_SITUACAO_DOSE: Record<SituacaoDose, string> = {
  aplicada: "Aplicada",
  pendente: "Está na hora",
  atrasada: "Em atraso",
  futura: "Mais pra frente",
};

export const AVISO_ESQUEMA =
  "Conferência baseada no calendário do PNI. Prematuridade, gravidez, imunossupressão, "
  + "viagem internacional e exposição ocupacional mudam o esquema — quem define é o "
  + "profissional de saúde, não este app.";
