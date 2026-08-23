import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
// Import nativo do Vite: resolve a URL do binário .wasm como asset
// versionado, com o Content-Type correto tanto em dev quanto no build.
// Evita depender de uma cópia manual em public/ (que fica sujeita a
// cache antigo do navegador servindo HTML no lugar do binário).
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { SCHEMA_SQL, CATEGORIAS_PADRAO, OPCOES_PADRAO } from "./schema";
import { loadLatestBytes, cacheToOPFS } from "./persistence";

// sql.js roda o SQLite inteiro compilado pra WebAssembly, dentro do navegador.
// O banco inteiro vive em memória (um array de bytes) enquanto o app está
// aberto. Isso é rápido, mas significa que QUALQUER escrita precisa ser
// espelhada pra um armazenamento persistente — é isso que persistence.ts faz.

let sqlModule: SqlJsStatic | null = null;
let db: Database | null = null;

async function getSqlModule(): Promise<SqlJsStatic> {
  if (!sqlModule) {
    sqlModule = await initSqlJs({
      locateFile: () => sqlWasmUrl,
    });
  }
  return sqlModule;
}

/**
 * Inicializa o banco: tenta carregar bytes de uma cópia anterior
 * (cache OPFS ou arquivo escolhido pelo usuário); se não existir
 * nenhuma, cria um banco novo e aplica o schema.
 */
export async function initDatabase(): Promise<Database> {
  if (db) return db;

  const SQL = await getSqlModule();
  const existingBytes = await loadLatestBytes();

  db = existingBytes ? new SQL.Database(existingBytes) : new SQL.Database();
  db.run(SCHEMA_SQL);
  migrarColunas(db, "veiculos", {
    cor: "TEXT",
    foto_url: "TEXT",
    fipe_marca_codigo: "TEXT",
    fipe_modelo_codigo: "TEXT",
    fipe_ano_codigo: "TEXT",
    fipe_atualizado_em: "TEXT",
  });
  migrarColunas(db, "registros_saude", {
    valor_numerico: "REAL",
    unidade: "TEXT",
    dose: "TEXT",
    frequencia: "TEXT",
  });
  migrarColunas(db, "pessoas", {
    principal: "INTEGER",
    foto: "TEXT",
    email: "TEXT",
    telefone: "TEXT",
    profissao: "TEXT",
  });
  migrarColunas(db, "eventos", { recorrencia: "TEXT" });
  migrarColunas(db, "tarefas", { recorrencia: "TEXT" });
  migrarColunas(db, "transacoes", { investimento_id: "TEXT", natureza: "TEXT" });
  migrarColunas(db, "movimentos_investimento", { conta_id: "TEXT", transacao_id: "TEXT" });

  // --- v12 -----------------------------------------------------------------
  // `pago` entra com DEFAULT 1 de propósito: todo lançamento que já existe no
  // banco de quem está atualizando é, por definição, um fato consumado. Só os
  // lançamentos novos (parcelas futuras, recorrências projetadas, contas a
  // pagar) nascem com pago = 0. Assim o saldo de conta não muda de valor
  // depois da atualização.
  migrarColunas(db, "transacoes", {
    pago: "INTEGER NOT NULL DEFAULT 1",
    data_vencimento: "TEXT",
    recorrencia_id: "TEXT",
    parcelamento_id: "TEXT",
    parcela_numero: "INTEGER",
    parcelas_totais: "INTEGER",
    fitid: "TEXT",
    importado_em: "TEXT",
  });
  migrarColunas(db, "documentos", { alerta_dias: "INTEGER" });
  migrarColunas(db, "manutencoes", { intervalo_km: "REAL", intervalo_meses: "INTEGER" });
  migrarColunas(db, "veiculos", { consumo_referencia: "REAL" });
  // --- v14 -----------------------------------------------------------------
  // Veículo e imóvel ganham ciclo de vida. Vender não pode ser sinônimo de
  // excluir: o carro vendido continua no histórico de gastos, no IR do ano
  // em que foi vendido, e na conta de quanto ele custou no total.
  migrarColunas(db, "veiculos", {
    status: "TEXT NOT NULL DEFAULT 'ativo'",   // ativo | vendido
    data_venda: "TEXT",
    valor_venda: "REAL",
    foto_anexo_id: "TEXT",
    valor_revenda: "REAL",
    valor_revenda_atualizado_em: "TEXT",
  });
  migrarColunas(db, "imoveis", {
    status: "TEXT NOT NULL DEFAULT 'ativo'",
    data_venda: "TEXT",
    valor_venda: "REAL",
    foto_anexo_id: "TEXT",
    foto_url: "TEXT",
  });
  migrarVersoesDocumentos(db);
  criarIndicesTardios(db);
  seedCategoriasPadrao(db);
  seedOpcoesPadrao(db);

  // Garante que sempre exista uma cópia em cache local logo após abrir
  await persistNow();

  return db;
}

/** Na primeira execução, popula a lista de categorias padrão de receita/despesa. */
function seedCategoriasPadrao(database: Database): void {
  const [result] = database.exec("SELECT COUNT(*) as total FROM categorias");
  const total = (result?.values?.[0]?.[0] as number) ?? 0;
  if (total > 0) return;

  for (const categoria of CATEGORIAS_PADRAO) {
    database.run("INSERT INTO categorias (id, nome, tipo) VALUES (?, ?, ?)", [
      crypto.randomUUID(),
      categoria.nome,
      categoria.tipo,
    ]);
  }
}

/** Na primeira execução (por grupo), popula as listas personalizáveis com os valores padrão. */
function seedOpcoesPadrao(database: Database): void {
  for (const [grupo, valores] of Object.entries(OPCOES_PADRAO)) {
    const stmt = database.prepare("SELECT COUNT(*) as total FROM opcoes_personalizadas WHERE grupo = ?");
    stmt.bind([grupo]);
    stmt.step();
    const total = stmt.getAsObject().total as number;
    stmt.free();
    if (total > 0) continue;

    const agora = new Date().toISOString();
    for (const valor of valores) {
      database.run("INSERT INTO opcoes_personalizadas (id, grupo, valor, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?)", [
        crypto.randomUUID(),
        grupo,
        valor,
        agora,
        agora,
      ]);
    }
  }
}

/**
 * CREATE TABLE IF NOT EXISTS não adiciona colunas em tabelas que já existem.
 * Para quem já tinha dados cadastrados antes de uma coluna nova ser criada,
 * checamos e adicionamos manualmente as colunas que faltarem.
 */
/**
 * Índices que dependem de colunas adicionadas por migração. Não podem morar
 * no SCHEMA_SQL porque ele roda ANTES do ALTER TABLE — num banco antigo a
 * coluna ainda não existe naquele momento e o CREATE INDEX falharia.
 */
/**
 * Move o conteúdo atual de cada documento para uma versão 1 vigente.
 *
 * Sem isso, quem já tinha 30 documentos cadastrados abriria a tela nova e
 * veria todos vazios — os dados estariam lá, mas na tabela antiga, e a
 * interface passaria a ler da nova. Roda uma vez só: documentos que já têm
 * versão são ignorados.
 */
function migrarVersoesDocumentos(database: Database): void {
  const pendentes = database.exec(
    `SELECT d.id, d.numero, d.orgao_emissor, d.data_emissao, d.data_validade, d.observacoes
     FROM documentos d
     WHERE NOT EXISTS (SELECT 1 FROM documento_versoes v WHERE v.documento_id = d.id)`,
  );
  if (pendentes.length === 0) return;
  const agora = new Date().toISOString();
  for (const linha of pendentes[0].values) {
    database.run(
      `INSERT INTO documento_versoes
         (id, documento_id, versao, numero, orgao_emissor, data_emissao, data_validade,
          observacoes, motivo, vigente, criado_em, atualizado_em)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?, 'primeira', 1, ?, ?)`,
      [crypto.randomUUID(), linha[0], linha[1], linha[2], linha[3], linha[4], linha[5], agora, agora],
    );
  }
}

function criarIndicesTardios(database: Database): void {
  database.run(`
    CREATE INDEX IF NOT EXISTS idx_transacoes_pago ON transacoes(pago, data_vencimento);
    CREATE INDEX IF NOT EXISTS idx_transacoes_recorrencia ON transacoes(recorrencia_id);
    CREATE INDEX IF NOT EXISTS idx_transacoes_parcelamento ON transacoes(parcelamento_id);
    CREATE INDEX IF NOT EXISTS idx_transacoes_fitid ON transacoes(fitid);
  `);
}

function migrarColunas(database: Database, tabela: string, colunasNovas: Record<string, string>): void {
  const colunasExistentes = new Set(
    database.exec(`PRAGMA table_info(${tabela})`)[0]?.values.map((v) => v[1] as string) ?? [],
  );
  for (const [coluna, tipo] of Object.entries(colunasNovas)) {
    if (!colunasExistentes.has(coluna)) {
      database.run(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`);
    }
  }
}

export function getDb(): Database {
  if (!db) {
    throw new Error("Banco ainda não foi inicializado — chame initDatabase() primeiro.");
  }
  return db;
}

/** Serializa o estado atual do banco e grava no cache OPFS (rápido, local). */
export async function persistNow(): Promise<void> {
  if (!db) return;
  const bytes = db.export();
  await cacheToOPFS(bytes);
}

/** Deve ser chamado depois de qualquer INSERT/UPDATE/DELETE. */
export async function runAndPersist(sql: string, params: unknown[] = []): Promise<void> {
  const database = getDb();
  database.run(sql, params as never);
  await persistNow();
}

export function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const database = getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params as never);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}
