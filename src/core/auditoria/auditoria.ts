import { queryAll, runAndPersist } from "../../database/db";
import type { RegistroAuditoria } from "../../types/entities";

// =====================================================================
// Trilha de auditoria
// ---------------------------------------------------------------------
// Objetivo modesto e claro: responder "quem mudou isso, quando, e o que
// estava antes". Não é controle de acesso e não impede nada — é memória.
//
// Por que "perfil" e não "usuário": o app é offline e sem conta. O que
// existe de fato é o perfil principal cadastrado em Família, e o nome do
// dispositivo. É isso que dá pra registrar com honestidade.
//
// Só as tabelas que mexem em dinheiro são auditadas por padrão. Auditar
// tudo dobraria o tamanho do banco pra ganhar pouco.
// =====================================================================

export const TABELAS_AUDITADAS = new Set([
  "transacoes", "contas", "cartoes", "recorrencias", "parcelamentos",
  "orcamentos", "investimentos", "movimentos_investimento", "dividas", "metas",
]);

const LIMITE_REGISTROS = 5000;

let perfilAtual = "";

/** Definido uma vez na inicialização (nome do perfil principal). */
export function definirPerfilAuditoria(nome: string): void {
  perfilAtual = nome;
}

function serializar(dados: unknown): string | null {
  if (dados == null) return null;
  try {
    // Campos internos poluem a leitura e não ajudam a entender a mudança.
    const limpo = { ...(dados as Record<string, unknown>) };
    delete limpo.criado_em;
    delete limpo.atualizado_em;
    return JSON.stringify(limpo);
  } catch {
    return null;
  }
}

export async function registrarAuditoria(entrada: {
  tabela: string;
  registro_id: string;
  acao: "criar" | "atualizar" | "excluir";
  resumo?: string | null;
  dados_antes?: unknown;
  dados_depois?: unknown;
}): Promise<void> {
  try {
    await runAndPersist(
      `INSERT INTO auditoria (id, tabela, registro_id, acao, resumo, dados_antes, dados_depois, perfil, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        entrada.tabela,
        entrada.registro_id,
        entrada.acao,
        entrada.resumo ?? null,
        serializar(entrada.dados_antes),
        serializar(entrada.dados_depois),
        perfilAtual || null,
        new Date().toISOString(),
      ],
    );
  } catch {
    // Auditoria nunca pode derrubar a operação que ela observa. Se falhar,
    // falha em silêncio: perder uma linha de log é infinitamente melhor do
    // que perder o lançamento que o usuário acabou de digitar.
  }
}

export function listarAuditoria(limite = 200, tabela?: string): RegistroAuditoria[] {
  return tabela
    ? queryAll<RegistroAuditoria>(
        "SELECT * FROM auditoria WHERE tabela = ? ORDER BY criado_em DESC LIMIT ?", [tabela, limite])
    : queryAll<RegistroAuditoria>("SELECT * FROM auditoria ORDER BY criado_em DESC LIMIT ?", [limite]);
}

export function historicoDoRegistro(tabela: string, registroId: string): RegistroAuditoria[] {
  return queryAll<RegistroAuditoria>(
    "SELECT * FROM auditoria WHERE tabela = ? AND registro_id = ? ORDER BY criado_em DESC",
    [tabela, registroId],
  );
}

export function totalAuditoria(): number {
  return queryAll<{ total: number }>("SELECT COUNT(*) as total FROM auditoria")[0]?.total ?? 0;
}

/**
 * Mantém o log dentro de um teto. Sem isso, um app usado por anos carrega um
 * histórico que só cresce dentro do próprio arquivo .db que vai e volta em
 * cada backup.
 */
export async function podarAuditoria(): Promise<number> {
  const total = totalAuditoria();
  if (total <= LIMITE_REGISTROS) return 0;
  const excedente = total - LIMITE_REGISTROS;
  await runAndPersist(
    `DELETE FROM auditoria WHERE id IN (
       SELECT id FROM auditoria ORDER BY criado_em ASC LIMIT ?
     )`,
    [excedente],
  );
  return excedente;
}

export async function limparAuditoria(): Promise<void> {
  await runAndPersist("DELETE FROM auditoria");
}

/** Descrição legível de uma linha do log, para a tela de histórico. */
export function descreverAuditoria(r: RegistroAuditoria): string {
  if (r.resumo) return r.resumo;
  const verbo = r.acao === "criar" ? "criou" : r.acao === "excluir" ? "excluiu" : "alterou";
  return `${verbo} um registro em ${r.tabela}`;
}

/** Campos que mudaram entre antes e depois — o "diff" mostrado na tela. */
export function camposAlterados(r: RegistroAuditoria): Array<{ campo: string; antes: string; depois: string }> {
  if (!r.dados_antes || !r.dados_depois) return [];
  try {
    const antes = JSON.parse(r.dados_antes) as Record<string, unknown>;
    const depois = JSON.parse(r.dados_depois) as Record<string, unknown>;
    const mudancas: Array<{ campo: string; antes: string; depois: string }> = [];
    for (const campo of Object.keys(depois)) {
      const a = antes[campo];
      const d = depois[campo];
      if (String(a ?? "") !== String(d ?? "")) {
        mudancas.push({ campo, antes: String(a ?? "—"), depois: String(d ?? "—") });
      }
    }
    return mudancas;
  } catch {
    return [];
  }
}
