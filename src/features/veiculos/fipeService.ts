// Integração com a API pública da tabela FIPE (fipe.parallelum.com.br).
// Esta é a ÚNICA parte do Nexo que depende de internet — tudo o resto
// continua funcionando 100% offline. A busca e a atualização de valor
// são ações explícitas do usuário, nunca automáticas em segundo plano.

const BASE_URL = "https://fipe.parallelum.com.br/api/v2";

export interface FipeMarca {
  code: string;
  name: string;
}

export interface FipeModelo {
  code: string;
  name: string;
}

export interface FipeAno {
  code: string;
  name: string;
}

export interface FipeValor {
  price: string; // ex: "R$ 45.328,00"
  brand: string;
  model: string;
  modelYear: number;
  fuel: string;
  codeFipe: string;
  referenceMonth: string;
}

async function buscarJson<T>(url: string): Promise<T> {
  const resp = await fetch(url);
  if (!resp.ok) {
    if (resp.status === 429) throw new Error("Limite diário de consultas à FIPE atingido. Tente novamente amanhã.");
    throw new Error(`Falha ao consultar a FIPE (HTTP ${resp.status}).`);
  }
  return resp.json();
}

export function listarMarcasFipe(): Promise<FipeMarca[]> {
  return buscarJson(`${BASE_URL}/cars/brands`);
}

export function listarModelosFipe(marcaCodigo: string): Promise<FipeModelo[]> {
  return buscarJson(`${BASE_URL}/cars/brands/${marcaCodigo}/models`);
}

export function listarAnosFipe(marcaCodigo: string, modeloCodigo: string): Promise<FipeAno[]> {
  return buscarJson(`${BASE_URL}/cars/brands/${marcaCodigo}/models/${modeloCodigo}/years`);
}

export function consultarValorFipe(marcaCodigo: string, modeloCodigo: string, anoCodigo: string): Promise<FipeValor> {
  return buscarJson(`${BASE_URL}/cars/brands/${marcaCodigo}/models/${modeloCodigo}/years/${anoCodigo}`);
}

/** Converte "R$ 45.328,00" em 45328 (número). */
export function precoFipeParaNumero(preco: string): number {
  const limpo = preco.replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(limpo) || 0;
}
