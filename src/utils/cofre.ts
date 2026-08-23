/**
 * Cofre de senhas — criptografia.
 *
 * As senhas NÃO são guardadas em texto puro. Cada uma é cifrada com
 * AES-GCM 256, usando uma chave derivada da sua senha-mestra via PBKDF2
 * (SHA-256, 250 mil iterações). A senha-mestra em si não é gravada em
 * lugar nenhum: guardamos apenas um "verificador" cifrado, que serve pra
 * checar se a senha digitada está certa.
 *
 * Consequência importante e honesta: **se você esquecer a senha-mestra,
 * não há como recuperar as senhas do cofre.** Não existe porta dos fundos.
 * Isso é proposital — uma forma de recuperar seria também uma forma de
 * alguém entrar sem a senha.
 *
 * A chave derivada fica só na memória da aba. Fechou ou recarregou, o
 * cofre tranca de novo.
 */

const CHAVE_SALT = "nexo:cofre-salt";
const CHAVE_VERIFICADOR = "nexo:cofre-verificador";
const TEXTO_VERIFICADOR = "nexo-cofre-ok";
const ITERACOES = 250_000;

let chaveNaMemoria: CryptoKey | null = null;

function paraBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function deBase64(txt: string): Uint8Array {
  return Uint8Array.from(atob(txt), (c) => c.charCodeAt(0));
}

async function derivarChave(senhaMestra: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(senhaMestra), "PBKDF2", false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERACOES, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function cifrarComChave(chave: CryptoKey, texto: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, chave, new TextEncoder().encode(texto),
  );
  // iv e conteúdo viajam juntos, separados por ponto
  return `${paraBase64(iv)}.${paraBase64(dados)}`;
}

async function decifrarComChave(chave: CryptoKey, pacote: string): Promise<string> {
  const [ivB64, dadosB64] = pacote.split(".");
  const aberto = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: deBase64(ivB64) as BufferSource }, chave, deBase64(dadosB64) as BufferSource,
  );
  return new TextDecoder().decode(aberto);
}

export function cofreJaConfigurado(): boolean {
  return !!localStorage.getItem(CHAVE_VERIFICADOR);
}

export function cofreDestrancado(): boolean {
  return chaveNaMemoria !== null;
}

export function trancarCofre(): void {
  chaveNaMemoria = null;
}

/** Primeira vez: define a senha-mestra e grava o verificador cifrado. */
export async function configurarCofre(senhaMestra: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const chave = await derivarChave(senhaMestra, salt);
  localStorage.setItem(CHAVE_SALT, paraBase64(salt));
  localStorage.setItem(CHAVE_VERIFICADOR, await cifrarComChave(chave, TEXTO_VERIFICADOR));
  chaveNaMemoria = chave;
}

/** Retorna false se a senha-mestra estiver errada. */
export async function destrancarCofre(senhaMestra: string): Promise<boolean> {
  const saltB64 = localStorage.getItem(CHAVE_SALT);
  const verificador = localStorage.getItem(CHAVE_VERIFICADOR);
  if (!saltB64 || !verificador) return false;
  try {
    const chave = await derivarChave(senhaMestra, deBase64(saltB64));
    const aberto = await decifrarComChave(chave, verificador);
    if (aberto !== TEXTO_VERIFICADOR) return false;
    chaveNaMemoria = chave;
    return true;
  } catch {
    return false;
  }
}

export async function cifrar(texto: string): Promise<string> {
  if (!chaveNaMemoria) throw new Error("O cofre está trancado.");
  return cifrarComChave(chaveNaMemoria, texto);
}

export async function decifrar(pacote: string): Promise<string> {
  if (!chaveNaMemoria) throw new Error("O cofre está trancado.");
  return decifrarComChave(chaveNaMemoria, pacote);
}

/** Gera uma senha forte usando o gerador aleatório do próprio navegador. */
export function gerarSenha(tamanho = 20, incluirSimbolos = true): string {
  const letras = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const numeros = "23456789";
  const simbolos = "!@#$%&*-_=+?";
  const alfabeto = letras + numeros + (incluirSimbolos ? simbolos : "");
  const bytes = crypto.getRandomValues(new Uint32Array(tamanho));
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

/** Avaliação simples de força, só pra dar um retorno visual ao digitar. */
export function forcaSenha(senha: string): { nivel: 0 | 1 | 2 | 3; rotulo: string } {
  let pontos = 0;
  if (senha.length >= 8) pontos++;
  if (senha.length >= 14) pontos++;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
  if (/\d/.test(senha)) pontos++;
  if (/[^\w]/.test(senha)) pontos++;
  if (senha.length < 6) return { nivel: 0, rotulo: "Muito fraca" };
  if (pontos <= 2) return { nivel: 1, rotulo: "Fraca" };
  if (pontos <= 4) return { nivel: 2, rotulo: "Boa" };
  return { nivel: 3, rotulo: "Forte" };
}
