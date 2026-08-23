import { getDb, queryAll } from "../../database/db";
import { hoje } from "../datas";
import { SCHEMA_VERSION } from "../../database/schema";

// =====================================================================
// Exportação total em JSON
// ---------------------------------------------------------------------
// O backup .db já existia e continua sendo o caminho oficial de
// restauração — é byte a byte, não perde nada. Mas ele é opaco: pra saber
// o que tem dentro, é preciso um leitor de SQLite.
//
// Este export existe pra outra finalidade: PORTABILIDADE e AUDITORIA.
// É um arquivo que qualquer pessoa abre no bloco de notas, joga num Excel,
// lê daqui a dez anos sem precisar do Nexo existir. Num app cuja premissa
// é "os dados são seus", poder sair sem pedir licença faz parte do trato.
//
// Os anexos (BLOBs) ficam de fora por padrão: um único PDF vira ~1,4 MB de
// base64 e o arquivo deixa de ser legível. Quem quiser tudo, marca a opção.
// =====================================================================

const TABELAS_EXPORTAVEIS = [
  "pessoas", "documentos", "veiculos", "abastecimentos", "manutencoes", "modificacoes",
  "km_registros", "contas", "cartoes", "categorias", "transacoes", "registros_saude",
  "eventos", "tarefas", "subtarefas", "bens", "opcoes_personalizadas", "dividas",
  "patrimonio_historico", "orcamentos", "investimentos", "movimentos_investimento",
  "imoveis", "manutencoes_imovel", "contatos", "recorrencias", "parcelamentos",
  "vacinas_aplicadas", "alertas_estado",
];

/**
 * `senhas` fica fora de propósito. O conteúdo é AES-GCM cifrado com chave
 * derivada da senha-mestra, então exportar não vazaria nada — mas colocar
 * um blob cifrado num arquivo "legível" convida alguém a tentar quebrá-lo
 * offline, sem limite de tentativas. O cofre sai só pelo backup .db.
 */
const TABELAS_SENSIVEIS = ["senhas"];

export interface OpcoesExport {
  incluirAnexos?: boolean;
  tabelas?: string[];
}

export interface PacoteExport {
  aplicativo: "Nexo";
  versaoSchema: number;
  exportadoEm: string;
  contagens: Record<string, number>;
  observacao: string;
  dados: Record<string, unknown[]>;
}

export function exportarJson(opcoes: OpcoesExport = {}): PacoteExport {
  const alvos = opcoes.tabelas ?? TABELAS_EXPORTAVEIS;
  const dados: Record<string, unknown[]> = {};
  const contagens: Record<string, number> = {};

  for (const tabela of alvos) {
    if (TABELAS_SENSIVEIS.includes(tabela)) continue;
    try {
      const linhas = queryAll(`SELECT * FROM ${tabela}`);
      dados[tabela] = linhas;
      contagens[tabela] = linhas.length;
    } catch {
      // Tabela ausente num banco antigo não pode abortar o export inteiro.
      contagens[tabela] = 0;
    }
  }

  if (opcoes.incluirAnexos) {
    const anexos = queryAll<Record<string, unknown>>("SELECT * FROM anexos");
    dados.anexos = anexos.map((a) => ({
      ...a,
      dados: a.dados instanceof Uint8Array ? bytesParaBase64(a.dados) : null,
      _codificacao: "base64",
    }));
    contagens.anexos = anexos.length;
  }

  return {
    aplicativo: "Nexo",
    versaoSchema: SCHEMA_VERSION,
    exportadoEm: new Date().toISOString(),
    contagens,
    observacao:
      "Export legível para portabilidade. O cofre de senhas não está incluído. "
      + "Para restaurar o app por completo, use o backup .db.",
    dados,
  };
}

function bytesParaBase64(bytes: Uint8Array): string {
  let binario = "";
  const bloco = 8192;
  for (let i = 0; i < bytes.length; i += bloco) {
    binario += String.fromCharCode(...bytes.subarray(i, i + bloco));
  }
  return btoa(binario);
}

function baixar(conteudo: string, nome: string, mime: string): void {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

export function baixarJson(opcoes: OpcoesExport = {}): PacoteExport {
  const pacote = exportarJson(opcoes);
  baixar(JSON.stringify(pacote, null, 2), `nexo-dados-${hoje()}.json`, "application/json;charset=utf-8");
  return pacote;
}

// --- CSV por tabela --------------------------------------------------------

function escaparCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Ponto e vírgula: é o separador que o Excel em português abre sem perguntar. */
export function tabelaParaCsv(tabela: string): string {
  const linhas = queryAll<Record<string, unknown>>(`SELECT * FROM ${tabela}`);
  if (linhas.length === 0) return "";
  const colunas = Object.keys(linhas[0]);
  const corpo = linhas.map((l) => colunas.map((c) => escaparCsv(l[c])).join(";"));
  return [colunas.join(";"), ...corpo].join("\n");
}

export function baixarCsv(tabela: string): void {
  const csv = tabelaParaCsv(tabela);
  if (!csv) return;
  // BOM na frente: sem ele o Excel abre acentuação quebrada.
  baixar("\uFEFF" + csv, `nexo-${tabela}-${hoje()}.csv`, "text/csv;charset=utf-8");
}

export function tabelasDisponiveis(): Array<{ nome: string; total: number }> {
  return TABELAS_EXPORTAVEIS.map((nome) => {
    try {
      return { nome, total: queryAll<{ t: number }>(`SELECT COUNT(*) as t FROM ${nome}`)[0]?.t ?? 0 };
    } catch {
      return { nome, total: 0 };
    }
  }).filter((t) => t.total > 0);
}

/** Tamanho aproximado do banco, pra tela de configurações. */
export function tamanhoBancoBytes(): number {
  try {
    return getDb().export().length;
  } catch {
    return 0;
  }
}
