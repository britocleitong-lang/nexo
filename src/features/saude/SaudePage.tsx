import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, HeartPulse, TrendingUp, Receipt } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import type { RegistroSaude, TipoRegistroSaude, Pessoa } from "../../types/entities";
import {
  TIPOS_SAUDE, criarRegistroSaude, atualizarRegistroSaude, excluirRegistroSaude, listarRegistrosSaude,
  nomesComEvolucao, historicoPorNome, gastosSaudePorPessoa, gastoTotalSaude,
} from "./saudeRepository";
import { listarPessoas } from "../pessoas/pessoasRepository";
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select, StatCard, Textarea } from "../../components/ui";
import { AnexosSection } from "../../components/AnexosSection";
import { diasAte, formatarData, formatarMoeda, hojeISO } from "../../utils/format";
import { confirmar } from "../../components/Confirm";

export function SaudePage() {
  const [registros, setRegistros] = useState<RegistroSaude[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<RegistroSaude | null>(null);

  const [tipo, setTipo] = useState<TipoRegistroSaude>("consulta");
  const [nome, setNome] = useState("");
  const [pessoaId, setPessoaId] = useState("");
  const [data, setData] = useState(hojeISO());
  const [profissional, setProfissional] = useState("");
  const [resultado, setResultado] = useState("");
  const [valorNumerico, setValorNumerico] = useState("");
  const [unidade, setUnidade] = useState("");
  const [dose, setDose] = useState("");
  const [frequencia, setFrequencia] = useState("");
  const [proximaData, setProximaData] = useState("");

  function recarregar() {
    setRegistros(listarRegistrosSaude());
    setPessoas(listarPessoas());
  }

  useEffect(() => {
    recarregar();
  }, []);

  function abrirNovo() {
    setEditando(null);
    setTipo("consulta");
    setNome("");
    setPessoaId("");
    setData(hojeISO());
    setProfissional("");
    setResultado("");
    setValorNumerico("");
    setUnidade("");
    setDose("");
    setFrequencia("");
    setProximaData("");
    setAberto(true);
  }

  function abrirEdicao(r: RegistroSaude) {
    setEditando(r);
    setTipo(r.tipo);
    setNome(r.nome);
    setPessoaId(r.pessoa_id ?? "");
    setData(r.data);
    setProfissional(r.profissional ?? "");
    setResultado(r.resultado ?? "");
    setValorNumerico(r.valor_numerico != null ? String(r.valor_numerico) : "");
    setUnidade(r.unidade ?? "");
    setDose(r.dose ?? "");
    setFrequencia(r.frequencia ?? "");
    setProximaData(r.proxima_data ?? "");
    setAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    const dados = {
      tipo,
      nome: nome.trim(),
      pessoa_id: pessoaId || null,
      data,
      profissional: profissional.trim() || null,
      resultado: resultado.trim() || null,
      valor_numerico: valorNumerico ? Number(valorNumerico) : null,
      unidade: unidade.trim() || null,
      dose: dose.trim() || null,
      frequencia: frequencia.trim() || null,
      proxima_data: proximaData || null,
    };
    if (editando) {
      await atualizarRegistroSaude(editando.id, dados);
    } else {
      await criarRegistroSaude(dados);
    }
    setAberto(false);
    recarregar();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir registro de saúde?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirRegistroSaude(id);
    recarregar();
  }

  return (
    <div>
      <PageHeader
        title="Saúde"
        subtitle="Consultas, exames, vacinas e histórico médico da família."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>
            Adicionar registro
          </Button>
        }
      />

      <GastosSaude refreshKey={registros.length} />

      <EvolucaoExames pessoas={pessoas} refreshKey={registros.length} />

      <Card>
        {registros.length === 0 ? (
          <EmptyState
            title="Nenhum registro de saúde ainda"
            description="Cadastre consultas, exames e vacinas para manter o histórico organizado."
            action={<Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Adicionar registro</Button>}
          />
        ) : (
          <div className="list">
            {registros.map((r) => {
              const pessoa = pessoas.find((p) => p.id === r.pessoa_id);
              const diasProxima = diasAte(r.proxima_data);
              return (
                <div key={r.id} className="list-row">
                  <div className="list-row-main">
                    <span className="list-row-title">
                      <HeartPulse size={14} style={{ marginRight: 6, verticalAlign: -2, color: "var(--text-muted)" }} />
                      {r.nome}
                      {r.valor_numerico != null && (
                        <span className="tabular" style={{ marginLeft: 6, fontWeight: 400, color: "var(--text-secondary)" }}>
                          — {r.valor_numerico}{r.unidade ? ` ${r.unidade}` : ""}
                        </span>
                      )}
                    </span>
                    <span className="list-row-meta">
                      <Badge tone="muted">{TIPOS_SAUDE.find((t) => t.valor === r.tipo)?.label}</Badge>
                      <span>{formatarData(r.data)}</span>
                      {pessoa && <span>{pessoa.nome}</span>}
                      {r.profissional && <span>{r.profissional}</span>}
                      {r.dose && <span>{r.dose}{r.frequencia ? ` — ${r.frequencia}` : ""}</span>}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {diasProxima !== null && diasProxima <= 30 && (
                      <Badge tone={diasProxima < 0 ? "danger" : "warn"}>
                        {diasProxima < 0 ? "Refazer" : `Próxima em ${diasProxima}d`}
                      </Badge>
                    )}
                    <button className="icon-btn" onClick={() => abrirEdicao(r)}><Pencil size={14} /></button>
                    <button className="icon-btn danger" onClick={() => handleExcluir(r.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Drawer open={aberto} title={editando ? "Editar registro de saúde" : "Adicionar registro de saúde"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoRegistroSaude)}>
              {TIPOS_SAUDE.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Nome" hint="Ex: Colesterol, Consulta cardiologista, Gripe">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </Field>
          <Field label="Pessoa">
            <Select value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
              <option value="">Selecione</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
          </Field>
          <div className="form-row-2">
            <Field label="Data"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
            <Field label="Profissional"><Input value={profissional} onChange={(e) => setProfissional(e.target.value)} /></Field>
          </div>

          {tipo === "exame" && (
            <div className="form-row-2">
              <Field label="Valor numérico" hint="Pra aparecer no gráfico de evolução">
                <Input type="number" step="any" value={valorNumerico} onChange={(e) => setValorNumerico(e.target.value)} />
              </Field>
              <Field label="Unidade"><Input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="mg/dL, kg..." /></Field>
            </div>
          )}

          {tipo === "medicamento" && (
            <div className="form-row-2">
              <Field label="Dose"><Input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="1 comprimido, 5ml..." /></Field>
              <Field label="Frequência"><Input value={frequencia} onChange={(e) => setFrequencia(e.target.value)} placeholder="A cada 8h, 1x ao dia..." /></Field>
            </div>
          )}

          <Field label="Resultado / observação">
            <Textarea value={resultado} onChange={(e) => setResultado(e.target.value)} />
          </Field>
          <Field label="Próxima data prevista" hint="Opcional — gera alerta no dashboard">
            <Input type="date" value={proximaData} onChange={(e) => setProximaData(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary">{editando ? "Salvar alterações" : "Salvar"}</Button>
          {editando ? (
            <AnexosSection entidadeTipo="saude" entidadeId={editando.id} />
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              Salve o registro primeiro para poder anexar o resultado do exame.
            </p>
          )}
        </form>
      </Drawer>
    </div>
  );
}

// --- Gastos com saúde (cruzamento com o Financeiro) -------------------------

function GastosSaude({ refreshKey }: { refreshKey: number }) {
  const [porPessoa, setPorPessoa] = useState<Array<{ pessoa_nome: string; total: number }>>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setPorPessoa(gastosSaudePorPessoa());
    setTotal(gastoTotalSaude());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (total === 0) return null;

  return (
    <div className="section">
      <h3 className="section-title"><Receipt size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Gastos com saúde</h3>
      <div className="grid-3">
        <StatCard label="Total gasto" value={formatarMoeda(total)} icon={<Receipt size={16} />} hint="Lançamentos com categoria Saúde no Financeiro" />
        {porPessoa.slice(0, 2).map((p) => (
          <StatCard key={p.pessoa_nome} label={p.pessoa_nome} value={formatarMoeda(p.total)} />
        ))}
      </div>
    </div>
  );
}

function EvolucaoExames({ pessoas, refreshKey }: { pessoas: Pessoa[]; refreshKey: number }) {
  const [pessoaId, setPessoaId] = useState("");
  const [nomeEscolhido, setNomeEscolhido] = useState("");

  useEffect(() => {
    if (!pessoaId && pessoas.length > 0) setPessoaId(pessoas[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoas.length]);

  const opcoes = useMemo(() => (pessoaId ? nomesComEvolucao(pessoaId) : []), [pessoaId, refreshKey]);

  useEffect(() => {
    if (opcoes.length > 0 && !opcoes.some((o) => o.nome === nomeEscolhido)) {
      setNomeEscolhido(opcoes[0].nome);
    }
    if (opcoes.length === 0) setNomeEscolhido("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opcoes]);

  const historico = useMemo(
    () => (pessoaId && nomeEscolhido ? historicoPorNome(pessoaId, nomeEscolhido) : []),
    [pessoaId, nomeEscolhido, refreshKey],
  );

  if (pessoas.length === 0) return null;

  return (
    <div className="section">
      <h3 className="section-title"><TrendingUp size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Evolução de exames</h3>
      <Card>
        <div style={{ padding: 16, display: "flex", gap: 10, flexWrap: "wrap", borderBottom: "1px solid var(--border-subtle)" }}>
          <Select value={pessoaId} onChange={(e) => setPessoaId(e.target.value)} style={{ maxWidth: 220 }}>
            {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
          {opcoes.length > 0 && (
            <Select value={nomeEscolhido} onChange={(e) => setNomeEscolhido(e.target.value)} style={{ maxWidth: 220 }}>
              {opcoes.map((o) => <option key={o.nome} value={o.nome}>{o.nome} ({o.total} registros)</option>)}
            </Select>
          )}
        </div>

        {opcoes.length === 0 ? (
          <EmptyState
            title="Ainda sem histórico suficiente"
            description="Registre o mesmo exame (ex: Colesterol) com valor numérico em pelo menos 2 datas diferentes pra ver a evolução aqui."
          />
        ) : (
          <div style={{ padding: "16px 16px 6px", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historico.map((h) => ({ data: formatarData(h.data), valor: h.valor_numerico }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="data" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={46} domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip
                  formatter={((v: any) => [`${v}${historico[0]?.unidade ? ` ${historico[0].unidade}` : ""}`, historico[0]?.nome ?? ""]) as any}
                  contentStyle={{ fontSize: 12.5, borderRadius: 8 }}
                />
                <Line type="monotone" dataKey="valor" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
