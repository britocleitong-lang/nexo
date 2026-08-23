import { useEffect, useState } from "react";
import { Cloud, CloudOff, Smartphone, Trash2, Check, UploadCloud, AlertTriangle } from "lucide-react";
import {
  clientIdSalvo, definirClientId, estaConfigurado, esquecerConta, jaConectouAlgumaVez,
} from "../../core/sync/driveClient";
import {
  sincronizar, listarAparelhos, esquecerAparelho, ultimaSincronizacao, pendencias,
  type AparelhoConhecido,
} from "../../core/sync/sincronizacao";
import {
  nomeAparelho, definirNomeAparelho, idAparelho,
  semearLogInicial, contarRegistrosSemLog, cargaInicialFeita,
} from "../../core/sync/oplog";
import { exportarParaArquivo, importarDeArquivo } from "../../core/sync/arquivoSync";
import { Button, Card, Field, Input } from "../../components/ui";
import { confirmar } from "../../components/Confirm";
import { DiagnosticoSync } from "./DiagnosticoSync";
import "./SincronizacaoBloco.css";

export function SincronizacaoBloco() {
  const [clientId, setClientId] = useState(clientIdSalvo());
  const [nome, setNome] = useState(nomeAparelho());
  const [aparelhos, setAparelhos] = useState<AparelhoConhecido[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [pendentes, setPendentes] = useState(0);
  const [semLog, setSemLog] = useState(0);

  function atualizarContadores() {
    setPendentes(pendencias());
    setSemLog(contarRegistrosSemLog());
  }

  useEffect(() => { atualizarContadores(); }, []);

  const conectado = estaConfigurado() && jaConectouAlgumaVez();

  async function carregarAparelhos() {
    try { setAparelhos(await listarAparelhos()); } catch { /* sem conexão */ }
  }

  useEffect(() => { if (conectado) void carregarAparelhos(); }, [conectado]);

  async function conectar() {
    setCarregando(true);
    setErro(""); setMensagem("");
    definirClientId(clientId);
    const resultado = await sincronizar(true);
    if (resultado.erro) setErro(resultado.erro);
    else {
      setMensagem(`Conectado. ${resultado.aplicadas} recebida(s), ${resultado.enviadas} enviada(s).`);
      void carregarAparelhos();
    }
    atualizarContadores();
    setCarregando(false);
  }

  /**
   * Prepara e envia tudo que já existia antes da sincronização.
   * É o passo que faz o outro aparelho sair do zero.
   */
  async function enviarTudo() {
    const ok = await confirmar({
      titulo: `Enviar ${semLog} registro(s) deste aparelho?`,
      descricao: "Tudo que já estava aqui vai para a nuvem e chega nos outros aparelhos. "
        + "Pode levar alguns minutos e é feito uma vez só.",
    });
    if (!ok) return;

    setCarregando(true);
    setErro(""); setMensagem("");
    try {
      setProgresso("Preparando os registros...");
      const carga = await semearLogInicial();
      atualizarContadores();

      setProgresso(`Enviando ${carga.registros} registros...`);
      let total = 0;
      // Envia em rodadas: cada uma sobe um bloco de arquivos. Numa base
      // grande, uma chamada só não daria conta e a tela ficaria parada
      // sem dizer nada.
      for (let rodada = 0; rodada < 30; rodada++) {
        const resultado = await sincronizar(rodada === 0);
        if (resultado.erro) { setErro(resultado.erro); break; }
        total += resultado.enviadas;
        setProgresso(`Enviados ${total} de ${carga.registros}...`);
        if (resultado.faltamEnviar === 0) break;
      }

      if (!erro) {
        setMensagem(`Pronto: ${carga.registros} registro(s) de ${carga.tabelas} área(s) enviados. `
          + "Agora abra o outro aparelho e toque em sincronizar.");
      }
      void carregarAparelhos();
    } finally {
      setProgresso("");
      atualizarContadores();
      setCarregando(false);
    }
  }

  async function desconectar() {
    const ok = await confirmar({
      titulo: "Desconectar a conta do Google?",
      descricao: "Os dados deste aparelho continuam intactos. O que já subiu permanece na pasta do app.",
    });
    if (!ok) return;
    esquecerConta();
    setAparelhos([]);
    setMensagem("Conta desconectada.");
  }

  return (
    <Card className="sinc-card">
      <div className="sinc-topo">
        <span className={`sinc-icone ${conectado ? "ligado" : ""}`}>
          {conectado ? <Cloud size={18} /> : <CloudOff size={18} />}
        </span>
        <div className="sinc-cabecalho">
          <strong>{conectado ? "Sincronização ligada" : "Sincronização desligada"}</strong>
          <p>
            {conectado
              ? pendentes > 0 ? `${pendentes} esperando para subir` : "Tudo em dia"
              : "Mesma conta Google nos dois aparelhos"}
            {ultimaSincronizacao() && conectado
              && ` · ${new Date(ultimaSincronizacao()!).toLocaleString("pt-BR")}`}
          </p>
        </div>
      </div>

      {/* A carga inicial é o passo que quase todo mundo precisa e ninguém
          adivinha que existe. Quando há dados antigos sem registro no log,
          ele aparece em destaque no topo — não escondido num canto. */}
      {conectado && semLog > 0 && (
        <div className="sinc-carga">
          <span className="sinc-carga-icone"><UploadCloud size={18} /></span>
          <div className="sinc-carga-texto">
            <strong>
              {cargaInicialFeita()
                ? `${semLog} registro(s) ainda não foram enviados`
                : "Primeira sincronização: envie o que já existe aqui"}
            </strong>
            <p>{semLog} registros anteriores à sincronização precisam ser enviados uma vez.</p>
          </div>
          <Button variant="primary" onClick={enviarTudo} disabled={carregando}>
            {carregando ? "Enviando..." : "Enviar tudo"}
          </Button>
        </div>
      )}

      {progresso && <p className="sinc-progresso">{progresso}</p>}

      <Field label="Nome deste aparelho">
        <div className="sinc-linha">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          <Button onClick={() => { definirNomeAparelho(nome); setMensagem("Nome salvo."); }}>Salvar</Button>
        </div>
      </Field>

      <Field label="Client ID do Google">
        <div className="sinc-linha">
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="000000000000-xxxxxxxx.apps.googleusercontent.com"
          />
          <Button variant="primary" onClick={conectar} disabled={carregando || clientId.length < 20}>
            {conectado ? "Reconectar" : "Conectar"}
          </Button>
        </div>
      </Field>

      {mensagem && <p className="sinc-ok"><Check size={14} /> {mensagem}</p>}
      {erro && <p className="sinc-erro"><AlertTriangle size={14} /> {erro}</p>}

      {aparelhos.length > 0 && (
        <div className="sinc-aparelhos">
          <h4>Aparelhos sincronizando</h4>
          {aparelhos.map((a) => (
            <div key={a.id} className="sinc-aparelho">
              <Smartphone size={15} />
              <div className="sinc-aparelho-info">
                <span className="sinc-aparelho-nome">
                  {a.nome}{a.id === idAparelho() && <em> (este)</em>}
                </span>
                <span className="sinc-aparelho-meta">
                  {a.arquivos} arquivo(s) · visto em {new Date(a.ultimaAtividade).toLocaleString("pt-BR")}
                </span>
              </div>
              {a.id !== idAparelho() && (
                <button
                  className="icon-btn danger"
                  title="Remover da sincronização"
                  onClick={async () => {
                    const ok = await confirmar({
                      titulo: `Remover "${a.nome}"?`,
                      descricao: "Os arquivos dele saem do Drive. O que já chegou aqui fica.",
                    });
                    if (!ok) return;
                    await esquecerAparelho(a.id);
                    void carregarAparelhos();
                  }}
                ><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="sinc-alternativa">
        <h4>Por arquivo</h4>
        <div className="sinc-linha">
          <Button onClick={async () => {
            const r = await exportarParaArquivo();
            setMensagem(`Arquivo ${r.nomeArquivo} gerado com ${r.operacoes} operação(ões).`);
            atualizarContadores();
          }}>Exportar arquivo</Button>
          <label className="btn btn-secondary sinc-importar">
            Importar arquivo
            <input
              type="file" accept="application/json,.json" hidden
              onChange={async (e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (!arquivo) return;
                const r = await importarDeArquivo(arquivo);
                if (r.erro) setErro(r.erro);
                else setMensagem(`Recebido de ${r.aparelho}: ${r.aplicadas} alteração(ões) aplicada(s).`);
                atualizarContadores();
              }}
            />
          </label>
        </div>
      </div>

      <DiagnosticoSync />

      {conectado && (
        <div className="sinc-rodape">
          <Button onClick={desconectar}>Desconectar conta</Button>
        </div>
      )}
    </Card>
  );
}
