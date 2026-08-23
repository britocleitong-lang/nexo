import { queryAll } from "../../database/db";
import { SCHEMA_VERSION } from "../../database/schema";
import { idAparelho, nomeAparelho, totalPendentes, contarRegistrosSemLog } from "./oplog";
import { clientIdSalvo, estaConfigurado, jaConectouAlgumaVez, listarArquivos } from "./driveClient";
import { ultimaSincronizacao } from "./sincronizacao";

// =====================================================================
// Diagnóstico
// ---------------------------------------------------------------------
// Existe porque "no computador funciona e no celular não" é impossível
// de resolver por dedução. Os dois aparelhos rodam o mesmo código em
// contextos diferentes — versão em cache, armazenamento particionado,
// política de cookies — e nenhuma dessas diferenças é visível na tela.
//
// Cada item aqui é um FATO verificável, não um palpite. Com a lista dos
// dois lados lado a lado, a diferença aparece sozinha.
// =====================================================================

export interface ItemDiagnostico {
  rotulo: string;
  valor: string;
  situacao: "ok" | "atencao" | "erro" | "neutro";
  dica?: string;
}

/** Versão do código, gravada na compilação. Compare entre aparelhos. */
export const VERSAO_APP = __VERSAO_APP__;

function contarLinhas(tabela: string): number {
  try {
    return queryAll<{ t: number }>(`SELECT COUNT(*) as t FROM ${tabela}`)[0]?.t ?? 0;
  } catch {
    return -1;
  }
}

export async function coletarDiagnostico(): Promise<ItemDiagnostico[]> {
  const itens: ItemDiagnostico[] = [];

  // --- Versão do código -----------------------------------------------
  itens.push({
    rotulo: "Versão do app",
    valor: VERSAO_APP,
    situacao: "neutro",
    dica: "Precisa ser IGUAL nos dois aparelhos. Diferente significa que um deles está com "
      + "versão antiga em cache — use o botão de forçar atualização.",
  });

  itens.push({
    rotulo: "Versão do banco",
    valor: String(SCHEMA_VERSION),
    situacao: "neutro",
  });

  // --- Identidade -------------------------------------------------------
  itens.push({
    rotulo: "Este aparelho",
    valor: `${nomeAparelho()} (${idAparelho().slice(0, 8)})`,
    situacao: "neutro",
  });

  // --- Armazenamento ----------------------------------------------------
  // O teste que mais importa no celular: se o navegador apagar o
  // localStorage entre sessões, a conexão com o Google "some" sozinha e
  // parece que o login não salva.
  let armazenamentoOk = false;
  try {
    localStorage.setItem("nexo:teste", "1");
    armazenamentoOk = localStorage.getItem("nexo:teste") === "1";
    localStorage.removeItem("nexo:teste");
  } catch {
    armazenamentoOk = false;
  }
  itens.push({
    rotulo: "Armazenamento local",
    valor: armazenamentoOk ? "Funcionando" : "BLOQUEADO",
    situacao: armazenamentoOk ? "ok" : "erro",
    dica: armazenamentoOk ? undefined
      : "O navegador está bloqueando o armazenamento. Costuma ser aba anônima/privada, "
        + "ou o app aberto dentro de outro app (Instagram, WhatsApp). Abra no navegador de verdade.",
  });

  // Persistência: sem isso o sistema pode limpar os dados sob pressão de
  // espaço, e no iOS o navegador limpa após dias sem uso.
  let persistente = false;
  try {
    persistente = await navigator.storage?.persisted?.() ?? false;
  } catch { /* API ausente */ }
  itens.push({
    rotulo: "Dados protegidos de limpeza",
    valor: persistente ? "Sim" : "Não",
    situacao: persistente ? "ok" : "atencao",
    dica: persistente ? undefined
      : "O sistema pode apagar os dados se faltar espaço. Instalar o app na tela inicial "
        + "e usá-lo com frequência costuma resolver.",
  });

  // --- Configuração do Google -------------------------------------------
  const clientId = clientIdSalvo();
  itens.push({
    rotulo: "Client ID salvo",
    valor: clientId ? `...${clientId.slice(-28)}` : "NÃO SALVO",
    situacao: clientId ? "ok" : "erro",
    dica: clientId
      ? "Compare o final com o do outro aparelho: precisa ser idêntico."
      : "Cole o Client ID no campo acima e conecte.",
  });

  itens.push({
    rotulo: "Já autorizou nesta instalação",
    valor: jaConectouAlgumaVez() ? "Sim" : "Não",
    situacao: jaConectouAlgumaVez() ? "ok" : "atencao",
    dica: jaConectouAlgumaVez() ? undefined
      : "Sem isso o botão de sincronizar nem aparece na barra lateral.",
  });

  itens.push({
    rotulo: "Endereço deste aparelho",
    valor: window.location.origin,
    situacao: "neutro",
    dica: "Precisa estar cadastrado em Origens JavaScript autorizadas, no Google Cloud, "
      + "exatamente assim.",
  });

  // --- Log local ---------------------------------------------------------
  itens.push({
    rotulo: "Operações no log",
    valor: String(contarLinhas("sync_oplog")),
    situacao: "neutro",
  });

  const pendentes = totalPendentes();
  itens.push({
    rotulo: "Esperando para subir",
    valor: String(pendentes),
    situacao: pendentes > 0 ? "atencao" : "ok",
  });

  const semLog = contarRegistrosSemLog();
  itens.push({
    rotulo: "Registros antigos sem log",
    valor: String(semLog),
    situacao: semLog > 0 ? "atencao" : "ok",
    dica: semLog > 0
      ? "Estes nunca vão sair daqui sozinhos. Use o botão Enviar tudo."
      : undefined,
  });

  itens.push({
    rotulo: "Última sincronização",
    valor: ultimaSincronizacao()
      ? new Date(ultimaSincronizacao()!).toLocaleString("pt-BR")
      : "Nunca",
    situacao: ultimaSincronizacao() ? "ok" : "atencao",
  });

  // --- Dados de verdade no banco ----------------------------------------
  const amostra = ["transacoes", "contas", "veiculos", "documentos", "pessoas"];
  const contagens = amostra.map((t) => `${t}: ${contarLinhas(t)}`).join(" · ");
  const totalDados = amostra.reduce((s, t) => s + Math.max(0, contarLinhas(t)), 0);
  itens.push({
    rotulo: "Dados no banco",
    valor: contagens,
    situacao: totalDados > 0 ? "ok" : "atencao",
    dica: totalDados === 0
      ? "Banco vazio. Se você já sincronizou, os dados não chegaram ou não foram gravados."
      : undefined,
  });

  // --- Drive --------------------------------------------------------------
  if (estaConfigurado() && jaConectouAlgumaVez()) {
    try {
      const arquivos = await listarArquivos("nexo-lote-", false);
      const meus = arquivos.filter((a) => a.name.includes(idAparelho()));
      const outros = arquivos.length - meus.length;
      const bytes = arquivos.reduce((s, a) => s + Number(a.size ?? 0), 0);

      itens.push({
        rotulo: "Arquivos na pasta do Drive",
        valor: `${arquivos.length} no total · ${outros} de outros aparelhos · ${(bytes / 1024).toFixed(0)} KB`,
        situacao: outros > 0 ? "ok" : "atencao",
        dica: outros === 0
          ? "Nenhum arquivo de outro aparelho. Ou o outro ainda não enviou, ou os dois estão "
            + "usando contas Google diferentes."
          : undefined,
      });
    } catch (erro) {
      itens.push({
        rotulo: "Acesso ao Drive",
        valor: erro instanceof Error ? erro.message : "Falhou",
        situacao: "erro",
      });
    }
  }

  return itens;
}

/** Texto plano para copiar e comparar entre aparelhos. */
export function formatarParaCopiar(itens: ItemDiagnostico[]): string {
  return itens.map((i) => `${i.rotulo}: ${i.valor}`).join("\n");
}
