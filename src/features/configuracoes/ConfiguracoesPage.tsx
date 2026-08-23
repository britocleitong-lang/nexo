import { useEffect, useState } from "react";
import { Moon, Sun, Save, FolderOpen, Lock, ShieldOff, PlayCircle } from "lucide-react";
import { Badge, Button, Card, Field, Input, PageHeader, Select } from "../../components/ui";
import { baixarJson, baixarCsv, tabelasDisponiveis, tamanhoBancoBytes } from "../../core/exportacao/exportarDados";
import { SincronizacaoBloco } from "./SincronizacaoBloco";
import { CopiaCompletaBloco } from "./CopiaCompletaBloco";
import { getDb } from "../../database/db";
import { salvarBackupReal, abrirBackupReal, diasDesdeUltimoBackup, cacheToOPFS } from "../../database/persistence";
import { obterTemaSalvo, aplicarTema, type Tema } from "../../utils/theme";
import { temPinConfigurado, definirPin, verificarPin, removerPin } from "../../utils/pin";
import { obterDiasAlerta, definirDiasAlerta } from "../../utils/configuracoes";
import { aguardarVozes, type VozDisponivel } from "../../utils/voz";
import {
  obterNomeAssistente, definirNomeAssistente, obterVoiceURISalvo, definirVoiceURISalvo,
  obterVelocidade, definirVelocidade, obterTom, definirTom,
} from "../../utils/vozConfig";
import { falarTexto } from "../../utils/falar";

export function ConfiguracoesPage() {
  const [tema, setTema] = useState<Tema>(obterTemaSalvo());
  const [diasAlerta, setDiasAlerta] = useState(obterDiasAlerta());
  const [diasBackup, setDiasBackup] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setDiasBackup(diasDesdeUltimoBackup());
  }, []);

  function alternarTema() {
    const novo: Tema = tema === "light" ? "dark" : "light";
    aplicarTema(novo);
    setTema(novo);
  }

  function handleDiasAlerta(valor: number) {
    definirDiasAlerta(valor);
    setDiasAlerta(valor);
  }

  async function handleBackup() {
    setStatus("Salvando backup...");
    const bytes = getDb().export();
    await salvarBackupReal(bytes);
    setStatus("Backup salvo com sucesso.");
    setDiasBackup(0);
  }

  async function handleRestaurar() {
    setStatus("Escolha o arquivo de backup...");
    const bytes = await abrirBackupReal();
    if (!bytes) {
      setStatus(null);
      return;
    }
    await cacheToOPFS(bytes);
    window.location.reload();
  }

  const avisoBackup =
    diasBackup === null
      ? { tone: "warn" as const, texto: "Nenhum backup real feito ainda" }
      : diasBackup >= 3
        ? { tone: "warn" as const, texto: `Último backup há ${diasBackup} dias` }
        : { tone: "success" as const, texto: diasBackup === 0 ? "Backup feito hoje" : `Último backup há ${diasBackup} dia(s)` };

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Aparência, segurança, backup e informações do sistema." />

      <div className="section">
        <h3 className="section-title">Aparência</h3>
        <Card>
          <div className="list-row">
            <div className="list-row-main">
              <span className="list-row-title">Tema</span>
              <span className="list-row-meta">Claro ou escuro, salvo neste dispositivo.</span>
            </div>
            <Button variant="secondary" icon={tema === "light" ? <Moon size={15} /> : <Sun size={15} />} onClick={alternarTema}>
              {tema === "light" ? "Ativar escuro" : "Ativar claro"}
            </Button>
          </div>
          <div className="list-row">
            <div className="list-row-main">
              <span className="list-row-title">Sobre o microfone do assistente</span>
              <span className="list-row-meta">
                Seus dados ficam só neste dispositivo. A leitura em voz também é local. Já o microfone usa o
                reconhecimento de voz do navegador, que costuma processar o áudio pela internet.
              </span>
            </div>
          </div>
          <div className="list-row">
            <div className="list-row-main">
              <span className="list-row-title">Alerta de vencimento de documentos</span>
              <span className="list-row-meta">Quantos dias antes do vencimento o documento aparece em destaque.</span>
            </div>
            <Input
              type="number"
              value={diasAlerta}
              onChange={(e) => handleDiasAlerta(Number(e.target.value) || 30)}
              style={{ width: 80 }}
            />
          </div>
        </Card>
      </div>

      <div className="section">
        <h3 className="section-title">Assistente e voz</h3>
        <ConfiguracaoVoz />
      </div>

      <div className="section">
        <h3 className="section-title">Segurança</h3>
        <SegurancaPin />
      </div>

      <div className="section">
        <h3 className="section-title">Sincronizar entre aparelhos</h3>
        <SincronizacaoBloco />
      </div>

      <div className="section">
        <h3 className="section-title">Cópia completa entre aparelhos</h3>
        <CopiaCompletaBloco />
      </div>

      <div className="section">
        <h3 className="section-title">Backup</h3>
        <Card>
          <div style={{ padding: 18 }}>
            <p className="cfg-texto">
              O cache do navegador pode ser limpo a qualquer momento. O arquivo .db é o que garante
              que nada se perca.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Badge tone={avisoBackup.tone}>{avisoBackup.texto}</Badge>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="primary" icon={<Save size={15} />} onClick={handleBackup}>Salvar backup agora</Button>
              <Button variant="secondary" icon={<FolderOpen size={15} />} onClick={handleRestaurar}>Restaurar de um arquivo</Button>
            </div>
            {status && <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10 }}>{status}</p>}
          </div>
        </Card>
      </div>

      <div className="section">
        <h3 className="section-title">Exportar</h3>
        <ExportarDados />
      </div>

      <div className="section">
        <h3 className="section-title">Sobre</h3>
        <Card>
          <div className="cfg-bloco">
            <p className="cfg-texto" style={{ margin: 0 }}>
              <strong>Nexo</strong> — os dados ficam só neste dispositivo. Nada é enviado para servidores.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

// --- Assistente: nome e voz -------------------------------------------------

function ConfiguracaoVoz() {
  const [nome, setNome] = useState(obterNomeAssistente());
  const [vozes, setVozes] = useState<VozDisponivel[]>([]);
  const [voiceURI, setVoiceURI] = useState(obterVoiceURISalvo() ?? "");
  const [testando, setTestando] = useState(false);

  const [velocidade, setVelocidade] = useState(obterVelocidade());
  const [tom, setTom] = useState(obterTom());

  useEffect(() => {
    aguardarVozes().then((lista) => {
      setVozes(lista);
      if (!voiceURI && lista.length > 0) {
        setVoiceURI(lista[0].voiceURI);
        definirVoiceURISalvo(lista[0].voiceURI);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleNome(valor: string) {
    setNome(valor);
    definirNomeAssistente(valor);
  }

  function handleVoz(uri: string) {
    setVoiceURI(uri);
    definirVoiceURISalvo(uri);
  }

  function handleTestar() {
    setTestando(true);
    falarTexto(`Oi! Eu sou ${nome || "o assistente"}. Seu saldo é de R$ 12.480,50 e o próximo vencimento é 16/08/2026.`)
      .finally(() => setTestando(false));
  }


  return (
    <Card>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Nome do assistente" hint="Usado nas saudações e ao falar em voz alta">
          <Input value={nome} onChange={(e) => handleNome(e.target.value)} placeholder="Nexo" />
        </Field>

        <Field
          label="Voz do sistema (nativa, gratuita)"
          hint={
            vozes.some((v) => v.natural)
              ? "Vozes marcadas (Natural) são bem mais fluidas — priorize essas."
              : "Nenhuma voz \"Natural\" detectada neste navegador/SO — pode variar entre Windows, Mac e celular."
          }
        >
          <Select value={voiceURI} onChange={(e) => handleVoz(e.target.value)}>
            {vozes.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.nome} {v.genero !== "indefinido" ? `— ${v.genero}` : ""} {v.natural ? "★ natural" : ""}
              </option>
            ))}
          </Select>
        </Field>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button variant="secondary" icon={<PlayCircle size={15} />} onClick={handleTestar} disabled={testando}>
            {testando ? "Tocando..." : "Testar voz"}
          </Button>
        </div>

        <div className="form-row-2">
          <Field label={`Velocidade — ${velocidade.toFixed(2)}x`} hint="Um pouco abaixo de 1 costuma soar menos apressado.">
            <input type="range" min="0.7" max="1.2" step="0.05" value={velocidade}
              onChange={(e) => { const v = Number(e.target.value); setVelocidade(v); definirVelocidade(v); }} />
          </Field>
          <Field label={`Tom — ${tom.toFixed(2)}`} hint="Ajuste fino de altura da voz.">
            <input type="range" min="0.8" max="1.2" step="0.05" value={tom}
              onChange={(e) => { const v = Number(e.target.value); setTom(v); definirTom(v); }} />
          </Field>
        </div>

        <p className="field-hint">
          As vozes marcadas com ★ são as neurais do Windows e soam bem mais naturais. Se nenhuma aparecer,
          dá para instalá-las em <strong>Configurações do Windows → Hora e idioma → Fala → Gerenciar vozes →
          Adicionar vozes</strong>, escolhendo Português (Brasil). Depois feche e reabra o Chrome.
        </p>
      </div>
    </Card>
  );
}

// --- PIN de acesso ---------------------------------------------------------

type EstadoPin = "idle" | "definindo" | "confirmando_para_alterar" | "confirmando_para_remover" | "alterando";

function SegurancaPin() {
  const [ativo, setAtivo] = useState(temPinConfigurado());
  const [estado, setEstado] = useState<EstadoPin>("idle");
  const [pinAtual, setPinAtual] = useState("");
  const [pinNovo, setPinNovo] = useState("");
  const [pinConfirma, setPinConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function soDigitos(v: string): string {
    return v.replace(/\D/g, "").slice(0, 6);
  }

  function resetar() {
    setEstado("idle");
    setPinAtual("");
    setPinNovo("");
    setPinConfirma("");
    setErro(null);
  }

  async function handleAtivar(e: React.FormEvent) {
    e.preventDefault();
    if (pinNovo.length !== 6) { setErro("O PIN precisa ter 6 números."); return; }
    if (pinNovo !== pinConfirma) { setErro("Os PINs não coincidem."); return; }
    await definirPin(pinNovo);
    setAtivo(true);
    resetar();
  }

  async function handleVerificarAtual(proximoEstado: "confirmando_para_alterar" | "confirmando_para_remover") {
    setErro(null);
    if (pinAtual.length !== 6) { setErro("Digite os 6 números do PIN atual."); return; }
    const ok = await verificarPin(pinAtual);
    if (!ok) { setErro("PIN atual incorreto."); return; }
    if (proximoEstado === "confirmando_para_remover") {
      removerPin();
      setAtivo(false);
      resetar();
    } else {
      setEstado("alterando");
    }
  }

  async function handleConfirmarNovoPin(e: React.FormEvent) {
    e.preventDefault();
    if (pinNovo.length !== 6) { setErro("O PIN precisa ter 6 números."); return; }
    if (pinNovo !== pinConfirma) { setErro("Os PINs não coincidem."); return; }
    await definirPin(pinNovo);
    resetar();
  }

  return (
    <Card>
      <div style={{ padding: 18 }}>
        <div className="list-row" style={{ padding: 0, border: "none", marginBottom: estado === "idle" ? 0 : 16 }}>
          <div className="list-row-main">
            <span className="list-row-title">PIN de acesso</span>
            <span className="list-row-meta">
              {ativo ? "Ativado — pedido sempre que o app é aberto." : "Desativado — qualquer pessoa com o dispositivo acessa o Nexo direto."}
            </span>
          </div>
          {estado === "idle" && (
            ativo ? (
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="secondary" icon={<Lock size={14} />} onClick={() => setEstado("confirmando_para_alterar")}>Alterar</Button>
                <Button variant="danger" icon={<ShieldOff size={14} />} onClick={() => setEstado("confirmando_para_remover")}>Remover</Button>
              </div>
            ) : (
              <Button variant="primary" icon={<Lock size={14} />} onClick={() => setEstado("definindo")}>Ativar PIN</Button>
            )
          )}
        </div>

        {estado === "definindo" && (
          <form className="form-grid" onSubmit={handleAtivar}>
            <div className="form-row-2">
              <Field label="Novo PIN (6 números)">
                <Input type="password" inputMode="numeric" value={pinNovo} onChange={(e) => setPinNovo(soDigitos(e.target.value))} autoFocus />
              </Field>
              <Field label="Confirmar PIN">
                <Input type="password" inputMode="numeric" value={pinConfirma} onChange={(e) => setPinConfirma(soDigitos(e.target.value))} />
              </Field>
            </div>
            {erro && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{erro}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <Button type="submit" variant="primary">Ativar</Button>
              <Button type="button" variant="ghost" onClick={resetar}>Cancelar</Button>
            </div>
          </form>
        )}

        {(estado === "confirmando_para_alterar" || estado === "confirmando_para_remover") && (
          <div className="form-grid">
            <Field label="Digite o PIN atual">
              <Input type="password" inputMode="numeric" value={pinAtual} onChange={(e) => setPinAtual(soDigitos(e.target.value))} autoFocus />
            </Field>
            {erro && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{erro}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant={estado === "confirmando_para_remover" ? "danger" : "primary"}
                onClick={() => handleVerificarAtual(estado)}
              >
                {estado === "confirmando_para_remover" ? "Confirmar remoção" : "Continuar"}
              </Button>
              <Button variant="ghost" onClick={resetar}>Cancelar</Button>
            </div>
          </div>
        )}

        {estado === "alterando" && (
          <form className="form-grid" onSubmit={handleConfirmarNovoPin}>
            <div className="form-row-2">
              <Field label="Novo PIN (6 números)">
                <Input type="password" inputMode="numeric" value={pinNovo} onChange={(e) => setPinNovo(soDigitos(e.target.value))} autoFocus />
              </Field>
              <Field label="Confirmar novo PIN">
                <Input type="password" inputMode="numeric" value={pinConfirma} onChange={(e) => setPinConfirma(soDigitos(e.target.value))} />
              </Field>
            </div>
            {erro && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{erro}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <Button type="submit" variant="primary">Salvar novo PIN</Button>
              <Button type="button" variant="ghost" onClick={resetar}>Cancelar</Button>
            </div>
          </form>
        )}

        <p className="cfg-nota">
          O PIN bloqueia a tela, não criptografa os dados. Esquecendo o PIN, dá para limpar a trava
          pelas ferramentas do navegador sem perder nada.
        </p>
      </div>
    </Card>
  );
}


/* =====================================================================
   Exportação legível (JSON e CSV)
   ===================================================================== */

function ExportarDados() {
  const [incluirAnexos, setIncluirAnexos] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const tabelas = tabelasDisponiveis();
  const tamanho = tamanhoBancoBytes();

  function handleJson() {
    const pacote = baixarJson({ incluirAnexos });
    const total = Object.values(pacote.contagens).reduce((a, b) => a + b, 0);
    setMensagem(`Exportei ${total} registros em ${Object.keys(pacote.dados).length} tabelas.`);
  }

  return (
    <Card>
      <div style={{ padding: 18 }}>
        <p className="cfg-texto">
          Arquivo legível, para levar os dados embora. Para restaurar o app, use o backup .db acima.
          O cofre de senhas não é incluído.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "14px 0" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, cursor: "pointer" }}>
            <input type="checkbox" checked={incluirAnexos} onChange={(e) => setIncluirAnexos(e.target.checked)} />
            Incluir anexos (deixa o arquivo bem maior)
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="primary" onClick={handleJson}>Exportar tudo em JSON</Button>
          {tabelas.slice(0, 4).map((t) => (
            <Button key={t.nome} onClick={() => baixarCsv(t.nome)}>
              {t.nome} (CSV)
            </Button>
          ))}
        </div>

        {mensagem && <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>{mensagem}</p>}

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 14, marginBottom: 0 }}>
          Banco atual: {(tamanho / 1024 / 1024).toFixed(2)} MB · {tabelas.length} tabelas com dados.
        </p>
      </div>
    </Card>
  );
}
