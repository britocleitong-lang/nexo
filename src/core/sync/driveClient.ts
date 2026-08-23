// =====================================================================
// Google Drive — pasta de dados do aplicativo
// ---------------------------------------------------------------------
// Escolhas que definem este arquivo:
//
// 1. ESCOPO `drive.appdata`, não `drive.file` nem `drive`.
//    O appDataFolder é uma pasta OCULTA que só este app enxerga. O Google
//    não deixa outro aplicativo ler, e o usuário não vê os arquivos
//    poluindo o Drive dele. Mais importante: é o escopo de menor permissão
//    que resolve o problema — o app nunca ganha acesso aos documentos
//    pessoais de ninguém, e é isso que permite pedir a permissão sem
//    constrangimento.
//
// 2. TOKEN NA MEMÓRIA, não em localStorage.
//    Access token vale uma hora. Guardar em disco só aumentaria a
//    superfície de ataque em troca de evitar um clique por sessão.
//    O fluxo implícito do Google Identity Services não devolve refresh
//    token para app de navegador — então uma reautorização silenciosa é
//    tentada primeiro, e só se ela falhar o usuário vê a janela.
//
// 3. SEM BIBLIOTECA. O SDK do Google (gapi) tem ~100 KB e faz muito mais
//    do que precisamos. Aqui são três chamadas REST e o script pequeno de
//    identidade, carregado sob demanda — nada disso pesa no app offline.
// =====================================================================

const ESCOPO = "https://www.googleapis.com/auth/drive.appdata";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const CHAVE_CLIENT_ID = "nexo:google-client-id";
const CHAVE_CONECTADO = "nexo:google-conectado";

export const PASTA = "appDataFolder";

export interface ArquivoDrive {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

let tokenAtual: string | null = null;
let tokenExpiraEm = 0;
let gisCarregado = false;

export function clientIdSalvo(): string {
  return localStorage.getItem(CHAVE_CLIENT_ID) ?? "";
}

export function definirClientId(id: string): void {
  localStorage.setItem(CHAVE_CLIENT_ID, id.trim());
  // Trocar o Client ID invalida qualquer token já obtido.
  tokenAtual = null;
  tokenExpiraEm = 0;
}

export function estaConfigurado(): boolean {
  return clientIdSalvo().length > 20;
}

export function jaConectouAlgumaVez(): boolean {
  return localStorage.getItem(CHAVE_CONECTADO) === "1";
}

export function esquecerConta(): void {
  tokenAtual = null;
  tokenExpiraEm = 0;
  localStorage.removeItem(CHAVE_CONECTADO);
}

async function carregarGis(): Promise<void> {
  if (gisCarregado) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(
      "Não consegui carregar o serviço de login do Google. Verifique a conexão.",
    ));
    document.head.appendChild(script);
  });
  gisCarregado = true;
}

interface RespostaToken {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

/**
 * Devolve um token válido.
 *
 * `interativo = false` tenta renovar sem mostrar nada — é o que roda ao
 * destravar o app com o PIN. Se o Google exigir interação, a promessa
 * rejeita e o chamador decide se pede o clique ou desiste em silêncio.
 */
export async function obterToken(interativo: boolean): Promise<string> {
  if (tokenAtual && Date.now() < tokenExpiraEm - 60_000) return tokenAtual;

  const clientId = clientIdSalvo();
  if (!clientId) throw new Error("Client ID do Google não configurado.");

  await carregarGis();

  return new Promise<string>((resolve, reject) => {
    const google = (window as unknown as { google?: any }).google;
    if (!google?.accounts?.oauth2) {
      reject(new Error("Serviço de login do Google indisponível."));
      return;
    }

    const cliente = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: ESCOPO,
      callback: (resposta: RespostaToken) => {
        if (resposta.error || !resposta.access_token) {
          reject(new Error(traduzirErro(resposta.error)));
          return;
        }
        tokenAtual = resposta.access_token;
        tokenExpiraEm = Date.now() + (resposta.expires_in ?? 3600) * 1000;
        localStorage.setItem(CHAVE_CONECTADO, "1");
        resolve(tokenAtual);
      },
      error_callback: (err: { type?: string }) => {
        reject(new Error(traduzirErro(err?.type)));
      },
    });

    // `prompt: ""` pede reautorização silenciosa: se a permissão já foi
    // concedida e a sessão do Google está viva, o token volta sem janela.
    cliente.requestAccessToken({ prompt: interativo ? "consent" : "" });
  });
}

function traduzirErro(codigo?: string): string {
  switch (codigo) {
    case "popup_closed":
    case "popup_failed_to_open":
      return "A janela do Google foi fechada antes de autorizar.";
    case "access_denied":
      return "Permissão negada. Sem ela não dá para sincronizar.";
    case "idpiframe_initialization_failed":
      return "O navegador bloqueou o login do Google. Cookies de terceiros precisam estar liberados.";
    default:
      return codigo
        ? `O Google recusou a autorização (${codigo}).`
        : "Não consegui autorizar com o Google.";
  }
}

async function chamar(url: string, opcoes: RequestInit, interativo: boolean): Promise<Response> {
  const token = await obterToken(interativo);
  const resposta = await fetch(url, {
    ...opcoes,
    headers: { ...(opcoes.headers ?? {}), Authorization: `Bearer ${token}` },
  });

  if (resposta.status === 401) {
    // Token venceu no meio da operação. Descarta e tenta uma vez mais.
    tokenAtual = null;
    tokenExpiraEm = 0;
    const novo = await obterToken(interativo);
    return fetch(url, {
      ...opcoes,
      headers: { ...(opcoes.headers ?? {}), Authorization: `Bearer ${novo}` },
    });
  }

  return resposta;
}

export async function listarArquivos(prefixo = "", interativo = false): Promise<ArquivoDrive[]> {
  const busca = prefixo ? ` and name contains '${prefixo.replace(/'/g, "")}'` : "";
  const url = "https://www.googleapis.com/drive/v3/files"
    + `?spaces=appDataFolder&pageSize=200&orderBy=modifiedTime desc`
    + `&fields=files(id,name,modifiedTime,size)`
    + `&q=trashed=false${busca}`;

  const resposta = await chamar(url, { method: "GET" }, interativo);
  if (!resposta.ok) throw new Error(await mensagemErro(resposta, "listar os arquivos"));
  const dados = await resposta.json();
  return (dados.files ?? []) as ArquivoDrive[];
}

export async function baixarArquivo(id: string, interativo = false): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files/${id}?alt=media`;
  const resposta = await chamar(url, { method: "GET" }, interativo);
  if (!resposta.ok) throw new Error(await mensagemErro(resposta, "baixar o arquivo"));
  return resposta.text();
}

/** Envia (cria ou substitui) usando upload multipart em uma requisição. */
export async function enviarArquivo(
  nome: string,
  conteudo: string,
  idExistente?: string,
  interativo = false,
): Promise<string> {
  const limite = `nexo${Date.now()}`;
  const metadados = idExistente
    ? { name: nome }
    : { name: nome, parents: [PASTA] };

  const corpo =
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`
    + `${JSON.stringify(metadados)}\r\n`
    + `--${limite}\r\nContent-Type: application/json\r\n\r\n`
    + `${conteudo}\r\n`
    + `--${limite}--`;

  const url = idExistente
    ? `https://www.googleapis.com/upload/drive/v3/files/${idExistente}?uploadType=multipart&fields=id`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id";

  const resposta = await chamar(url, {
    method: idExistente ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${limite}` },
    body: corpo,
  }, interativo);

  if (!resposta.ok) throw new Error(await mensagemErro(resposta, "enviar o arquivo"));
  const dados = await resposta.json();
  return dados.id as string;
}

export async function excluirArquivo(id: string, interativo = false): Promise<void> {
  const resposta = await chamar(
    `https://www.googleapis.com/drive/v3/files/${id}`, { method: "DELETE" }, interativo);
  if (!resposta.ok && resposta.status !== 404) {
    throw new Error(await mensagemErro(resposta, "excluir o arquivo"));
  }
}

async function mensagemErro(resposta: Response, acao: string): Promise<string> {
  let detalhe = "";
  try {
    const corpo = await resposta.json();
    detalhe = corpo?.error?.message ?? "";
  } catch {
    // corpo não é JSON
  }
  if (resposta.status === 403 && /quota|rate/i.test(detalhe)) {
    return "O Google limitou as requisições por agora. Tente de novo em alguns minutos.";
  }
  if (resposta.status === 403) {
    return `Sem permissão para ${acao}. Reconecte a conta nas configurações.`;
  }
  return `Não consegui ${acao}${detalhe ? `: ${detalhe}` : ` (erro ${resposta.status})`}.`;
}

/** Espaço ocupado pela pasta oculta — ajuda a decidir quando podar. */
export async function tamanhoOcupadoBytes(): Promise<number> {
  const arquivos = await listarArquivos("", false);
  return arquivos.reduce((soma, a) => soma + Number(a.size ?? 0), 0);
}
