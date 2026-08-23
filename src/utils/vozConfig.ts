const CHAVE_NOME = "nexo:assistente-nome";
const CHAVE_VOICE_URI = "nexo:assistente-voice-uri";
const CHAVE_VELOCIDADE = "nexo:assistente-velocidade";
const CHAVE_TOM = "nexo:assistente-tom";

export function obterNomeAssistente(): string {
  return localStorage.getItem(CHAVE_NOME) || "Nexo";
}
export function definirNomeAssistente(nome: string): void {
  localStorage.setItem(CHAVE_NOME, nome || "Nexo");
}

export function obterVoiceURISalvo(): string | null {
  return localStorage.getItem(CHAVE_VOICE_URI);
}
export function definirVoiceURISalvo(voiceURI: string): void {
  localStorage.setItem(CHAVE_VOICE_URI, voiceURI);
}

/** Levemente abaixo de 1 soa menos apressado e mais natural na maioria das vozes. */
export function obterVelocidade(): number {
  return Number(localStorage.getItem(CHAVE_VELOCIDADE) ?? "0.95");
}
export function definirVelocidade(v: number): void {
  localStorage.setItem(CHAVE_VELOCIDADE, String(v));
}

export function obterTom(): number {
  return Number(localStorage.getItem(CHAVE_TOM) ?? "1");
}
export function definirTom(v: number): void {
  localStorage.setItem(CHAVE_TOM, String(v));
}
