import { queryAll, runAndPersist } from "../../database/db";
import { inserir, excluir } from "../../database/crud";
import type { Subtarefa } from "../../types/entities";

export function listarSubtarefas(tarefaId: string): Subtarefa[] {
  return queryAll<Subtarefa>("SELECT * FROM subtarefas WHERE tarefa_id = ? ORDER BY ordem ASC, criado_em ASC", [tarefaId]);
}

export function contarSubtarefas(tarefaId: string): { total: number; concluidas: number } {
  const rows = queryAll<{ total: number; concluidas: number }>(
    "SELECT COUNT(*) as total, COALESCE(SUM(concluida), 0) as concluidas FROM subtarefas WHERE tarefa_id = ?",
    [tarefaId],
  );
  return rows[0] ?? { total: 0, concluidas: 0 };
}

export async function criarSubtarefa(tarefaId: string, titulo: string): Promise<void> {
  const ordens = queryAll<{ max: number }>("SELECT COALESCE(MAX(ordem), -1) as max FROM subtarefas WHERE tarefa_id = ?", [tarefaId]);
  await inserir("subtarefas", { tarefa_id: tarefaId, titulo: titulo.trim(), ordem: (ordens[0]?.max ?? -1) + 1 });
}

export async function alternarSubtarefa(id: string, concluida: boolean): Promise<void> {
  await runAndPersist("UPDATE subtarefas SET concluida = ?, atualizado_em = ? WHERE id = ?", [
    concluida ? 1 : 0,
    new Date().toISOString(),
    id,
  ]);
}

export async function excluirSubtarefa(id: string): Promise<void> {
  await excluir("subtarefas", id);
}
