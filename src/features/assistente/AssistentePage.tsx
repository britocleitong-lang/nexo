import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, FileText, Mic, Volume2, VolumeX, Paperclip, SkipForward, GraduationCap, MessageSquare, Check, RotateCcw } from "lucide-react";
import { responderPergunta, type AnexoSugerido } from "./assistenteEngine";
import { pareceComandoDeLancamento, extrairValor, extrairTipo } from "./assistenteComandos";
import {
  iniciarWizard, avancarWizard, concluirComArquivo, mapearRespostaTexto,
  type EstadoWizard, type OpcaoWizard,
} from "./assistenteWizard";
import { abrirAnexo } from "../anexos/anexosRepository";
import { PageHeader, Button } from "../../components/ui";
import type { TipoCategoria } from "../../types/entities";
import { obterNomeAssistente } from "../../utils/vozConfig";
import { falarTexto, pararFala } from "../../utils/falar";
import { LICOES, licoesConcluidas, marcarLicaoConcluida, reiniciarProgresso, type Licao, type Trilha } from "./licoes";
import { IlustracaoLicao } from "./IlustracaoLicao";

const TRILHAS: Trilha[] = ["Fundamentos", "Dívidas", "Reserva e proteção", "Planejamento", "Comportamento", "Longo prazo"];
import "./AssistentePage.css";

interface Mensagem {
  id: string;
  autor: "usuario" | "assistente";
  texto: string;
  anexos?: AnexoSugerido[];
  opcoes?: OpcaoWizard[];
  pedeArquivo?: boolean;
}

const SUGESTOES = [
  "Quanto gastei este mês?",
  "Qual meu patrimônio líquido?",
  "Adicionar gasto de 35 reais",
  "Quanto tenho investido?",
  "Quais minhas tarefas pendentes?",
];

const CHAVE_VOZ = "nexo:assistente-voz-ativa";

const SpeechRecognitionCtor: any =
  typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

export function AssistentePage() {
  const [modo, setModo] = useState<"assistente" | "professor">("assistente");
  const nomeAssistente = obterNomeAssistente();
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      id: "boas-vindas",
      autor: "assistente",
      texto:
        `Oi! Eu sou ${nomeAssistente === "Nexo" ? "o assistente do Nexo" : nomeAssistente}. Respondo perguntas sobre os seus dados e também lanço despesas/receitas — por exemplo, digite "adicionar gasto de 35 reais" e eu pergunto o resto passo a passo.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [estadoWizard, setEstadoWizard] = useState<EstadoWizard | null>(null);
  const [opcoesAtuais, setOpcoesAtuais] = useState<OpcaoWizard[] | undefined>(undefined);
  const [aguardandoValor, setAguardandoValor] = useState(false);
  const [tipoPendente, setTipoPendente] = useState<TipoCategoria>("despesa");
  const [vozAtiva, setVozAtiva] = useState(() => localStorage.getItem(CHAVE_VOZ) === "1");
  const [ouvindo, setOuvindo] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  function falar(texto: string) {
    if (!vozAtiva) return;
    falarTexto(texto);
  }

  function alternarVoz() {
    const novo = !vozAtiva;
    setVozAtiva(novo);
    localStorage.setItem(CHAVE_VOZ, novo ? "1" : "0");
    if (!novo) pararFala();
  }

  function adicionarAssistente(texto: string, extras?: Partial<Mensagem>) {
    setMensagens((m) => [...m, { id: crypto.randomUUID(), autor: "assistente", texto, ...extras }]);
    falar(texto);
  }

  function adicionarUsuario(texto: string) {
    setMensagens((m) => [...m, { id: crypto.randomUUID(), autor: "usuario", texto }]);
  }

  function processarPasso(passo: { texto: string; opcoes?: OpcaoWizard[]; pedeArquivo?: boolean; finalizado?: boolean; estado: EstadoWizard }) {
    adicionarAssistente(passo.texto, { opcoes: passo.opcoes, pedeArquivo: passo.pedeArquivo });
    setOpcoesAtuais(passo.opcoes);
    setEstadoWizard(passo.finalizado ? null : passo.estado);
  }

  async function enviar(textoForcado?: string) {
    const texto = (textoForcado ?? input).trim();
    if (!texto) return;
    adicionarUsuario(texto);
    setInput("");

    if (estadoWizard) {
      const respostaMapeada = mapearRespostaTexto(texto, opcoesAtuais);
      const passo = await avancarWizard(estadoWizard, respostaMapeada);
      processarPasso(passo);
      return;
    }

    if (aguardandoValor) {
      const valor = extrairValor(texto);
      if (!valor) {
        adicionarAssistente("Não entendi o valor — digite só o número, tipo 35 ou 35,50.");
        return;
      }
      setAguardandoValor(false);
      processarPasso(iniciarWizard(valor, tipoPendente));
      return;
    }

    if (pareceComandoDeLancamento(texto)) {
      const valor = extrairValor(texto);
      const tipo = extrairTipo(texto);
      if (!valor) {
        setAguardandoValor(true);
        setTipoPendente(tipo);
        adicionarAssistente("Qual foi o valor?");
        return;
      }
      processarPasso(iniciarWizard(valor, tipo));
      return;
    }

    const resposta = responderPergunta(texto);
    adicionarAssistente(resposta.texto, { anexos: resposta.anexos });
  }

  function clicarOpcao(opcao: OpcaoWizard) {
    if (!estadoWizard) return;
    adicionarUsuario(opcao.label);
    avancarWizard(estadoWizard, opcao.valor).then(processarPasso);
  }

  async function handleArquivoWizard(arquivo: File | null) {
    if (!estadoWizard) return;
    const passo = await concluirComArquivo(estadoWizard, arquivo);
    processarPasso(passo);
  }

  function iniciarEscuta() {
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as any)
        .map((r: any) => r[0].transcript)
        .join("");
      setInput(transcript);
      const ultimo = event.results[event.results.length - 1];
      if (ultimo.isFinal) {
        setOuvindo(false);
        enviar(transcript);
      }
    };
    recognition.onerror = () => setOuvindo(false);
    recognition.onend = () => setOuvindo(false);
    recognitionRef.current = recognition;
    recognition.start();
    setOuvindo(true);
  }

  function pararEscuta() {
    recognitionRef.current?.stop();
    setOuvindo(false);
  }

  return (
    <div className="assistente-page">
      <PageHeader
        title="Assistente"
        subtitle={modo === "assistente" ? "Faça perguntas, peça pra lançar algo, ou use o microfone." : "Lições curtas de educação financeira, aplicadas aos seus próprios números."}
        actions={
          <>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button className={`tab ${modo === "assistente" ? "active" : ""}`} onClick={() => setModo("assistente")}>
                <MessageSquare size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Assistente
              </button>
              <button className={`tab ${modo === "professor" ? "active" : ""}`} onClick={() => setModo("professor")}>
                <GraduationCap size={14} style={{ verticalAlign: -2, marginRight: 5 }} />Professor
              </button>
            </div>
            <button className={`assistente-voz-toggle ${vozAtiva ? "ativo" : ""}`} onClick={alternarVoz} title="Ler respostas em voz alta">
              {vozAtiva ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </>
        }
      />

      {modo === "professor" ? <ModoProfessor falar={falar} /> : (<>
      <div className="assistente-chat">
        <div className="assistente-mensagens">
          {mensagens.map((m) => (
            <div key={m.id} className={`assistente-msg ${m.autor}`}>
              {m.autor === "assistente" && <Sparkles size={14} className="assistente-msg-icone" />}
              <div className="assistente-msg-conteudo">
                <p>{m.texto}</p>
                {m.anexos?.map((a) => (
                  <button key={a.id} className="assistente-anexo" onClick={() => abrirAnexo(a.id)}>
                    <FileText size={14} /> {a.nome}
                  </button>
                ))}
                {m.opcoes && (
                  <div className="assistente-opcoes">
                    {m.opcoes.map((o) => (
                      <button key={o.valor} className="assistente-opcao-btn" onClick={() => clicarOpcao(o)}>{o.label}</button>
                    ))}
                  </div>
                )}
                {m.pedeArquivo && (
                  <div className="assistente-arquivo-row">
                    <label className="assistente-anexo" style={{ cursor: "pointer" }}>
                      <Paperclip size={14} /> Escolher arquivo
                      <input type="file" style={{ display: "none" }} onChange={(e) => handleArquivoWizard(e.target.files?.[0] ?? null)} />
                    </label>
                    <button className="assistente-opcao-btn" onClick={() => handleArquivoWizard(null)}>
                      <SkipForward size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Pular
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={fimRef} />
        </div>

        {mensagens.length <= 1 && (
          <div className="assistente-sugestoes">
            {SUGESTOES.map((s) => (
              <button key={s} className="assistente-sugestao" onClick={() => enviar(s)}>{s}</button>
            ))}
          </div>
        )}

        <div className="assistente-input-row">
          {SpeechRecognitionCtor && (
            <button
              className={`assistente-mic ${ouvindo ? "ouvindo" : ""}`}
              onClick={ouvindo ? pararEscuta : iniciarEscuta}
              title={ouvindo ? "Parar de ouvir" : "Falar com o microfone"}
            >
              <Mic size={16} />
            </button>
          )}
          <input
            className="assistente-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") enviar(); }}
            placeholder={ouvindo ? "Ouvindo..." : "Pergunte ou peça pra lançar algo..."}
          />
          <button className="assistente-enviar" onClick={() => enviar()} aria-label="Enviar">
            <Send size={16} />
          </button>
        </div>
      </div>
      </>)}
    </div>
  );
}

// --- Modo professor ----------------------------------------------------------

function ModoProfessor({ falar }: { falar: (t: string) => void }) {
  const [concluidas, setConcluidas] = useState<string[]>(licoesConcluidas());
  const [aberta, setAberta] = useState<Licao | null>(null);

  const progresso = Math.round((concluidas.length / LICOES.length) * 100);

  function concluir(licao: Licao) {
    marcarLicaoConcluida(licao.id);
    setConcluidas(licoesConcluidas());
    setAberta(null);
  }

  if (aberta) {
    const diagnostico = aberta.diagnostico?.() ?? null;
    return (
      <div className="professor-licao">
        <button className="voltar-link" onClick={() => setAberta(null)}>← Todas as lições</button>
        <div className="professor-licao-topo">
          <IlustracaoLicao chave={aberta.ilustracao} tamanho={104} />
          <div>
            <span className="professor-card-trilha">{aberta.trilha}</span>
            <h2 className="professor-licao-titulo">{aberta.titulo}</h2>
            <span className="professor-duracao">{aberta.duracao} de leitura</span>
          </div>
        </div>

        {aberta.conteudo.map((paragrafo, i) => (
          <p key={i} className="professor-paragrafo">{paragrafo}</p>
        ))}

        {diagnostico && (
          <div className="professor-diagnostico">
            <span className="professor-diagnostico-rotulo">No seu caso</span>
            <p>{diagnostico}</p>
          </div>
        )}

        <div className="professor-acoes">
          <Button variant="secondary" onClick={() => falar(aberta.conteudo.join(" "))} icon={<Volume2 size={15} />}>
            Ouvir a lição
          </Button>
          <Button variant="primary" onClick={() => concluir(aberta)} icon={<Check size={15} />}>
            {concluidas.includes(aberta.id) ? "Marcar de novo" : "Marcar como lida"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="professor-progresso">
        <div className="professor-progresso-barra"><span style={{ width: `${progresso}%` }} /></div>
        <span>{concluidas.length} de {LICOES.length} lições</span>
        {concluidas.length > 0 && (
          <button className="link-sutil" onClick={() => { reiniciarProgresso(); setConcluidas([]); }}>
            <RotateCcw size={11} /> reiniciar
          </button>
        )}
      </div>

      {TRILHAS.map((trilha) => (
        <div key={trilha} className="professor-trilha">
          <h3 className="section-title">{trilha}</h3>
          <div className="professor-lista">
        {LICOES.filter((l) => l.trilha === trilha).map((l, i) => {
          const feita = concluidas.includes(l.id);
          return (
            <button key={l.id} className={`professor-card ${feita ? "feita" : ""}`} onClick={() => setAberta(l)}>
              <span className="professor-card-arte"><IlustracaoLicao chave={l.ilustracao} tamanho={64} /></span>
              <span className="professor-card-corpo">
                <span className="professor-card-trilha">{l.trilha}</span>
                <span className="professor-card-titulo">{l.titulo}</span>
                <span className="professor-card-meta">{l.duracao}</span>
              </span>
              <span className={`professor-numero ${feita ? "feita" : ""}`}>{feita ? <Check size={14} /> : i + 1}</span>
            </button>
          );
        })}
          </div>
        </div>
      ))}
    </div>
  );
}
