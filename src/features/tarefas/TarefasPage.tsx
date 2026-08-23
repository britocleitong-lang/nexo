import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Circle, CircleDot, CircleCheckBig, Repeat, X } from "lucide-react";
import type { Tarefa, PrioridadeTarefa, StatusTarefa, Subtarefa } from "../../types/entities";
import { criarTarefa, atualizarTarefa, excluirTarefa, listarTarefas, mudarStatusTarefa, RECORRENCIAS_TAREFA } from "./tarefasRepository";
import { listarSubtarefas, contarSubtarefas, criarSubtarefa, alternarSubtarefa, excluirSubtarefa } from "./subtarefasRepository";
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select } from "../../components/ui";
import { AnexosSection } from "../../components/AnexosSection";
import { formatarData } from "../../utils/format";
import { confirmar } from "../../components/Confirm";

const PRIORIDADE_TONE: Record<PrioridadeTarefa, "danger" | "warn" | "muted"> = {
  alta: "danger",
  media: "warn",
  baixa: "muted",
};

const PROXIMO_STATUS: Record<StatusTarefa, StatusTarefa> = {
  pendente: "andamento",
  andamento: "concluida",
  concluida: "pendente",
};

const STATUS_ICON: Record<StatusTarefa, typeof Circle> = {
  pendente: Circle,
  andamento: CircleDot,
  concluida: CircleCheckBig,
};

export function TarefasPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Tarefa | null>(null);
  const [titulo, setTitulo] = useState("");
  const [prioridade, setPrioridade] = useState<PrioridadeTarefa>("media");
  const [prazo, setPrazo] = useState("");
  const [recorrencia, setRecorrencia] = useState("");

  function recarregar() {
    setTarefas(listarTarefas());
  }

  useEffect(() => {
    recarregar();
  }, []);

  function abrirNovo() {
    setEditando(null);
    setTitulo("");
    setPrioridade("media");
    setPrazo("");
    setRecorrencia("");
    setAberto(true);
  }

  function abrirEdicao(t: Tarefa) {
    setEditando(t);
    setTitulo(t.titulo);
    setPrioridade(t.prioridade);
    setPrazo(t.prazo ?? "");
    setRecorrencia(t.recorrencia ?? "");
    setAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    const dados = { titulo: titulo.trim(), prioridade, prazo: prazo || null, recorrencia: recorrencia || null };
    if (editando) {
      await atualizarTarefa(editando.id, dados);
    } else {
      await criarTarefa(dados);
    }
    setAberto(false);
    recarregar();
  }

  async function handleAvancarStatus(t: Tarefa) {
    await mudarStatusTarefa(t.id, PROXIMO_STATUS[t.status]);
    recarregar();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir tarefa?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirTarefa(id);
    recarregar();
  }

  return (
    <div>
      <PageHeader
        title="Tarefas"
        subtitle="Clique no círculo para avançar o status: pendente → em andamento → concluída."
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Nova tarefa</Button>}
      />

      <Card>
        {tarefas.length === 0 ? (
          <EmptyState title="Nenhuma tarefa cadastrada" description="Adicione o que precisa fazer." />
        ) : (
          <div className="list">
            {tarefas.map((t) => {
              const Icone = STATUS_ICON[t.status];
              const sub = contarSubtarefas(t.id);
              return (
                <div key={t.id} className="list-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <button className="icon-btn" onClick={() => handleAvancarStatus(t)} aria-label="Mudar status">
                      <Icone size={17} />
                    </button>
                    <div className="list-row-main">
                      <span className="list-row-title" style={{ textDecoration: t.status === "concluida" ? "line-through" : "none" }}>
                        {t.titulo}
                      </span>
                      <span className="list-row-meta">
                        <Badge tone={PRIORIDADE_TONE[t.prioridade]}>{t.prioridade}</Badge>
                        {t.prazo && <span>Prazo: {formatarData(t.prazo)}</span>}
                        {t.recorrencia && <span><Repeat size={11} style={{ verticalAlign: -2 }} /> {RECORRENCIAS_TAREFA.find((r) => r.valor === t.recorrencia)?.label}</span>}
                        {sub.total > 0 && <span>{sub.concluidas}/{sub.total} subtarefas</span>}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="icon-btn" onClick={() => abrirEdicao(t)} aria-label="Editar">
                      <Pencil size={14} />
                    </button>
                    <button className="icon-btn danger" onClick={() => handleExcluir(t.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Drawer open={aberto} title={editando ? "Editar tarefa" : "Nova tarefa"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Título">
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
          </Field>
          <Field label="Prioridade">
            <Select value={prioridade} onChange={(e) => setPrioridade(e.target.value as PrioridadeTarefa)}>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </Select>
          </Field>
          <div className="form-row-2">
            <Field label="Prazo">
              <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </Field>
            <Field label="Repetir" hint="Cria a próxima automaticamente ao concluir">
              <Select value={recorrencia} onChange={(e) => setRecorrencia(e.target.value)}>
                <option value="">Não repete</option>
                {RECORRENCIAS_TAREFA.map((r) => <option key={r.valor} value={r.valor}>{r.label}</option>)}
              </Select>
            </Field>
          </div>
          <Button type="submit" variant="primary">{editando ? "Salvar alterações" : "Salvar"}</Button>
          {editando ? (
            <>
              <SubtarefasSection tarefaId={editando.id} onMudou={recarregar} />
              <AnexosSection entidadeTipo="tarefa" entidadeId={editando.id} />
            </>
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              Salve a tarefa primeiro para poder adicionar subtarefas e anexos.
            </p>
          )}
        </form>
      </Drawer>
    </div>
  );
}

// --- Subtarefas (checklist) --------------------------------------------------

function SubtarefasSection({ tarefaId, onMudou }: { tarefaId: string; onMudou: () => void }) {
  const [subtarefas, setSubtarefas] = useState<Subtarefa[]>([]);
  const [novoTitulo, setNovoTitulo] = useState("");

  function recarregar() {
    setSubtarefas(listarSubtarefas(tarefaId));
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefaId]);

  async function handleAdicionar() {
    if (!novoTitulo.trim()) return;
    await criarSubtarefa(tarefaId, novoTitulo);
    setNovoTitulo("");
    recarregar();
    onMudou();
  }

  async function handleAlternar(s: Subtarefa) {
    await alternarSubtarefa(s.id, !s.concluida);
    recarregar();
    onMudou();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir subtarefa?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirSubtarefa(id);
    recarregar();
    onMudou();
  }

  return (
    <div className="anexos-section">
      <div className="anexos-header">
        <span className="anexos-titulo">Subtarefas</span>
      </div>
      {subtarefas.map((s) => (
        <div key={s.id} className="anexo-item">
          <button type="button" className="icon-btn" onClick={() => handleAlternar(s)} style={{ flexShrink: 0 }}>
            {s.concluida ? <CircleCheckBig size={14} /> : <Circle size={14} />}
          </button>
          <span className="anexo-nome" style={{ textDecoration: s.concluida ? "line-through" : "none", cursor: "default" }}>
            {s.titulo}
          </span>
          <button type="button" className="icon-btn danger" onClick={() => handleExcluir(s.id)}><X size={12} /></button>
        </div>
      ))}
      {/* Não é um <form> de propósito — isso já está dentro do form principal
          da tarefa, e HTML não permite formulários aninhados. Um <form> aqui
          dentro faria o navegador disparar os dois submits juntos e fechar
          o painel inteiro ao adicionar uma subtarefa. */}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <Input
          value={novoTitulo}
          onChange={(e) => setNovoTitulo(e.target.value)}
          placeholder="Adicionar item..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdicionar();
            }
          }}
        />
        <Button type="button" variant="secondary" icon={<Plus size={14} />} onClick={handleAdicionar}>Adicionar</Button>
      </div>
    </div>
  );
}
