const KEY_HASH = "nexo:pin-hash";

async function sha256(texto: string): Promise<string> {
  const dados = new TextEncoder().encode(texto);
  const buffer = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function temPinConfigurado(): boolean {
  return !!localStorage.getItem(KEY_HASH);
}

export async function definirPin(pin: string): Promise<void> {
  localStorage.setItem(KEY_HASH, await sha256(pin));
}

export async function verificarPin(pin: string): Promise<boolean> {
  const hash = localStorage.getItem(KEY_HASH);
  if (!hash) return true;
  return (await sha256(pin)) === hash;
}

export function removerPin(): void {
  localStorage.removeItem(KEY_HASH);
}
