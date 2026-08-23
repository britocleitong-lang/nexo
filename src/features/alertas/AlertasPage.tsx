import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, BellOff, Check, Clock, CalendarPlus, FileText, Wrench, HeartPulse,
  CalendarDays, CheckSquare, Wallet, Repeat, PiggyBank, Target, Syringe, RotateCcw,
} from "lucide-react";
import { listarAlertas, resumoAlertas, type Alerta, type OrigemAlerta } from "../../core/alertas/alertasEngine";
import { dispensarAlerta, adiarAlerta, limparDispensados, totalDispensados } from "../../core/alertas/alertasRepository";
import {
  permissaoAtual, pedirPermissao, notificacoesHabilitadas, definirHabilitado,
  notificarTeste, baixarIcsDosAlertas,
} from "../../core/notificacoes/notificacoes";
import { Badge, Button, Card, EmptyState, PageHeader, StatCard } from "../../components/ui";
import { textoPrazo } from "../../core/datas";
import { confirmar } from "../../components/Confirm";
import "./AlertasPage.css";

const ICONES: Record<OrigemAlerta, typeof FileText> = {
  documento: FileText,
  veiculo: Wrench,
  imovel: Wrench,
  saude: HeartPulse,
  agenda: CalendarDays,
  tarefa: CheckSquare,
  financeiro: Wallet,
  recorrencia: Repeat,
  orcamento: PiggyBank,
  meta: Target,
  vacina: Syringe,
};

export function AlertasPage() {
  const navigate = useNavigate();
  const [versao, setVersao] = useState(0);
  const [filtro, setFiltro] = useState<OrigemAlerta | "todos">("todos");
  const [permissao, setPermissao] = useState(permissaoAtual());
  const [habilitado, setHabilitado] = useState(notificacoesHabilitadas());
  const [mensagemTeste, setMensagemTeste] = useState("");

  const alertas = useMemo(() => listarAlertas(), [versao]);
  const resumo = useMemo(() => resumoAlertas(alertas), [alertas]);
  const dispensados = useMemo(() => totalDispensados(), [versao]);

  useEffect(() => { setPermissao(permissaoAtual()); }, [versao]);

  const origensPresentes = useMemo(() => {
    const set = new Set<OrigemAlerta>();
    for (const a of alertas) set.add(a.origem);
    return [...set];
  }, [alertas]);

  const visiveis = filtro === "todos" ? alertas : alertas.filter((a) => a.origem === filtro);

  async function handleDispensar(a: Alerta) {
    await dispensarAlerta(a.chave);
    setVersao((v) => v + 1);
  }

  async function handleAdiar(a: Alerta, dias: number) {
    await adiarAlerta(a.chave, dias);
    setVersao((v) => v + 1);
  }

  async function handleReativarTodos() {
    const ok = await confirmar({
      titulo: "Trazer de volta os avisos dispensados?",
      descricao: `${dispensados} aviso(s) voltam a aparecer, inclusive os que você já resolveu.`,
    });
    if (!ok) return;
    await limparDispensados();
    setVersao((v) => v + 1);
  }

  async function handleAtivarNotificacoes() {
    const resultado = await pedirPermissao();
    setPermissao(resultado);
    setHabilitado(notificacoesHabilitadas());
    if (resultado === "denied") {
      setMensagemTeste("O navegador bloqueou. Para reverter, clique no cadeado ao lado do endereço e libere as notificações deste site.");
    }
  }

  async function handleTestar() {
    const ok = await notificarTeste();
    setMensagemTeste(ok
      ? "Enviei uma notificação de teste — ela deve aparecer na Central de Ações do Windows."
      : "Não consegui enviar. Confira se a permissão está concedida.");
  }

  return (
    <div>
      <PageHeader
        title="Avisos"
        subtitle="Tudo que vence, atrasa ou precisa de decisão, reunido num lugar só."
        actions={alertas.length > 0 && (
          <Button icon={<CalendarPlus size={16} />} onClick={() => baixarIcsDosAlertas(alertas)}>
            Exportar para o calendário
          </Button>
        )}
      />

      <div className="grid-3 section">
        <StatCard label="Em atraso" value={String(resumo.atrasados)} tone={resumo.atrasados > 0 ? "danger" : "default"} />
        <StatCard label="Vencem em breve" value={String(resumo.urgentes)} tone={resumo.urgentes > 0 ? "warn" : "default"} />
        <StatCard label="Mais à frente" value={String(resumo.total - resumo.atrasados - resumo.urgentes)} />
      </div>

      <div className="section">
        <Card className="alerta-notificacoes">
          <div className="alerta-notif-topo">
            <span className={`alerta-notif-icone ${habilitado ? "ativo" : ""}`}>
              {habilitado ? <Bell size={17} /> : <BellOff size={17} />}
            </span>
            <div className="alerta-notif-texto">
              <strong>Notificações do Windows</strong>
              <p>
                Com o Nexo instalado como aplicativo, os avisos aparecem na Central de Ações.
                A verificação roda uma vez por dia, quando o app está aberto.
                {" "}
                <em>
                  Com o app fechado não há como notificar sem servidor — para esse caso,
                  exporte os avisos para o seu calendário, que já sabe avisar sozinho.
                </em>
              </p>
            </div>
            <div className="alerta-notif-acoes">
              {permissao === "indisponivel" ? (
                <Badge tone="muted">Não suportado neste navegador</Badge>
              ) : permissao === "granted" ? (
                <>
                  <label className="alerta-switch">
                    <input
                      type="checkbox"
                      checked={habilitado}
                      onChange={(e) => { definirHabilitado(e.target.checked); setHabilitado(e.target.checked); }}
                    />
                    Ativadas
                  </label>
                  <Button onClick={handleTestar}>Testar</Button>
                </>
              ) : (
                <Button variant="primary" onClick={handleAtivarNotificacoes}>Ativar notificações</Button>
              )}
            </div>
          </div>
          {mensagemTeste && <p className="alerta-notif-mensagem">{mensagemTeste}</p>}
        </Card>
      </div>

      {origensPresentes.length > 1 && (
        <div className="tabs section">
          <button className={`tab ${filtro === "todos" ? "active" : ""}`} onClick={() => setFiltro("todos")}>
            Todos ({alertas.length})
          </button>
          {origensPresentes.map((o) => (
            <button key={o} className={`tab ${filtro === o ? "active" : ""}`} onClick={() => setFiltro(o)}>
              {alertas.find((a) => a.origem === o)?.origemLabel} ({alertas.filter((a) => a.origem === o).length})
            </button>
          ))}
        </div>
      )}

      {visiveis.length === 0 ? (
        <Card>
          <EmptyState
            title="Nada pedindo atenção"
            description="Documentos, manutenções, exames, contas e tarefas estão todos dentro do prazo. Quando algo se aproximar do vencimento, aparece aqui primeiro."
          />
        </Card>
      ) : (
        <Card>
          <div className="alerta-lista">
            {visiveis.map((a) => {
              const Icone = ICONES[a.origem];
              return (
                <div key={a.chave} className={`alerta-item sev-${a.severidade}`}>
                  <span className="alerta-icone"><Icone size={15} /></span>

                  <button className="alerta-corpo" onClick={() => navigate(a.destino)}>
                    <span className="alerta-titulo">{a.titulo}</span>
                    <span className="alerta-detalhe">
                      {a.origemLabel}
                      {a.detalhe && ` · ${a.detalhe}`}
                    </span>
                  </button>

                  <Badge tone={a.severidade === "atrasado" ? "danger" : a.severidade === "urgente" ? "warn" : "muted"}>
                    {a.dias !== null ? textoPrazo(a.dias) : a.severidade === "atrasado" ? "vencido" : "atenção"}
                  </Badge>

                  <div className="alerta-acoes">
                    <button className="icon-btn" title="Lembrar daqui a 7 dias" onClick={() => handleAdiar(a, 7)}>
                      <Clock size={15} />
                    </button>
                    <button className="icon-btn" title="Já resolvi" onClick={() => handleDispensar(a)}>
                      <Check size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {dispensados > 0 && (
        <div className="alerta-dispensados">
          <span>{dispensados} aviso(s) foram dispensados ou adiados.</span>
          <button className="link-sutil" onClick={handleReativarTodos}>
            <RotateCcw size={12} /> Trazer todos de volta
          </button>
        </div>
      )}
    </div>
  );
}
