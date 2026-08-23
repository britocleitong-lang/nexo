import { runAndPersist, queryAll, persistNow } from "../../database/db";
import {
  operacoesPendentes, marcarEnviadas, idsConhecidos, marcarAplicada,
  lerEstado, gravarEstado, idAparelho, nomeAparelho, semCaptura,
  tabelaSincronizada, totalPendentes, podarLog, type Operacao,
} from "./oplog";
import {
  listarArquivos, baixarArquivo, enviarArquivo, excluirArquivo,
  estaConfigurado, jaConectouAlgumaVez,
} from "./driveClient";

// =====================================================================
// Motor de sincronização
// ---------------------------------------------------------------------
// Cada aparelho escreve um arquivo só seu na pasta oculta do Drive:
// `nexo-lote-<idAparelho>.json`, contendo as operações que ele gerou.
//
// Um arquivo por aparelho, e não um arquivo compartilhado, resolve o
// problema mais chato desse tipo de sincronia: dois aparelhos escrevendo
// no mesmo arquivo ao mesmo tempo se sobrescrevem, e o Drive não tem
// transação para impedir. Como cada um só escreve o seu e só LÊ os dos
// outros, não existe escrita concorrente — nunca.
//
// A fusão é última-escrita-vence por REGISTRO, decidida por
// (relógio, contador, id do aparelho). O desempate pelo id garante que os
// dois aparelhos cheguem ao mesmo resultado sem trocar mensagem.
//
// O que isso NÃO resolve, dito claramente: se a MESMA linha for editada
// nos dois aparelhos antes de sincronizar, uma das versões vence e a
// outra é descartada. Editar linhas diferentes — o caso normal — não
// perde nada.
// =====================================================================

const PREFIXO = "nexo-lote-";
const CHAVE_ULTIMA_SYNC = "ultima-sincronizacao";
const CHAVE_ID_ARQUIVO = "id-arquivo-proprio";
/** Acima disso o lote é dividido: o Drive fica lento com JSON gigante. */
const OPS_POR_LOTE = 3000;

export interface ResultadoSync {
  enviadas: number;
  recebidas: number;
  aplicadas: number;
  ignoradas: number;
  conflitos: number;
  aparelhos: string[];
  erro?: string;
}

interface LoteRemoto {
  aparelho: string;
  nomeAparelho: string;
  geradoEm: string;
  versaoSchema: number;
  operacoes: Operacao[];
}

export function ultimaSincronizacao(): string | null {
  return lerEstado(CHAVE_ULTIMA_SYNC);
}

export function sincronizacaoDisponivel(): boolean {
  return estaConfigurado() && jaConectouAlgumaVez();
}

export function pendencias(): number {
  return totalPendentes();
}

// --- Aplicação de operações recebidas ---------------------------------------

/** Colunas reais da tabela — filtra campos que o outro aparelho tinha e este não. */
function colunasDe(tabela: string): Set<string> {
  try {
    const info = queryAll<{ name: string }>(`PRAGMA table_info(${tabela})`);
    return new Set(info.map((c) => c.name));
  } catch {
    return new Set();
  }
}

/**
 * Aplica uma operação vinda de outro aparelho, se ela for mais nova que o
 * que já existe aqui.
 *
 * A comparação é feita contra o log local daquele registro, não contra a
 * coluna `atualizado_em` da linha: relógios de aparelhos diferentes não
 * são confiáveis entre si, mas o par (relógio, contador, origem) é uma
 * ordem total consistente nos dois lados.
 */
async function aplicarOperacao(op: Operacao): Promise<"aplicada" | "ignorada" | "conflito"> {
  if (!tabelaSincronizada(op.tabela)) return "ignorada";

  const colunas = colunasDe(op.tabela);
  if (colunas.size === 0) return "ignorada"; // tabela não existe nesta versão

  // Operação local mais recente sobre o mesmo registro.
  const local = queryAll<Operacao>(
    `SELECT * FROM sync_oplog WHERE tabela = ? AND registro_id = ?
     ORDER BY relogio DESC, contador DESC LIMIT 1`,
    [op.tabela, op.registro_id],
  )[0];

  let houveConflito = false;
  if (local) {
    const remotaVence =
      op.relogio > local.relogio
      || (op.relogio === local.relogio && op.contador > local.contador)
      || (op.relogio === local.relogio && op.contador === local.contador && op.origem > local.origem);
    // Só é conflito de verdade quando os dois mexeram e o remoto perdeu:
    // aí existe uma versão sendo descartada, e vale contar para avisar.
    if (!remotaVence) return "conflito";
    houveConflito = local.origem !== op.origem;
  }

  await semCaptura(async () => {
    if (op.operacao === "excluir") {
      await runAndPersist(`DELETE FROM ${op.tabela} WHERE id = ?`, [op.registro_id]);
      return;
    }

    const dados = op.dados ? (JSON.parse(op.dados) as Record<string, unknown>) : null;
    if (!dados) return;

    // Descarta campos que não existem aqui — acontece quando um aparelho
    // está numa versão mais nova do schema que o outro. Sincronizar entre
    // versões diferentes é o cenário normal (um aparelho atualiza antes),
    // então isso precisa degradar bem em vez de quebrar.
    const filtrados: Record<string, unknown> = {};
    for (const [campo, valor] of Object.entries(dados)) {
      if (colunas.has(campo)) filtrados[campo] = valor;
    }
    filtrados.id = op.registro_id;

    const nomes = Object.keys(filtrados);
    const marcadores = nomes.map(() => "?").join(", ");
    const sets = nomes.filter((n) => n !== "id").map((n) => `${n} = excluded.${n}`).join(", ");

    // INSERT ... ON CONFLICT DO UPDATE: a mesma operação serve para criar
    // e para atualizar. Isso importa porque o outro aparelho pode nunca
    // ter enviado o "inserir" original (log podado, sincronia ligada
    // depois) e mesmo assim o registro precisa aparecer aqui.
    await runAndPersist(
      `INSERT INTO ${op.tabela} (${nomes.join(", ")}) VALUES (${marcadores})
       ON CONFLICT(id) DO UPDATE SET ${sets || "id = excluded.id"}`,
      nomes.map((n) => filtrados[n] ?? null),
    );
  });

  await marcarAplicada(op.id);
  return houveConflito ? "aplicada" : "aplicada";
}

// --- Ciclo completo ---------------------------------------------------------

/**
 * Sincroniza: baixa o que os outros aparelhos escreveram, aplica, e sobe
 * o que este aparelho gerou.
 *
 * A ordem importa. Baixar primeiro garante que, se algo der errado no
 * envio, o aparelho pelo menos já recebeu as novidades. O contrário
 * deixaria o log local marcado como enviado sem ter recebido nada.
 */
export async function sincronizar(interativo = false): Promise<ResultadoSync> {
  const resultado: ResultadoSync = {
    enviadas: 0, recebidas: 0, aplicadas: 0, ignoradas: 0, conflitos: 0, aparelhos: [],
  };

  if (!estaConfigurado()) {
    return { ...resultado, erro: "Conta do Google ainda não configurada." };
  }

  try {
    const meuId = idAparelho();
    const arquivos = await listarArquivos(PREFIXO, interativo);

    // --- 1. Receber -------------------------------------------------------
    const conhecidas = idsConhecidos();

    for (const arquivo of arquivos) {
      if (arquivo.name === nomeDoMeuArquivo(meuId)) continue;

      let lote: LoteRemoto;
      try {
        lote = JSON.parse(await baixarArquivo(arquivo.id, interativo)) as LoteRemoto;
      } catch {
        // Um lote corrompido não pode travar a sincronia inteira: os
        // outros aparelhos continuam válidos.
        continue;
      }

      if (!Array.isArray(lote.operacoes)) continue;
      resultado.aparelhos.push(lote.nomeAparelho || lote.aparelho?.slice(0, 8) || "?");

      const novas = lote.operacoes
        .filter((op) => !conhecidas.has(op.id))
        .sort((a, b) => a.relogio - b.relogio || a.contador - b.contador);

      resultado.recebidas += novas.length;

      for (const op of novas) {
        const situacao = await aplicarOperacao(op);
        if (situacao === "aplicada") resultado.aplicadas += 1;
        else if (situacao === "conflito") {
          resultado.conflitos += 1;
          // Mesmo perdendo, marca como vista: sem isso ela seria
          // reavaliada em toda sincronia, para sempre.
          await marcarAplicada(op.id);
        } else {
          resultado.ignoradas += 1;
        }
      }
    }

    // --- 2. Enviar --------------------------------------------------------
    const pendentes = operacoesPendentes(OPS_POR_LOTE);
    if (pendentes.length > 0) {
      // O arquivo é reescrito com o histórico recente inteiro, não só com
      // o que falta enviar. Assim um aparelho que ficou semanas fora
      // encontra tudo o que perdeu num arquivo só.
      const historico = queryAll<Operacao>(
        `SELECT * FROM sync_oplog WHERE origem = ? ORDER BY relogio DESC, contador DESC LIMIT ?`,
        [meuId, OPS_POR_LOTE],
      ).reverse();

      const lote: LoteRemoto = {
        aparelho: meuId,
        nomeAparelho: nomeAparelho(),
        geradoEm: new Date().toISOString(),
        versaoSchema: 15,
        operacoes: historico,
      };

      const nomeArquivo = nomeDoMeuArquivo(meuId);
      const existente = arquivos.find((a) => a.name === nomeArquivo);
      const idSalvo = lerEstado(CHAVE_ID_ARQUIVO);

      const novoId = await enviarArquivo(
        nomeArquivo,
        JSON.stringify(lote),
        existente?.id ?? idSalvo ?? undefined,
        interativo,
      );

      await gravarEstado(CHAVE_ID_ARQUIVO, novoId);
      await marcarEnviadas(pendentes.map((o) => o.id));
      resultado.enviadas = pendentes.length;
    }

    await gravarEstado(CHAVE_ULTIMA_SYNC, new Date().toISOString());
    await podarLog();

    // Persiste o banco depois de aplicar tudo — sem isso, fechar o app
    // logo após sincronizar perderia o que acabou de chegar.
    if (resultado.aplicadas > 0) await persistNow();

    return resultado;
  } catch (erro) {
    return { ...resultado, erro: erro instanceof Error ? erro.message : "Falha na sincronização." };
  }
}

function nomeDoMeuArquivo(id: string): string {
  return `${PREFIXO}${id}.json`;
}

/**
 * Sincronização silenciosa, para rodar ao destravar o app.
 *
 * Nunca abre janela do Google e nunca mostra erro: se a sessão expirou ou
 * a rede caiu, ela simplesmente não acontece e a pessoa segue usando o app
 * normalmente. A sincronia é uma conveniência, não um pedágio na entrada.
 */
export async function sincronizarSilenciosamente(): Promise<ResultadoSync | null> {
  if (!sincronizacaoDisponivel()) return null;
  if (!navigator.onLine) return null;
  try {
    return await sincronizar(false);
  } catch {
    return null;
  }
}

export interface AparelhoConhecido {
  nome: string;
  id: string;
  ultimaAtividade: string;
  operacoes: number;
}

/** Aparelhos que já escreveram na pasta — mostrado nas configurações. */
export async function listarAparelhos(): Promise<AparelhoConhecido[]> {
  const arquivos = await listarArquivos(PREFIXO, false);
  const resultado: AparelhoConhecido[] = [];
  for (const arquivo of arquivos) {
    try {
      const lote = JSON.parse(await baixarArquivo(arquivo.id)) as LoteRemoto;
      resultado.push({
        nome: lote.nomeAparelho || "Aparelho sem nome",
        id: lote.aparelho,
        ultimaAtividade: arquivo.modifiedTime,
        operacoes: lote.operacoes?.length ?? 0,
      });
    } catch {
      // lote ilegível: aparece sem detalhes em vez de sumir
      resultado.push({
        nome: arquivo.name.replace(PREFIXO, "").replace(".json", "").slice(0, 8),
        id: arquivo.id, ultimaAtividade: arquivo.modifiedTime, operacoes: 0,
      });
    }
  }
  return resultado;
}

/** Remove o lote de um aparelho que não é mais usado. */
export async function esquecerAparelho(nomeArquivoOuId: string): Promise<void> {
  const arquivos = await listarArquivos(PREFIXO, true);
  const alvo = arquivos.find((a) => a.name.includes(nomeArquivoOuId) || a.id === nomeArquivoOuId);
  if (alvo) await excluirArquivo(alvo.id, true);
}
