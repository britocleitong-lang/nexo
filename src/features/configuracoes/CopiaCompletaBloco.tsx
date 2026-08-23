import { useEffect, useState } from "react";
import { HardDriveUpload, HardDriveDownload, Check, AlertTriangle, FileUp, FileDown } from "lucide-react";
import {
  enviarCopiaParaDrive, listarCopiasDisponiveis, baixarEAplicar,
  baixarCopiaComoArquivo, aplicarCopiaDeArquivo, montarCopia, totalNaCopia,
  type CopiaDisponivel, type ResultadoAplicacao,
} from "../../core/sync/snapshot";
import { sincronizacaoDisponivel } from "../../core/sync/sincronizacao";
import { Button, Card } from "../../components/ui";
import { confirmar } from "../../components/Confirm";
import "./CopiaCompletaBloco.css";

export function CopiaCompletaBloco() {
  const [copias, setCopias] = useState<CopiaDisponivel[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [meuTotal, setMeuTotal] = useState(0);

  const naNuvem = sincronizacaoDisponivel();

  useEffect(() => {
    setMeuTotal(totalNaCopia(montarCopia()));
    if (naNuvem) void carregar();
  }, [naNuvem]);

  async function carregar() {
    try { setCopias(await listarCopiasDisponiveis()); } catch { /* sem rede */ }
  }

  async function enviar() {
    setOcupado(true); setErro(""); setMensagem("");
    try {
      const r = await enviarCopiaParaDrive(true);
      setMensagem(`Cópia enviada: ${r.registros} registros de ${r.tabelas} áreas, ${r.tamanhoKb} KB. `
        + "Agora abra o outro aparelho e clique em Baixar.");
      void carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar.");
    } finally {
      setOcupado(false);
    }
  }

  async function relatar(r: ResultadoAplicacao) {
    if (r.gravados === 0) {
      setErro(r.falhas[0]?.motivo ?? "Nada foi gravado. O arquivo pode estar vazio.");
      return;
    }
    setMensagem(`${r.gravados} registros gravados em ${r.tabelas} áreas.`
      + (r.falhas.length > 0 ? ` ${r.falhas.length} linha(s) não entraram.` : "")
      + " Recarregando...");
    // A tela precisa recarregar: as páginas já montadas leram o banco
    // antigo e não têm como saber que ele mudou por baixo.
    window.setTimeout(() => window.location.reload(), 1800);
  }

  async function baixar(copia: CopiaDisponivel) {
    const ok = await confirmar({
      titulo: `Trazer os ${copia.registros} registros de "${copia.aparelho}"?`,
      descricao: "A cópia é gravada por cima do que existe aqui. Se você digitou algo neste "
        + "aparelho e ainda não sincronizou, pode ser sobrescrito.",
    });
    if (!ok) return;

    setOcupado(true); setErro(""); setMensagem("");
    try {
      await relatar(await baixarEAplicar(copia.arquivoId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao baixar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card className="copia-card">
      <div className="copia-topo">
        <span className="copia-icone"><HardDriveUpload size={18} /></span>
        <div>
          <strong>Cópia completa</strong>
          <p>Leva todas as tabelas de uma vez. Use para pôr um aparelho novo em dia.</p>
        </div>
      </div>

      <div className="copia-acoes">
        <button className="copia-acao" onClick={enviar} disabled={ocupado || !naNuvem}>
          <span className="copia-acao-icone"><HardDriveUpload size={17} /></span>
          <span>
            <strong>Enviar cópia deste aparelho</strong>
            <em>{meuTotal} registros</em>
          </span>
        </button>

        <button className="copia-acao" onClick={() => {
          const r = baixarCopiaComoArquivo();
          setMensagem(`Arquivo gerado: ${r.registros} registros, ${r.tamanhoKb} KB.`);
        }} disabled={ocupado}>
          <span className="copia-acao-icone"><FileDown size={17} /></span>
          <span>
            <strong>Salvar como arquivo</strong>
            <em>Sem nuvem</em>
          </span>
        </button>
      </div>

      {copias.length > 0 && (
        <div className="copia-disponiveis">
          <h4>Disponíveis para baixar</h4>
          {copias.map((c) => (
            <div key={c.arquivoId} className="copia-item">
              <HardDriveDownload size={16} />
              <div className="copia-item-info">
                <span className="copia-item-nome">{c.aparelho}</span>
                <span className="copia-item-meta">
                  {c.registros} registros · {c.tamanhoKb} KB ·{" "}
                  {new Date(c.geradoEm).toLocaleString("pt-BR")}
                </span>
              </div>
              <Button variant="primary" onClick={() => baixar(c)} disabled={ocupado}>
                Baixar
              </Button>
            </div>
          ))}
        </div>
      )}

      <label className="copia-importar">
        <FileUp size={15} />
        <span>Aplicar de um arquivo</span>
        <input
          type="file" accept="application/json,.json" hidden disabled={ocupado}
          onChange={async (e) => {
            const arquivo = e.target.files?.[0];
            e.target.value = "";
            if (!arquivo) return;
            const ok = await confirmar({
              titulo: "Aplicar esta cópia?",
              descricao: "Ela é gravada por cima do que existe neste aparelho.",
            });
            if (!ok) return;
            setOcupado(true); setErro(""); setMensagem("");
            try {
              await relatar(await aplicarCopiaDeArquivo(arquivo));
            } catch (err) {
              setErro(err instanceof Error ? err.message : "Arquivo inválido.");
            } finally {
              setOcupado(false);
            }
          }}
        />
      </label>

      {mensagem && <p className="copia-ok"><Check size={14} /> {mensagem}</p>}
      {erro && <p className="copia-erro"><AlertTriangle size={14} /> {erro}</p>}
    </Card>
  );
}
