// =====================================================================
// Leitura de extrato bancário — OFX e CSV
// ---------------------------------------------------------------------
// OFX (Open Financial Exchange) é o que todo internet banking brasileiro
// exporta, e é o formato bom: cada lançamento tem um FITID, um
// identificador único e estável dado pelo banco. É ele que permite
// importar o mesmo arquivo duas vezes sem duplicar nada.
//
// O parser aqui é escrito à mão de propósito. OFX 1.x é SGML, não XML —
// tem tags sem fechamento (`<NAME>Padaria` numa linha só), então
// DOMParser falha ou entrega lixo. Um parser de tags simples resolve os
// dois dialetos (1.x SGML e 2.x XML) com muito menos código do que
// adaptar uma biblioteca, e sem adicionar dependência a um app que se
// define por rodar offline.
// =====================================================================

export interface LancamentoExtrato {
  fitid: string | null;
  data: string;
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
  memo?: string | null;
  documento?: string | null;
}

export interface ResultadoLeitura {
  lancamentos: LancamentoExtrato[];
  banco?: string | null;
  conta?: string | null;
  periodo?: { inicio: string; fim: string } | null;
  formato: "ofx" | "csv";
  avisos: string[];
}

// --- OFX -------------------------------------------------------------------

/** Extrai o conteúdo de uma tag, tolerando SGML sem fechamento. */
function tag(bloco: string, nome: string): string | null {
  const fechada = new RegExp(`<${nome}>([\\s\\S]*?)</${nome}>`, "i").exec(bloco);
  if (fechada) return fechada[1].trim();
  // SGML: o valor vai até o próximo "<" ou fim de linha.
  const aberta = new RegExp(`<${nome}>([^<\\r\\n]*)`, "i").exec(bloco);
  return aberta ? aberta[1].trim() : null;
}

/** OFX usa YYYYMMDD, às vezes com hora e fuso colado: 20260812120000[-3:BRT] */
function dataOfx(bruto: string | null): string | null {
  if (!bruto) return null;
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(bruto.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function lerOfx(conteudo: string): ResultadoLeitura {
  const avisos: string[] = [];
  const lancamentos: LancamentoExtrato[] = [];

  const blocos = conteudo.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  if (blocos.length === 0) {
    avisos.push("Nenhuma transação encontrada no arquivo. Confirme que é um extrato OFX/OFC.");
  }

  for (const bloco of blocos) {
    const data = dataOfx(tag(bloco, "DTPOSTED"));
    const valorBruto = tag(bloco, "TRNAMT");
    if (!data || !valorBruto) {
      avisos.push("Um lançamento foi ignorado por não ter data ou valor.");
      continue;
    }
    // Alguns bancos brasileiros exportam TRNAMT no formato local
    // ("-1.234,56") apesar da especificação pedir ponto decimal. Reaproveitar
    // o normalizador do CSV cobre os dois dialetos — descoberto testando um
    // OFX real, não lendo a spec.
    const valor = normalizarValor(valorBruto);
    if (valor === null) {
      avisos.push(`Valor não reconhecido: ${valorBruto}`);
      continue;
    }
    const nome = tag(bloco, "NAME") ?? tag(bloco, "MEMO") ?? "Lançamento";
    lancamentos.push({
      fitid: tag(bloco, "FITID"),
      data,
      descricao: decodificarEntidades(nome).replace(/\s+/g, " ").trim(),
      // OFX assina o valor: negativo é saída. É o próprio arquivo dizendo
      // se é receita ou despesa, sem precisar adivinhar pela descrição.
      valor: Math.abs(valor),
      tipo: valor < 0 ? "despesa" : "receita",
      memo: tag(bloco, "MEMO"),
      documento: tag(bloco, "CHECKNUM"),
    });
  }

  const inicio = dataOfx(tag(conteudo, "DTSTART"));
  const fim = dataOfx(tag(conteudo, "DTEND"));

  return {
    lancamentos: lancamentos.sort((a, b) => a.data.localeCompare(b.data)),
    banco: tag(conteudo, "ORG") ?? tag(conteudo, "FID"),
    conta: tag(conteudo, "ACCTID"),
    periodo: inicio && fim ? { inicio, fim } : null,
    formato: "ofx",
    avisos,
  };
}

// --- CSV -------------------------------------------------------------------

/** Divide uma linha de CSV respeitando aspas. */
function dividirLinha(linha: string, separador: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroAspas && linha[i + 1] === '"') { atual += '"'; i++; }
      else dentroAspas = !dentroAspas;
    } else if (c === separador && !dentroAspas) {
      campos.push(atual); atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

function detectarSeparador(linha: string): string {
  const candidatos = [";", ",", "\t"];
  return candidatos.sort((a, b) => linha.split(b).length - linha.split(a).length)[0];
}

/** Aceita 12/08/2026, 2026-08-12 e 12-08-2026. */
function normalizarData(bruto: string): string | null {
  const t = bruto.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})[/-](\d{2})[/-](\d{4})/.exec(t);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{2})[/-](\d{2})[/-](\d{2})$/.exec(t);
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/**
 * Interpreta valor no padrão brasileiro E no americano.
 * "1.234,56" → 1234.56 e "1,234.56" → 1234.56. A regra: o último separador
 * encontrado é o decimal.
 */
export function normalizarValor(bruto: string): number | null {
  let t = bruto.replace(/[R$\s]/gi, "").trim();
  if (!t) return null;
  const negativo = t.startsWith("-") || /^\(.*\)$/.test(t);
  t = t.replace(/[()-]/g, "");
  const ultimaVirgula = t.lastIndexOf(",");
  const ultimoPonto = t.lastIndexOf(".");

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    // Os dois presentes: o último é o decimal, o outro é milhar.
    if (ultimaVirgula > ultimoPonto) t = t.replace(/\./g, "").replace(",", ".");
    else t = t.replace(/,/g, "");
  } else if (ultimaVirgula >= 0 || ultimoPonto >= 0) {
    // Só um separador. "2.000" é dois mil no extrato brasileiro, não dois.
    // A pista é o tamanho do grupo à direita: 3 dígitos = milhar,
    // 1 ou 2 = centavos. Ambíguo por natureza; essa é a leitura correta
    // na esmagadora maioria dos extratos reais.
    const pos = Math.max(ultimaVirgula, ultimoPonto);
    const direita = t.length - pos - 1;
    if (direita === 3) t = t.replace(/[.,]/g, "");
    else t = t.replace(",", ".");
  }
  const n = Number(t);
  if (Number.isNaN(n)) return null;
  return negativo ? -n : n;
}

const CABECALHOS_DATA = ["data", "date", "dt", "data lancamento", "data movimento"];
const CABECALHOS_DESC = ["descricao", "historico", "description", "memo", "lancamento", "detalhe", "estabelecimento"];
const CABECALHOS_VALOR = ["valor", "amount", "quantia", "value", "montante"];
const CABECALHOS_CREDITO = ["credito", "entrada", "receita"];
const CABECALHOS_DEBITO = ["debito", "saida", "despesa"];

function achaColuna(cabecalho: string[], candidatos: string[]): number {
  const normal = cabecalho.map((c) =>
    c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
  for (const cand of candidatos) {
    const i = normal.findIndex((c) => c === cand);
    if (i >= 0) return i;
  }
  for (const cand of candidatos) {
    const i = normal.findIndex((c) => c.includes(cand));
    if (i >= 0) return i;
  }
  return -1;
}

export function lerCsv(conteudo: string): ResultadoLeitura {
  const avisos: string[] = [];
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length < 2) {
    return { lancamentos: [], formato: "csv", avisos: ["Arquivo vazio ou sem linhas de dados."] };
  }

  const separador = detectarSeparador(linhas[0]);
  const cabecalho = dividirLinha(linhas[0], separador);

  const iData = achaColuna(cabecalho, CABECALHOS_DATA);
  const iDesc = achaColuna(cabecalho, CABECALHOS_DESC);
  const iValor = achaColuna(cabecalho, CABECALHOS_VALOR);
  const iCredito = achaColuna(cabecalho, CABECALHOS_CREDITO);
  const iDebito = achaColuna(cabecalho, CABECALHOS_DEBITO);

  if (iData < 0 || iDesc < 0 || (iValor < 0 && iCredito < 0 && iDebito < 0)) {
    return {
      lancamentos: [], formato: "csv",
      avisos: [
        `Não consegui identificar as colunas. Encontrei: ${cabecalho.join(" | ")}.`,
        "O arquivo precisa ter uma coluna de data, uma de descrição e uma de valor (ou débito/crédito).",
      ],
    };
  }

  const lancamentos: LancamentoExtrato[] = [];
  for (let i = 1; i < linhas.length; i++) {
    const campos = dividirLinha(linhas[i], separador);
    const data = normalizarData(campos[iData] ?? "");
    if (!data) continue;

    let valor: number | null = null;
    if (iValor >= 0) {
      valor = normalizarValor(campos[iValor] ?? "");
    } else {
      const credito = iCredito >= 0 ? normalizarValor(campos[iCredito] ?? "") ?? 0 : 0;
      const debito = iDebito >= 0 ? normalizarValor(campos[iDebito] ?? "") ?? 0 : 0;
      valor = credito - Math.abs(debito);
    }
    if (valor === null || valor === 0) continue;

    lancamentos.push({
      // CSV não tem FITID. Como não há identificador do banco, a detecção de
      // duplicata cai pro método por semelhança (data + valor + descrição).
      fitid: null,
      data,
      descricao: (campos[iDesc] ?? "Lançamento").replace(/\s+/g, " ").trim(),
      valor: Math.abs(valor),
      tipo: valor < 0 ? "despesa" : "receita",
    });
  }

  if (lancamentos.length === 0) avisos.push("Nenhuma linha pôde ser lida como lançamento.");
  else avisos.push("CSV não tem identificador único do banco — a checagem de duplicata usa data, valor e descrição parecida.");

  return {
    lancamentos: lancamentos.sort((a, b) => a.data.localeCompare(b.data)),
    formato: "csv",
    avisos,
  };
}

/** Escolhe o leitor pelo conteúdo, não pela extensão (que mente com frequência). */
export function lerExtrato(conteudo: string, nomeArquivo = ""): ResultadoLeitura {
  const pareceOfx = /<STMTTRN>|<OFX>|OFXHEADER/i.test(conteudo.slice(0, 4000));
  if (pareceOfx) return lerOfx(conteudo);
  if (/\.ofx$/i.test(nomeArquivo)) {
    return { lancamentos: [], formato: "ofx", avisos: ["O arquivo tem extensão .ofx mas não contém transações no formato esperado."] };
  }
  return lerCsv(conteudo);
}
