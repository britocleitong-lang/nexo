import { queryAll } from "../../database/db";
import { hoje, diasRestantes, chaveMes, somarDias } from "../datas";
import { recorrenciasVencendo } from "../recorrencia/recorrenciaRepository";
import { estadoDosAlertas } from "./alertasRepository";
import type { Documento, Manutencao, ManutencaoImovel, RegistroSaude, Evento, Tarefa, Veiculo, Transacao } from "../../types/entities";

// =====================================================================
// Motor de alertas
// ---------------------------------------------------------------------
// Antes, a lista "Precisa de você" era montada dentro do DashboardPage.
// Isso funcionava, mas amarrava o conhecimento sobre urgência a uma tela
// só — e o app tem outros lugares que precisam da mesma informação: o
// badge na barra lateral, a notificação do sistema, o resumo do
// assistente. Extrair pra cá é o que permite que os três concordem.
//
// Duas coisas que o motor faz e a versão anterior não fazia:
//   1. inclui vencimento financeiro (conta a pagar, recorrência, parcela)
//   2. respeita dispensa e adiamento, com chave por ciclo — um alerta
//      dispensado em agosto volta em setembro, porque a conta é outra.
// =====================================================================

export type SeveridadeAlerta = "atrasado" | "urgente" | "proximo";
export type OrigemAlerta =
  | "documento" | "veiculo" | "imovel" | "saude" | "agenda" | "tarefa"
  | "financeiro" | "recorrencia" | "orcamento" | "meta" | "vacina";

export interface Alerta {
  /** Determinística e estável dentro do ciclo — base da dispensa. */
  chave: string;
  titulo: string;
  detalhe?: string;
  origem: OrigemAlerta;
  origemLabel: string;
  dias: number | null;
  severidade: SeveridadeAlerta;
  destino: string;
  /** Grupo de navegação, pra saber em qual item da sidebar pôr o badge. */
  grupo: "financeiro" | "bens" | "pessoal" | "analise" | "sistema";
}

/** Janelas de antecedência por origem — o que é "em breve" depende do assunto. */
export const JANELAS: Record<OrigemAlerta, number> = {
  documento: 90,   // renovar documento leva tempo; avisar cedo
  veiculo: 45,
  imovel: 45,
  saude: 45,
  agenda: 14,
  tarefa: 14,
  financeiro: 10,  // conta a pagar: janela curta, senão vira ruído
  recorrencia: 7,
  orcamento: 0,
  meta: 30,
  vacina: 30,
};

function severidade(dias: number | null, urgenteAte = 7): SeveridadeAlerta {
  if (dias === null) return "proximo";
  if (dias < 0) return "atrasado";
  if (dias <= urgenteAte) return "urgente";
  return "proximo";
}

// --- Coletores por módulo ---------------------------------------------------

function alertasDocumentos(): Alerta[] {
  const limite = somarDias(hoje(), JANELAS.documento);
  const docs = queryAll<Documento>(
    `SELECT * FROM documentos WHERE data_validade IS NOT NULL AND data_validade <= ?
     ORDER BY data_validade ASC`, [limite]);
  return docs
    .filter((d) => {
      // Um documento pode ter antecedência própria (CNH avisa com 90 dias,
      // um contrato de 30 dias não precisa aparecer três meses antes).
      const dias = diasRestantes(d.data_validade);
      return dias !== null && dias <= (d.alerta_dias ?? JANELAS.documento);
    })
    .map((d) => {
      const dias = diasRestantes(d.data_validade);
      return {
        chave: `documento:${d.id}:${d.data_validade}`,
        titulo: d.nome,
        detalhe: dias !== null && dias < 0 ? "Documento vencido" : "Vencimento do documento",
        origem: "documento" as const,
        origemLabel: "Documento",
        dias,
        severidade: severidade(dias, 30),
        destino: "/documentos",
        grupo: "pessoal" as const,
      };
    });
}

function alertasManutencaoVeiculo(): Alerta[] {
  const limite = somarDias(hoje(), JANELAS.veiculo);
  const alertas: Alerta[] = [];

  // (a) por data
  const porData = queryAll<Manutencao & { veiculo_nome: string; veiculo_id: string }>(
    `SELECT m.*, (v.marca || ' ' || v.modelo) as veiculo_nome
     FROM manutencoes m JOIN veiculos v ON v.id = m.veiculo_id
     WHERE m.proxima_data IS NOT NULL AND m.proxima_data <= ?
     ORDER BY m.proxima_data ASC`, [limite]);
  for (const m of porData) {
    const dias = diasRestantes(m.proxima_data);
    alertas.push({
      chave: `veiculo-data:${m.id}`,
      titulo: `${m.veiculo_nome} — ${m.tipo}`,
      detalhe: "Manutenção prevista por data",
      origem: "veiculo", origemLabel: "Veículo", dias,
      severidade: severidade(dias, 15),
      destino: `/veiculos/${m.veiculo_id}`, grupo: "bens",
    });
  }

  // (b) por quilometragem — o que faltava. Uma troca de óleo marcada pra
  // 60.000 km não tem data; ela vence quando o carro chega lá. Comparar o
  // km_atual com o proximo_km é o que transforma isso em alerta de verdade.
  const porKm = queryAll<Manutencao & { veiculo_nome: string; km_atual: number | null }>(
    `SELECT m.*, (v.marca || ' ' || v.modelo) as veiculo_nome, v.km_atual
     FROM manutencoes m JOIN veiculos v ON v.id = m.veiculo_id
     WHERE m.proximo_km IS NOT NULL AND v.km_atual IS NOT NULL`);
  for (const m of porKm) {
    const faltam = (m.proximo_km ?? 0) - (m.km_atual ?? 0);
    // 1.000 km de antecedência: perto o suficiente pra agendar a oficina.
    if (faltam > 1000) continue;
    // Se essa manutenção também tem data e a data já gerou alerta, não
    // duplica — mostra só a que estiver mais próxima de vencer.
    if (m.proxima_data && (diasRestantes(m.proxima_data) ?? 999) <= JANELAS.veiculo) continue;
    alertas.push({
      chave: `veiculo-km:${m.id}:${Math.floor((m.km_atual ?? 0) / 500)}`,
      titulo: `${m.veiculo_nome} — ${m.tipo}`,
      detalhe: faltam <= 0
        ? `Passou ${Math.abs(Math.round(faltam)).toLocaleString("pt-BR")} km do previsto`
        : `Faltam ${Math.round(faltam).toLocaleString("pt-BR")} km`,
      origem: "veiculo", origemLabel: "Veículo",
      dias: faltam <= 0 ? -1 : null,
      severidade: faltam <= 0 ? "atrasado" : "urgente",
      destino: `/veiculos/${m.veiculo_id}`, grupo: "bens",
    });
  }

  return alertas;
}

function alertasImoveis(): Alerta[] {
  const limite = somarDias(hoje(), JANELAS.imovel);
  const rows = queryAll<ManutencaoImovel & { imovel_nome: string }>(
    `SELECT m.*, i.apelido as imovel_nome FROM manutencoes_imovel m
     JOIN imoveis i ON i.id = m.imovel_id
     WHERE m.proxima_data IS NOT NULL AND m.proxima_data <= ?
     ORDER BY m.proxima_data ASC`, [limite]);
  return rows.map((m) => {
    const dias = diasRestantes(m.proxima_data);
    return {
      chave: `imovel:${m.id}`,
      titulo: `${m.imovel_nome} — ${m.tipo}`,
      detalhe: "Manutenção prevista",
      origem: "imovel" as const, origemLabel: "Imóvel", dias,
      severidade: severidade(dias, 15),
      destino: `/imoveis/${m.imovel_id}`, grupo: "bens" as const,
    };
  });
}

function alertasSaude(): Alerta[] {
  const limite = somarDias(hoje(), JANELAS.saude);
  const rows = queryAll<RegistroSaude & { pessoa_nome: string | null }>(
    `SELECT r.*, p.nome as pessoa_nome FROM registros_saude r
     LEFT JOIN pessoas p ON p.id = r.pessoa_id
     WHERE r.proxima_data IS NOT NULL AND r.proxima_data <= ?
     ORDER BY r.proxima_data ASC`, [limite]);
  return rows.map((r) => {
    const dias = diasRestantes(r.proxima_data);
    const rotulo = r.tipo === "exame" ? "Repetir exame"
      : r.tipo === "consulta" ? "Retorno da consulta"
      : r.tipo === "vacina" ? "Próxima dose"
      : r.tipo === "medicamento" ? "Renovar receita"
      : "Retorno";
    return {
      chave: `saude:${r.id}:${r.proxima_data}`,
      titulo: r.pessoa_nome ? `${r.nome} — ${r.pessoa_nome}` : r.nome,
      detalhe: rotulo,
      origem: "saude" as const, origemLabel: "Saúde", dias,
      severidade: severidade(dias, 15),
      destino: "/saude", grupo: "pessoal" as const,
    };
  });
}

function alertasAgenda(): Alerta[] {
  const limite = somarDias(hoje(), JANELAS.agenda);
  const rows = queryAll<Evento>(
    `SELECT * FROM eventos WHERE concluido = 0 AND substr(data_hora, 1, 10) <= ?
     ORDER BY data_hora ASC`, [limite]);
  return rows.map((e) => {
    const dias = diasRestantes(e.data_hora.slice(0, 10));
    return {
      chave: `agenda:${e.id}`,
      titulo: e.titulo,
      detalhe: e.tipo,
      origem: "agenda" as const, origemLabel: "Agenda", dias,
      severidade: severidade(dias, 3),
      destino: "/agenda", grupo: "pessoal" as const,
    };
  });
}

function alertasTarefas(): Alerta[] {
  const limite = somarDias(hoje(), JANELAS.tarefa);
  const rows = queryAll<Tarefa>(
    `SELECT * FROM tarefas WHERE status != 'concluida' AND prazo IS NOT NULL AND prazo <= ?
     ORDER BY prazo ASC`, [limite]);
  return rows.map((t) => {
    const dias = diasRestantes(t.prazo);
    return {
      chave: `tarefa:${t.id}`,
      titulo: t.titulo,
      detalhe: t.prioridade === "alta" ? "Prioridade alta" : "Tarefa com prazo",
      origem: "tarefa" as const, origemLabel: "Tarefa", dias,
      severidade: severidade(dias, 3),
      destino: "/tarefas", grupo: "pessoal" as const,
    };
  });
}

function alertasFinanceiros(): Alerta[] {
  const limite = somarDias(hoje(), JANELAS.financeiro);
  // Lançamentos previstos e ainda não efetivados: parcelas futuras que
  // chegaram a vez, contas a pagar cadastradas à frente.
  const rows = queryAll<Transacao>(
    `SELECT * FROM transacoes
     WHERE pago = 0 AND COALESCE(data_vencimento, data) <= ?
     ORDER BY COALESCE(data_vencimento, data) ASC`, [limite]);
  return rows.map((t) => {
    const venc = t.data_vencimento ?? t.data;
    const dias = diasRestantes(venc);
    const parcela = t.parcela_numero && t.parcelas_totais
      ? ` (${t.parcela_numero}/${t.parcelas_totais})` : "";
    return {
      chave: `financeiro:${t.id}`,
      titulo: `${t.descricao}${parcela}`,
      detalhe: t.tipo === "despesa" ? "A pagar" : "A receber",
      origem: "financeiro" as const, origemLabel: "Financeiro", dias,
      severidade: severidade(dias, 3),
      destino: "/financeiro", grupo: "financeiro" as const,
    };
  });
}

function alertasRecorrencias(): Alerta[] {
  return recorrenciasVencendo(JANELAS.recorrencia).map(({ recorrencia: r, dias }) => ({
    chave: `recorrencia:${r.id}:${r.proxima_ocorrencia}`,
    titulo: r.descricao,
    detalhe: r.lancar_automatico ? "Recorrência (lança sozinha)" : "Recorrência a confirmar",
    origem: "recorrencia" as const, origemLabel: "Recorrência", dias,
    severidade: severidade(dias, 3),
    destino: "/financeiro", grupo: "financeiro" as const,
  }));
}

function alertasOrcamento(): Alerta[] {
  // Estourar o orçamento não tem "prazo" — é um estado. Entra como urgente
  // e usa a chave do mês pra poder ser dispensado sem sumir pra sempre.
  const inicioMes = `${chaveMes()}-01`;
  const rows = queryAll<{ id: string; nome: string; valor_limite: number; gasto: number }>(
    `SELECT o.id, c.nome, o.valor_limite,
            COALESCE((SELECT SUM(t.valor) FROM transacoes t
                      WHERE t.categoria_id = o.categoria_id AND t.tipo = 'despesa'
                        AND t.pago = 1 AND t.data >= ?), 0) as gasto
     FROM orcamentos o JOIN categorias c ON c.id = o.categoria_id`, [inicioMes]);
  return rows
    .filter((r) => r.valor_limite > 0 && r.gasto >= r.valor_limite * 0.9)
    .map((r) => {
      const pct = Math.round((r.gasto / r.valor_limite) * 100);
      return {
        chave: `orcamento:${r.id}:${chaveMes()}`,
        titulo: r.nome,
        detalhe: pct >= 100 ? `Orçamento estourado (${pct}%)` : `Orçamento em ${pct}%`,
        origem: "orcamento" as const, origemLabel: "Orçamento",
        dias: null,
        severidade: pct >= 100 ? ("atrasado" as const) : ("urgente" as const),
        destino: "/financeiro", grupo: "financeiro" as const,
      };
    });
}

function alertasIpvaLicenciamento(): Alerta[] {
  // IPVA e licenciamento não estão em nenhuma tabela — mas dependem só do
  // final da placa e do calendário do estado. Em vez de inventar uma tabela
  // nova, o alerta é derivado: se o veículo tem placa, o app sabe o mês.
  // A data exata varia por UF, então o alerta é do MÊS, e diz isso.
  const veiculos = queryAll<Veiculo>("SELECT * FROM veiculos WHERE placa IS NOT NULL AND placa != ''");
  const mesAtual = Number(hoje().slice(5, 7));
  const alertas: Alerta[] = [];
  for (const v of veiculos) {
    const ultimo = Number((v.placa ?? "").replace(/\D/g, "").slice(-1));
    if (Number.isNaN(ultimo)) continue;
    // Convenção mais comum: final 1 → janeiro ... final 0 → outubro.
    const mesVenc = ultimo === 0 ? 10 : ultimo;
    if (mesVenc !== mesAtual && mesVenc !== mesAtual + 1) continue;
    alertas.push({
      chave: `veiculo-ipva:${v.id}:${chaveMes()}`,
      titulo: `${v.marca} ${v.modelo} — IPVA / licenciamento`,
      detalhe: mesVenc === mesAtual
        ? `Placa final ${ultimo}: vence este mês (confira a data da sua UF)`
        : `Placa final ${ultimo}: vence no mês que vem`,
      origem: "veiculo", origemLabel: "Veículo",
      dias: mesVenc === mesAtual ? 0 : 30,
      severidade: mesVenc === mesAtual ? "urgente" : "proximo",
      destino: `/veiculos/${v.id}`, grupo: "bens",
    });
  }
  return alertas;
}

// --- Composição ------------------------------------------------------------

const ORDEM_SEVERIDADE: Record<SeveridadeAlerta, number> = { atrasado: 0, urgente: 1, proximo: 2 };

/** Coleta bruta, sem filtrar dispensados. */
function coletarTodos(): Alerta[] {
  return [
    ...alertasFinanceiros(),
    ...alertasRecorrencias(),
    ...alertasOrcamento(),
    ...alertasDocumentos(),
    ...alertasManutencaoVeiculo(),
    ...alertasIpvaLicenciamento(),
    ...alertasImoveis(),
    ...alertasSaude(),
    ...alertasAgenda(),
    ...alertasTarefas(),
  ];
}

/**
 * Lista final: sem os dispensados, sem os adiados que ainda não voltaram,
 * ordenada por severidade e depois por proximidade.
 */
export function listarAlertas(): Alerta[] {
  const estados = estadoDosAlertas();
  const agora = hoje();

  return coletarTodos()
    .filter((a) => {
      const estado = estados.get(a.chave);
      if (!estado) return true;
      if (estado.estado === "dispensado") return false;
      if (estado.estado === "adiado" && estado.adiado_ate && estado.adiado_ate > agora) return false;
      return true;
    })
    .sort((a, b) => {
      const s = ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade];
      if (s !== 0) return s;
      return (a.dias ?? 9999) - (b.dias ?? 9999);
    });
}

export interface ResumoAlertas {
  total: number;
  atrasados: number;
  urgentes: number;
  porGrupo: Record<string, number>;
}

export function resumoAlertas(alertas = listarAlertas()): ResumoAlertas {
  const porGrupo: Record<string, number> = {};
  let atrasados = 0;
  let urgentes = 0;
  for (const a of alertas) {
    porGrupo[a.grupo] = (porGrupo[a.grupo] ?? 0) + 1;
    if (a.severidade === "atrasado") atrasados += 1;
    if (a.severidade === "urgente") urgentes += 1;
  }
  return { total: alertas.length, atrasados, urgentes, porGrupo };
}

/** Só o que é acionável hoje — o que o assistente e a notificação usam. */
export function alertasDeHoje(): Alerta[] {
  return listarAlertas().filter((a) => a.severidade !== "proximo");
}
