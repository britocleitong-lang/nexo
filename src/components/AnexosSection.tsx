import { useEffect, useRef, useState } from "react";
import { Paperclip, Trash2, FileText, Image as ImageIcon, Upload, Loader2 } from "lucide-react";
import { listarAnexos, anexarArquivo, excluirAnexo, abrirAnexo, type AnexoMeta } from "../features/anexos/anexosRepository";
import "./AnexosSection.css";
import { confirmar } from "./Confirm";

function formatarTamanho(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AnexosSection({ entidadeTipo, entidadeId }: { entidadeTipo: string; entidadeId: string }) {
  const [anexos, setAnexos] = useState<AnexoMeta[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function recarregar() {
    setAnexos(listarAnexos(entidadeTipo, entidadeId));
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entidadeTipo, entidadeId]);

  async function handleArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro(null);
    setEnviando(true);
    try {
      await anexarArquivo(entidadeTipo, entidadeId, arquivo);
      recarregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível anexar o arquivo.");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir anexo?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirAnexo(id);
    recarregar();
  }

  return (
    <div className="anexos-section">
      <div className="anexos-header">
        <span className="anexos-titulo"><Paperclip size={13} /> Anexos</span>
        <label className={`anexos-botao ${enviando ? "desabilitado" : ""}`}>
          {enviando ? <Loader2 size={13} className="spin" /> : <Upload size={13} />}
          {enviando ? "Enviando..." : "Anexar arquivo"}
          <input ref={inputRef} type="file" onChange={handleArquivoSelecionado} disabled={enviando} />
        </label>
      </div>

      {erro && <p className="anexos-erro">{erro}</p>}

      {anexos.length === 0 ? (
        <p className="anexos-vazio">Nenhum arquivo anexado ainda.</p>
      ) : (
        <div className="anexos-lista">
          {anexos.map((a) => (
            <div key={a.id} className="anexo-item">
              {a.tipo_mime?.startsWith("image/") ? <ImageIcon size={14} /> : <FileText size={14} />}
              <button className="anexo-nome" onClick={() => abrirAnexo(a.id)} title="Abrir">
                {a.nome_arquivo}
              </button>
              <span className="anexo-tamanho tabular">{formatarTamanho(a.tamanho)}</span>
              <button className="icon-btn danger" onClick={() => handleExcluir(a.id)} aria-label="Remover anexo">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
