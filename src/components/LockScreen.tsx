import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { verificarPin } from "../utils/pin";
import "./LockScreen.css";
import { LogoNexo } from "./LogoNexo";

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "apagar"];

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState(false);
  const [tentativas, setTentativas] = useState(0);
  const [bloqueadoAte, setBloqueadoAte] = useState<number | null>(null);
  const [verificando, setVerificando] = useState(false);

  const bloqueado = bloqueadoAte !== null && Date.now() < bloqueadoAte;

  async function handleDigito(d: string) {
    if (bloqueado || verificando) return;
    const novo = (pin + d.replace(/\D/g, "")).slice(0, 6);
    setPin(novo);
    setErro(false);

    if (novo.length === 6) {
      setVerificando(true);
      const ok = await verificarPin(novo);
      if (ok) {
        onUnlock();
        return;
      }
      setErro(true);
      setPin("");
      setVerificando(false);
      const novasTentativas = tentativas + 1;
      setTentativas(novasTentativas);
      if (novasTentativas >= 5) {
        const ate = Date.now() + 30_000;
        setBloqueadoAte(ate);
        setTimeout(() => setBloqueadoAte(null), 30_000);
      }
    }
  }

  function handleApagar() {
    setPin((p) => p.slice(0, -1));
    setErro(false);
  }

  // Digitação pelo teclado físico. Antes só dava para clicar nos botões, o
  // que era lento no computador — no celular o teclado numérico é natural,
  // mas aqui a mão já está no teclado.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (bloqueado || verificando) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigito(e.key);
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        handleApagar();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setPin("");
        setErro(false);
      }
    }

    // Colar o PIN (Ctrl+V) — útil para quem guarda num gerenciador de senhas
    function aoColar(e: ClipboardEvent) {
      if (bloqueado || verificando) return;
      const texto = (e.clipboardData?.getData("text") ?? "").replace(/\D/g, "");
      if (!texto) return;
      e.preventDefault();
      handleDigito(texto);
    }

    window.addEventListener("keydown", aoTeclar);
    window.addEventListener("paste", aoColar);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("paste", aoColar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, bloqueado, verificando]);

  return (
    <div className="lock-screen">
      <div className="lock-brand-logo"><LogoNexo tamanho={54} /></div>
      <p className="lock-title">Digite seu PIN</p>
      <p className="lock-subtitle">Digite pelo teclado ou use os botões abaixo</p>

      <div className={`lock-dots ${erro ? "lock-shake" : ""}`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={`lock-dot ${i < pin.length ? "filled" : ""}`} />
        ))}
      </div>

      {bloqueado && <p className="lock-warning">Muitas tentativas erradas. Aguarde 30 segundos.</p>}

      <div className="lock-keypad">
        {TECLAS.map((tecla, i) =>
          tecla === "" ? (
            <span key={i} />
          ) : tecla === "apagar" ? (
            <button key={i} className="lock-key" onClick={handleApagar} aria-label="Apagar">
              <Delete size={20} />
            </button>
          ) : (
            <button key={i} className="lock-key" onClick={() => handleDigito(tecla)} disabled={bloqueado}>
              {tecla}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
