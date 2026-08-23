import { runAndPersist, queryAll } from "./db";
import { registrarOperacao } from "../core/sync/oplog";

// Camada única de escrita do app. Como TUDO passa por aqui, este é o lugar
// certo para o log de sincronização se pendurar — nenhuma tela precisa
// saber que a sincronia existe, e nenhuma escrita escapa do registro.

/** Insere um registro novo, preenchendo id/criado_em/atualizado_em automaticamente. */
export async function inserir(table: string, dados: Record<string, unknown>): Promise<string> {
  const id = crypto.randomUUID();
  const agora = new Date().toISOString();
  const campos: Record<string, unknown> = { id, ...dados, criado_em: agora, atualizado_em: agora };
  const colunas = Object.keys(campos);
  const placeholders = colunas.map(() => "?").join(", ");

  await runAndPersist(
    `INSERT INTO ${table} (${colunas.join(", ")}) VALUES (${placeholders})`,
    colunas.map((c) => campos[c] ?? null),
  );

  await registrarOperacao(table, id, "inserir", campos);
  return id;
}

/** Atualiza um registro existente, atualizando atualizado_em automaticamente. */
export async function atualizar(table: string, id: string, dados: Record<string, unknown>): Promise<void> {
  const campos: Record<string, unknown> = { ...dados, atualizado_em: new Date().toISOString() };
  const colunas = Object.keys(campos);
  const sets = colunas.map((c) => `${c} = ?`).join(", ");

  await runAndPersist(
    `UPDATE ${table} SET ${sets} WHERE id = ?`,
    [...colunas.map((c) => campos[c] ?? null), id],
  );

  // O log guarda a LINHA INTEIRA depois da mudança, não só os campos
  // alterados. Custa mais bytes e evita um problema real: se o outro
  // aparelho nunca viu esse registro (foi criado antes da sincronia ser
  // ligada), aplicar só o delta não teria onde encaixar. Com a linha
  // completa, a operação funciona como insere-ou-atualiza.
  const linha = queryAll<Record<string, unknown>>(`SELECT * FROM ${table} WHERE id = ?`, [id])[0];
  await registrarOperacao(table, id, "atualizar", linha ?? { id, ...campos });
}

export async function excluir(table: string, id: string): Promise<void> {
  await runAndPersist(`DELETE FROM ${table} WHERE id = ?`, [id]);
  // Exclusão precisa virar lápide: sem registro do apagamento, o outro
  // aparelho reenviaria o registro achando que é novidade e ele voltaria
  // do além na próxima sincronia.
  await registrarOperacao(table, id, "excluir", null);
}
