import { queryAll, runAndPersist } from "../../database/db";

// =====================================================================
// Log de operações
// ---------------------------------------------------------------------
// Toda escrita do app passa por inserir/atualizar/excluir. Este módulo se
// pendura ali e registra o que aconteceu, para que a operação possa ser
// reproduzida no outro aparelho.
//
// A decisão central, e a razão de tudo isto existir: sincronizar o
// arquivo .db inteiro seria muito mais simples de escrever e destrutivo de
// usar. Se você lançou uma despesa no celular de manhã e cadastrou um
// documento no computador à tarde, quem sincronizasse por último apagaria
// o trabalho do outro. Com log por registro, os dois sobrevivem — só
// colidem se a MESMA linha for editada nos dois lugares antes de
// sincronizar, e aí vale a mais recente.
// =====================================================================

/** Tabelas que não entram no log, e o motivo de cada uma. */
const NAO_SINCRONIZADAS = new Set([
  // O próprio log e o controle de sincronia — sincronizar isso seria recursivo.
  "sync_oplog", "sync_aplicadas", "sync_estado",
  // BLOBs. Um PDF de 2 MB viraria 2,7 MB de base64 em cada operação, e o
  // arquivo de sincronia estouraria rápido. Anexos vão pelo backup .db.
  "anexos", "versao_anexos",
  // Cofre de senhas: cifrado com chave derivada da senha-mestra, que é
  // local. Sincronizar o blob não vazaria nada, mas colocá-lo num arquivo
  // na nuvem convida ataque offline sem limite de tentativas.
  "senhas",
]);

export function tabelaSincronizada(tabela: string): boolean {
  return !NAO_SINCRONIZADAS.has(tabela);
}

export interface Operacao {
  id: string;
  tabela: string;
  registro_id: string;
  operacao: "inserir" | "atualizar" | "excluir";
  dados: string | null;
  relogio: number;
  contador: number;
  origem: string;
  enviado: number;
}

const CHAVE_APARELHO = "nexo:id-aparelho";
const CHAVE_NOME_APARELHO = "nexo:nome-aparelho";

/** Identificador estável deste aparelho. Criado uma vez e nunca muda. */
export function idAparelho(): string {
  let id = localStorage.getItem(CHAVE_APARELHO);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CHAVE_APARELHO, id);
  }
  return id;
}

export function nomeAparelho(): string {
  const salvo = localStorage.getItem(CHAVE_NOME_APARELHO);
  if (salvo) return salvo;
  // Palpite pelo user agent — só para a pessoa reconhecer os aparelhos na
  // lista. É editável nas configurações.
  const ua = navigator.userAgent;
  const palpite = /Android/i.test(ua) ? "Celular Android"
    : /iPhone|iPad/i.test(ua) ? "iPhone"
    : /Mac/i.test(ua) ? "Mac"
    : /Windows/i.test(ua) ? "Computador"
    : "Aparelho";
  localStorage.setItem(CHAVE_NOME_APARELHO, palpite);
  return palpite;
}

export function definirNomeAparelho(nome: string): void {
  localStorage.setItem(CHAVE_NOME_APARELHO, nome.trim() || "Aparelho");
}

// O contador garante ordem entre operações no mesmo milissegundo. Sem ele,
// criar cinco lançamentos de uma vez geraria cinco operações com o mesmo
// relógio, e a ordem de aplicação no outro aparelho seria arbitrária.
let ultimoRelogio = 0;
let contador = 0;

function proximoRelogio(): { relogio: number; contador: number } {
  const agora = Date.now();
  if (agora === ultimoRelogio) {
    contador += 1;
  } else {
    ultimoRelogio = agora;
    contador = 0;
  }
  return { relogio: ultimoRelogio, contador };
}

let capturaAtiva = true;

/**
 * Desliga a captura enquanto operações vindas de fora são aplicadas.
 *
 * Sem isso, aplicar uma operação recebida geraria uma operação nova, que
 * seria enviada de volta, que o outro aparelho aplicaria, que geraria
 * outra — um laço infinito de eco entre os dois aparelhos.
 */
export function semCaptura<T>(fn: () => T): T {
  const anterior = capturaAtiva;
  capturaAtiva = false;
  try {
    return fn();
  } finally {
    capturaAtiva = anterior;
  }
}

export async function registrarOperacao(
  tabela: string,
  registroId: string,
  operacao: "inserir" | "atualizar" | "excluir",
  dados: Record<string, unknown> | null,
): Promise<void> {
  if (!capturaAtiva || !tabelaSincronizada(tabela)) return;

  const { relogio, contador: seq } = proximoRelogio();
  const agora = new Date().toISOString();

  try {
    await runAndPersist(
      `INSERT INTO sync_oplog (id, tabela, registro_id, operacao, dados, relogio, contador, origem, enviado, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        crypto.randomUUID(), tabela, registroId, operacao,
        dados ? JSON.stringify(dados) : null,
        relogio, seq, idAparelho(), agora, agora,
      ],
    );
  } catch {
    // O log nunca pode derrubar a operação que ele observa. Perder uma
    // linha de sincronia é infinitamente melhor que perder o lançamento
    // que a pessoa acabou de digitar — na pior hipótese aquele registro
    // não viaja, e a pessoa refaz.
  }
}

export function operacoesPendentes(limite = 5000): Operacao[] {
  return queryAll<Operacao>(
    "SELECT * FROM sync_oplog WHERE enviado = 0 ORDER BY relogio ASC, contador ASC LIMIT ?",
    [limite],
  );
}

export function totalPendentes(): number {
  return queryAll<{ t: number }>("SELECT COUNT(*) as t FROM sync_oplog WHERE enviado = 0")[0]?.t ?? 0;
}

export async function marcarEnviadas(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const marcadores = ids.map(() => "?").join(",");
  await runAndPersist(
    `UPDATE sync_oplog SET enviado = 1, atualizado_em = ? WHERE id IN (${marcadores})`,
    [new Date().toISOString(), ...ids],
  );
}

export function jaAplicada(opId: string): boolean {
  return queryAll<{ op_id: string }>("SELECT op_id FROM sync_aplicadas WHERE op_id = ?", [opId]).length > 0;
}

export function idsConhecidos(): Set<string> {
  const proprias = queryAll<{ id: string }>("SELECT id FROM sync_oplog").map((r) => r.id);
  const externas = queryAll<{ op_id: string }>("SELECT op_id FROM sync_aplicadas").map((r) => r.op_id);
  return new Set([...proprias, ...externas]);
}

export async function marcarAplicada(opId: string): Promise<void> {
  await runAndPersist(
    "INSERT OR IGNORE INTO sync_aplicadas (op_id, aplicada_em) VALUES (?, ?)",
    [opId, new Date().toISOString()],
  );
}

// --- Estado ----------------------------------------------------------------

export function lerEstado(chave: string): string | null {
  return queryAll<{ valor: string | null }>(
    "SELECT valor FROM sync_estado WHERE chave = ?", [chave],
  )[0]?.valor ?? null;
}

export async function gravarEstado(chave: string, valor: string | null): Promise<void> {
  const agora = new Date().toISOString();
  await runAndPersist(
    `INSERT INTO sync_estado (chave, valor, atualizado_em) VALUES (?, ?, ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
    [chave, valor, agora],
  );
}

/**
 * Remove operações antigas já enviadas.
 *
 * O log cresce para sempre se ninguém podar, e ele mora dentro do mesmo
 * .db que vai no backup. Guardar 60 dias cobre com folga o cenário de um
 * aparelho ficar semanas sem abrir. Se passar disso, aquele aparelho
 * precisa de uma restauração completa em vez de sincronia incremental —
 * e a tela avisa quando é o caso.
 */
export async function podarLog(diasRetencao = 60): Promise<number> {
  const limite = Date.now() - diasRetencao * 86400000;
  const antes = queryAll<{ t: number }>("SELECT COUNT(*) as t FROM sync_oplog")[0]?.t ?? 0;
  await runAndPersist("DELETE FROM sync_oplog WHERE enviado = 1 AND relogio < ?", [limite]);
  await runAndPersist(
    "DELETE FROM sync_aplicadas WHERE aplicada_em < ?",
    [new Date(limite).toISOString()],
  );
  const depois = queryAll<{ t: number }>("SELECT COUNT(*) as t FROM sync_oplog")[0]?.t ?? 0;
  return antes - depois;
}
