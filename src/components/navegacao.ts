import type { ComponentType } from "react";

// Tipos da navegação, num arquivo próprio porque agora duas cascas os
// consomem: AppShell no computador e MobileShell no celular.

export interface ItemNav {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  end?: boolean;
}

export interface GrupoNav {
  id: string;
  label: string;
  hue: string;
  itens: ItemNav[];
}

/**
 * Título mostrado na barra superior do celular.
 *
 * Derivado da rota em vez de cada página informar o seu: assim nenhuma
 * tela nova pode esquecer de declarar e aparecer sem título.
 */
const TITULOS: Array<[RegExp, string]> = [
  [/^\/$/, "Início"],
  [/^\/financeiro/, "Financeiro"],
  [/^\/investimentos/, "Investimentos"],
  [/^\/analise/, "Análise"],
  [/^\/projecao/, "Projeção"],
  [/^\/relatorios/, "Relatórios"],
  [/^\/imposto-de-renda/, "Imposto de Renda"],
  [/^\/patrimonio/, "Patrimônio"],
  [/^\/veiculos\/[^/]+\/analise/, "Análise do veículo"],
  [/^\/veiculos\/[^/]+/, "Veículo"],
  [/^\/veiculos/, "Veículos"],
  [/^\/imoveis\/[^/]+/, "Imóvel"],
  [/^\/imoveis/, "Imóveis"],
  [/^\/saude/, "Saúde"],
  [/^\/vacinas/, "Vacinação"],
  [/^\/treinos/, "Treinos"],
  [/^\/alimentacao/, "Alimentação"],
  [/^\/pessoas/, "Família"],
  [/^\/documentos/, "Documentos"],
  [/^\/educacao/, "Educação"],
  [/^\/contatos/, "Contatos"],
  [/^\/senhas/, "Senhas"],
  [/^\/agenda/, "Agenda"],
  [/^\/tarefas/, "Tarefas"],
  [/^\/assistente/, "Assistente"],
  [/^\/cadastros/, "Cadastros"],
  [/^\/configuracoes/, "Configurações"],
];

export function tituloDaRota(caminho: string): string {
  return TITULOS.find(([padrao]) => padrao.test(caminho))?.[1] ?? "Nexo";
}
