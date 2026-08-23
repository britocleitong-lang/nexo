import { queryAll } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import { encontrarOuCriarCategoria, criarTransacao } from "../financeiro/financeiroRepository";
import type { Imovel, ManutencaoImovel, TipoImovel } from "../../types/entities";

export const TIPOS_IMOVEL: Array<{ valor: TipoImovel; label: string }> = [
  { valor: "casa", label: "Casa" },
  { valor: "apartamento", label: "Apartamento" },
  { valor: "terreno", label: "Terreno" },
  { valor: "outro", label: "Outro" },
];

export function listarImoveis(): Imovel[] {
  return queryAll<Imovel>("SELECT * FROM imoveis ORDER BY apelido COLLATE NOCASE");
}

export function buscarImovel(id: string): Imovel | null {
  return queryAll<Imovel>("SELECT * FROM imoveis WHERE id = ?", [id])[0] ?? null;
}

export type ImovelInput = {
  apelido: string;
  tipo: TipoImovel;
  endereco?: string | null;
  area_m2?: number | null;
  valor_atual?: number | null;
  valor_compra?: number | null;
  data_compra?: string | null;
  pessoa_id?: string | null;
  observacoes?: string | null;
  foto_anexo_id?: string | null;
  foto_url?: string | null;
};

export async function criarImovel(input: ImovelInput): Promise<string> {
  return inserir("imoveis", input);
}

export async function atualizarImovel(id: string, input: Partial<ImovelInput>): Promise<void> {
  await atualizar("imoveis", id, input);
}

export async function excluirImovel(id: string): Promise<void> {
  await excluir("imoveis", id);
}

export function valorTotalImoveis(): number {
  const rows = queryAll<{ total: number }>("SELECT COALESCE(SUM(valor_atual), 0) as total FROM imoveis");
  return rows[0]?.total ?? 0;
}

// --- Manutenção do imóvel ---------------------------------------------------

export function listarManutencoesImovel(imovelId: string): ManutencaoImovel[] {
  return queryAll<ManutencaoImovel>("SELECT * FROM manutencoes_imovel WHERE imovel_id = ? ORDER BY data DESC", [imovelId]);
}

export type ManutencaoImovelInput = {
  imovel_id: string;
  tipo: string;
  data: string;
  valor?: number | null;
  prestador?: string | null;
  observacoes?: string | null;
  proxima_data?: string | null;
};

/** Registra a manutenção E, se houver valor, lança automaticamente no Financeiro. */
export async function criarManutencaoImovel(input: ManutencaoImovelInput): Promise<void> {
  await inserir("manutencoes_imovel", input);
  if (input.valor) {
    const categoriaId = await encontrarOuCriarCategoria("Manutenção da casa", "despesa");
    await criarTransacao({
      tipo: "despesa",
      descricao: `Manutenção da casa — ${input.tipo}`,
      valor: input.valor,
      data: input.data,
      categoria_id: categoriaId,
      natureza: "variavel",
    });
  }
}

export async function atualizarManutencaoImovel(id: string, input: Partial<ManutencaoImovelInput>): Promise<void> {
  await atualizar("manutencoes_imovel", id, input);
}

export async function excluirManutencaoImovel(id: string): Promise<void> {
  await excluir("manutencoes_imovel", id);
}

export function custoTotalImovel(imovelId: string): number {
  const rows = queryAll<{ total: number }>(
    "SELECT COALESCE(SUM(valor), 0) as total FROM manutencoes_imovel WHERE imovel_id = ?",
    [imovelId],
  );
  return rows[0]?.total ?? 0;
}

export function proximasManutencoesImovel(dias = 30): Array<ManutencaoImovel & { imovel_nome: string }> {
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);
  const limiteStr = limite.toISOString().slice(0, 10);
  return queryAll<ManutencaoImovel & { imovel_nome: string }>(
    `SELECT m.*, i.apelido as imovel_nome
     FROM manutencoes_imovel m JOIN imoveis i ON i.id = m.imovel_id
     WHERE m.proxima_data IS NOT NULL AND m.proxima_data <= ?
     ORDER BY m.proxima_data ASC`,
    [limiteStr],
  );
}


// =====================================================================
// Ciclo de vida do imóvel (v14)
// ---------------------------------------------------------------------
// Mesma regra dos veículos: vender inativa, nunca apaga. O imóvel vendido
// continua respondendo quanto custou de IPTU e reforma ao longo dos anos,
// e precisa aparecer na declaração do ano da venda com o valor recebido.
// =====================================================================

export function listarImoveisPorStatus(status?: "ativo" | "vendido"): Imovel[] {
  return status
    ? queryAll<Imovel>("SELECT * FROM imoveis WHERE COALESCE(status, 'ativo') = ? ORDER BY apelido", [status])
    : queryAll<Imovel>("SELECT * FROM imoveis ORDER BY COALESCE(status, 'ativo'), apelido");
}

export async function venderImovel(
  id: string,
  dados: { data_venda: string; valor_venda: number | null; lancarReceita?: boolean; conta_id?: string | null },
): Promise<void> {
  await atualizar("imoveis", id, {
    status: "vendido",
    data_venda: dados.data_venda,
    valor_venda: dados.valor_venda,
  });

  if (dados.lancarReceita && dados.valor_venda && dados.valor_venda > 0) {
    const imovel = buscarImovel(id);
    await inserir("transacoes", {
      tipo: "receita",
      descricao: `Venda do imóvel ${imovel?.apelido ?? ""}`.trim(),
      valor: dados.valor_venda,
      data: dados.data_venda,
      conta_id: dados.conta_id ?? null,
      recorrente: 0,
      pago: 1,
    });
  }
}

export async function reativarImovel(id: string): Promise<void> {
  await atualizar("imoveis", id, { status: "ativo", data_venda: null, valor_venda: null });
}
