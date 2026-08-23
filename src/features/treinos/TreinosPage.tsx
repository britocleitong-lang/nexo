import { useEffect, useMemo, useState } from "react";
import {
  Plus, Trash2, Dumbbell, Play, Square, Flame, CalendarCheck,
  Check, Timer, Trophy, Layers,
} from "lucide-react";
import {
  listarRotinas, criarRotina, excluirRotina, exerciciosDaRotina,
  adicionarExercicioNaRotina, removerExercicioDaRotina,
  listarExercicios, criarExercicio, GRUPOS_MUSCULARES,
  listarSessoes, iniciarSessao, encerrarSessao, excluirSessao, seriesDaSessao,
  registrarSerie, atualizarSerie, excluirSerie,
  resumirTreinos, volumePorGrupo, evolucaoVolume, recordes, estimar1RM,
  type Rotina, type Exercicio, type SessaoTreino,
} from "./treinosRepository";
import { listarPessoas } from "../pessoas/pessoasRepository";
import { Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select, StatCard, Textarea } from "../../components/ui";
import { formatarData } from "../../utils/format";
import { textoPrazo } from "../../core/datas";
import { confirmar } from "../../components/Confirm";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import "./TreinosPage.css";

type Aba = "hoje" | "rotinas" | "historico" | "progresso";

export function TreinosPage() {
  const [aba, setAba] = useState<Aba>("hoje");
  const [versao, setVersao] = useState(0);
  const [sessaoAtiva, setSessaoAtiva] = useState<SessaoTreino | null>(null);

  const recarregar = () => setVersao((v) => v + 1);

  // Uma sessão sem `fim` é uma sessão em andamento — o app reabre nela se
  // você fechou o navegador no meio do treino, que é o cenário normal.
  useEffect(() => {
    const aberta = listarSessoes(10).find((s) => !s.fim);
    setSessaoAtiva(aberta ?? null);
  }, [versao]);

  const resumo = useMemo(() => resumirTreinos(), [versao]);

  return (
    <div>
      <PageHeader
        title="Treinos"
        subtitle="Registre série a série. O que sustenta o resto — volume, recorde, progressão — sai daí sozinho."
      />

      <div className="grid-4 section">
        <StatCard
          label="Treinos no mês"
          value={String(resumo.sessoesNoMes)}
          hint={`${resumo.sessoesNaSemana} nos últimos 7 dias`}
          icon={<CalendarCheck size={15} />}
        />
        <StatCard
          label="Volume no mês"
          value={`${(resumo.volumeNoMes / 1000).toFixed(1)} t`}
          hint="Carga × repetições somadas"
          icon={<Layers size={15} />}
        />
        <StatCard
          label="Sequência"
          value={resumo.sequenciaSemanas > 0 ? `${resumo.sequenciaSemanas} sem` : "—"}
          hint="Semanas seguidas treinando"
          tone={resumo.sequenciaSemanas >= 4 ? "success" : "default"}
          icon={<Flame size={15} />}
        />
        <StatCard
          label="Último treino"
          value={resumo.ultimaSessao ? textoPrazo(resumo.diasDesdeUltima) : "—"}
          hint={resumo.duracaoMediaMinutos ? `média de ${resumo.duracaoMediaMinutos} min` : undefined}
          tone={resumo.diasDesdeUltima !== null && resumo.diasDesdeUltima < -6 ? "warn" : "default"}
        />
      </div>

      <div className="tabs section">
        {([["hoje", "Hoje"], ["rotinas", "Rotinas"], ["historico", "Histórico"], ["progresso", "Progresso"]] as const)
          .map(([valor, label]) => (
            <button key={valor} className={`tab ${aba === valor ? "active" : ""}`} onClick={() => setAba(valor)}>
              {label}
            </button>
          ))}
      </div>

      {aba === "hoje" && (
        <SessaoAtual
          sessao={sessaoAtiva}
          somenteLeitura={false}
          onMudou={recarregar}
        />
      )}
      {aba === "rotinas" && <Rotinas versao={versao} onMudou={recarregar} />}
      {aba === "historico" && <Historico versao={versao} onMudou={recarregar} />}
      {aba === "progresso" && <Progresso versao={versao} />}
    </div>
  );
}

// =====================================================================
// Sessão em andamento
// =====================================================================

function SessaoAtual({ sessao, somenteLeitura, onMudou }: {
  sessao: SessaoTreino | null; somenteLeitura: boolean; onMudou: () => void;
}) {
  const [rotinas] = useState<Rotina[]>(() => listarRotinas());
  const [rotinaId] = useState("");
  const [esforco, setEsforco] = useState("");
  const [seletorAberto, setSeletorAberto] = useState(false);

  const series = useMemo(() => (sessao ? seriesDaSessao(sessao.id) : []), [sessao, somenteLeitura]);
  const [, forcar] = useState(0);
  const atualizar = () => { forcar((v) => v + 1); onMudou(); };

  async function comecar(rotina?: Rotina) {
    await iniciarSessao({
      rotina_id: rotina?.id ?? null,
      nome: rotina?.nome ?? "Treino livre",
      pessoa_id: listarPessoas().find((p) => p.principal === 1)?.id ?? null,
    });
    onMudou();
  }

  async function terminar() {
    if (!sessao) return;
    const feitas = series.filter((s) => s.concluida === 1).length;
    const ok = await confirmar({
      titulo: "Encerrar o treino?",
      descricao: feitas < series.length
        ? `${series.length - feitas} série(s) não foram marcadas e serão descartadas — elas não aconteceram.`
        : "As séries registradas ficam salvas no histórico.",
    });
    if (!ok) return;
    await encerrarSessao(sessao.id, esforco ? Number(esforco) : null);
    setEsforco("");
    onMudou();
  }

  if (!sessao) {
    return (
      <>
        <Card>
          <EmptyState
            title="Nenhum treino em andamento"
            description="Escolha uma rotina para começar já com os exercícios carregados e o peso da última vez preenchido, ou comece um treino livre e vá montando."
            action={(
              <div className="treino-comecar">
                <Button variant="primary" icon={<Play size={16} />} onClick={() => comecar()}>
                  Treino livre
                </Button>
                {rotinas.length > 0 && (
                  <Select value={rotinaId} onChange={(e) => {
                    const r = rotinas.find((x) => x.id === e.target.value);
                    if (r) comecar(r);
                  }}>
                    <option value="">Começar por uma rotina...</option>
                    {rotinas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                  </Select>
                )}
              </div>
            )}
          />
        </Card>
      </>
    );
  }

  const porExercicio = new Map<string, typeof series>();
  for (const s of series) {
    if (!porExercicio.has(s.exercicio_id)) porExercicio.set(s.exercicio_id, []);
    porExercicio.get(s.exercicio_id)!.push(s);
  }

  const feitas = series.filter((s) => s.concluida === 1);
  const volume = feitas.reduce((sum, s) => sum + (s.peso ?? 0) * (s.repeticoes ?? 0), 0);

  return (
    <>
      <Card className="treino-ativo">
        <div className="treino-ativo-topo">
          <div>
            <span className="treino-ativo-selo"><Timer size={12} /> Em andamento</span>
            <h2>{sessao.nome}</h2>
            <p>{formatarData(sessao.data)} · {feitas.length} de {series.length} séries · {volume.toLocaleString("pt-BR")} kg de volume</p>
          </div>
          {(
            <div className="treino-ativo-acoes">
              <Input
                type="number" min="1" max="10" placeholder="Esforço 1-10"
                value={esforco} onChange={(e) => setEsforco(e.target.value)}
                style={{ width: 110 }}
              />
              <Button variant="primary" icon={<Square size={15} />} onClick={terminar}>Encerrar</Button>
            </div>
          )}
        </div>
      </Card>

      {[...porExercicio.entries()].map(([exercicioId, lista]) => (
        <div key={exercicioId} className="section">
          <h3 className="treino-exercicio-nome">
            <Dumbbell size={15} /> {lista[0].exercicio_nome}
          </h3>
          <Card>
            <div className="treino-series">
              <div className="treino-serie treino-serie-cabecalho">
                <span>#</span><span>Peso (kg)</span><span>Reps</span><span>1RM est.</span><span></span><span></span>
              </div>
              {lista.map((s) => (
                <LinhaSerie key={s.id} serie={s} somenteLeitura={false} onMudou={atualizar} />
              ))}
            </div>
            {(
              <button
                className="treino-add-serie"
                onClick={async () => {
                  const ultima = lista[lista.length - 1];
                  await registrarSerie({
                    sessao_id: sessao.id, exercicio_id: exercicioId,
                    serie_numero: lista.length + 1,
                    peso: ultima?.peso ?? null, repeticoes: ultima?.repeticoes ?? null,
                  });
                  atualizar();
                }}
              >
                <Plus size={14} /> Adicionar série
              </button>
            )}
          </Card>
        </div>
      ))}

      {(
        <Button icon={<Plus size={16} />} onClick={() => setSeletorAberto(true)}>
          Adicionar exercício ao treino
        </Button>
      )}

      <SeletorExercicio
        aberto={seletorAberto}
        onFechar={() => setSeletorAberto(false)}
        onEscolher={async (ex) => {
          await registrarSerie({ sessao_id: sessao.id, exercicio_id: ex.id, serie_numero: 1 });
          setSeletorAberto(false);
          atualizar();
        }}
      />
    </>
  );
}

function LinhaSerie({ serie, somenteLeitura, onMudou }: {
  serie: ReturnType<typeof seriesDaSessao>[number]; somenteLeitura: boolean; onMudou: () => void;
}) {
  const [peso, setPeso] = useState(serie.peso != null ? String(serie.peso) : "");
  const [reps, setReps] = useState(serie.repeticoes != null ? String(serie.repeticoes) : "");

  async function salvar(concluida?: boolean) {
    await atualizarSerie(serie.id, {
      peso: peso ? Number(peso) : null,
      repeticoes: reps ? Number(reps) : null,
      ...(concluida !== undefined ? { concluida: concluida ? 1 : 0 } : {}),
    });
    onMudou();
  }

  const rm = peso && reps ? estimar1RM(Number(peso), Number(reps)) : null;

  return (
    <div className={`treino-serie ${serie.concluida ? "feita" : ""}`}>
      <span className="treino-serie-num">{serie.serie_numero}</span>
      <Input
        type="number" step="0.5" inputMode="decimal" value={peso} disabled={somenteLeitura}
        onChange={(e) => setPeso(e.target.value)} onBlur={() => salvar()} placeholder="—"
      />
      <Input
        type="number" inputMode="numeric" value={reps} disabled={somenteLeitura}
        onChange={(e) => setReps(e.target.value)} onBlur={() => salvar()} placeholder="—"
      />
      <span className="treino-rm tabular">{rm ? `${rm.toFixed(1)} kg` : "—"}</span>
      {true ? (
        <>
          <button
            className={`treino-check ${serie.concluida ? "ativo" : ""}`}
            onClick={() => salvar(serie.concluida !== 1)}
            title={serie.concluida ? "Desmarcar" : "Marcar como feita"}
          >
            <Check size={14} />
          </button>
          <button className="icon-btn danger" onClick={async () => { await excluirSerie(serie.id); onMudou(); }}>
            <Trash2 size={14} />
          </button>
        </>
      ) : <><span /><span /></>}
    </div>
  );
}

// =====================================================================
// Seletor de exercício
// =====================================================================

function SeletorExercicio({ aberto, onFechar, onEscolher }: {
  aberto: boolean; onFechar: () => void; onEscolher: (ex: Exercicio) => void;
}) {
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState("");
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoGrupo, setNovoGrupo] = useState(GRUPOS_MUSCULARES[0]);
  const [versao, setVersao] = useState(0);

  const exercicios = useMemo(() => listarExercicios(grupo || undefined), [grupo, versao]);
  const filtrados = exercicios.filter((e) =>
    e.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .includes(busca.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));

  return (
    <Drawer open={aberto} title="Escolher exercício" onClose={onFechar}>
      <div className="form-grid">
        <Input autoFocus placeholder="Buscar exercício..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
          <option value="">Todos os grupos</option>
          {GRUPOS_MUSCULARES.map((g) => <option key={g} value={g}>{g}</option>)}
        </Select>

        <div className="treino-lista-exercicios">
          {filtrados.map((ex) => (
            <button key={ex.id} className="treino-item-exercicio" onClick={() => onEscolher(ex)}>
              <span className="treino-item-nome">{ex.nome}</span>
              <span className="treino-item-meta">{ex.grupo_muscular}{ex.equipamento && ` · ${ex.equipamento}`}</span>
            </button>
          ))}
          {filtrados.length === 0 && <p className="treino-vazio">Nenhum exercício com esse nome.</p>}
        </div>

        {criando ? (
          <div className="form-grid">
            <Field label="Nome do exercício">
              <Input autoFocus value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
            </Field>
            <Field label="Grupo muscular">
              <Select value={novoGrupo} onChange={(e) => setNovoGrupo(e.target.value)}>
                {GRUPOS_MUSCULARES.map((g) => <option key={g} value={g}>{g}</option>)}
              </Select>
            </Field>
            <div className="page-actions">
              <Button onClick={() => setCriando(false)}>Cancelar</Button>
              <Button variant="primary" onClick={async () => {
                if (!novoNome.trim()) return;
                await criarExercicio({ nome: novoNome.trim(), grupo_muscular: novoGrupo });
                setNovoNome(""); setCriando(false); setVersao((v) => v + 1);
              }}>Criar</Button>
            </div>
          </div>
        ) : (
          <Button icon={<Plus size={15} />} onClick={() => setCriando(true)}>
            Criar exercício que não está na lista
          </Button>
        )}
      </div>
    </Drawer>
  );
}

// =====================================================================
// Rotinas
// =====================================================================

function Rotinas({ versao, onMudou }: { versao: number; onMudou: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [seletorPara, setSeletorPara] = useState<string | null>(null);

  const rotinas = useMemo(() => listarRotinas(), [versao]);

  return (
    <>
      {(
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAberto(true)} className="treino-btn-topo">
          Nova rotina
        </Button>
      )}

      {rotinas.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma rotina montada"
            description="Rotina é a sua ficha: 'Treino A — peito e tríceps', com os exercícios na ordem. Ao começar um treino por ela, tudo já vem carregado com o peso da última vez."
          />
        </Card>
      ) : (
        <div className="grid-2">
          {rotinas.map((r) => {
            const itens = exerciciosDaRotina(r.id);
            return (
              <Card key={r.id} className="treino-rotina">
                <div className="treino-rotina-topo">
                  <div>
                    <h3>{r.nome}</h3>
                    {r.descricao && <p>{r.descricao}</p>}
                  </div>
                  {(
                    <button className="icon-btn danger" onClick={async () => {
                      const ok = await confirmar({
                        titulo: `Excluir a rotina "${r.nome}"?`,
                        descricao: "Os treinos já registrados por ela continuam no histórico.",
                      });
                      if (!ok) return;
                      await excluirRotina(r.id);
                      onMudou();
                    }}><Trash2 size={15} /></button>
                  )}
                </div>

                <div className="treino-rotina-itens">
                  {itens.map((i) => (
                    <div key={i.id} className="treino-rotina-item">
                      <span>{i.exercicio.nome}</span>
                      <span className="treino-rotina-alvo">
                        {i.series_alvo}× {i.reps_alvo}
                      </span>
                      {(
                        <button className="icon-btn" onClick={async () => {
                          await removerExercicioDaRotina(i.id);
                          onMudou();
                        }}><Trash2 size={13} /></button>
                      )}
                    </div>
                  ))}
                  {itens.length === 0 && <p className="treino-vazio">Nenhum exercício ainda.</p>}
                </div>

                {(
                  <button className="treino-add-serie" onClick={() => setSeletorPara(r.id)}>
                    <Plus size={14} /> Adicionar exercício
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <SeletorExercicio
        aberto={seletorPara !== null}
        onFechar={() => setSeletorPara(null)}
        onEscolher={async (ex) => {
          if (seletorPara) await adicionarExercicioNaRotina(seletorPara, ex.id);
          setSeletorPara(null);
          onMudou();
        }}
      />

      <Drawer open={aberto} title={editandoId ? "Editar rotina" : "Nova rotina"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={async (e) => {
          e.preventDefault();
          if (!nome.trim()) return;
          await criarRotina({ nome: nome.trim(), descricao: descricao.trim() || null });
          setNome(""); setDescricao(""); setEditandoId(null); setAberto(false);
          onMudou();
        }}>
          <Field label="Nome" hint="Ex: Treino A — peito e tríceps">
            <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} required />
          </Field>
          <Field label="Descrição">
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </Field>
          <div className="page-actions">
            <Button type="button" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Criar rotina</Button>
          </div>
        </form>
      </Drawer>
    </>
  );
}

// =====================================================================
// Histórico e progresso
// =====================================================================

function Historico({ versao, onMudou }: { versao: number; onMudou: () => void }) {
  const sessoes = useMemo(() => listarSessoes(60).filter((s) => s.fim), [versao]);

  if (sessoes.length === 0) {
    return <Card><EmptyState title="Nenhum treino registrado" description="Os treinos encerrados aparecem aqui, com volume e duração." /></Card>;
  }

  return (
    <Card>
      <div className="list">
        {sessoes.map((s) => {
          const series = seriesDaSessao(s.id);
          const volume = series.reduce((sum, x) => sum + (x.peso ?? 0) * (x.repeticoes ?? 0), 0);
          return (
            <div key={s.id} className="list-row">
              <span className="treino-icone-sessao"><Dumbbell size={14} /></span>
              <div className="list-row-main">
                <div className="list-row-title">{s.nome}</div>
                <div className="list-row-meta">
                  {formatarData(s.data)} · {series.length} séries
                  {s.duracao_minutos && ` · ${s.duracao_minutos} min`}
                  {s.percepcao_esforco && ` · esforço ${s.percepcao_esforco}/10`}
                </div>
              </div>
              <div className="list-row-value tabular">{(volume / 1000).toFixed(1)} t</div>
              {(
                <div className="list-row-actions">
                  <button className="icon-btn danger" onClick={async () => {
                    const ok = await confirmar({ titulo: "Excluir este treino?", descricao: "Todas as séries registradas nele serão apagadas." });
                    if (!ok) return;
                    await excluirSessao(s.id);
                    onMudou();
                  }}><Trash2 size={15} /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Progresso({ versao }: { versao: number }) {
  const grupos = useMemo(() => volumePorGrupo(30), [versao]);
  const evolucao = useMemo(() => evolucaoVolume(6), [versao]);
  const prs = useMemo(() => recordes(), [versao]);

  if (prs.length === 0) {
    return <Card><EmptyState title="Sem dados ainda" description="Depois de alguns treinos registrados, aparecem aqui o volume por grupo muscular, a evolução mensal e os seus recordes por exercício." /></Card>;
  }

  return (
    <>
      <div className="section">
        <h3 className="section-title">Volume por mês</h3>
        <Card>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}t`} />
                <Tooltip
                  formatter={(v) => `${(Number(v) / 1000).toFixed(1)} t`}
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, fontSize: 12 }}
                />
                <Bar dataKey="volume" name="Volume" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="section">
        <h3 className="section-title">Séries por grupo muscular — últimos 30 dias</h3>
        <Card>
          <div className="treino-grupos">
            {grupos.map((g) => {
              const max = Math.max(...grupos.map((x) => x.series));
              return (
                <div key={g.grupo} className="treino-grupo-linha">
                  <span className="treino-grupo-nome">{g.grupo}</span>
                  <div className="treino-grupo-barra-fundo">
                    <div className="treino-grupo-barra" style={{ width: `${(g.series / max) * 100}%` }} />
                  </div>
                  <span className="treino-grupo-valor tabular">{g.series}</span>
                </div>
              );
            })}
          </div>
          <p className="treino-nota">
            Desequilíbrio grande entre grupos costuma ser sinal de que algo está sendo negligenciado —
            mas o número certo depende do seu programa. Isso é observação, não prescrição.
          </p>
        </Card>
      </div>

      <div className="section">
        <h3 className="section-title">Recordes</h3>
        <Card>
          <div className="list">
            {prs.slice(0, 15).map((r) => (
              <div key={r.exercicio_id} className="list-row">
                <span className="treino-icone-sessao"><Trophy size={14} /></span>
                <div className="list-row-main">
                  <div className="list-row-title">{r.exercicio_nome}</div>
                  <div className="list-row-meta">
                    {r.totalSeries} séries registradas
                    {r.dataMelhor && ` · melhor em ${formatarData(r.dataMelhor)}`}
                  </div>
                </div>
                <div className="treino-pr">
                  <span className="tabular">{r.maiorPeso?.toFixed(1)} kg</span>
                  {r.melhor1RM && <em>1RM est. {r.melhor1RM.toFixed(1)} kg</em>}
                </div>
              </div>
            ))}
          </div>
          <p className="treino-nota">
            O 1RM estimado usa a fórmula de Epley (peso × [1 + reps/30]). Ela é boa até cerca de 10
            repetições e perde precisão acima disso. Serve para comparar progressão ao longo do tempo,
            não para decidir quanto colocar na barra numa tentativa máxima.
          </p>
        </Card>
      </div>
    </>
  );
}
