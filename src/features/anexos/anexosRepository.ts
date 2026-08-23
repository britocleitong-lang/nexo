import { queryAll, runAndPersist } from "../../database/db";

export const TAMANHO_MAXIMO_MB = 10;

export interface AnexoMeta {
  id: string;
  entidade_tipo: string;
  entidade_id: string;
  nome_arquivo: string;
  tipo_mime: string | null;
  tamanho: number | null;
  criado_em: string;
}

/** Lista só os metadados (sem o conteúdo binário) — rápido pra exibir listas. */
export function listarAnexos(entidadeTipo: string, entidadeId: string): AnexoMeta[] {
  return queryAll<AnexoMeta>(
    `SELECT id, entidade_tipo, entidade_id, nome_arquivo, tipo_mime, tamanho, criado_em
     FROM anexos WHERE entidade_tipo = ? AND entidade_id = ? ORDER BY criado_em DESC`,
    [entidadeTipo, entidadeId],
  );
}

export function contarAnexos(entidadeTipo: string, entidadeId: string): number {
  const rows = queryAll<{ total: number }>(
    "SELECT COUNT(*) as total FROM anexos WHERE entidade_tipo = ? AND entidade_id = ?",
    [entidadeTipo, entidadeId],
  );
  return rows[0]?.total ?? 0;
}

/** Lê o arquivo (metadados + bytes) só na hora de abrir/baixar. */
export function obterAnexoComDados(id: string): { nome_arquivo: string; tipo_mime: string | null; dados: Uint8Array } | null {
  const rows = queryAll<{ nome_arquivo: string; tipo_mime: string | null; dados: Uint8Array }>(
    "SELECT nome_arquivo, tipo_mime, dados FROM anexos WHERE id = ?",
    [id],
  );
  return rows[0] ?? null;
}

export async function anexarArquivo(entidadeTipo: string, entidadeId: string, arquivo: File): Promise<void> {
  if (arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
    throw new Error(`Arquivo muito grande — o limite é ${TAMANHO_MAXIMO_MB}MB.`);
  }
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const id = crypto.randomUUID();
  const agora = new Date().toISOString();
  await runAndPersist(
    `INSERT INTO anexos (id, entidade_tipo, entidade_id, nome_arquivo, tipo_mime, tamanho, dados, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, entidadeTipo, entidadeId, arquivo.name, arquivo.type || null, arquivo.size, dados, agora, agora],
  );
}

export async function excluirAnexo(id: string): Promise<void> {
  await runAndPersist("DELETE FROM anexos WHERE id = ?", [id]);
}

/** Abre o anexo numa nova aba (imagens exibem inline, PDFs abrem no visualizador do navegador). */
export function abrirAnexo(id: string): void {
  const anexo = obterAnexoComDados(id);
  if (!anexo) return;
  const blob = new Blob([anexo.dados as BlobPart], { type: anexo.tipo_mime || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Baixa o anexo como arquivo, preservando o nome original. */
export function baixarAnexo(id: string, nomeArquivo?: string): void {
  const anexo = obterAnexoComDados(id);
  if (!anexo) return;
  const blob = new Blob([anexo.dados as BlobPart], { type: anexo.tipo_mime || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo || anexo.nome_arquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
