import { queryAll } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import { diferencaDias, hoje } from "../../core/datas";
import { registrarAuditoria } from "../../core/auditoria/auditoria";
import { folgaMensalCerta } from "../financeiro/projecaoRepository";
import type { Meta, Investimento } from "../../types/entities";

// =====================================================================
// Metas financeiras
// ---------------------------------------------------------------------
// A decisão de projeto que faz a diferença: uma meta pode ser AMARRADA a
// um investimento já existente. Quando é, o progresso é LIDO do saldo real
// daquele investimento — não digitado.
//
// Isso importa porque meta com progresso manual é a primeira coisa que
// para de ser atualizada. Se a meta "reserva de emergência" aponta para o
// investimento de reserva que já existe no app, ela se atualiza sozinha a
// cada aporte lançado, e nunca mentirá.
//
// Meta solta (sem investimento) continua possível, para objetivos que não
// têm conta própria — e nesse caso o app é explícito de que o número
// depende de alguém atualizar.
// =====================================================================

export type MetaInput = {
  nome: string;
  valor_alvo: number;
  valor_inicial?: number;
  data_alvo?: string | null;
  investimento_id?: string | null;
  conta_id?: string | null;
  pessoa_id?: string | null;
  observacoes?: string | null;
};

export function listarMetas(incluirConcluidas = true): Meta[] {
  const sql = incluirConcluidas
    ? "SELECT * FROM metas ORDER BY concluida ASC, (data_alvo IS NULL), data_alvo ASC"
    : "SELECT * FROM metas WHERE concluida = 0 ORDER BY (data_alvo IS NULL), data_alvo ASC";
  return queryAll<Meta>(sql);
}

export async function criarMeta(input: MetaInput): Promise<string> {
  const id = await inserir("metas", { valor_inicial: 0, concluida: 0, ...input });
  await registrarAuditoria({
    tabela: "metas", registro_id: id, acao: "criar",
    resumo: `Meta "${input.nome}" criada (alvo ${input.valor_alvo})`, dados_depois: input,
  });
  return id;
}

export async function atualizarMeta(id: string, input: Partial<MetaInput> & { concluida?: number }): Promise<void> {
  await atualizar("metas", id, input);
}

export async function excluirMeta(id: string): Promise<void> {
  await excluir("metas", id);
}

export type RitmoMeta = "concluida" | "adiantada" | "no_ritmo" | "atrasada" | "sem_prazo" | "inalcancavel";

export interface ProgressoMeta {
  meta: Meta;
  valorAtual: number;
  /** De onde veio o valor atual — muda o nível de confiança. */
  fonte: "investimento" | "conta" | "manual";
  investimentoNome: string | null;
  faltam: number;
  percentual: number;
  diasRestantes: number | null;
  /** Quanto precisa guardar por mês pra chegar no prazo. */
  aporteMensalNecessario: number | null;
  /** Se o aporte necessário cabe na folga mensal projetada. */
  cabeNaFolga: boolean | null;
  ritmo: RitmoMeta;
}

export function calcularProgresso(meta: Meta): ProgressoMeta {
  let valorAtual = meta.valor_inicial;
  let fonte: ProgressoMeta["fonte"] = "manual";
  let investimentoNome: string | null = null;

  if (meta.investimento_id) {
    const inv = queryAll<Investimento>("SELECT * FROM investimentos WHERE id = ?", [meta.investimento_id])[0];
    if (inv) {
      valorAtual = inv.valor_atual;
      fonte = "investimento";
      investimentoNome = inv.nome;
    }
  } else if (meta.conta_id) {
    // Só os aportes marcados como investimento contam pra meta; o saldo
    // corrente da conta não é "dinheiro guardado".
    const rows = queryAll<{ total: number }>(
      `SELECT COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END), 0) as total
       FROM transacoes WHERE conta_id = ? AND pago = 1 AND natureza = 'investimento'`,
      [meta.conta_id],
    );
    valorAtual = meta.valor_inicial + (rows[0]?.total ?? 0);
    fonte = "conta";
  }

  const faltam = Math.max(0, meta.valor_alvo - valorAtual);
  const percentual = meta.valor_alvo > 0 ? Math.min(100, (valorAtual / meta.valor_alvo) * 100) : 0;
  const dias = meta.data_alvo ? diferencaDias(hoje(), meta.data_alvo) : null;

  const mesesRestantes = dias !== null ? Math.max(0, dias / 30) : null;
  const aporteMensalNecessario = mesesRestantes && mesesRestantes > 0 ? faltam / mesesRestantes : null;

  const folga = folgaMensalCerta();
  const cabeNaFolga = aporteMensalNecessario !== null && folga > 0
    ? aporteMensalNecessario <= folga : null;

  let ritmo: RitmoMeta;
  if (meta.concluida === 1 || faltam === 0) ritmo = "concluida";
  else if (dias === null) ritmo = "sem_prazo";
  else if (dias < 0) ritmo = "atrasada";
  else if (aporteMensalNecessario !== null && folga > 0 && aporteMensalNecessario > folga * 3) ritmo = "inalcancavel";
  else {
    // Compara o progresso com o tempo já decorrido: se a meta foi criada
    // há 6 meses de um prazo de 12, deveria estar em ~50%.
    const totalDias = diferencaDias(meta.criado_em.slice(0, 10), meta.data_alvo ?? hoje());
    const decorridos = diferencaDias(meta.criado_em.slice(0, 10), hoje());
    const esperado = totalDias > 0 ? (decorridos / totalDias) * 100 : 0;
    ritmo = percentual >= esperado + 5 ? "adiantada" : percentual >= esperado - 5 ? "no_ritmo" : "atrasada";
  }

  return {
    meta, valorAtual, fonte, investimentoNome, faltam, percentual,
    diasRestantes: dias, aporteMensalNecessario, cabeNaFolga, ritmo,
  };
}

export function listarProgressos(incluirConcluidas = false): ProgressoMeta[] {
  return listarMetas(incluirConcluidas).map(calcularProgresso);
}

/** Marca como concluída quando o alvo foi atingido — chamado ao abrir a tela. */
export async function marcarConcluidasAtingidas(): Promise<number> {
  let marcadas = 0;
  for (const p of listarProgressos(false)) {
    if (p.faltam === 0 && p.meta.concluida === 0) {
      await atualizar("metas", p.meta.id, { concluida: 1 });
      marcadas += 1;
    }
  }
  return marcadas;
}

export const LABEL_RITMO: Record<RitmoMeta, string> = {
  concluida: "Alcançada",
  adiantada: "Adiantada",
  no_ritmo: "No ritmo",
  atrasada: "Atrasada",
  sem_prazo: "Sem prazo",
  inalcancavel: "Fora de alcance no prazo",
};

export const TOM_RITMO: Record<RitmoMeta, "success" | "warn" | "danger" | "muted"> = {
  concluida: "success",
  adiantada: "success",
  no_ritmo: "success",
  atrasada: "warn",
  sem_prazo: "muted",
  inalcancavel: "danger",
};
