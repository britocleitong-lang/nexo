/**
 * Referência dos documentos que uma pessoa costuma ter no Brasil.
 * Serve como checklist: a tela mostra o que já foi cadastrado e o que
 * ainda falta, pra não depender da memória de cada um.
 */

/**
 * Natureza do documento — a distinção que faz o alerta ser confiável.
 *
 * `temValidade` era booleano e tratava CNH e IPVA como a mesma coisa. Não
 * são: a CNH vence numa data específica e exige exame médico (avisar com 90
 * dias), o IPVA é refeito todo ano pelo final da placa (avisar com 30, e a
 * data varia por UF). E RG não vence — pedir validade ali só gerava campo
 * vazio. Três naturezas, três comportamentos de aviso.
 */
export type NaturezaDocumento = "permanente" | "periodico" | "anual";

export interface TipoDocumento {
  nome: string;
  grupo: string;
  temValidade?: boolean;
  dica?: string;
  natureza?: NaturezaDocumento;
  /** Antecedência sugerida do alerta, em dias. */
  alertaDias?: number;
  /** Validade típica em anos — preenche a sugestão; o usuário confirma. */
  validadeAnos?: number;
}

export const TIPOS_DOCUMENTO_BR: TipoDocumento[] = [
  // Identificação
  { nome: "RG", grupo: "Identificação", dica: "Registro Geral / Carteira de Identidade", natureza: "permanente" },
  { nome: "CPF", grupo: "Identificação", natureza: "permanente" },
  { nome: "CNH", grupo: "Identificação", temValidade: true, dica: "Renovação exige exame médico — aviso com 90 dias", natureza: "periodico", alertaDias: 90, validadeAnos: 10 },
  { nome: "Passaporte", grupo: "Identificação", temValidade: true, dica: "Muitos países exigem 6 meses de validade restante", natureza: "periodico", alertaDias: 180, validadeAnos: 10 },
  { nome: "Certidão de nascimento", grupo: "Identificação", natureza: "permanente" },
  { nome: "Certidão de casamento", grupo: "Identificação", natureza: "permanente" },
  { nome: "Título de eleitor", grupo: "Identificação", natureza: "permanente" },
  { nome: "Certificado de reservista", grupo: "Identificação", dica: "Homens acima de 18 anos", natureza: "permanente" },

  // Trabalho e previdência
  { nome: "Carteira de trabalho", grupo: "Trabalho", dica: "CTPS — hoje em versão digital", natureza: "permanente" },
  { nome: "PIS/PASEP/NIT", grupo: "Trabalho", natureza: "permanente" },
  { nome: "Extrato do INSS", grupo: "Trabalho", dica: "CNIS — histórico de contribuições", natureza: "permanente" },
  { nome: "Contrato de trabalho", grupo: "Trabalho", natureza: "permanente" },

  // Saúde
  { nome: "Cartão do SUS", grupo: "Saúde", natureza: "permanente" },
  { nome: "Carteirinha do plano de saúde", grupo: "Saúde", temValidade: true, natureza: "periodico", alertaDias: 45, validadeAnos: 1 },
  { nome: "Carteira de vacinação", grupo: "Saúde", natureza: "permanente" },

  // Veículo
  { nome: "CRLV", grupo: "Veículo", temValidade: true, dica: "Emitido a cada licenciamento anual, pelo final da placa", natureza: "anual", alertaDias: 30 },
  { nome: "CRV / DUT", grupo: "Veículo", dica: "Documento de propriedade", natureza: "permanente" },
  { nome: "Apólice do seguro do carro", grupo: "Veículo", temValidade: true, natureza: "periodico", alertaDias: 45, validadeAnos: 1 },

  // Imóvel
  { nome: "Escritura do imóvel", grupo: "Imóvel", natureza: "permanente" },
  { nome: "Matrícula do imóvel", grupo: "Imóvel", natureza: "permanente" },
  { nome: "Carnê do IPTU", grupo: "Imóvel", temValidade: true, natureza: "anual", alertaDias: 30 },
  { nome: "Contrato de aluguel", grupo: "Imóvel", temValidade: true, natureza: "periodico", alertaDias: 60 },

  // Educação
  { nome: "Diploma", grupo: "Educação", natureza: "permanente" },
  { nome: "Histórico escolar", grupo: "Educação", natureza: "permanente" },
  { nome: "Certificado de curso", grupo: "Educação", natureza: "permanente" },

  // Financeiro
  { nome: "Declaração do Imposto de Renda", grupo: "Financeiro", natureza: "anual", alertaDias: 45 },
  { nome: "Comprovante de residência", grupo: "Financeiro", dica: "Conta de luz, água ou telefone recente", natureza: "periodico", alertaDias: 30 },
  { nome: "Contrato de financiamento", grupo: "Financeiro", natureza: "permanente" },

  // Profissional
  { nome: "Carteira de conselho de classe", grupo: "Profissional", temValidade: true, dica: "CREA, CRM, OAB, CRC...", natureza: "periodico", alertaDias: 60, validadeAnos: 1 },
  { nome: "Certidão negativa de débitos", grupo: "Profissional", temValidade: true, natureza: "periodico", alertaDias: 30 },
  { nome: "ASO (atestado de saúde ocupacional)", grupo: "Profissional", temValidade: true, dica: "Exame ocupacional periódico", natureza: "periodico", alertaDias: 30, validadeAnos: 1 },
  { nome: "Treinamento NR", grupo: "Profissional", temValidade: true, dica: "NR-10, NR-33, NR-35 têm reciclagem obrigatória", natureza: "periodico", alertaDias: 60, validadeAnos: 2 },
  { nome: "Certificado digital (e-CPF/e-CNPJ)", grupo: "Financeiro", temValidade: true, natureza: "periodico", alertaDias: 45, validadeAnos: 1 },

  // Novos itens de identificação e veículo
  { nome: "CIN (Carteira de Identidade Nacional)", grupo: "Identificação", temValidade: true, dica: "Substitui o RG, atrelada ao CPF", natureza: "periodico", alertaDias: 90, validadeAnos: 10 },
  { nome: "Visto", grupo: "Identificação", temValidade: true, natureza: "periodico", alertaDias: 120 },
  { nome: "IPVA", grupo: "Veículo", temValidade: true, dica: "Vence pelo final da placa — data varia por UF", natureza: "anual", alertaDias: 30 },
  { nome: "Aferição do tacógrafo", grupo: "Veículo", temValidade: true, natureza: "periodico", alertaDias: 30, validadeAnos: 1 },
  { nome: "Seguro residencial", grupo: "Imóvel", temValidade: true, natureza: "periodico", alertaDias: 45, validadeAnos: 1 },
];

export const LABEL_NATUREZA: Record<NaturezaDocumento, string> = {
  permanente: "Não vence",
  periodico: "Vence em data",
  anual: "Refeito todo ano",
};

/** Antecedência de alerta padrão quando o documento não tem uma própria. */
export const ALERTA_DIAS_PADRAO = 60;

function chaveComparavel(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/** Casa o nome digitado livremente com um tipo do catálogo. */
export function inferirTipoDocumento(nome: string): TipoDocumento | undefined {
  const alvo = chaveComparavel(nome);
  const exato = TIPOS_DOCUMENTO_BR.find((t) => chaveComparavel(t.nome) === alvo);
  if (exato) return exato;
  return TIPOS_DOCUMENTO_BR.find((t) => {
    const tn = chaveComparavel(t.nome);
    return alvo.includes(tn) || tn.includes(alvo);
  });
}

/** Antecedência efetiva de aviso para um documento pelo nome. */
export function alertaDiasDoNome(nome: string): number {
  const tipo = inferirTipoDocumento(nome);
  if (!tipo) return ALERTA_DIAS_PADRAO;
  if (tipo.natureza === "permanente") return 0;
  return tipo.alertaDias ?? ALERTA_DIAS_PADRAO;
}

/**
 * Validade sugerida quando o documento não a declara: emissão + validade
 * típica do tipo. É sugestão, nunca substitui o que está escrito no papel.
 */
export function sugerirValidade(nome: string, dataEmissao: string | null): string | null {
  const tipo = inferirTipoDocumento(nome);
  if (!dataEmissao || !tipo?.validadeAnos) return null;
  const [ano, mes, dia] = dataEmissao.slice(0, 10).split("-").map(Number);
  if (!ano) return null;
  return `${ano + tipo.validadeAnos}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export const GRUPOS_DOCUMENTO = Array.from(new Set(TIPOS_DOCUMENTO_BR.map((t) => t.grupo)));
