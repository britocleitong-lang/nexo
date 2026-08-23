import { alertasDeHoje, type Alerta } from "../alertas/alertasEngine";
import { hoje } from "../datas";

// =====================================================================
// Notificações do sistema
// ---------------------------------------------------------------------
// O que isto FAZ: instalado como PWA no Edge/Chrome, o app pede permissão
// e dispara notificação nativa do Windows — aparece na Central de Ações,
// com o ícone do Nexo, mesmo com a janela minimizada.
//
// O que isto NÃO FAZ, e é importante ser exato: não dispara com o app
// FECHADO. Notificação agendada de verdade exigiria push server (Web Push
// precisa de um endpoint remoto) ou uma tarefa agendada do Windows — as
// duas coisas quebram a premissa de não ter servidor. A API
// `showTrigger`/Notification Triggers foi retirada dos navegadores.
//
// Então o contrato honesto é: o Nexo avisa quando você abre o app (ou
// quando ele está aberto em segundo plano), e a verificação roda a cada
// hora enquanto estiver aberto. Para lembrete com app fechado, a tela de
// Configurações oferece exportar um .ics — aí o lembrete vira compromisso
// no calendário do sistema, que já sabe notificar sozinho.
// =====================================================================

const CHAVE_ULTIMA_NOTIFICACAO = "nexo:ultima-notificacao";
const CHAVE_HABILITADO = "nexo:notificacoes-habilitadas";
const INTERVALO_VERIFICACAO_MS = 60 * 60 * 1000;

export type PermissaoNotificacao = "indisponivel" | "default" | "granted" | "denied";

export function suportaNotificacao(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function permissaoAtual(): PermissaoNotificacao {
  if (!suportaNotificacao()) return "indisponivel";
  return Notification.permission as PermissaoNotificacao;
}

export function notificacoesHabilitadas(): boolean {
  return localStorage.getItem(CHAVE_HABILITADO) === "1" && permissaoAtual() === "granted";
}

export function definirHabilitado(valor: boolean): void {
  localStorage.setItem(CHAVE_HABILITADO, valor ? "1" : "0");
}

export async function pedirPermissao(): Promise<PermissaoNotificacao> {
  if (!suportaNotificacao()) return "indisponivel";
  if (Notification.permission === "granted") {
    definirHabilitado(true);
    return "granted";
  }
  const resultado = await Notification.requestPermission();
  if (resultado === "granted") definirHabilitado(true);
  return resultado as PermissaoNotificacao;
}

async function mostrar(titulo: string, corpo: string, tag: string): Promise<void> {
  if (permissaoAtual() !== "granted") return;
  const opcoes: NotificationOptions = {
    body: corpo,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag,
    // Não vibra nem toca: o app é usado no desktop e uma notificação
    // silenciosa na Central de Ações é menos invasiva e igualmente eficaz.
    silent: true,
  };

  // Pelo service worker quando disponível: só assim a notificação sobrevive
  // ao fechamento da aba e aparece agrupada no sistema, não presa à janela.
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(titulo, opcoes);
      return;
    }
  } catch {
    // cai no construtor direto
  }
  new Notification(titulo, opcoes);
}

/** Notificação de teste, pro usuário confirmar que funciona antes de confiar. */
export async function notificarTeste(): Promise<boolean> {
  const permissao = await pedirPermissao();
  if (permissao !== "granted") return false;
  await mostrar("Nexo", "Pronto — é assim que os avisos vão aparecer.", "nexo-teste");
  return true;
}

function resumirAlertas(alertas: Alerta[]): string {
  const atrasados = alertas.filter((a) => a.severidade === "atrasado");
  const partes: string[] = [];
  if (atrasados.length > 0) {
    partes.push(atrasados.length === 1
      ? `1 item em atraso: ${atrasados[0].titulo}`
      : `${atrasados.length} itens em atraso`);
  }
  const urgentes = alertas.filter((a) => a.severidade === "urgente");
  if (urgentes.length > 0) {
    partes.push(urgentes.length === 1
      ? `1 vence logo: ${urgentes[0].titulo}`
      : `${urgentes.length} vencem nos próximos dias`);
  }
  return partes.join(" · ");
}

/**
 * Verifica e notifica, no máximo uma vez por dia. O limite diário é
 * deliberado: um app que avisa a mesma coisa cinco vezes é um app que a
 * pessoa desliga na segunda semana.
 */
export async function verificarENotificar(forcar = false): Promise<boolean> {
  if (!notificacoesHabilitadas()) return false;
  const ultima = localStorage.getItem(CHAVE_ULTIMA_NOTIFICACAO);
  if (!forcar && ultima === hoje()) return false;

  const alertas = alertasDeHoje();
  if (alertas.length === 0) {
    // Nada urgente é uma boa notícia, mas não é motivo pra notificação.
    localStorage.setItem(CHAVE_ULTIMA_NOTIFICACAO, hoje());
    return false;
  }

  const titulo = alertas.length === 1 ? "Nexo — 1 item precisa de você" : `Nexo — ${alertas.length} itens precisam de você`;
  await mostrar(titulo, resumirAlertas(alertas), "nexo-alertas-diarios");
  localStorage.setItem(CHAVE_ULTIMA_NOTIFICACAO, hoje());
  return true;
}

/** Liga a verificação periódica enquanto o app estiver aberto. */
export function iniciarVigilancia(): () => void {
  void verificarENotificar();
  const timer = window.setInterval(() => void verificarENotificar(), INTERVALO_VERIFICACAO_MS);

  // Voltar pra aba depois de horas é o momento natural de reverificar.
  function aoVoltar() {
    if (document.visibilityState === "visible") void verificarENotificar();
  }
  document.addEventListener("visibilitychange", aoVoltar);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", aoVoltar);
  };
}

// --- Alternativa honesta para app fechado: exportar .ics -------------------

function escaparIcs(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function dataIcs(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

/**
 * Gera um arquivo .ics com os alertas com data. Importado no Outlook,
 * Google Calendar ou app de Calendário do Windows, cada alerta vira um
 * compromisso com lembrete — e aí sim o aviso chega com o Nexo fechado,
 * usando o mecanismo que o sistema já tem, sem servidor nenhum.
 */
export function gerarIcsDosAlertas(alertas: Alerta[]): string {
  const linhas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nexo//Sistema Operacional Pessoal//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Nexo — avisos",
  ];

  for (const a of alertas) {
    if (a.dias === null) continue;
    const data = new Date();
    data.setDate(data.getDate() + a.dias);
    const iso = data.toISOString().slice(0, 10);
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${a.chave.replace(/[^a-zA-Z0-9:-]/g, "")}@nexo`,
      `DTSTAMP:${dataIcs(hoje())}T090000`,
      `DTSTART;VALUE=DATE:${dataIcs(iso)}`,
      `SUMMARY:${escaparIcs(`${a.origemLabel}: ${a.titulo}`)}`,
      `DESCRIPTION:${escaparIcs(a.detalhe ?? "Aviso gerado pelo Nexo")}`,
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escaparIcs(a.titulo)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }

  linhas.push("END:VCALENDAR");
  return linhas.join("\r\n");
}

export function baixarIcsDosAlertas(alertas: Alerta[]): void {
  const blob = new Blob([gerarIcsDosAlertas(alertas)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nexo-avisos-${hoje()}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}
