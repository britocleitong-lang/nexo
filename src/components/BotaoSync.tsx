import { useEffect, useState } from "react";
import { RefreshCw, Check, CloudOff, AlertTriangle } from "lucide-react";
import {
  sincronizar, sincronizacaoDisponivel, pendencias, ultimaSincronizacao,
} from "../core/sync/sincronizacao";
import "./BotaoSync.css";

// =====================================================================
// Botão de sincronizar
// ---------------------------------------------------------------------
// Um clique, sem confirmação. Sincronizar não é destrutivo — no pior caso
// não acontece nada — e pedir "tem certeza?" numa ação que a pessoa vai
// repetir várias vezes por dia é fricção pura.
//
// O estado é comunicado pelo próprio botão, sem toast e sem modal: o
// contador de pendências fica visível o tempo todo, o ícone gira enquanto
// trabalha, e o resultado aparece ali mesmo por alguns segundos.
// =====================================================================

type Situacao = "ocioso" | "sincronizando" | "sucesso" | "erro";

export function BotaoSync({ compacto = false }: { compacto?: boolean }) {
  const [situacao, setSituacao] = useState<Situacao>("ocioso");
  const [mensagem, setMensagem] = useState("");
  const [pendentes, setPendentes] = useState(0);
  const [disponivel, setDisponivel] = useState(false);

  function atualizarContadores() {
    setDisponivel(sincronizacaoDisponivel());
    setPendentes(pendencias());
  }

  useEffect(() => {
    atualizarContadores();
    // O contador precisa refletir o que foi digitado enquanto a tela estava
    // aberta. Consulta indexada a cada 20 s é barata e evita um store global.
    const timer = window.setInterval(atualizarContadores, 20_000);
    return () => window.clearInterval(timer);
  }, []);

  async function executar() {
    if (situacao === "sincronizando") return;
    setSituacao("sincronizando");
    setMensagem("");

    // Interativo: se a sessão do Google expirou, aqui É a hora de mostrar
    // a janela — a pessoa clicou, então está esperando algo acontecer.
    const resultado = await sincronizar(true);

    if (resultado.erro) {
      setSituacao("erro");
      setMensagem(resultado.erro);
    } else {
      setSituacao("sucesso");
      const partes: string[] = [];
      if (resultado.enviadas > 0) partes.push(`${resultado.enviadas} enviada(s)`);
      if (resultado.aplicadas > 0) partes.push(`${resultado.aplicadas} recebida(s)`);
      if (resultado.conflitos > 0) partes.push(`${resultado.conflitos} versão(ões) mais antiga(s) descartada(s)`);
      setMensagem(partes.length > 0 ? partes.join(" · ") : "Tudo já estava em dia.");
    }

    atualizarContadores();
    // Volta ao repouso sozinho. Erro fica mais tempo porque precisa ser lido.
    window.setTimeout(() => setSituacao("ocioso"), resultado.erro ? 8000 : 3500);
  }

  if (!disponivel) return null;

  const rotulo = situacao === "sincronizando" ? "Sincronizando..."
    : situacao === "sucesso" ? "Sincronizado"
    : situacao === "erro" ? "Falhou"
    : pendentes > 0 ? `Sincronizar (${pendentes})`
    : "Sincronizar";

  return (
    <div className="sync-wrapper">
      <button
        className={`sync-botao ${situacao} ${compacto ? "compacto" : ""}`}
        onClick={executar}
        disabled={situacao === "sincronizando"}
        title={ultimaSincronizacao()
          ? `Última sincronização: ${new Date(ultimaSincronizacao()!).toLocaleString("pt-BR")}`
          : "Nunca sincronizado neste aparelho"}
      >
        {situacao === "sucesso" ? <Check size={16} />
          : situacao === "erro" ? <AlertTriangle size={16} />
          : <RefreshCw size={16} className={situacao === "sincronizando" ? "sync-girando" : ""} />}
        {!compacto && <span>{rotulo}</span>}
        {compacto && pendentes > 0 && situacao === "ocioso" && (
          <span className="sync-ponto" />
        )}
      </button>

      {mensagem && situacao !== "ocioso" && (
        <span className={`sync-mensagem ${situacao}`}>{mensagem}</span>
      )}
    </div>
  );
}

/** Versão de status para a tela de configurações. */
export function StatusSync() {
  const [pendentes, setPendentes] = useState(0);
  const ultima = ultimaSincronizacao();

  useEffect(() => { setPendentes(pendencias()); }, []);

  if (!sincronizacaoDisponivel()) {
    return (
      <span className="sync-status desligado">
        <CloudOff size={14} /> Sincronização desligada
      </span>
    );
  }

  return (
    <span className="sync-status">
      {pendentes > 0
        ? `${pendentes} alteração(ões) esperando para subir`
        : "Tudo sincronizado"}
      {ultima && ` · última em ${new Date(ultima).toLocaleString("pt-BR")}`}
    </span>
  );
}
