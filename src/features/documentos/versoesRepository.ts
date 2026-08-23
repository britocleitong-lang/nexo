import { queryAll, runAndPersist } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import { diasRestantes } from "../../core/datas";
import { alertaDiasDoNome } from "./tiposDocumento";
import type { Documento, DocumentoVersao, MotivoVersao } from "../../types/entities";

// =====================================================================
// Versionamento de documentos
// ---------------------------------------------------------------------
// O problema que isto resolve: antes, renovar a CNH significava editar o
// registro existente. O número antigo, a validade antiga e a data em que
// aquilo foi emitido simplesmente sumiam — sobrescritos. E há situações
// reais em que a versão antiga importa: comprovar desde quando você é
// habilitado, achar o número de um RG antigo que ainda aparece em
// contrato assinado, provar que um certificado estava válido na data de
// um serviço prestado.
//
// O modelo: `documentos` guarda a IDENTIDADE (nome, pessoa, tipo) e
// `documento_versoes` guarda cada EMISSÃO. Uma versão é vigente; as
// outras ficam no histórico, intactas.
//
// Renovar nunca sobrescreve. Ele fecha a versão atual (carimbando
// `substituida_em`) e abre uma nova. Não existe caminho no código que
// apague uma versão anterior sem o usuário pedir explicitamente.
// =====================================================================

export const MOTIVOS: Array<{ valor: MotivoVersao; label: string; descricao: string }> = [
  { valor: "primeira", label: "Primeira emissão", descricao: "A versão original do documento" },
  { valor: "renovacao", label: "Renovação", descricao: "Venceu e foi renovado — número costuma mudar" },
  { valor: "segunda_via", label: "Segunda via", descricao: "Perda, roubo ou dano — mesmo documento, nova via" },
  { valor: "correcao", label: "Correção", descricao: "Erro de digitação ou dado desatualizado" },
];

export function labelMotivo(m: string | null): string {
  return MOTIVOS.find((x) => x.valor === m)?.label ?? "Versão";
}

export interface DocumentoComVersao extends Documento {
  vigente: DocumentoVersao | null;
  totalVersoes: number;
}

/** Versões de um documento, da mais recente para a mais antiga. */
export function versoesDo(documentoId: string): DocumentoVersao[] {
  return queryAll<DocumentoVersao>(
    "SELECT * FROM documento_versoes WHERE documento_id = ? ORDER BY versao DESC",
    [documentoId],
  );
}

export function versaoVigente(documentoId: string): DocumentoVersao | null {
  return queryAll<DocumentoVersao>(
    "SELECT * FROM documento_versoes WHERE documento_id = ? AND vigente = 1 LIMIT 1",
    [documentoId],
  )[0] ?? null;
}

/**
 * Lista os documentos já resolvidos com a versão vigente.
 *
 * A consulta lê os dados de `documento_versoes`, não das colunas antigas
 * de `documentos` — que continuam existindo apenas para não quebrar quem
 * ainda não migrou, e deixam de ser escritas a partir daqui.
 */
export function listarDocumentosComVersao(pessoaId?: string | null): DocumentoComVersao[] {
  const docs = pessoaId
    ? queryAll<Documento>("SELECT * FROM documentos WHERE pessoa_id = ? ORDER BY nome", [pessoaId])
    : queryAll<Documento>("SELECT * FROM documentos ORDER BY nome");

  return docs.map((d) => {
    const versoes = versoesDo(d.id);
    return {
      ...d,
      vigente: versoes.find((v) => v.vigente === 1) ?? versoes[0] ?? null,
      totalVersoes: versoes.length,
    };
  });
}

export type NovaVersaoInput = {
  numero?: string | null;
  orgao_emissor?: string | null;
  data_emissao?: string | null;
  data_validade?: string | null;
  observacoes?: string | null;
  motivo?: MotivoVersao;
};

/** Cria o documento e já abre a versão 1. Um sem o outro não faz sentido. */
export async function criarDocumento(
  dados: { nome: string; tipo: string; pessoa_id: string | null; alerta_dias?: number | null },
  versao: NovaVersaoInput = {},
): Promise<string> {
  const documentoId = await inserir("documentos", {
    ...dados,
    alerta_dias: dados.alerta_dias ?? alertaDiasDoNome(dados.nome),
    // As colunas antigas recebem uma cópia da versão vigente para que
    // consultas legadas (motor de alertas, busca global) continuem
    // funcionando sem serem reescritas de uma vez.
    numero: versao.numero ?? null,
    data_emissao: versao.data_emissao ?? null,
    data_validade: versao.data_validade ?? null,
    orgao_emissor: versao.orgao_emissor ?? null,
    observacoes: versao.observacoes ?? null,
  });

  await inserir("documento_versoes", {
    documento_id: documentoId,
    versao: 1,
    motivo: versao.motivo ?? "primeira",
    vigente: 1,
    numero: versao.numero ?? null,
    orgao_emissor: versao.orgao_emissor ?? null,
    data_emissao: versao.data_emissao ?? null,
    data_validade: versao.data_validade ?? null,
    observacoes: versao.observacoes ?? null,
  });

  return documentoId;
}

/**
 * Abre uma nova versão vigente e aposenta a anterior.
 *
 * A ordem das operações importa: o índice único garante que só existe uma
 * versão vigente por documento, então a anterior precisa ser rebaixada
 * ANTES da nova ser inserida. Invertido, o INSERT falharia.
 */
export async function novaVersao(documentoId: string, dados: NovaVersaoInput): Promise<string> {
  const versoes = versoesDo(documentoId);
  const atualVigente = versoes.find((v) => v.vigente === 1);
  const proximoNumero = (versoes[0]?.versao ?? 0) + 1;

  if (atualVigente) {
    await runAndPersist(
      "UPDATE documento_versoes SET vigente = 0, substituida_em = ?, atualizado_em = ? WHERE id = ?",
      [new Date().toISOString(), new Date().toISOString(), atualVigente.id],
    );
  }

  const versaoId = await inserir("documento_versoes", {
    documento_id: documentoId,
    versao: proximoNumero,
    motivo: dados.motivo ?? "renovacao",
    vigente: 1,
    numero: dados.numero ?? null,
    orgao_emissor: dados.orgao_emissor ?? null,
    data_emissao: dados.data_emissao ?? null,
    data_validade: dados.data_validade ?? null,
    observacoes: dados.observacoes ?? null,
  });

  await atualizar("documentos", documentoId, {
    numero: dados.numero ?? null,
    orgao_emissor: dados.orgao_emissor ?? null,
    data_emissao: dados.data_emissao ?? null,
    data_validade: dados.data_validade ?? null,
    observacoes: dados.observacoes ?? null,
  });

  return versaoId;
}

/** Corrige uma versão existente sem criar outra — para erro de digitação. */
export async function corrigirVersao(versaoId: string, dados: NovaVersaoInput): Promise<void> {
  await atualizar("documento_versoes", versaoId, dados);
  const versao = queryAll<DocumentoVersao>("SELECT * FROM documento_versoes WHERE id = ?", [versaoId])[0];
  if (versao?.vigente === 1) {
    await atualizar("documentos", versao.documento_id, {
      numero: dados.numero ?? versao.numero,
      orgao_emissor: dados.orgao_emissor ?? versao.orgao_emissor,
      data_emissao: dados.data_emissao ?? versao.data_emissao,
      data_validade: dados.data_validade ?? versao.data_validade,
    });
  }
}

/**
 * Volta uma versão antiga a ser a vigente. Útil quando a renovação foi
 * lançada por engano — desfaz sem perder nenhuma das duas.
 */
export async function tornarVigente(versaoId: string): Promise<void> {
  const versao = queryAll<DocumentoVersao>("SELECT * FROM documento_versoes WHERE id = ?", [versaoId])[0];
  if (!versao) return;
  const agora = new Date().toISOString();
  await runAndPersist(
    "UPDATE documento_versoes SET vigente = 0, substituida_em = ?, atualizado_em = ? WHERE documento_id = ? AND vigente = 1",
    [agora, agora, versao.documento_id],
  );
  await runAndPersist(
    "UPDATE documento_versoes SET vigente = 1, substituida_em = NULL, atualizado_em = ? WHERE id = ?",
    [agora, versaoId],
  );
  await atualizar("documentos", versao.documento_id, {
    numero: versao.numero,
    orgao_emissor: versao.orgao_emissor,
    data_emissao: versao.data_emissao,
    data_validade: versao.data_validade,
  });
}

/** Exclui uma versão do histórico. Bloqueia a última que sobrou. */
export async function excluirVersao(versaoId: string): Promise<{ ok: boolean; motivo?: string }> {
  const versao = queryAll<DocumentoVersao>("SELECT * FROM documento_versoes WHERE id = ?", [versaoId])[0];
  if (!versao) return { ok: false, motivo: "Versão não encontrada." };

  const total = versoesDo(versao.documento_id).length;
  if (total <= 1) {
    return { ok: false, motivo: "Esta é a única versão. Para remover tudo, exclua o documento inteiro." };
  }
  if (versao.vigente === 1) {
    return { ok: false, motivo: "Esta é a versão vigente. Torne outra vigente antes de excluí-la." };
  }
  await excluir("documento_versoes", versaoId);
  return { ok: true };
}

export async function excluirDocumento(documentoId: string): Promise<void> {
  // O ON DELETE CASCADE do schema já leva as versões junto.
  await excluir("documentos", documentoId);
}

export async function renomearDocumento(documentoId: string, dados: { nome?: string; tipo?: string; pessoa_id?: string | null; alerta_dias?: number | null }): Promise<void> {
  await atualizar("documentos", documentoId, dados);
}

// --- Situação --------------------------------------------------------------

export type SituacaoDocumento = "vencido" | "vencendo" | "valido" | "sem_validade";

export function situacaoDo(doc: DocumentoComVersao): { situacao: SituacaoDocumento; dias: number | null } {
  const validade = doc.vigente?.data_validade;
  if (!validade) return { situacao: "sem_validade", dias: null };
  const dias = diasRestantes(validade);
  if (dias === null) return { situacao: "sem_validade", dias: null };
  if (dias < 0) return { situacao: "vencido", dias };
  const janela = doc.alerta_dias ?? alertaDiasDoNome(doc.nome);
  return { situacao: dias <= janela ? "vencendo" : "valido", dias };
}

export const LABEL_SITUACAO_DOC: Record<SituacaoDocumento, string> = {
  vencido: "Vencido",
  vencendo: "Renovar",
  valido: "Em dia",
  sem_validade: "Sem validade",
};
