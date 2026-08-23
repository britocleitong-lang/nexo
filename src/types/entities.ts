export interface Pessoa {
  id: string;
  nome: string;
  parentesco: string | null;
  data_nascimento: string | null;
  principal: number;
  foto: string | null;
  email: string | null;
  telefone: string | null;
  profissao: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Documento {
  id: string;
  nome: string;
  categoria: string;
  pessoa_id: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  numero: string | null;
  orgao_emissor: string | null;
  observacoes: string | null;
  /** Antecedência do alerta de vencimento, em dias. null = usa o padrão do tipo. */
  alerta_dias: number | null;
  criado_em: string;
  atualizado_em: string;
}

export type MotivoVersao = "primeira" | "renovacao" | "segunda_via" | "correcao";

export interface DocumentoVersao {
  id: string;
  documento_id: string;
  versao: number;
  numero: string | null;
  orgao_emissor: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  observacoes: string | null;
  motivo: MotivoVersao | null;
  vigente: number;
  substituida_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Veiculo {
  id: string;
  pessoa_id: string | null;
  marca: string;
  modelo: string;
  ano: string | null;
  placa: string | null;
  renavam: string | null;
  km_atual: number | null;
  data_compra: string | null;
  valor_compra: number | null;
  valor_atual: number | null;
  combustivel: string | null;
  cor: string | null;
  foto_url: string | null;
  fipe_marca_codigo: string | null;
  fipe_modelo_codigo: string | null;
  fipe_ano_codigo: string | null;
  fipe_atualizado_em: string | null;
  /** Consumo de fábrica (km/l) para comparar com o consumo real medido. */
  consumo_referencia: number | null;
  /** ativo | vendido. Vender inativa, nunca apaga: o histórico de gastos continua valendo. */
  status: "ativo" | "vendido";
  data_venda: string | null;
  valor_venda: number | null;
  foto_anexo_id: string | null;
  valor_revenda: number | null;
  valor_revenda_atualizado_em: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Modificacao {
  id: string;
  veiculo_id: string;
  descricao: string;
  data: string;
  valor: number | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface RegistroKm {
  id: string;
  veiculo_id: string;
  data: string;
  km: number;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Manutencao {
  id: string;
  veiculo_id: string;
  tipo: string;
  data: string;
  km: number | null;
  valor: number | null;
  oficina: string | null;
  observacoes: string | null;
  proxima_data: string | null;
  proximo_km: number | null;
  /** Intervalo recomendado para a próxima troca — alimenta o alerta preventivo. */
  intervalo_km: number | null;
  intervalo_meses: number | null;
  criado_em: string;
  atualizado_em: string;
}

export type TipoConta = "corrente" | "poupanca" | "dinheiro" | "investimento" | "outra";

export interface Conta {
  id: string;
  nome: string;
  tipo: TipoConta;
  saldo_inicial: number;
  instituicao: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Cartao {
  id: string;
  nome: string;
  limite: number | null;
  dia_fechamento: number | null;
  dia_vencimento: number | null;
  instituicao: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type TipoCategoria = "receita" | "despesa";

export interface Categoria {
  id: string;
  nome: string;
  tipo: TipoCategoria;
}

export type NaturezaTransacao = "fixo" | "variavel" | "investimento";

export interface Transacao {
  id: string;
  tipo: TipoCategoria;
  descricao: string;
  valor: number;
  data: string;
  categoria_id: string | null;
  conta_id: string | null;
  cartao_id: string | null;
  pessoa_id: string | null;
  veiculo_id: string | null;
  investimento_id: string | null;
  natureza: NaturezaTransacao | null;
  recorrente: number;
  observacoes: string | null;
  /** 0 = previsto/a pagar, 1 = efetivado. Só pago=1 entra no saldo da conta. */
  pago: number;
  data_vencimento: string | null;
  recorrencia_id: string | null;
  parcelamento_id: string | null;
  parcela_numero: number | null;
  parcelas_totais: number | null;
  /** Identificador único do lançamento no extrato OFX — evita importar 2x. */
  fitid: string | null;
  importado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type TipoRegistroSaude = "consulta" | "exame" | "vacina" | "medicamento" | "procedimento";

export interface RegistroSaude {
  id: string;
  tipo: TipoRegistroSaude;
  nome: string;
  pessoa_id: string | null;
  data: string;
  profissional: string | null;
  local: string | null;
  resultado: string | null;
  valor_numerico: number | null;
  unidade: string | null;
  dose: string | null;
  frequencia: string | null;
  proxima_data: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Evento {
  id: string;
  titulo: string;
  tipo: string;
  data_hora: string;
  pessoa_id: string | null;
  veiculo_id: string | null;
  observacoes: string | null;
  concluido: number;
  recorrencia: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type PrioridadeTarefa = "baixa" | "media" | "alta";
export type StatusTarefa = "pendente" | "andamento" | "concluida";

export interface Tarefa {
  id: string;
  titulo: string;
  prioridade: PrioridadeTarefa;
  prazo: string | null;
  status: StatusTarefa;
  pessoa_id: string | null;
  recorrencia: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Subtarefa {
  id: string;
  tarefa_id: string;
  titulo: string;
  concluida: number;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

export type CategoriaBem = string;

export interface Bem {
  id: string;
  descricao: string;
  categoria: CategoriaBem;
  valor_aquisicao: number | null;
  valor_atual: number | null;
  data_aquisicao: string | null;
  pessoa_id: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type TipoDivida = "emprestimo" | "financiamento" | "cartao" | "outro";

export interface Divida {
  id: string;
  descricao: string;
  tipo: TipoDivida;
  valor_total: number;
  valor_pago: number;
  parcelas_totais: number | null;
  parcelas_pagas: number | null;
  taxa_juros: number | null;
  data_inicio: string | null;
  data_vencimento_final: string | null;
  pessoa_id: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface PatrimonioHistorico {
  id: string;
  data: string;
  valor_ativos: number;
  valor_passivos: number;
  valor_liquido: number;
  criado_em: string;
}

export interface Orcamento {
  id: string;
  categoria_id: string;
  valor_limite: number;
  criado_em: string;
  atualizado_em: string;
}

export interface Abastecimento {
  id: string;
  veiculo_id: string;
  data: string;
  km: number;
  litros: number;
  valor_total: number;
  posto: string | null;
  tanque_cheio: number;
  criado_em: string;
  atualizado_em: string;
}

export type TipoInvestimento = "reserva_emergencia" | "renda_fixa" | "renda_variavel" | "fundo" | "previdencia" | "outro";
export type TipoMovimentoInvestimento = "aporte" | "resgate" | "rendimento";

export interface Investimento {
  id: string;
  nome: string;
  tipo: TipoInvestimento;
  valor_atual: number;
  meta_valor: number | null;
  instituicao: string | null;
  pessoa_id: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface MovimentoInvestimento {
  id: string;
  investimento_id: string;
  tipo: TipoMovimentoInvestimento;
  valor: number;
  data: string;
  conta_id: string | null;
  transacao_id: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type TipoImovel = "casa" | "apartamento" | "terreno" | "outro";

export interface Imovel {
  id: string;
  status?: "ativo" | "vendido";
  data_venda?: string | null;
  valor_venda?: number | null;
  foto_anexo_id?: string | null;
  foto_url?: string | null;
  apelido: string;
  tipo: TipoImovel;
  endereco: string | null;
  area_m2: number | null;
  valor_atual: number | null;
  valor_compra: number | null;
  data_compra: string | null;
  pessoa_id: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ManutencaoImovel {
  id: string;
  imovel_id: string;
  tipo: string;
  data: string;
  valor: number | null;
  prestador: string | null;
  observacoes: string | null;
  proxima_data: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type CategoriaContato = "medico" | "mecanico" | "contador" | "seguro" | "advogado" | "outro";

export interface Contato {
  id: string;
  nome: string;
  categoria: CategoriaContato;
  especialidade: string | null;
  empresa: string | null;
  telefone: string | null;
  email: string | null;
  pessoa_id: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface SenhaGuardada {
  id: string;
  titulo: string;
  usuario: string | null;
  senha_cifrada: string;
  url: string | null;
  categoria: string | null;
  pessoa_id: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

// =====================================================================
// v12 — automação (recorrência, parcelamento, metas, regras, alertas)
// =====================================================================

export type Frequencia =
  | "diaria" | "semanal" | "quinzenal" | "mensal"
  | "bimestral" | "trimestral" | "semestral" | "anual";

export interface Recorrencia {
  id: string;
  tipo: TipoCategoria;
  descricao: string;
  valor: number;
  frequencia: Frequencia;
  dia_referencia: number | null;
  data_inicio: string;
  data_fim: string | null;
  proxima_ocorrencia: string;
  categoria_id: string | null;
  conta_id: string | null;
  cartao_id: string | null;
  pessoa_id: string | null;
  veiculo_id: string | null;
  natureza: NaturezaTransacao | null;
  lancar_automatico: number;
  ativa: number;
  ultima_geracao: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Parcelamento {
  id: string;
  descricao: string;
  valor_total: number;
  parcelas_totais: number;
  data_primeira: string;
  categoria_id: string | null;
  cartao_id: string | null;
  conta_id: string | null;
  pessoa_id: string | null;
  veiculo_id: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Meta {
  id: string;
  nome: string;
  valor_alvo: number;
  valor_inicial: number;
  data_alvo: string | null;
  investimento_id: string | null;
  conta_id: string | null;
  pessoa_id: string | null;
  concluida: number;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type ModoRegra = "contem" | "comeca" | "igual" | "regex";

export interface RegraCategorizacao {
  id: string;
  padrao: string;
  modo: ModoRegra;
  categoria_id: string | null;
  natureza: NaturezaTransacao | null;
  pessoa_id: string | null;
  veiculo_id: string | null;
  prioridade: number;
  vezes_aplicada: number;
  ativa: number;
  criado_em: string;
  atualizado_em: string;
}

export interface RegistroAuditoria {
  id: string;
  tabela: string;
  registro_id: string;
  acao: "criar" | "atualizar" | "excluir";
  resumo: string | null;
  dados_antes: string | null;
  dados_depois: string | null;
  perfil: string | null;
  criado_em: string;
}

export interface VacinaAplicada {
  id: string;
  pessoa_id: string;
  vacina_chave: string;
  dose_chave: string;
  data: string;
  lote: string | null;
  local: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}
