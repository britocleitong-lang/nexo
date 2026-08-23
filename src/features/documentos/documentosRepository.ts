import { queryAll } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import type { Documento } from "../../types/entities";

export function listarDocumentos(): Documento[] {
  return queryAll<Documento>(
    "SELECT * FROM documentos ORDER BY (data_validade IS NULL), data_validade ASC, nome COLLATE NOCASE",
  );
}

export type DocumentoInput = {
  nome: string;
  categoria: string;
  pessoa_id?: string | null;
  data_emissao?: string | null;
  data_validade?: string | null;
  numero?: string | null;
  orgao_emissor?: string | null;
  observacoes?: string | null;
};

export async function criarDocumento(input: DocumentoInput): Promise<void> {
  await inserir("documentos", { ...input, pessoa_id: input.pessoa_id || null });
}

export async function atualizarDocumento(id: string, input: Partial<DocumentoInput>): Promise<void> {
  await atualizar("documentos", id, input);
}

export async function excluirDocumento(id: string): Promise<void> {
  await excluir("documentos", id);
}

/** Documentos vencendo nos próximos `dias` dias (ou já vencidos). */
export function documentosProximosVencimento(dias = 90): Documento[] {
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);
  const limiteStr = limite.toISOString().slice(0, 10);
  return queryAll<Documento>(
    "SELECT * FROM documentos WHERE data_validade IS NOT NULL AND data_validade <= ? ORDER BY data_validade ASC",
    [limiteStr],
  );
}
