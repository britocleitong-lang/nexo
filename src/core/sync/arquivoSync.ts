import { queryAll } from "../../database/db";
import { persistNow } from "../../database/db";
import {
  operacoesPendentes, marcarEnviadas, idsConhecidos, marcarAplicada,
  lerEstado, gravarEstado, idAparelho, nomeAparelho, semCaptura,
  tabelaSincronizada, type Operacao,
} from "./oplog";
import { runAndPersist } from "../../database/db";

// =====================================================================
// Sincronização por arquivo — zero contas, zero APIs, zero cadastro
// ---------------------------------------------------------------------
// Mesmo motor da sincronização por nuvem, transporte diferente. Em vez de
// falar com uma API, o app gera um arquivo pequeno e lê arquivos que
// chegaram. Como você leva esse arquivo de um aparelho ao outro é
// problema seu, e é justamente aí que está a vantagem: serve o app do
// Google Drive comum, Dropbox, OneDrive, WhatsApp para você mesmo,
// Telegram, cabo USB, cartão de memória, e-mail. Qualquer coisa.
//
// Nada disso exige criar conta de desenvolvedor, ativar API, configurar
// tela de permissão ou colar Client ID. O app não conhece nenhum serviço,
// e por isso nenhum serviço pode encarecer, mudar regra ou sair do ar.
//
// O arquivo é pequeno de propósito: só as operações, não o banco. Um mês
// de uso normal dá algo entre 20 e 200 KB — cabe em qualquer lugar e sobe
// instantaneamente até em rede ruim.
// =====================================================================

const CHAVE_ULTIMO_ARQUIVO = "ultimo-arquivo-gerado";
const CHAVE_ULTIMA_IMPORTACAO = "ultima-importacao";

export interface PacoteSync {
  formato: "nexo-sync";
  versao: 1;
  aparelho: string;
  nomeAparelho: string;
  geradoEm: string;
  /** Quantas operações o pacote carrega, para a tela avisar antes de aplicar. */
  total: number;
  operacoes: Operacao[];
}

/**
 * Monta o pacote com o histórico recente deste aparelho.
 *
 * Manda o histórico inteiro do período, não só o que ainda não foi
 * enviado. Parece desperdício e não é: se o outro aparelho ficou três
 * semanas sem receber nada, um pacote só resolve tudo. E como a aplicação
 * ignora operação já conhecida, reenviar não causa efeito nenhum.
 */
export function montarPacote(dias = 90): PacoteSync {
  const desde = Date.now() - dias * 86400000;
  const operacoes = queryAll<Operacao>(
    `SELECT * FROM sync_oplog WHERE origem = ? AND relogio >= ?
     ORDER BY relogio ASC, contador ASC`,
    [idAparelho(), desde],
  );

  return {
    formato: "nexo-sync",
    versao: 1,
    aparelho: idAparelho(),
    nomeAparelho: nomeAparelho(),
    geradoEm: new Date().toISOString(),
    total: operacoes.length,
    operacoes,
  };
}

export function nomeSugerido(): string {
  const limpo = nomeAparelho().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
  return `nexo-${limpo}.json`;
}

export interface ResultadoExportacao {
  operacoes: number;
  tamanhoKb: number;
  nomeArquivo: string;
}

/** Gera e baixa o arquivo. No celular, cai direto no seletor de destino. */
export async function exportarParaArquivo(): Promise<ResultadoExportacao> {
  const pacote = montarPacote();
  const texto = JSON.stringify(pacote);
  const nome = nomeSugerido();

  const blob = new Blob([texto], { type: "application/json" });

  // A API de compartilhamento nativa é o que torna isso viável no celular:
  // em vez de baixar e depois procurar o arquivo, ela abre o menu do
  // sistema com Drive, WhatsApp e o que mais estiver instalado. No
  // computador ela não existe e o download comum resolve.
  const arquivo = new File([blob], nome, { type: "application/json" });
  const navegador = navigator as Navigator & {
    canShare?: (dados: { files: File[] }) => boolean;
    share?: (dados: { files: File[]; title?: string }) => Promise<void>;
  };

  if (navegador.canShare?.({ files: [arquivo] }) && navegador.share) {
    try {
      await navegador.share({ files: [arquivo], title: "Nexo — alterações" });
      await marcarTudoEnviado();
      return { operacoes: pacote.total, tamanhoKb: Math.round(texto.length / 1024), nomeArquivo: nome };
    } catch (erro) {
      // Cancelar o menu de compartilhamento é uma escolha, não uma falha:
      // não faz sentido baixar o arquivo por baixo dos panos depois disso.
      if (erro instanceof Error && erro.name === "AbortError") {
        return { operacoes: 0, tamanhoKb: 0, nomeArquivo: nome };
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);

  await marcarTudoEnviado();
  await gravarEstado(CHAVE_ULTIMO_ARQUIVO, new Date().toISOString());

  return { operacoes: pacote.total, tamanhoKb: Math.round(texto.length / 1024), nomeArquivo: nome };
}

async function marcarTudoEnviado(): Promise<void> {
  const pendentes = operacoesPendentes(100000);
  await marcarEnviadas(pendentes.map((o) => o.id));
}

export interface ResultadoImportacao {
  aparelho: string;
  recebidas: number;
  aplicadas: number;
  jaTinha: number;
  conflitos: number;
  erro?: string;
}

/** Colunas reais da tabela — descarta campos de versões diferentes do app. */
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
    // Ordem total: relógio, depois contador, depois id do aparelho. O
    // desempate pelo id garante que os dois aparelhos cheguem ao mesmo
    // resultado mesmo aplicando os pacotes em ordens diferentes.
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

    const filtrados: Record<string, unknown> = {};
    for (const [campo, valor] of Object.entries(dados)) {
      if (colunas.has(campo)) filtrados[campo] = valor;
    }
    filtrados.id = op.registro_id;

    const nomes = Object.keys(filtrados);
    const marcadores = nomes.map(() => "?").join(", ");
    const sets = nomes.filter((n) => n !== "id").map((n) => `${n} = excluded.${n}`).join(", ");

    await runAndPersist(
      `INSERT INTO ${op.tabela} (${nomes.join(", ")}) VALUES (${marcadores})
       ON CONFLICT(id) DO UPDATE SET ${sets || "id = excluded.id"}`,
      nomes.map((n) => filtrados[n] ?? null),
    );
  });

  await marcarAplicada(op.id);
  return "aplicada";
}

export async function importarDeArquivo(arquivo: File): Promise<ResultadoImportacao> {
  const vazio: ResultadoImportacao = {
    aparelho: "", recebidas: 0, aplicadas: 0, jaTinha: 0, conflitos: 0,
  };

  let pacote: PacoteSync;
  try {
    pacote = JSON.parse(await arquivo.text()) as PacoteSync;
  } catch {
    return { ...vazio, erro: "Arquivo ilegível. Confira se é o arquivo gerado pelo Nexo." };
  }

  if (pacote.formato !== "nexo-sync" || !Array.isArray(pacote.operacoes)) {
    return { ...vazio, erro: "Esse arquivo não é um pacote de sincronização do Nexo." };
  }

  if (pacote.aparelho === idAparelho()) {
    return {
      ...vazio,
      aparelho: pacote.nomeAparelho,
      erro: "Esse arquivo foi gerado por este mesmo aparelho. Use o arquivo do outro.",
    };
  }

  const conhecidas = idsConhecidos();
  const resultado: ResultadoImportacao = { ...vazio, aparelho: pacote.nomeAparelho || "Outro aparelho" };

  const ordenadas = [...pacote.operacoes].sort(
    (a, b) => a.relogio - b.relogio || a.contador - b.contador,
  );

  for (const op of ordenadas) {
    if (conhecidas.has(op.id)) {
      resultado.jaTinha += 1;
      continue;
    }
    resultado.recebidas += 1;
    const situacao = await aplicarOperacao(op);
    if (situacao === "aplicada") resultado.aplicadas += 1;
    else if (situacao === "conflito") {
      resultado.conflitos += 1;
      await marcarAplicada(op.id);
    }
  }

  if (resultado.aplicadas > 0) await persistNow();
  await gravarEstado(CHAVE_ULTIMA_IMPORTACAO, new Date().toISOString());

  return resultado;
}

export function ultimaExportacao(): string | null {
  return lerEstado(CHAVE_ULTIMO_ARQUIVO);
}

export function ultimaImportacao(): string | null {
  return lerEstado(CHAVE_ULTIMA_IMPORTACAO);
}

/** Tamanho estimado do pacote, mostrado antes de exportar. */
export function tamanhoEstimadoKb(): number {
  const pacote = montarPacote();
  return Math.round(JSON.stringify(pacote).length / 1024);
}
