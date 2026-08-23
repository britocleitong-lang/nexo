import { queryAll, runAndPersist, persistNow } from "../../database/db";
import { SCHEMA_VERSION } from "../../database/schema";
import { idAparelho, nomeAparelho, semCaptura, tabelaSincronizada } from "./oplog";
import { listarArquivos, baixarArquivo, enviarArquivo } from "./driveClient";

// =====================================================================
// Cópia completa
// ---------------------------------------------------------------------
// Por que isto existe, além da sincronização incremental:
//
// O caminho incremental é elegante e é o certo para o dia a dia — manda
// só o que mudou. Mas ele depende de uma corrente de operações chegar
// inteira: se um lote se perde, se o envio para na metade, se um aparelho
// ficou fora tempo demais, o resultado é um banco parcialmente povoado —
// e pior, sem sinal nenhum de que está incompleto.
//
// A cópia completa é o oposto: burra, grande e infalível. Ela leva o
// conteúdo de todas as tabelas de uma vez. Não há ordem para respeitar,
// nem operação para perder. Se chegou, chegou tudo.
//
// É a ferramenta certa para dois momentos: colocar um aparelho novo em
// dia, e resgatar um aparelho que ficou pela metade. Depois disso, o
// incremental cuida do resto.
// =====================================================================

const NOME_ARQUIVO = "nexo-completo-";

/**
 * Ordem de gravação: tabelas referenciadas antes das que apontam para
 * elas. Se as chaves estrangeiras estiverem ativas, inserir uma transação
 * antes da conta que ela referencia falharia.
 */
const ORDEM = [
  "pessoas", "categorias", "contas", "cartoes", "veiculos", "imoveis",
  "investimentos", "documentos", "documento_versoes", "exercicios", "rotinas",
  "alimentos", "medidas_caseiras", "bens", "dividas",
  "transacoes", "orcamentos", "movimentos_investimento",
  "abastecimentos", "manutencoes", "modificacoes", "km_registros",
  "manutencoes_imovel", "registros_saude", "vacinas_aplicadas",
  "eventos", "tarefas", "subtarefas", "patrimonio_historico",
  "contatos", "opcoes_personalizadas", "recorrencias", "parcelamentos",
  "rotina_exercicios", "sessoes_treino", "series_treino", "medidas_corporais",
  "refeicoes", "refeicao_itens", "registros_agua",
];

export interface CopiaCompleta {
  formato: "nexo-completo";
  versaoSchema: number;
  aparelho: string;
  nomeAparelho: string;
  geradoEm: string;
  contagens: Record<string, number>;
  tabelas: Record<string, Array<Record<string, unknown>>>;
}

export function montarCopia(): CopiaCompleta {
  const tabelas: Record<string, Array<Record<string, unknown>>> = {};
  const contagens: Record<string, number> = {};

  for (const tabela of ORDEM) {
    if (!tabelaSincronizada(tabela)) continue;
    try {
      const linhas = queryAll<Record<string, unknown>>(`SELECT * FROM ${tabela}`);
      if (linhas.length === 0) continue;
      tabelas[tabela] = linhas;
      contagens[tabela] = linhas.length;
    } catch {
      // Tabela ausente nesta versão do schema — segue sem ela.
    }
  }

  return {
    formato: "nexo-completo",
    versaoSchema: SCHEMA_VERSION,
    aparelho: idAparelho(),
    nomeAparelho: nomeAparelho(),
    geradoEm: new Date().toISOString(),
    contagens,
    tabelas,
  };
}

export function totalNaCopia(copia: CopiaCompleta): number {
  return Object.values(copia.contagens).reduce((s, n) => s + n, 0);
}

export interface ResultadoEnvio {
  registros: number;
  tabelas: number;
  tamanhoKb: number;
}

export async function enviarCopiaParaDrive(interativo = true): Promise<ResultadoEnvio> {
  const copia = montarCopia();
  const texto = JSON.stringify(copia);
  const nome = `${NOME_ARQUIVO}${idAparelho()}.json`;

  const existentes = await listarArquivos(NOME_ARQUIVO, interativo);
  const meu = existentes.find((a) => a.name === nome);

  await enviarArquivo(nome, texto, meu?.id, interativo);

  return {
    registros: totalNaCopia(copia),
    tabelas: Object.keys(copia.tabelas).length,
    tamanhoKb: Math.round(texto.length / 1024),
  };
}

export interface CopiaDisponivel {
  arquivoId: string;
  aparelho: string;
  geradoEm: string;
  registros: number;
  tamanhoKb: number;
}

/** Cópias que OUTROS aparelhos deixaram na pasta. */
export async function listarCopiasDisponiveis(): Promise<CopiaDisponivel[]> {
  const arquivos = await listarArquivos(NOME_ARQUIVO, false);
  const meuNome = `${NOME_ARQUIVO}${idAparelho()}.json`;
  const resultado: CopiaDisponivel[] = [];

  for (const arquivo of arquivos) {
    if (arquivo.name === meuNome) continue;
    try {
      const copia = JSON.parse(await baixarArquivo(arquivo.id)) as CopiaCompleta;
      resultado.push({
        arquivoId: arquivo.id,
        aparelho: copia.nomeAparelho || "Outro aparelho",
        geradoEm: copia.geradoEm,
        registros: totalNaCopia(copia),
        tamanhoKb: Math.round(Number(arquivo.size ?? 0) / 1024),
      });
    } catch {
      // Cópia ilegível é ignorada em vez de derrubar a lista.
    }
  }
  return resultado;
}

export interface ResultadoAplicacao {
  gravados: number;
  tabelas: number;
  falhas: Array<{ tabela: string; motivo: string }>;
}

/**
 * Grava a cópia por cima do que existe aqui.
 *
 * Usa INSERT OR REPLACE, e a escolha é deliberada: numa cópia completa o
 * objetivo é justamente ficar igual à origem. Tentar mesclar linha a
 * linha por data traria de volta toda a fragilidade que esta função
 * existe para contornar.
 *
 * Por isso a tela avisa antes: se você digitou algo neste aparelho e
 * ainda não sincronizou, aquilo pode ser sobrescrito. Num aparelho novo
 * ou vazio — que é o caso de uso — não há o que perder.
 *
 * A captura do log fica desligada durante a gravação: sem isso, receber
 * 3.000 registros geraria 3.000 operações novas, que voltariam para a
 * nuvem num eco inútil.
 */
export async function aplicarCopia(copia: CopiaCompleta): Promise<ResultadoAplicacao> {
  const resultado: ResultadoAplicacao = { gravados: 0, tabelas: 0, falhas: [] };

  if (copia.formato !== "nexo-completo" || !copia.tabelas) {
    resultado.falhas.push({ tabela: "-", motivo: "Arquivo não é uma cópia completa do Nexo." });
    return resultado;
  }

  await semCaptura(async () => {
    for (const tabela of ORDEM) {
      const linhas = copia.tabelas[tabela];
      if (!linhas?.length) continue;
      if (!tabelaSincronizada(tabela)) continue;

      let colunas: Set<string>;
      try {
        colunas = new Set(
          queryAll<{ name: string }>(`PRAGMA table_info(${tabela})`).map((c) => c.name),
        );
      } catch {
        resultado.falhas.push({ tabela, motivo: "Tabela não existe nesta versão do app." });
        continue;
      }
      if (colunas.size === 0) {
        resultado.falhas.push({ tabela, motivo: "Tabela não existe nesta versão do app." });
        continue;
      }

      let gravadosAqui = 0;
      for (const linha of linhas) {
        // Descarta campos que este aparelho não conhece — acontece quando
        // um lado está numa versão de schema mais nova que o outro.
        const filtrados: Record<string, unknown> = {};
        for (const [campo, valor] of Object.entries(linha)) {
          if (colunas.has(campo)) filtrados[campo] = valor;
        }
        if (!filtrados.id) continue;

        const nomes = Object.keys(filtrados);
        try {
          await runAndPersist(
            `INSERT OR REPLACE INTO ${tabela} (${nomes.join(", ")})
             VALUES (${nomes.map(() => "?").join(", ")})`,
            nomes.map((n) => filtrados[n] ?? null),
          );
          gravadosAqui += 1;
        } catch (erro) {
          // Uma linha problemática não pode impedir as outras 2.999.
          if (resultado.falhas.length < 20) {
            resultado.falhas.push({
              tabela,
              motivo: erro instanceof Error ? erro.message : "erro ao gravar",
            });
          }
        }
      }

      if (gravadosAqui > 0) {
        resultado.tabelas += 1;
        resultado.gravados += gravadosAqui;
      }
    }
  });

  await persistNow();
  return resultado;
}

export async function baixarEAplicar(arquivoId: string): Promise<ResultadoAplicacao> {
  const texto = await baixarArquivo(arquivoId, true);
  return aplicarCopia(JSON.parse(texto) as CopiaCompleta);
}

// --- Caminho por arquivo, sem nuvem -----------------------------------------

export function baixarCopiaComoArquivo(): ResultadoEnvio {
  const copia = montarCopia();
  const texto = JSON.stringify(copia);
  const blob = new Blob([texto], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nexo-completo-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);

  return {
    registros: totalNaCopia(copia),
    tabelas: Object.keys(copia.tabelas).length,
    tamanhoKb: Math.round(texto.length / 1024),
  };
}

export async function aplicarCopiaDeArquivo(arquivo: File): Promise<ResultadoAplicacao> {
  const texto = await arquivo.text();
  return aplicarCopia(JSON.parse(texto) as CopiaCompleta);
}
