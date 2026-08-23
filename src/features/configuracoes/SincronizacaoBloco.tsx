import { useEffect, useState } from "react";
import { Cloud, CloudOff, Smartphone, Trash2, ExternalLink, Check } from "lucide-react";
import {
  clientIdSalvo, definirClientId, estaConfigurado, esquecerConta, jaConectouAlgumaVez,
} from "../../core/sync/driveClient";
import {
  sincronizar, listarAparelhos, esquecerAparelho, ultimaSincronizacao, pendencias,
  type AparelhoConhecido,
} from "../../core/sync/sincronizacao";
import { nomeAparelho, definirNomeAparelho, idAparelho } from "../../core/sync/oplog";
import { Button, Card, Field, Input } from "../../components/ui";
import { confirmar } from "../../components/Confirm";
import "./SincronizacaoBloco.css";

export function SincronizacaoBloco() {
  const [clientId, setClientId] = useState(clientIdSalvo());
  const [nome, setNome] = useState(nomeAparelho());
  const [aparelhos, setAparelhos] = useState<AparelhoConhecido[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [mostrarAjuda, setMostrarAjuda] = useState(!estaConfigurado());
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => { setPendentes(pendencias()); }, []);

  const conectado = estaConfigurado() && jaConectouAlgumaVez();

  async function conectar() {
    setCarregando(true);
    setErro("");
    setMensagem("");
    definirClientId(clientId);
    const resultado = await sincronizar(true);
    if (resultado.erro) setErro(resultado.erro);
    else {
      setMensagem(`Conectado. ${resultado.aplicadas} alteração(ões) recebida(s), ${resultado.enviadas} enviada(s).`);
      void carregarAparelhos();
    }
    setPendentes(pendencias());
    setCarregando(false);
  }

  async function carregarAparelhos() {
    try {
      setAparelhos(await listarAparelhos());
    } catch {
      // Sem conexão a lista simplesmente não aparece.
    }
  }

  useEffect(() => { if (conectado) void carregarAparelhos(); }, [conectado]);

  async function desconectar() {
    const ok = await confirmar({
      titulo: "Desconectar a conta do Google?",
      descricao: "Os dados deste aparelho continuam intactos. O que já subiu permanece na pasta do app "
        + "e volta a ser usado se você reconectar.",
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
              ? pendentes > 0
                ? `${pendentes} alteração(ões) esperando para subir.`
                : "Tudo em dia neste aparelho."
              : "Use a mesma conta do Google no computador e no celular para os dois se manterem iguais."}
            {ultimaSincronizacao() && conectado
              && ` Última em ${new Date(ultimaSincronizacao()!).toLocaleString("pt-BR")}.`}
          </p>
        </div>
      </div>

      <div className="sinc-como">
        <h4>Como funciona</h4>
        <p>
          Cada alteração que você faz vira uma linha num registro de operações. Ao sincronizar, esse
          registro sobe para uma <strong>pasta oculta do seu Google Drive</strong> — que só este app
          enxerga, não aparece no meio dos seus arquivos, e nenhum outro aplicativo consegue ler.
          O aparelho também baixa o que os outros escreveram e aplica aqui.
        </p>
        <p>
          Como cada aparelho escreve só o próprio arquivo, não existe um sobrescrevendo o outro.
          Lançar uma despesa no celular e cadastrar um documento no computador funciona sem conflito:
          são registros diferentes.
        </p>
        <p className="sinc-ressalva">
          <strong>O limite honesto:</strong> se você editar o <em>mesmo</em> lançamento nos dois
          aparelhos antes de sincronizar, vale a alteração mais recente e a outra é descartada.
          Anexos e o cofre de senhas não sincronizam — anexos porque ficariam grandes demais, e o
          cofre porque um arquivo cifrado na nuvem pode ser atacado sem limite de tentativas.
          Esses dois viajam pelo backup .db.
        </p>
      </div>

      <Field label="Nome deste aparelho" hint="Serve para você reconhecer quem escreveu o quê.">
        <div className="sinc-linha">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          <Button onClick={() => { definirNomeAparelho(nome); setMensagem("Nome salvo."); }}>Salvar</Button>
        </div>
      </Field>

      <Field
        label="Client ID do Google"
        hint="Precisa ser criado uma vez, de graça, na sua própria conta Google."
      >
        <div className="sinc-linha">
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="000000000000-xxxxxxxx.apps.googleusercontent.com"
          />
          <Button variant="primary" onClick={conectar} disabled={carregando || clientId.length < 20}>
            {carregando ? "Conectando..." : conectado ? "Reconectar" : "Conectar"}
          </Button>
        </div>
      </Field>

      <button className="link-sutil" onClick={() => setMostrarAjuda((v) => !v)}>
        {mostrarAjuda ? "Esconder o passo a passo" : "Como criar o Client ID"}
      </button>

      {mostrarAjuda && (
        <ol className="sinc-passos">
          <li>
            Abra o <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">
              Google Cloud Console <ExternalLink size={11} />
            </a> e crie um projeto (qualquer nome).
          </li>
          <li>
            Em <strong>APIs e Serviços → Biblioteca</strong>, procure <strong>Google Drive API</strong> e ative.
          </li>
          <li>
            Em <strong>Tela de permissão OAuth</strong>, escolha <strong>Externo</strong>, preencha
            nome e e-mail, e adicione seu próprio e-mail em <strong>Usuários de teste</strong>.
            {" "}<em>Não precisa publicar nem passar por verificação — como você é o único usuário,
            o modo de teste basta.</em>
          </li>
          <li>
            Em <strong>Credenciais → Criar credencial → ID do cliente OAuth</strong>, tipo
            {" "}<strong>Aplicativo da Web</strong>.
          </li>
          <li>
            Em <strong>Origens JavaScript autorizadas</strong>, coloque o endereço exato de onde o app
            roda — por exemplo <code>http://localhost:8123</code> no computador e o endereço do
            GitHub Pages no celular. Precisa ser igual, incluindo a porta.
          </li>
          <li>Copie o Client ID gerado e cole no campo acima.</li>
        </ol>
      )}

      {mensagem && <p className="sinc-ok"><Check size={14} /> {mensagem}</p>}
      {erro && <p className="sinc-erro">{erro}</p>}

      {aparelhos.length > 0 && (
        <div className="sinc-aparelhos">
          <h4>Aparelhos sincronizando</h4>
          {aparelhos.map((a) => (
            <div key={a.id} className="sinc-aparelho">
              <Smartphone size={15} />
              <div className="sinc-aparelho-info">
                <span className="sinc-aparelho-nome">
                  {a.nome}
                  {a.id === idAparelho() && <em> (este)</em>}
                </span>
                <span className="sinc-aparelho-meta">
                  {a.operacoes} operação(ões) · visto em {new Date(a.ultimaAtividade).toLocaleString("pt-BR")}
                </span>
              </div>
              {a.id !== idAparelho() && (
                <button
                  className="icon-btn danger"
                  title="Remover este aparelho da sincronização"
                  onClick={async () => {
                    const ok = await confirmar({
                      titulo: `Remover "${a.nome}" da sincronização?`,
                      descricao: "O arquivo dele sai da pasta do Drive. Os dados que já chegaram aqui ficam. "
                        + "Se aquele aparelho sincronizar de novo, ele volta.",
                    });
                    if (!ok) return;
                    await esquecerAparelho(a.id);
                    void carregarAparelhos();
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {conectado && (
        <div className="sinc-rodape">
          <Button onClick={desconectar}>Desconectar conta</Button>
        </div>
      )}
    </Card>
  );
}
