import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./Confirm.css";

/**
 * Confirmação para ações destrutivas.
 *
 * Antes, qualquer clique no ícone de lixeira apagava o registro na hora —
 * sem confirmar e sem desfazer. Num app que guarda documentos, histórico
 * médico e lançamentos financeiros, um toque errado custava caro.
 *
 * A API é imperativa de propósito, pra caber dentro dos handlers que já
 * existem sem reescrever cada tela:
 *
 *   if (!(await confirmar({ titulo: "Excluir documento?" }))) return;
 */

interface OpcoesConfirmacao {
  titulo: string;
  descricao?: string;
  textoConfirmar?: string;
  destrutivo?: boolean;
}

interface EstadoConfirmacao extends OpcoesConfirmacao {
  resolver: (ok: boolean) => void;
}

let publicar: ((estado: EstadoConfirmacao | null) => void) | null = null;

export function confirmar(opcoes: OpcoesConfirmacao): Promise<boolean> {
  // Sem o host montado, não trava a ação — apenas segue sem confirmar.
  if (!publicar) return Promise.resolve(true);
  return new Promise((resolve) => {
    publicar!({ ...opcoes, resolver: resolve });
  });
}

export function ConfirmHost() {
  const [estado, setEstado] = useState<EstadoConfirmacao | null>(null);

  useEffect(() => {
    publicar = setEstado;
    return () => { publicar = null; };
  }, []);

  useEffect(() => {
    if (!estado) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") responder(false);
      if (e.key === "Enter") responder(true);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  function responder(ok: boolean) {
    estado?.resolver(ok);
    setEstado(null);
  }

  if (!estado) return null;

  return createPortal(
    <div className="confirm-overlay" onClick={() => responder(false)}>
      <div
        className="confirm-caixa"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="confirm-titulo" id="confirm-titulo">{estado.titulo}</h2>
        {estado.descricao && <p className="confirm-descricao">{estado.descricao}</p>}
        <div className="confirm-acoes">
          <button className="btn btn-secondary" onClick={() => responder(false)}>Cancelar</button>
          <button
            className={`btn ${estado.destrutivo === false ? "btn-primary" : "btn-confirm-danger"}`}
            onClick={() => responder(true)}
            autoFocus
          >
            {estado.textoConfirmar ?? "Excluir"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
