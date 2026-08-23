import { queryAll, runAndPersist } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import type { RegraCategorizacao, ModoRegra, NaturezaTransacao } from "../../types/entities";

// =====================================================================
// Regras de categorização automática
// ---------------------------------------------------------------------
// Existem por causa da importação de extrato: um OFX traz 80 linhas com
// descrições como "PIX ENVIADO 12/08 MERC SAO JOAO" e categorizar isso na
// mão é o que faz a pessoa desistir de conciliar.
//
// A regra é intencionalmente burra e previsível — texto contido na
// descrição, prioridade explícita, primeira que casar ganha. Nada de
// aprendizado estatístico opaco: se a categoria saiu errada, dá pra
// apontar exatamente qual regra fez isso e corrigir.
// =====================================================================

export const MODOS_REGRA: Array<{ valor: ModoRegra; label: string }> = [
  { valor: "contem", label: "Contém o texto" },
  { valor: "comeca", label: "Começa com" },
  { valor: "igual", label: "É exatamente" },
  { valor: "regex", label: "Expressão regular" },
];

export type RegraInput = {
  padrao: string;
  modo?: ModoRegra;
  categoria_id?: string | null;
  natureza?: NaturezaTransacao | null;
  pessoa_id?: string | null;
  veiculo_id?: string | null;
  prioridade?: number;
};

export function listarRegras(incluirInativas = false): RegraCategorizacao[] {
  const sql = incluirInativas
    ? "SELECT * FROM regras_categorizacao ORDER BY ativa DESC, prioridade DESC, vezes_aplicada DESC"
    : "SELECT * FROM regras_categorizacao WHERE ativa = 1 ORDER BY prioridade DESC, vezes_aplicada DESC";
  return queryAll<RegraCategorizacao>(sql);
}

export function listarRegrasComCategoria(): Array<RegraCategorizacao & { categoria_nome: string | null }> {
  return queryAll<RegraCategorizacao & { categoria_nome: string | null }>(
    `SELECT r.*, c.nome as categoria_nome FROM regras_categorizacao r
     LEFT JOIN categorias c ON c.id = r.categoria_id
     ORDER BY r.ativa DESC, r.prioridade DESC, r.vezes_aplicada DESC`,
  );
}

export async function criarRegra(input: RegraInput): Promise<string> {
  return inserir("regras_categorizacao", {
    ...input,
    modo: input.modo ?? "contem",
    prioridade: input.prioridade ?? 0,
    vezes_aplicada: 0,
    ativa: 1,
  });
}

export async function atualizarRegra(id: string, input: Partial<RegraInput> & { ativa?: number }): Promise<void> {
  await atualizar("regras_categorizacao", id, input);
}

export async function excluirRegra(id: string): Promise<void> {
  await excluir("regras_categorizacao", id);
}

/** Normaliza pra comparação: minúsculas, sem acento, espaços colapsados. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function casa(descricao: string, regra: RegraCategorizacao): boolean {
  const alvo = normalizar(descricao);
  const padrao = normalizar(regra.padrao);
  switch (regra.modo) {
    case "comeca": return alvo.startsWith(padrao);
    case "igual": return alvo === padrao;
    case "regex":
      try {
        return new RegExp(regra.padrao, "i").test(descricao);
      } catch {
        // Regex inválida não pode derrubar a importação inteira.
        return false;
      }
    case "contem":
    default: return alvo.includes(padrao);
  }
}

export interface Classificacao {
  categoria_id: string | null;
  natureza: NaturezaTransacao | null;
  pessoa_id: string | null;
  veiculo_id: string | null;
  regra_id: string;
  regra_padrao: string;
}

/** Primeira regra que casar com a descrição, na ordem de prioridade. */
export function classificar(descricao: string, regras = listarRegras()): Classificacao | null {
  for (const r of regras) {
    if (!casa(descricao, r)) continue;
    return {
      categoria_id: r.categoria_id,
      natureza: r.natureza,
      pessoa_id: r.pessoa_id,
      veiculo_id: r.veiculo_id,
      regra_id: r.id,
      regra_padrao: r.padrao,
    };
  }
  return null;
}

/** Contabiliza o uso — permite ordenar as regras pelas que realmente pegam. */
export async function contabilizarUso(regraIds: string[]): Promise<void> {
  const contagem = new Map<string, number>();
  for (const id of regraIds) contagem.set(id, (contagem.get(id) ?? 0) + 1);
  for (const [id, n] of contagem) {
    await runAndPersist("UPDATE regras_categorizacao SET vezes_aplicada = vezes_aplicada + ? WHERE id = ?", [n, id]);
  }
}

// --- Aprendizado a partir do histórico -------------------------------------

export interface SugestaoRegra {
  padrao: string;
  categoria_id: string;
  categoria_nome: string;
  ocorrencias: number;
}

/**
 * Olha o que já foi categorizado à mão e propõe regras.
 *
 * A heurística: pega a primeira palavra significativa da descrição (>= 4
 * letras, ignorando termos genéricos de extrato como "pix" e "compra") e,
 * se todas as vezes que ela apareceu a categoria foi a mesma, isso é um
 * padrão confiável. Exigir 3 ocorrências evita transformar uma coincidência
 * em regra.
 */
const PALAVRAS_GENERICAS = new Set([
  "pix", "compra", "pagamento", "pago", "debito", "credito", "transferencia",
  "enviado", "recebido", "parcela", "boleto", "saque", "deposito", "taxa",
  "tarifa", "cartao", "conta", "para", "dia", "mes", "valor", "ref",
]);

function palavraChave(descricao: string): string | null {
  const palavras = normalizar(descricao).split(/[^a-z0-9]+/).filter(Boolean);
  for (const p of palavras) {
    if (p.length >= 4 && !PALAVRAS_GENERICAS.has(p) && !/^\d+$/.test(p)) return p;
  }
  return null;
}

export function sugerirRegras(minimoOcorrencias = 3): SugestaoRegra[] {
  const rows = queryAll<{ descricao: string; categoria_id: string; categoria_nome: string }>(
    `SELECT t.descricao, t.categoria_id, c.nome as categoria_nome
     FROM transacoes t JOIN categorias c ON c.id = t.categoria_id
     WHERE t.tipo = 'despesa' AND t.categoria_id IS NOT NULL
     ORDER BY t.data DESC LIMIT 800`,
  );

  const mapa = new Map<string, { categorias: Map<string, { nome: string; n: number }>; total: number }>();
  for (const r of rows) {
    const chave = palavraChave(r.descricao);
    if (!chave) continue;
    if (!mapa.has(chave)) mapa.set(chave, { categorias: new Map(), total: 0 });
    const entrada = mapa.get(chave)!;
    entrada.total += 1;
    const atual = entrada.categorias.get(r.categoria_id) ?? { nome: r.categoria_nome, n: 0 };
    atual.n += 1;
    entrada.categorias.set(r.categoria_id, atual);
  }

  const existentes = new Set(listarRegras(true).map((r) => normalizar(r.padrao)));
  const sugestoes: SugestaoRegra[] = [];

  for (const [chave, entrada] of mapa) {
    if (entrada.total < minimoOcorrencias) continue;
    if (existentes.has(chave)) continue;
    // Só sugere se a categoria foi consistente em pelo menos 80% das vezes.
    const [catId, dados] = [...entrada.categorias.entries()].sort((a, b) => b[1].n - a[1].n)[0];
    if (dados.n / entrada.total < 0.8) continue;
    sugestoes.push({ padrao: chave, categoria_id: catId, categoria_nome: dados.nome, ocorrencias: dados.n });
  }

  return sugestoes.sort((a, b) => b.ocorrencias - a.ocorrencias).slice(0, 20);
}

/** Aplica as regras nos lançamentos que estão sem categoria. */
export async function aplicarRegrasEmPendentes(): Promise<number> {
  const semCategoria = queryAll<{ id: string; descricao: string }>(
    "SELECT id, descricao FROM transacoes WHERE categoria_id IS NULL",
  );
  const regras = listarRegras();
  if (regras.length === 0) return 0;

  let aplicadas = 0;
  const usadas: string[] = [];
  for (const t of semCategoria) {
    const c = classificar(t.descricao, regras);
    if (!c?.categoria_id) continue;
    await atualizar("transacoes", t.id, {
      categoria_id: c.categoria_id,
      natureza: c.natureza,
      pessoa_id: c.pessoa_id,
      veiculo_id: c.veiculo_id,
    });
    usadas.push(c.regra_id);
    aplicadas += 1;
  }
  await contabilizarUso(usadas);
  return aplicadas;
}
