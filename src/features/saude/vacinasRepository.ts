import { queryAll } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import { conferirEsquema, resumirEsquema, buscarVacina, type ItemConferencia, type ResumoEsquema } from "./esquemaVacinal";
import type { VacinaAplicada, Pessoa } from "../../types/entities";

export function listarVacinasAplicadas(pessoaId: string): VacinaAplicada[] {
  return queryAll<VacinaAplicada>(
    "SELECT * FROM vacinas_aplicadas WHERE pessoa_id = ? ORDER BY data DESC",
    [pessoaId],
  );
}

export type VacinaAplicadaInput = {
  pessoa_id: string;
  vacina_chave: string;
  dose_chave: string;
  data: string;
  lote?: string | null;
  local?: string | null;
  observacoes?: string | null;
};

/**
 * Registra a dose e, para vacinas de reforço periódico (dT a cada 10 anos,
 * gripe todo ano), já cria o registro de saúde com `proxima_data` — que é
 * o campo que o motor de alertas lê. Sem isso, o reforço de 10 anos seria
 * exatamente o tipo de coisa que ninguém lembra.
 */
export async function registrarDose(input: VacinaAplicadaInput): Promise<string> {
  const id = await inserir("vacinas_aplicadas", input);

  const vacina = buscarVacina(input.vacina_chave);
  if (vacina) {
    const proximaData = vacina.reforcoAnos
      ? `${Number(input.data.slice(0, 4)) + vacina.reforcoAnos}${input.data.slice(4, 10)}`
      : null;
    await inserir("registros_saude", {
      tipo: "vacina",
      nome: vacina.nome,
      pessoa_id: input.pessoa_id,
      data: input.data,
      local: input.local ?? null,
      dose: vacina.doses.find((d) => d.chave === input.dose_chave)?.rotulo ?? input.dose_chave,
      proxima_data: proximaData,
      observacoes: input.lote ? `Lote ${input.lote}` : input.observacoes ?? null,
    });
  }

  return id;
}

export async function atualizarDose(id: string, input: Partial<VacinaAplicadaInput>): Promise<void> {
  await atualizar("vacinas_aplicadas", id, input);
}

export async function excluirDose(id: string): Promise<void> {
  await excluir("vacinas_aplicadas", id);
}

/** Mapa "vacina:dose" → data, alimentando a conferência. */
export function dosesAplicadasMap(pessoaId: string): Map<string, string> {
  const rows = listarVacinasAplicadas(pessoaId);
  return new Map(rows.map((r) => [`${r.vacina_chave}:${r.dose_chave}`, r.data]));
}

export interface CarteiraVacinal {
  pessoa: Pessoa;
  itens: ItemConferencia[];
  resumo: ResumoEsquema;
}

export function montarCarteira(pessoaId: string): CarteiraVacinal | null {
  const pessoa = queryAll<Pessoa>("SELECT * FROM pessoas WHERE id = ?", [pessoaId])[0];
  if (!pessoa) return null;
  const itens = conferirEsquema(pessoa.data_nascimento, dosesAplicadasMap(pessoaId));
  return { pessoa, itens, resumo: resumirEsquema(itens) };
}

/** Carteira de todo mundo da família — a visão que responde "falta algo em casa?". */
export function carteirasDaFamilia(): CarteiraVacinal[] {
  const pessoas = queryAll<Pessoa>("SELECT * FROM pessoas ORDER BY principal DESC, nome");
  return pessoas
    .map((p) => montarCarteira(p.id))
    .filter((c): c is CarteiraVacinal => c !== null);
}

/** Doses em atraso de toda a família — entra na lista de alertas. */
export function dosesEmAtraso(): Array<{ pessoa: Pessoa; item: ItemConferencia }> {
  const resultado: Array<{ pessoa: Pessoa; item: ItemConferencia }> = [];
  for (const carteira of carteirasDaFamilia()) {
    for (const item of carteira.itens) {
      if (item.situacao === "atrasada") resultado.push({ pessoa: carteira.pessoa, item });
    }
  }
  return resultado;
}
