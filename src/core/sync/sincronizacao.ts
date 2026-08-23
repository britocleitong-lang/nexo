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
// Cada aparelho escreve arquivos só seus na pasta oculta do Drive e só LÊ
// os dos outros. Não existe escrita concorrente — que é o problema
// clássico desse tipo de sincronia, já que o Drive não tem transação para
// impedir dois aparelhos gravando o mesmo arquivo.
//
// A fusão é última-escrita-vence por REGISTRO, decidida por
// (relógio, contador, id do aparelho). O desempate pelo id garante que os
// dois lados cheguem ao mesmo resultado sem trocar mensagem.
//
// Registros diferentes nunca conflitam. Se a MESMA linha for editada nos
// dois aparelhos antes de sincronizar, uma versão vence e a outra é
// descartada — esse é o limite conhecido.
// =====================================================================

const PREFIXO = "nexo-lote-";
const CHAVE_ULTIMA_SYNC = "ultima-sincronizacao";

/**
 * Operações por arquivo.
 *
 * O envio é fatiado porque a carga inicial de um banco com anos de uso
 * gera milhares de operações — e fotos guardadas como data URL vão junto,
 * no texto. Um único JSON de dezenas de MB fica lento para enviar, lento
 * para baixar e frágil em conexão de celular. Em pedaços, cada arquivo
 * sobe rápido e uma falha no meio não invalida o que já foi.
 */
const OPS_POR_ARQUIVO = 400;
/** Teto por sincronização, para não travar o app numa base gigante. */
const MAX_ARQUIVOS = 40;

export interface ResultadoSync {
  enviadas: number;
  recebidas: number;
  aplicadas: number;
  ignoradas: number;
  conflitos: number;
  aparelhos: string[];
  faltamEnviar: number;
  erro?: string;
}

interface LoteRemoto {
  aparelho: string;
  nomeAparelho: string;
  geradoEm: string;
  parte: number;
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

function colunasDe(tabela: string): Set<string> {
  try {
    return new Set(queryAll<{ name: string }>(`PRAGMA table_info(${tabela})`).map((c) => c.name));
  } catch {
    return new Set();
  }
}

async function aplicarOperacao(op: Operacao): Promise<"aplicada" | "ignorada" | "conflito"> {
  if (!tabelaSincronizada(op.tabela)) return "ignorada";

  const colunas = colunasDe(op.tabela);
  if (colunas.size === 0) return "ignorada";

  const local = queryAll<Operacao>(
    `SELECT * FROM sync_oplog WHERE tabela = ? AND registro_id = ?
     ORDER BY relogio DESC, contador DESC LIMIT 1`,
    [op.tabela, op.registro_id],
  )[0];

  if (local) {
    const remotaVence =
      op.relogio > local.relogio
      || (op.relogio === local.relogio && op.contador > local.contador)
      || (op.relogio === local.relogio && op.contador === local.contador && op.origem > local.origem);
    if (!remotaVence) return "conflito";
  }

  await semCaptura(async () => {
    if (op.operacao === "excluir") {
      await runAndPersist(`DELETE FROM ${op.tabela} WHERE id = ?`, [op.registro_id]);
      return;
    }

    const dados = op.dados ? (JSON.parse(op.dados) as Record<string, unknown>) : null;
    if (!dados) return;

    // Descarta campos que não existem aqui. Acontece quando um aparelho
    // está numa versão de schema mais nova que o outro — cenário normal,
    // porque um deles sempre atualiza primeiro.
    const filtrados: Record<string, unknown> = {};
    for (const [campo, valor] of Object.entries(dados)) {
      if (colunas.has(campo)) filtrados[campo] = valor;
    }
    filtrados.id = op.registro_id;

    const nomes = Object.keys(filtrados);
    const marcadores = nomes.map(() => "?").join(", ");
    const sets = nomes.filter((n) => n !== "id").map((n) => `${n} = excluded.${n}`).join(", ");

    // Insere-ou-atualiza: a mesma operação serve para criar e para alterar.
    // Necessário porque o outro aparelho pode nunca ter visto o registro.
    await runAndPersist(
      `INSERT INTO ${op.tabela} (${nomes.join(", ")}) VALUES (${marcadores})
       ON CONFLICT(id) DO UPDATE SET ${sets || "id = excluded.id"}`,
      nomes.map((n) => filtrados[n] ?? null),
    );
  });

  await marcarAplicada(op.id);
  return "aplicada";
}

export async function sincronizar(interativo = false): Promise<ResultadoSync> {
  const resultado: ResultadoSync = {
    enviadas: 0, recebidas: 0, aplicadas: 0, ignoradas: 0,
    conflitos: 0, aparelhos: [], faltamEnviar: 0,
  };

  if (!estaConfigurado()) {
    return { ...resultado, erro: "Conta do Google ainda não configurada." };
  }

  try {
    const meuId = idAparelho();
    const arquivos = await listarArquivos(PREFIXO, interativo);

    // --- 1. Receber -------------------------------------------------------
    const conhecidas = idsConhecidos();
    const vistos = new Set<string>();

    for (const arquivo of arquivos) {
      // Pular os próprios arquivos pelo NOME, e não só o principal: com o
      // envio fatiado existem vários, e reprocessar os próprios seria
      // trabalho inútil em toda sincronização.
      if (arquivo.name.startsWith(`${PREFIXO}${meuId}`)) continue;

      let lote: LoteRemoto;
      try {
        lote = JSON.parse(await baixarArquivo(arquivo.id, interativo)) as LoteRemoto;
      } catch {
        // Um lote corrompido não pode travar os outros aparelhos.
        continue;
      }

      if (!Array.isArray(lote.operacoes)) continue;
      if (lote.aparelho === meuId) continue;

      const nome = lote.nomeAparelho || lote.aparelho?.slice(0, 8) || "?";
      if (!vistos.has(nome)) { vistos.add(nome); resultado.aparelhos.push(nome); }

      const novas = lote.operacoes
        .filter((op) => !conhecidas.has(op.id))
        .sort((a, b) => a.relogio - b.relogio || a.contador - b.contador);

      resultado.recebidas += novas.length;

      for (const op of novas) {
        const situacao = await aplicarOperacao(op);
        if (situacao === "aplicada") resultado.aplicadas += 1;
        else if (situacao === "conflito") {
          resultado.conflitos += 1;
          // Marca como vista mesmo perdendo: sem isso seria reavaliada em
          // toda sincronização, para sempre.
          await marcarAplicada(op.id);
        } else {
          resultado.ignoradas += 1;
        }
      }
    }

    // --- 2. Enviar em fatias ---------------------------------------------
    const pendentes = operacoesPendentes(OPS_POR_ARQUIVO * MAX_ARQUIVOS);

    if (pendentes.length > 0) {
      const totalPendente = totalPendentes();
      const meusArquivos = arquivos.filter((a) => a.name.startsWith(`${PREFIXO}${meuId}`));

      for (let i = 0; i < pendentes.length; i += OPS_POR_ARQUIVO) {
        const fatia = pendentes.slice(i, i + OPS_POR_ARQUIVO);
        const parte = Math.floor(i / OPS_POR_ARQUIVO);
        const nomeArquivo = `${PREFIXO}${meuId}-${String(parte).padStart(3, "0")}.json`;

        const lote: LoteRemoto = {
          aparelho: meuId,
          nomeAparelho: nomeAparelho(),
          geradoEm: new Date().toISOString(),
          parte,
          operacoes: fatia,
        };

        const existente = meusArquivos.find((a) => a.name === nomeArquivo);
        await enviarArquivo(nomeArquivo, JSON.stringify(lote), existente?.id, interativo);

        // Marca fatia por fatia. Se a conexão cair no meio, o que já subiu
        // não é reenviado na próxima tentativa.
        await marcarEnviadas(fatia.map((o) => o.id));
        resultado.enviadas += fatia.length;
      }

      resultado.faltamEnviar = Math.max(0, totalPendente - resultado.enviadas);
    }

    await gravarEstado(CHAVE_ULTIMA_SYNC, new Date().toISOString());
    await podarLog();

    if (resultado.aplicadas > 0) await persistNow();

    return resultado;
  } catch (erro) {
    return { ...resultado, erro: erro instanceof Error ? erro.message : "Falha na sincronização." };
  }
}

/**
 * Sincronização silenciosa ao destravar o app. Nunca abre janela do
 * Google e nunca mostra erro: sincronia é conveniência, não pedágio.
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
  arquivos: number;
}

export async function listarAparelhos(): Promise<AparelhoConhecido[]> {
  const arquivos = await listarArquivos(PREFIXO, false);
  const porAparelho = new Map<string, AparelhoConhecido>();

  for (const arquivo of arquivos) {
    // Extrai o id do aparelho do nome, sem baixar todos os arquivos:
    // nexo-lote-<uuid>-000.json
    const semPrefixo = arquivo.name.replace(PREFIXO, "").replace(".json", "");
    const idDispositivo = semPrefixo.replace(/-\d{3}$/, "");

    const atual = porAparelho.get(idDispositivo);
    if (atual) {
      atual.arquivos += 1;
      if (arquivo.modifiedTime > atual.ultimaAtividade) atual.ultimaAtividade = arquivo.modifiedTime;
      continue;
    }

    let nome = idDispositivo.slice(0, 8);
    let operacoes = 0;
    try {
      const lote = JSON.parse(await baixarArquivo(arquivo.id)) as LoteRemoto;
      nome = lote.nomeAparelho || nome;
      operacoes = lote.operacoes?.length ?? 0;
    } catch {
      // Lote ilegível aparece sem detalhes, em vez de sumir da lista.
    }

    porAparelho.set(idDispositivo, {
      nome, id: idDispositivo, ultimaAtividade: arquivo.modifiedTime,
      operacoes, arquivos: 1,
    });
  }

  return [...porAparelho.values()];
}

/** Remove todos os arquivos de um aparelho que não é mais usado. */
export async function esquecerAparelho(idDispositivo: string): Promise<void> {
  const arquivos = await listarArquivos(PREFIXO, true);
  for (const arquivo of arquivos) {
    if (arquivo.name.startsWith(`${PREFIXO}${idDispositivo}`)) {
      await excluirArquivo(arquivo.id, true);
    }
  }
}
