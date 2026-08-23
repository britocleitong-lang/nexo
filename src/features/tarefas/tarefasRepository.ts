import { queryAll } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import type { Tarefa, StatusTarefa, PrioridadeTarefa } from "../../types/entities";

export const RECORRENCIAS_TAREFA: Array<{ valor: string; label: string }> = [
  { valor: "diaria", label: "Diariamente" },
  { valor: "semanal", label: "Semanalmente" },
  { valor: "mensal", label: "Mensalmente" },
  { valor: "anual", label: "Anualmente" },
];

export function listarTarefas(): Tarefa[] {
  return queryAll<Tarefa>(
    `SELECT * FROM tarefas ORDER BY
       CASE status WHEN 'pendente' THEN 0 WHEN 'andamento' THEN 1 ELSE 2 END,
       CASE prioridade WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END,
       (prazo IS NULL), prazo ASC`,
  );
}

export type TarefaInput = {
  titulo: string;
  prioridade: PrioridadeTarefa;
  prazo?: string | null;
  pessoa_id?: string | null;
  recorrencia?: string | null;
  observacoes?: string | null;
};

export async function criarTarefa(input: TarefaInput): Promise<void> {
  await inserir("tarefas", { ...input, status: "pendente" as StatusTarefa });
}

function proximoPrazo(prazoAtual: string, recorrencia: string): string {
  const d = new Date(prazoAtual + "T00:00:00");
  if (recorrencia === "diaria") d.setDate(d.getDate() + 1);
  else if (recorrencia === "semanal") d.setDate(d.getDate() + 7);
  else if (recorrencia === "mensal") d.setMonth(d.getMonth() + 1);
  else if (recorrencia === "anual") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Muda o status; se a tarefa for recorrente e estiver sendo concluída,
 * cria automaticamente a próxima ocorrência com o prazo ajustado.
 */
export async function mudarStatusTarefa(id: string, status: StatusTarefa): Promise<void> {
  await atualizar("tarefas", id, { status });

  if (status === "concluida") {
    const tarefa = queryAll<Tarefa>("SELECT * FROM tarefas WHERE id = ?", [id])[0];
    if (tarefa?.recorrencia && tarefa.prazo) {
      await criarTarefa({
        titulo: tarefa.titulo,
        prioridade: tarefa.prioridade,
        prazo: proximoPrazo(tarefa.prazo, tarefa.recorrencia),
        pessoa_id: tarefa.pessoa_id,
        recorrencia: tarefa.recorrencia,
        observacoes: tarefa.observacoes,
      });
    }
  }
}

export async function atualizarTarefa(id: string, input: Partial<TarefaInput>): Promise<void> {
  await atualizar("tarefas", id, input);
}

export async function excluirTarefa(id: string): Promise<void> {
  await excluir("tarefas", id);
}

export function tarefasPendentesCount(): number {
  return queryAll<{ total: number }>("SELECT COUNT(*) as total FROM tarefas WHERE status != 'concluida'")[0]?.total ?? 0;
}
