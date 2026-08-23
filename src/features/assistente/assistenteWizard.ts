import { listarContas, listarCategorias, criarTransacao, criarCategoria } from "../financeiro/financeiroRepository";
import { anexarArquivo } from "../anexos/anexosRepository";
import { hojeISO, formatarMoeda } from "../../utils/format";
import type { TipoCategoria } from "../../types/entities";

export type EtapaWizard =
  | "natureza" | "conta" | "categoria" | "categoria_nome_novo" | "descricao" | "anexo" | "concluido";

export interface EstadoWizard {
  etapa: EtapaWizard;
  tipo: TipoCategoria;
  valor: number;
  natureza?: "fixo" | "variavel";
  contaId?: string | null;
  categoriaId?: string | null;
  descricao?: string;
}

export interface OpcaoWizard {
  label: string;
  valor: string;
}

export interface PassoWizard {
  estado: EstadoWizard;
  texto: string;
  opcoes?: OpcaoWizard[];
  pedeArquivo?: boolean;
  finalizado?: boolean;
}

const SEM_CONTA = "__sem_conta__";
const NOVA_CATEGORIA = "__nova__";

function montarPasso(estado: EstadoWizard): PassoWizard {
  if (estado.etapa === "natureza") {
    return {
      estado,
      texto: "Isso é um gasto fixo ou variável?",
      opcoes: [{ label: "Fixo", valor: "fixo" }, { label: "Variável", valor: "variavel" }],
    };
  }
  if (estado.etapa === "conta") {
    const contas = listarContas();
    return {
      estado,
      texto: "Em qual conta?",
      opcoes: [...contas.map((c) => ({ label: c.nome, valor: c.id })), { label: "Sem conta", valor: SEM_CONTA }],
    };
  }
  if (estado.etapa === "categoria") {
    const categorias = listarCategorias(estado.tipo);
    return {
      estado,
      texto: "Qual a categoria?",
      opcoes: [...categorias.map((c) => ({ label: c.nome, valor: c.id })), { label: "+ Nova categoria", valor: NOVA_CATEGORIA }],
    };
  }
  if (estado.etapa === "categoria_nome_novo") {
    return { estado, texto: "Qual o nome da categoria nova?" };
  }
  if (estado.etapa === "descricao") {
    return { estado, texto: "Qual o nome/descrição desse lançamento?" };
  }
  if (estado.etapa === "anexo") {
    return {
      estado,
      texto: "Quer anexar um comprovante a esse lançamento?",
      opcoes: [{ label: "Sim", valor: "sim" }, { label: "Não", valor: "nao" }],
    };
  }
  return { estado, texto: "" };
}

/** Primeiro passo do wizard, a partir do valor e tipo já identificados na mensagem inicial. */
export function iniciarWizard(valor: number, tipo: TipoCategoria): PassoWizard {
  const etapaInicial: EtapaWizard = tipo === "despesa" ? "natureza" : "conta";
  return montarPasso({ etapa: etapaInicial, tipo, valor });
}

async function finalizar(estado: EstadoWizard, arquivo: File | null): Promise<PassoWizard> {
  const categorias = listarCategorias();
  const contas = listarContas();
  const categoriaNome = categorias.find((c) => c.id === estado.categoriaId)?.nome;
  const contaNome = contas.find((c) => c.id === estado.contaId)?.nome;

  const id = await criarTransacao({
    tipo: estado.tipo,
    descricao: estado.descricao || categoriaNome || (estado.tipo === "despesa" ? "Despesa via assistente" : "Receita via assistente"),
    valor: estado.valor,
    data: hojeISO(),
    categoria_id: estado.categoriaId || null,
    conta_id: estado.contaId || null,
    natureza: estado.tipo === "despesa" ? (estado.natureza ?? "variavel") : null,
  });

  if (arquivo) {
    await anexarArquivo("transacao", id, arquivo);
  }

  const partes = [
    categoriaNome && `em ${categoriaNome}`,
    contaNome && `na conta ${contaNome}`,
    arquivo && "com o comprovante anexado",
  ].filter(Boolean);

  return {
    estado: { ...estado, etapa: "concluido" },
    texto: `Pronto! Lancei ${estado.tipo === "despesa" ? "uma despesa" : "uma receita"} de ${formatarMoeda(estado.valor)}${partes.length ? " " + partes.join(", ") : ""}. ✅`,
    finalizado: true,
  };
}

/** Avança o wizard com a resposta do usuário (texto digitado ou valor da opção clicada) pra etapa atual. */
export async function avancarWizard(estadoAtual: EstadoWizard, resposta: string): Promise<PassoWizard> {
  const estado: EstadoWizard = { ...estadoAtual };

  if (estado.etapa === "natureza") {
    estado.natureza = resposta === "fixo" ? "fixo" : "variavel";
    estado.etapa = "conta";
    return montarPasso(estado);
  }
  if (estado.etapa === "conta") {
    estado.contaId = resposta === SEM_CONTA ? null : resposta;
    estado.etapa = "categoria";
    return montarPasso(estado);
  }
  if (estado.etapa === "categoria") {
    if (resposta === NOVA_CATEGORIA) {
      estado.etapa = "categoria_nome_novo";
      return montarPasso(estado);
    }
    estado.categoriaId = resposta;
    estado.etapa = "descricao";
    return montarPasso(estado);
  }
  if (estado.etapa === "categoria_nome_novo") {
    const nome = resposta.trim();
    if (nome) estado.categoriaId = await criarCategoria(nome, estado.tipo);
    estado.etapa = "descricao";
    return montarPasso(estado);
  }
  if (estado.etapa === "descricao") {
    estado.descricao = resposta.trim();
    estado.etapa = "anexo";
    return montarPasso(estado);
  }
  if (estado.etapa === "anexo") {
    if (resposta === "sim") {
      return { estado, texto: "Escolha o arquivo:", pedeArquivo: true };
    }
    return finalizar(estado, null);
  }

  return montarPasso(estado);
}

/** Chamado quando o usuário escolhe (ou pula) o arquivo na etapa final. */
export async function concluirComArquivo(estado: EstadoWizard, arquivo: File | null): Promise<PassoWizard> {
  return finalizar(estado, arquivo);
}

/** Mapeia o texto digitado pra o valor de uma opção, se bater com algum label (permite digitar em vez de clicar). */
export function mapearRespostaTexto(texto: string, opcoes?: OpcaoWizard[]): string {
  if (!opcoes) return texto;
  const encontrada = opcoes.find((o) => o.label.toLowerCase() === texto.trim().toLowerCase());
  return encontrada ? encontrada.valor : texto;
}
