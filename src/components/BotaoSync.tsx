import { useEffect, useState } from "react";
import { RefreshCw, Check, AlertTriangle } from "lucide-react";
import { sincronizar, sincronizacaoDisponivel, pendencias, ultimaSincronizacao } from "../core/sync/sincronizacao";
import "./BotaoSync.css";

// =====================================================================
// Botão de sincronizar
// ---------------------------------------------------------------------
// Um clique, sem confirmação. Sincronizar não é destrutivo — no pior caso
// não acontece nada — e pedir "tem certeza?" numa ação repetida várias
// vezes por dia é fricção pura.
//
// Fica no rodapé, ao lado de Configurações, porque é o mesmo tipo de
// coisa: comando de sistema, não navegação. O estado é comunicado no
// próprio botão — sem toast, sem modal, sem tirar a pessoa do lugar.
// =====================================================================

type Situacao = "ocioso" | "sincronizando" | "sucesso" | "erro";

export function BotaoSync() {
  const [situacao, setSituacao] = useState<Situacao>("ocioso");
  const [detalhe, setDetalhe] = useState("");
  const [pendentes, setPendentes] = useState(0);
  const [disponivel, setDisponivel] = useState(false);

  function atualizar() {
    setDisponivel(sincronizacaoDisponivel());
    setPendentes(pendencias());
  }

  useEffect(() => {
    atualizar();
    // O contador precisa refletir o que foi digitado com a tela aberta.
    // Consulta indexada a cada 20 s é barata e evita um store global.
    const timer = window.setInterval(atualizar, 20_000);
    return () => window.clearInterval(timer);
  }, []);

  async function executar() {
    if (situacao === "sincronizando") return;
    setSituacao("sincronizando");
    setDetalhe("");

    // Interativo: a pessoa clicou, então se a sessão do Google expirou
    // esta É a hora de mostrar a janela.
    const resultado = await sincronizar(true);

    if (resultado.erro) {
      setSituacao("erro");
      setDetalhe(resultado.erro);
    } else {
      setSituacao("sucesso");
      const partes: string[] = [];
      if (resultado.enviadas > 0) partes.push(`${resultado.enviadas} enviada(s)`);
      if (resultado.aplicadas > 0) partes.push(`${resultado.aplicadas} recebida(s)`);
      if (resultado.faltamEnviar > 0) partes.push(`${resultado.faltamEnviar} na fila`);
      setDetalhe(partes.length > 0 ? partes.join(" · ") : "Tudo em dia");
    }

    atualizar();
    // Erro fica mais tempo na tela porque precisa ser lido.
    window.setTimeout(() => { setSituacao("ocioso"); setDetalhe(""); }, resultado.erro ? 9000 : 4000);
  }

  if (!disponivel) return null;

  const rotulo = situacao === "sincronizando" ? "Sincronizando"
    : situacao === "sucesso" ? "Sincronizado"
    : situacao === "erro" ? "Falhou"
    : "Sincronizar";

  const titulo = detalhe
    || (ultimaSincronizacao()
      ? `Última sincronização: ${new Date(ultimaSincronizacao()!).toLocaleString("pt-BR")}`
      : "Nunca sincronizado neste aparelho");

  return (
    <>
      <button
        className={`nav-item nav-item-botao sync-item ${situacao}`}
        onClick={executar}
        disabled={situacao === "sincronizando"}
        title={titulo}
      >
        {situacao === "sucesso" ? <Check size={17} />
          : situacao === "erro" ? <AlertTriangle size={17} />
          : <RefreshCw size={17} className={situacao === "sincronizando" ? "sync-girando" : ""} />}
        <span>{rotulo}</span>
        {/* O contador só aparece parado e com coisa pendente: durante a
            sincronização ele mudaria sozinho e viraria ruído. */}
        {situacao === "ocioso" && pendentes > 0 && (
          <span className="sync-contador">{pendentes > 99 ? "99+" : pendentes}</span>
        )}
      </button>

      {detalhe && situacao !== "ocioso" && (
        <span className={`sync-detalhe ${situacao}`}>{detalhe}</span>
      )}
    </>
  );
}
