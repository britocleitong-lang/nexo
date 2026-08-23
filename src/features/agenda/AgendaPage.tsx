import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Check, CalendarDays, Repeat, ChevronLeft, ChevronRight, List, Grid3x3 } from "lucide-react";
import type { Evento } from "../../types/entities";
import { criarEvento, atualizarEvento, excluirEvento, listarEventos, marcarConcluido, RECORRENCIAS_EVENTO } from "./agendaRepository";
import { listarOpcoes, criarOpcao, GRUPO_EVENTO_TIPO } from "../cadastros/opcoesRepository";
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select, SelectCriavel } from "../../components/ui";
import { AnexosSection } from "../../components/AnexosSection";
import { diasAte, formatarDataHora, hojeISO } from "../../utils/format";
import { confirmar } from "../../components/Confirm";

type Visualizacao = "lista" | "calendario";

export function AgendaPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("calendario");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Evento | null>(null);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("");
  const [dataHora, setDataHora] = useState(`${hojeISO()}T09:00`);
  const [recorrencia, setRecorrencia] = useState("");

  function recarregar() {
    setEventos(listarEventos());
    setTipos(listarOpcoes(GRUPO_EVENTO_TIPO).map((o) => o.valor));
  }

  useEffect(() => {
    recarregar();
  }, []);

  function abrirNovo(dataPreenchida?: string) {
    setEditando(null);
    setTitulo("");
    setTipo(tipos[0] ?? "");
    setDataHora(dataPreenchida ? `${dataPreenchida}T09:00` : `${hojeISO()}T09:00`);
    setRecorrencia("");
    setAberto(true);
  }

  function abrirEdicao(ev: Evento) {
    setEditando(ev);
    setTitulo(ev.titulo);
    setTipo(ev.tipo);
    setDataHora(ev.data_hora);
    setRecorrencia(ev.recorrencia ?? "");
    setAberto(true);
  }

  async function handleCriarTipo(nome: string): Promise<string> {
    const valor = await criarOpcao(GRUPO_EVENTO_TIPO, nome);
    setTipos(listarOpcoes(GRUPO_EVENTO_TIPO).map((o) => o.valor));
    return valor;
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !tipo) return;
    const dados = { titulo: titulo.trim(), tipo, data_hora: dataHora, recorrencia: recorrencia || null };
    if (editando) {
      await atualizarEvento(editando.id, dados);
    } else {
      await criarEvento(dados);
    }
    setAberto(false);
    recarregar();
  }

  async function handleConcluir(id: string, atual: number) {
    await marcarConcluido(id, atual === 0);
    recarregar();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir evento?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirEvento(id);
    recarregar();
  }

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Compromissos, consultas e prazos importantes."
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => abrirNovo()}>Novo evento</Button>}
      />

      <div className="tabs">
        <button className={`tab ${visualizacao === "calendario" ? "active" : ""}`} onClick={() => setVisualizacao("calendario")}>
          <Grid3x3 size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Calendário
        </button>
        <button className={`tab ${visualizacao === "lista" ? "active" : ""}`} onClick={() => setVisualizacao("lista")}>
          <List size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Lista
        </button>
      </div>

      {visualizacao === "calendario" ? (
        <CalendarioMensal eventos={eventos} onNovoEvento={abrirNovo} onClickEvento={abrirEdicao} />
      ) : (
        <Card>
          {eventos.length === 0 ? (
            <EmptyState title="Nenhum evento cadastrado" description="Adicione compromissos e prazos importantes." />
          ) : (
            <div className="list">
              {eventos.map((ev) => {
                const dias = diasAte(ev.data_hora);
                return (
                  <div key={ev.id} className="list-row" style={{ opacity: ev.concluido ? 0.5 : 1 }}>
                    <div className="list-row-main">
                      <span className="list-row-title" style={{ textDecoration: ev.concluido ? "line-through" : "none" }}>
                        <CalendarDays size={14} style={{ marginRight: 6, verticalAlign: -2, color: "var(--text-muted)" }} />
                        {ev.titulo}
                      </span>
                      <span className="list-row-meta">
                        <Badge tone="muted">{ev.tipo}</Badge>
                        <span>{formatarDataHora(ev.data_hora)}</span>
                        {ev.recorrencia && <span><Repeat size={11} style={{ verticalAlign: -2 }} /> {RECORRENCIAS_EVENTO.find((r) => r.valor === ev.recorrencia)?.label}</span>}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {!ev.concluido && dias !== null && dias <= 7 && dias >= 0 && <Badge tone="warn">Em {dias}d</Badge>}
                      <button className="icon-btn" onClick={() => handleConcluir(ev.id, ev.concluido)} aria-label="Concluir">
                        <Check size={15} />
                      </button>
                      <button className="icon-btn" onClick={() => abrirEdicao(ev)} aria-label="Editar">
                        <Pencil size={14} />
                      </button>
                      <button className="icon-btn danger" onClick={() => handleExcluir(ev.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <Drawer open={aberto} title={editando ? "Editar evento" : "Novo evento"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Título">
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
          </Field>
          <Field label="Tipo">
            <SelectCriavel
              value={tipo}
              onChange={setTipo}
              opcoes={tipos.map((t) => ({ id: t, label: t }))}
              onCriarOpcao={handleCriarTipo}
            />
          </Field>
          <div className="form-row-2">
            <Field label="Data e hora">
              <Input type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} />
            </Field>
            <Field label="Repetir" hint="Cria a próxima ao concluir">
              <Select value={recorrencia} onChange={(e) => setRecorrencia(e.target.value)}>
                <option value="">Não repete</option>
                {RECORRENCIAS_EVENTO.map((r) => <option key={r.valor} value={r.valor}>{r.label}</option>)}
              </Select>
            </Field>
          </div>
          <Button type="submit" variant="primary">{editando ? "Salvar alterações" : "Salvar"}</Button>
          {editando ? (
            <AnexosSection entidadeTipo="evento" entidadeId={editando.id} />
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              Salve o evento primeiro para poder anexar um arquivo.
            </p>
          )}
        </form>
      </Drawer>
    </div>
  );
}

// --- Calendário mensal -------------------------------------------------------

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function CalendarioMensal({
  eventos,
  onNovoEvento,
  onClickEvento,
}: {
  eventos: Evento[];
  onNovoEvento: (data: string) => void;
  onClickEvento: (ev: Evento) => void;
}) {
  const [mesVisivel, setMesVisivel] = useState(() => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  });

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, Evento[]>();
    for (const ev of eventos) {
      const dia = ev.data_hora.slice(0, 10);
      if (!mapa.has(dia)) mapa.set(dia, []);
      mapa.get(dia)!.push(ev);
    }
    return mapa;
  }, [eventos]);

  const celulas = useMemo(() => {
    const ano = mesVisivel.getFullYear();
    const mes = mesVisivel.getMonth();
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const dias: Array<{ data: string; numero: number; foraDoMes: boolean }> = [];

    // dias do mês anterior pra preencher a primeira semana
    const diasMesAnterior = new Date(ano, mes, 0).getDate();
    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
      const d = diasMesAnterior - i;
      dias.push({ data: isoLocal(ano, mes - 1, d), numero: d, foraDoMes: true });
    }
    for (let d = 1; d <= totalDias; d++) {
      dias.push({ data: isoLocal(ano, mes, d), numero: d, foraDoMes: false });
    }
    // completa até fechar semanas de 7
    while (dias.length % 7 !== 0) {
      const proximo = dias.length - (primeiroDiaSemana + totalDias) + 1;
      dias.push({ data: isoLocal(ano, mes + 1, proximo), numero: proximo, foraDoMes: true });
    }
    return dias;
  }, [mesVisivel]);

  const hojeStr = hojeISO();

  return (
    <Card>
      <div className="calendario-header">
        <button className="icon-btn" onClick={() => setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() - 1, 1))}>
          <ChevronLeft size={16} />
        </button>
        <span className="calendario-titulo">{MESES[mesVisivel.getMonth()]} {mesVisivel.getFullYear()}</span>
        <button className="icon-btn" onClick={() => setMesVisivel(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 1))}>
          <ChevronRight size={16} />
        </button>
        <Button variant="ghost" onClick={() => setMesVisivel(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
          Hoje
        </Button>
      </div>

      <div className="calendario-grid">
        {DIAS_SEMANA.map((d) => <div key={d} className="calendario-dia-semana">{d}</div>)}
        {celulas.map((c) => {
          const eventosDoDia = eventosPorDia.get(c.data) ?? [];
          return (
            <button
              key={c.data}
              className={`calendario-celula ${c.foraDoMes ? "fora-do-mes" : ""} ${c.data === hojeStr ? "hoje" : ""}`}
              onClick={() => onNovoEvento(c.data)}
            >
              <span className="calendario-numero">{c.numero}</span>
              <div className="calendario-eventos">
                {eventosDoDia.slice(0, 3).map((ev) => (
                  <span
                    key={ev.id}
                    className={`calendario-evento-item ${ev.concluido ? "concluido" : ""}`}
                    onClick={(e) => { e.stopPropagation(); onClickEvento(ev); }}
                  >
                    {ev.titulo}
                  </span>
                ))}
                {eventosDoDia.length > 3 && <span className="calendario-evento-mais">+{eventosDoDia.length - 3}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function isoLocal(ano: number, mes: number, dia: number): string {
  const d = new Date(ano, mes, dia);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
