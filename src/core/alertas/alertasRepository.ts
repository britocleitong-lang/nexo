import { queryAll, runAndPersist } from "../../database/db";
import { hoje, somarDias } from "../datas";

// Estado de dispensa dos alertas. Fica no banco (e não no localStorage) de
// propósito: "eu já resolvi isso" é informação do usuário, e vai junto no
// backup. Perder isso ao restaurar um .db faria todos os alertas voltarem.

export interface EstadoAlerta {
  chave: string;
  estado: "dispensado" | "adiado";
  adiado_ate: string | null;
}

export function estadoDosAlertas(): Map<string, EstadoAlerta> {
  const rows = queryAll<EstadoAlerta>("SELECT chave, estado, adiado_ate FROM alertas_estado");
  return new Map(rows.map((r) => [r.chave, r]));
}

async function gravar(chave: string, estado: "dispensado" | "adiado", adiadoAte: string | null): Promise<void> {
  const agora = new Date().toISOString();
  await runAndPersist(
    `INSERT INTO alertas_estado (chave, estado, adiado_ate, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(chave) DO UPDATE SET estado = excluded.estado,
       adiado_ate = excluded.adiado_ate, atualizado_em = excluded.atualizado_em`,
    [chave, estado, adiadoAte, agora, agora],
  );
}

/** "Já resolvi" — não volta mais nesse ciclo. */
export async function dispensarAlerta(chave: string): Promise<void> {
  await gravar(chave, "dispensado", null);
}

/** "Me lembra depois" — volta na data. */
export async function adiarAlerta(chave: string, dias = 7): Promise<void> {
  await gravar(chave, "adiado", somarDias(hoje(), dias));
}

export async function reativarAlerta(chave: string): Promise<void> {
  await runAndPersist("DELETE FROM alertas_estado WHERE chave = ?", [chave]);
}

export async function limparDispensados(): Promise<void> {
  await runAndPersist("DELETE FROM alertas_estado");
}

export function totalDispensados(): number {
  return queryAll<{ total: number }>("SELECT COUNT(*) as total FROM alertas_estado")[0]?.total ?? 0;
}

/**
 * Remove estados órfãos (o registro que originou o alerta foi excluído).
 * Sem isso a tabela cresce devagar e para sempre.
 */
export async function podarEstadosAntigos(): Promise<void> {
  const limite = somarDias(hoje(), -400);
  await runAndPersist("DELETE FROM alertas_estado WHERE substr(criado_em, 1, 10) < ?", [limite]);
}
