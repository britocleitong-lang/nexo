import { inferirTipoDocumento, sugerirValidade, type TipoDocumento } from "./tiposDocumento";

// =====================================================================
// Leitura assistida de documento
// ---------------------------------------------------------------------
// Honestidade sobre o que isto é, porque a diferença importa:
//
// NÃO é OCR. OCR de verdade, offline, dentro do navegador, exigiria
// tesseract.js — uns 10 MB de WebAssembly mais arquivos de idioma que ele
// busca em tempo de execução. Isso quebraria as duas premissas do app
// (leve e sem CDN) em troca de um resultado que, na prática, é um chute
// na foto torta do documento tirada em cima da mesa.
//
// O que ISTO É: extração de campos a partir de TEXTO. O fluxo real é abrir
// o PDF do documento, Ctrl+A, Ctrl+C, colar aqui — e o formulário se
// preenche. Para PDF nativo (CRLV digital, apólice, carnê de IPTU, ASO,
// certificado de NR) funciona bem, porque o texto já está no arquivo.
// Para foto de papel não funciona, e a tela diz isso em vez de fingir.
//
// Todo campo extraído entra no formulário como SUGESTÃO editável. Nada é
// gravado sem o usuário ver.
// =====================================================================

export interface CamposExtraidos {
  tipoSugerido: TipoDocumento | null;
  nome: string | null;
  numero: string | null;
  cpf: string | null;
  orgaoEmissor: string | null;
  dataEmissao: string | null;
  dataValidade: string | null;
  validadeInferida: boolean;
  placa: string | null;
  renavam: string | null;
  confianca: "alta" | "media" | "baixa";
  camposEncontrados: string[];
}

function normalizarDataBr(bruto: string): string | null {
  const m = /(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4})/.exec(bruto);
  if (m) {
    const dia = m[1].padStart(2, "0");
    const mes = m[2].padStart(2, "0");
    if (Number(mes) > 12 || Number(dia) > 31) return null;
    return `${m[3]}-${mes}-${dia}`;
  }
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(bruto);
  return iso ? iso[0] : null;
}

const D = "\\d{1,2}[/.\\-\\s]\\d{1,2}[/.\\-\\s]\\d{4}";

const PADROES_VALIDADE = [
  new RegExp(`valid(?:ade|o at[eé]|a at[eé])[^\\d]{0,25}(${D})`, "i"),
  new RegExp(`vencimento[^\\d]{0,25}(${D})`, "i"),
  new RegExp(`vence (?:em|dia)[^\\d]{0,25}(${D})`, "i"),
  new RegExp(`exame m[eé]dico[^\\d]{0,40}(${D})`, "i"),
  new RegExp(`fim (?:da )?vig[eê]ncia[^\\d]{0,25}(${D})`, "i"),
];

const PADROES_EMISSAO = [
  new RegExp(`(?:data (?:da )?)?emiss[ãa]o[^\\d]{0,25}(${D})`, "i"),
  new RegExp(`expedi[çc][ãa]o[^\\d]{0,25}(${D})`, "i"),
  new RegExp(`in[íi]cio (?:da )?vig[eê]ncia[^\\d]{0,25}(${D})`, "i"),
  new RegExp(`emitido em[^\\d]{0,25}(${D})`, "i"),
];

const PADROES_ORGAO: RegExp[] = [
  /(?:[óo]rg[ãa]o\s*(?:emissor|expedidor)|expedidor)[:\s]{0,5}([A-Z]{2,10}(?:[/\-][A-Z]{2})?)/,
  /\b(SSP[/\-][A-Z]{2})\b/,
  /\b(DETRAN[/\-][A-Z]{2})\b/,
  /\b(DPF|IFP|IIRGD|SESP|CREA|CRM|OAB|CRC|CRO|CRA|CRF)\b/,
];

/** Pistas de tipo, das mais específicas para as mais genéricas. */
const PISTAS_TIPO: Array<[RegExp, string]> = [
  [/carteira nacional de habilita|\bCNH\b|permiss[ãa]o para dirigir/i, "CNH"],
  [/certificado de registro e licenciamento|\bCRLV\b/i, "CRLV"],
  [/\bIPVA\b|imposto sobre a propriedade de ve[íi]culos/i, "IPVA"],
  [/\bIPTU\b|imposto predial/i, "Carnê do IPTU"],
  [/passaporte|passport/i, "Passaporte"],
  [/ap[óo]lice/i, "Apólice do seguro do carro"],
  [/carteira de identidade nacional|\bCIN\b/i, "CIN (Carteira de Identidade Nacional)"],
  [/atestado de sa[úu]de ocupacional|\bASO\b/i, "ASO (atestado de saúde ocupacional)"],
  [/\bNR-?\s?\d{1,2}\b/i, "Treinamento NR"],
  [/contrato de loca[çc][ãa]o|contrato de aluguel/i, "Contrato de aluguel"],
  [/certid[ãa]o de nascimento/i, "Certidão de nascimento"],
  [/certid[ãa]o de casamento/i, "Certidão de casamento"],
  [/t[íi]tulo (?:de )?eleitor/i, "Título de eleitor"],
  [/certificado digital|e-CPF|e-CNPJ/i, "Certificado digital (e-CPF/e-CNPJ)"],
  [/certid[ãa]o negativa/i, "Certidão negativa de débitos"],
  [/carteira de trabalho|\bCTPS\b/i, "Carteira de trabalho"],
  [/cart[ãa]o (?:nacional )?(?:do |de )?s[úu]s/i, "Cartão do SUS"],
  // "carteira de identidade" fica no fim: a CNH também contém essa frase.
  [/carteira de identidade|registro geral/i, "RG"],
];

function primeiraCaptura(texto: string, padroes: RegExp[]): string | null {
  for (const p of padroes) {
    const m = p.exec(texto);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function extrairCampos(texto: string): CamposExtraidos {
  const encontrados: string[] = [];
  const limpo = texto.replace(/\r/g, "").replace(/[ \t]+/g, " ");

  let tipoSugerido: TipoDocumento | null = null;
  for (const [regex, nomeTipo] of PISTAS_TIPO) {
    if (!regex.test(limpo)) continue;
    tipoSugerido = inferirTipoDocumento(nomeTipo) ?? null;
    if (tipoSugerido) encontrados.push("tipo");
    break;
  }

  // O CPF mascarado é procurado PRIMEIRO e em todo o texto. A ordem importa:
  // um Renavam ("00123456789") também tem 11 dígitos e costuma aparecer antes
  // do CPF no CRLV — procurar "11 dígitos" primeiro fazia o Renavam ganhar a
  // corrida e o CPF verdadeiro ser descartado logo depois pela checagem de
  // rótulo. Só se não houver nenhum CPF mascarado é que vale tentar a versão
  // crua, e aí exigindo o rótulo "CPF" por perto.
  const cpfMascarado = /\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/.exec(limpo);
  let cpf: string | null = cpfMascarado ? cpfMascarado[1] : null;
  if (!cpf) {
    for (const m of limpo.matchAll(/\b(\d{11})\b/g)) {
      const antes = limpo.slice(Math.max(0, (m.index ?? 0) - 30), m.index);
      if (/cpf/i.test(antes)) { cpf = m[1]; break; }
    }
  }
  if (cpf) encontrados.push("CPF");

  const placaMatch = /\b([A-Z]{3}-?\d{4}|[A-Z]{3}\d[A-Z]\d{2})\b/.exec(limpo.toUpperCase());
  const placa = placaMatch ? placaMatch[1] : null;
  if (placa) encontrados.push("placa");

  const renavamMatch = /renavam[:\s]{0,5}(\d{9,11})/i.exec(limpo);
  const renavam = renavamMatch ? renavamMatch[1] : null;
  if (renavam) encontrados.push("Renavam");

  const validadeBruta = primeiraCaptura(limpo, PADROES_VALIDADE);
  let dataValidade = validadeBruta ? normalizarDataBr(validadeBruta) : null;
  if (dataValidade) encontrados.push("validade");

  const emissaoBruta = primeiraCaptura(limpo, PADROES_EMISSAO);
  const dataEmissao = emissaoBruta ? normalizarDataBr(emissaoBruta) : null;
  if (dataEmissao) encontrados.push("emissão");

  // Se o documento não declara validade mas o tipo tem prazo conhecido,
  // calcula a partir da emissão — sinalizando que foi inferido.
  let validadeInferida = false;
  if (!dataValidade && tipoSugerido && dataEmissao) {
    const sugerida = sugerirValidade(tipoSugerido.nome, dataEmissao);
    if (sugerida) {
      dataValidade = sugerida;
      validadeInferida = true;
    }
  }

  const orgaoEmissor = primeiraCaptura(limpo, PADROES_ORGAO)?.toUpperCase() ?? null;
  if (orgaoEmissor) encontrados.push("órgão emissor");

  const numeroMatch =
    /(?:n[ºo°]?\.?\s*(?:d[oa]\s*)?(?:registro|documento|ap[óo]lice|certificado)|registro n[ºo°]?|matr[íi]cula)[:\s]{0,5}([\dA-Z.\-/]{5,25})/i.exec(limpo)
    ?? /\bn[ºo°]\s*([\d.\-/]{6,25})\b/.exec(limpo);
  const numero = numeroMatch ? numeroMatch[1].trim().replace(/[.\-/]$/, "") : null;
  if (numero) encontrados.push("número");

  const confianca: CamposExtraidos["confianca"] =
    encontrados.length >= 4 ? "alta" : encontrados.length >= 2 ? "media" : "baixa";

  return {
    tipoSugerido,
    nome: tipoSugerido?.nome ?? null,
    numero,
    cpf,
    orgaoEmissor,
    dataEmissao,
    dataValidade,
    validadeInferida,
    placa,
    renavam,
    confianca,
    camposEncontrados: encontrados,
  };
}

/** Mensagem honesta sobre o resultado, mostrada na tela. */
export function explicarResultado(campos: CamposExtraidos): string {
  if (campos.confianca === "baixa") {
    return "Não reconheci quase nada. Se o texto veio de uma foto, não vai funcionar — só de PDF ou texto selecionável. Preencha à mão.";
  }
  const lista = campos.camposEncontrados.join(", ");
  const aviso = campos.validadeInferida
    ? " A validade foi calculada pela emissão, não estava escrita — confirme."
    : "";
  return `Reconheci: ${lista}. Confira tudo antes de salvar.${aviso}`;
}
