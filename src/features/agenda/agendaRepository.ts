import { queryAll } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import type { Evento } from "../../types/entities";

export const RECORRENCIAS_EVENTO: Array<{ valor: string; label: string }> = [
  { valor: "diaria", label: "Diariamente" },
  { valor: "semanal", label: "Semanalmente" },
  { valor: "mensal", label: "Mensalmente" },
  { valor: "anual", label: "Anualmente" },
];

export function listarEventos(): Evento[] {
  return queryAll<Evento>("SELECT * FROM eventos ORDER BY data_hora ASC");
}

export type EventoInput = {
  titulo: string;
  tipo: string;
  data_hora: string;
  pessoa_id?: string | null;
  veiculo_id?: string | null;
  observacoes?: string | null;
  recorrencia?: string | null;
};

export async function criarEvento(input: EventoInput): Promise<void> {
  await inserir("eventos", { ...input, concluido: 0 });
}

function proximaDataHora(atual: string, recorrencia: string): string {
  const d = new Date(atual);
  if (recorrencia === "diaria") d.setDate(d.getDate() + 1);
  else if (recorrencia === "semanal") d.setDate(d.getDate() + 7);
  else if (recorrencia === "mensal") d.setMonth(d.getMonth() + 1);
  else if (recorrencia === "anual") d.setFullYear(d.getFullYear() + 1);
  // preserva o formato "YYYY-MM-DDTHH:mm" esperado pelo <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Marca concluído; se o evento for recorrente, cria automaticamente a
 * próxima ocorrência na data/hora seguinte.
 */
export async function marcarConcluido(id: string, concluido: boolean): Promise<void> {
  await atualizar("eventos", id, { concluido: concluido ? 1 : 0 });

  if (concluido) {
    const evento = queryAll<Evento>("SELECT * FROM eventos WHERE id = ?", [id])[0];
    if (evento?.recorrencia) {
      await criarEvento({
        titulo: evento.titulo,
        tipo: evento.tipo,
        data_hora: proximaDataHora(evento.data_hora, evento.recorrencia),
        pessoa_id: evento.pessoa_id,
        veiculo_id: evento.veiculo_id,
        observacoes: evento.observacoes,
        recorrencia: evento.recorrencia,
      });
    }
  }
}

export async function atualizarEvento(id: string, input: Partial<EventoInput>): Promise<void> {
  await atualizar("eventos", id, input);
}

export async function excluirEvento(id: string): Promise<void> {
  await excluir("eventos", id);
}

export function proximosEventos(dias = 30): Evento[] {
  const agora = new Date().toISOString();
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);
  return queryAll<Evento>(
    "SELECT * FROM eventos WHERE concluido = 0 AND data_hora >= ? AND data_hora <= ? ORDER BY data_hora ASC",
    [agora.slice(0, 10), limite.toISOString().slice(0, 10)],
  );
}
