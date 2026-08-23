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


// =====================================================================
// Carga inicial
// ---------------------------------------------------------------------
// O problema que isto resolve, e que só aparece no primeiro uso:
//
// O log registra o que acontece a partir do momento em que ele existe.
// Quem já usava o app antes da sincronização tem centenas de registros
// no banco e ZERO operações no log — porque nada daquilo passou por aqui.
// O resultado é uma primeira sincronização que funciona perfeitamente e
// não transfere nada, porque de fato não há nada a transferir.
//
// A carga inicial percorre as tabelas e cria uma operação de inserção
// para cada linha existente. A partir daí a sincronização normal leva
// tudo, sem nenhum caminho especial.
//
// Detalhe que evita estrago: o relógio de cada operação vem do
// `atualizado_em` da própria linha, não da hora atual. Se viesse de agora,
// a carga inicial do computador ficaria "mais recente" que edições
// legítimas feitas no celular e sobrescreveria todas elas. Usando a data
// real do registro, a ordem verdadeira é preservada.
// =====================================================================

const CHAVE_CARGA_FEITA = "carga-inicial-feita";

/** Ordem importa: tabelas referenciadas antes das que dependem delas. */
const ORDEM_CARGA = [
  "pessoas", "categorias", "contas", "cartoes", "veiculos", "imoveis",
  "investimentos", "documentos", "documento_versoes", "exercicios", "rotinas",
  "alimentos", "medidas_caseiras",
  "transacoes", "orcamentos", "movimentos_investimento", "dividas",
  "abastecimentos", "manutencoes", "modificacoes", "km_registros",
  "manutencoes_imovel", "registros_saude", "vacinas_aplicadas",
  "eventos", "tarefas", "subtarefas", "bens", "patrimonio_historico",
  "contatos", "opcoes_personalizadas", "recorrencias", "parcelamentos",
  "rotina_exercicios", "sessoes_treino", "series_treino", "medidas_corporais",
  "refeicoes", "refeicao_itens", "registros_agua",
];

export function cargaInicialFeita(): boolean {
  return lerEstado(CHAVE_CARGA_FEITA) === "1";
}

/** Quantos registros existem hoje sem nenhuma operação no log. */
export function contarRegistrosSemLog(): number {
  let total = 0;
  for (const tabela of ORDEM_CARGA) {
    if (!tabelaSincronizada(tabela)) continue;
    try {
      total += queryAll<{ t: number }>(
        `SELECT COUNT(*) as t FROM ${tabela} t
         WHERE NOT EXISTS (SELECT 1 FROM sync_oplog o WHERE o.tabela = ? AND o.registro_id = t.id)`,
        [tabela],
      )[0]?.t ?? 0;
    } catch {
      // Tabela ausente nesta versão do schema.
    }
  }
  return total;
}

/** Converte a data ISO da linha em milissegundos, com reserva segura. */
function relogioDaLinha(linha: Record<string, unknown>): number {
  const iso = (linha.atualizado_em ?? linha.criado_em) as string | undefined;
  const ms = iso ? Date.parse(iso) : NaN;
  // Sem data válida, usa um instante antigo: qualquer edição real feita
  // depois vence a carga inicial, que é exatamente o comportamento certo.
  return Number.isNaN(ms) ? 1 : ms;
}

export interface ResultadoCarga {
  tabelas: number;
  registros: number;
}

export async function semearLogInicial(): Promise<ResultadoCarga> {
  const origem = idAparelho();
  const agora = new Date().toISOString();
  const resultado: ResultadoCarga = { tabelas: 0, registros: 0 };

  for (const tabela of ORDEM_CARGA) {
    if (!tabelaSincronizada(tabela)) continue;

    let linhas: Array<Record<string, unknown>>;
    try {
      linhas = queryAll<Record<string, unknown>>(
        `SELECT * FROM ${tabela} t
         WHERE NOT EXISTS (SELECT 1 FROM sync_oplog o WHERE o.tabela = ? AND o.registro_id = t.id)`,
        [tabela],
      );
    } catch {
      continue;
    }

    if (linhas.length === 0) continue;
    resultado.tabelas += 1;

    let seq = 0;
    for (const linha of linhas) {
      const id = linha.id as string | undefined;
      if (!id) continue;
      await runAndPersist(
        `INSERT INTO sync_oplog (id, tabela, registro_id, operacao, dados, relogio, contador, origem, enviado, criado_em, atualizado_em)
         VALUES (?, ?, ?, 'inserir', ?, ?, ?, ?, 0, ?, ?)`,
        [
          crypto.randomUUID(), tabela, id, JSON.stringify(linha),
          relogioDaLinha(linha), seq++, origem, agora, agora,
        ],
      );
      resultado.registros += 1;
    }
  }

  await gravarEstado(CHAVE_CARGA_FEITA, "1");
  return resultado;
}
