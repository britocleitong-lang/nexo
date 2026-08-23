import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, TrendingUp, ArrowDownCircle, ArrowUpCircle, PiggyBank } from "lucide-react";
import type { Investimento, MovimentoInvestimento, TipoInvestimento, Pessoa } from "../../types/entities";
import {
  listarInvestimentos, criarInvestimento, atualizarInvestimento, excluirInvestimento, valorTotalInvestimentos,
  TIPOS_INVESTIMENTO, listarMovimentos, registrarMovimento, excluirMovimento,
} from "./investimentosRepository";
import { totaisPeriodo, listarContas, saldoConta } from "../financeiro/financeiroRepository";
import { listarPessoas } from "../pessoas/pessoasRepository";
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select, StatCard, Textarea } from "../../components/ui";
import { formatarData, formatarMoeda, hojeISO } from "../../utils/format";
import { confirmar } from "../../components/Confirm";

export function InvestimentosPage() {
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Investimento | null>(null);
  const [selecionado, setSelecionado] = useState<Investimento | null>(null);

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoInvestimento>("reserva_emergencia");
  const [valorAtual, setValorAtual] = useState("");
  const [metaValor, setMetaValor] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const [pessoaId, setPessoaId] = useState("");

  function recarregar() {
    const lista = listarInvestimentos();
    setInvestimentos(lista);
    setPessoas(listarPessoas());
    setSelecionado((sel) => (sel ? lista.find((i) => i.id === sel.id) ?? null : null));
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = useMemo(() => valorTotalInvestimentos(), [investimentos]);

  // Sugestão de meta pra reserva de emergência: 6x a média de despesas dos últimos 3 meses
  const sugestaoReserva = useMemo(() => {
    const hoje = new Date();
    const tresmesesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1);
    const { despesas } = totaisPeriodo(tresmesesAtras.toISOString().slice(0, 10), hojeISO());
    const mediaMensal = despesas / 3;
    return mediaMensal > 0 ? mediaMensal * 6 : null;
  }, []);

  function abrirNovo() {
    setEditando(null);
    setNome("");
    setTipo("reserva_emergencia");
    setValorAtual("");
    setMetaValor("");
    setInstituicao("");
    setPessoaId("");
    setAberto(true);
  }

  function abrirEdicao(inv: Investimento) {
    setEditando(inv);
    setNome(inv.nome);
    setTipo(inv.tipo);
    setValorAtual(String(inv.valor_atual));
    setMetaValor(inv.meta_valor != null ? String(inv.meta_valor) : "");
    setInstituicao(inv.instituicao ?? "");
    setPessoaId(inv.pessoa_id ?? "");
    setAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    const dados = {
      nome: nome.trim(),
      tipo,
      valor_atual: valorAtual ? Number(valorAtual) : 0,
      meta_valor: metaValor ? Number(metaValor) : null,
      instituicao: instituicao.trim() || null,
      pessoa_id: pessoaId || null,
    };
    if (editando) {
      await atualizarInvestimento(editando.id, dados);
    } else {
      await criarInvestimento(dados);
    }
    setAberto(false);
    recarregar();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir investimento?", descricao: "Todos os aportes e resgates registrados nele também serão apagados." }))) return;
    await excluirInvestimento(id);
    setSelecionado(null);
    recarregar();
  }

  return (
    <div>
      <PageHeader
        title="Investimentos"
        subtitle="Reserva de emergência, renda fixa, renda variável e outros aportes."
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Adicionar investimento</Button>}
      />

      <div className="section">
        <StatCard label="Total investido" value={formatarMoeda(total)} icon={<TrendingUp size={16} />} />
      </div>

      {investimentos.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum investimento cadastrado"
            description="Comece pela reserva de emergência — o recomendado é 6 meses do seu custo de vida em algo com liquidez diária."
            action={<Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Adicionar investimento</Button>}
          />
        </Card>
      ) : (
        <div className="grid-3">
          {investimentos.map((inv) => {
            const percentual = inv.meta_valor && inv.meta_valor > 0 ? Math.min(100, (inv.valor_atual / inv.meta_valor) * 100) : null;
            return (
              <Card key={inv.id} className="investimento-card">
                <button className="investimento-card-body" onClick={() => setSelecionado(inv)}>
                  <div className="investimento-icon"><PiggyBank size={18} /></div>
                  <div className="list-row-title">{inv.nome}</div>
                  <Badge tone="muted">{TIPOS_INVESTIMENTO.find((t) => t.valor === inv.tipo)?.label}</Badge>
                  <div className="investimento-valor tabular">{formatarMoeda(inv.valor_atual)}</div>
                  {percentual != null && (
                    <>
                      <div className="orcamento-barra-fundo" style={{ marginTop: 6 }}>
                        <div className="orcamento-barra-preenchida" style={{ width: `${percentual}%`, background: percentual >= 100 ? "var(--signal-good)" : "var(--ink-700)" }} />
                      </div>
                      <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                        {percentual.toFixed(0)}% da meta de {formatarMoeda(inv.meta_valor!)}
                      </span>
                    </>
                  )}
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <Drawer open={aberto} title={editando ? "Editar investimento" : "Adicionar investimento"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Nome">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Reserva de emergência, Tesouro Selic..." autoFocus />
          </Field>
          <Field label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoInvestimento)}>
              {TIPOS_INVESTIMENTO.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Valor atual">
            <Input type="number" value={valorAtual} onChange={(e) => setValorAtual(e.target.value)} />
          </Field>
          <Field
            label="Meta (opcional)"
            hint={
              tipo === "reserva_emergencia" && sugestaoReserva
                ? `Sugestão: ${formatarMoeda(sugestaoReserva)} (6x sua média de despesas dos últimos 3 meses)`
                : "Defina uma meta pra acompanhar o progresso"
            }
          >
            <Input type="number" value={metaValor} onChange={(e) => setMetaValor(e.target.value)} />
          </Field>
          <div className="form-row-2">
            <Field label="Instituição"><Input value={instituicao} onChange={(e) => setInstituicao(e.target.value)} /></Field>
            <Field label="Pessoa">
              <Select value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
                <option value="">Nenhuma</option>
                {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
            </Field>
          </div>
          <Button type="submit" variant="primary">{editando ? "Salvar alterações" : "Salvar"}</Button>
        </form>
      </Drawer>

      {selecionado && (
        <InvestimentoDetalhe
          investimento={selecionado}
          onClose={() => setSelecionado(null)}
          onEditar={() => { abrirEdicao(selecionado); setSelecionado(null); }}
          onExcluir={() => handleExcluir(selecionado.id)}
          onMudou={recarregar}
        />
      )}
    </div>
  );
}

function InvestimentoDetalhe({
  investimento,
  onClose,
  onEditar,
  onExcluir,
  onMudou,
}: {
  investimento: Investimento;
  onClose: () => void;
  onEditar: () => void;
  onExcluir: () => void;
  onMudou: () => void;
}) {
  const [movimentos, setMovimentos] = useState<MovimentoInvestimento[]>([]);
  const [contas, setContas] = useState(listarContas());
  const [tipoMov, setTipoMov] = useState<"aporte" | "resgate" | "rendimento">("aporte");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());
  const [contaId, setContaId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function recarregar() {
    setMovimentos(listarMovimentos(investimento.id));
    setContas(listarContas());
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investimento.id]);

  async function handleRegistrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!valor) return;
    if (!contaId && tipoMov !== "rendimento") {
      setErro(`Escolha a conta de ${tipoMov === "aporte" ? "origem" : "destino"} do dinheiro.`);
      return;
    }
    await registrarMovimento(investimento.id, tipoMov, Number(valor), data, contaId, observacoes.trim() || null);
    setValor("");
    setObservacoes("");
    recarregar();
    onMudou();
  }

  async function handleExcluirMovimento(id: string) {
    if (!(await confirmar({ titulo: "Excluir movimento?", descricao: "O lançamento vinculado no Financeiro também será desfeito." }))) return;
    await excluirMovimento(id, investimento.id);
    recarregar();
    onMudou();
  }

  const percentual = investimento.meta_valor && investimento.meta_valor > 0
    ? Math.min(100, (investimento.valor_atual / investimento.meta_valor) * 100)
    : null;

  return (
    <Drawer open title={investimento.nome} onClose={onClose}>
      <div className="section" style={{ display: "flex", gap: 8 }}>
        <Button variant="secondary" icon={<Pencil size={14} />} onClick={onEditar}>Editar</Button>
        <Button variant="danger" icon={<Trash2 size={14} />} onClick={onExcluir}>Excluir</Button>
      </div>

      <div className="section">
        <div className="stat-card stat-success">
          <div className="stat-top"><span className="stat-label">Valor atual</span></div>
          <div className="stat-value tabular">{formatarMoeda(investimento.valor_atual)}</div>
          {percentual != null && (
            <>
              <div className="orcamento-barra-fundo" style={{ marginTop: 8 }}>
                <div className="orcamento-barra-preenchida" style={{ width: `${percentual}%`, background: percentual >= 100 ? "var(--signal-good)" : "var(--ink-700)" }} />
              </div>
              <div className="stat-hint">{percentual.toFixed(0)}% da meta de {formatarMoeda(investimento.meta_valor!)}</div>
            </>
          )}
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Aportar ou resgatar</h3>
        {contas.length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--warn)", marginTop: 0 }}>
            Você ainda não tem nenhuma conta cadastrada no Financeiro. Cadastre uma primeiro pra poder registrar aportes e resgates vinculados a ela.
          </p>
        )}
        <form className="form-grid" onSubmit={handleRegistrar}>
          <div className="form-row-3">
            <button type="button" className={`tab ${tipoMov === "aporte" ? "active" : ""}`} onClick={() => setTipoMov("aporte")}>
              <ArrowUpCircle size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Aporte
            </button>
            <button type="button" className={`tab ${tipoMov === "resgate" ? "active" : ""}`} onClick={() => setTipoMov("resgate")}>
              <ArrowDownCircle size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Resgate
            </button>
            <button type="button" className={`tab ${tipoMov === "rendimento" ? "active" : ""}`} onClick={() => setTipoMov("rendimento")}>
              <TrendingUp size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Rendimento
            </button>
          </div>
          <div className="form-row-2">
            <Field label="Valor"><Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus /></Field>
            <Field label="Data"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
          </div>
          {tipoMov === "rendimento" ? (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>
              Rendimento é valorização do próprio investimento — não mexe no saldo de nenhuma conta.
            </p>
          ) : (
            <Field label={tipoMov === "aporte" ? "Conta de origem (será debitada)" : "Conta de destino (será creditada)"}>
              <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
                <option value="">Selecione a conta</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} — saldo atual: {formatarMoeda(saldoConta(c.id))}</option>
                ))}
              </Select>
            </Field>
          )}
          {erro && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{erro}</p>}
          <Field label="Observações"><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></Field>
          <Button type="submit" variant="primary">
            {tipoMov === "aporte" ? "Registrar aporte" : tipoMov === "resgate" ? "Registrar resgate" : "Registrar rendimento"}
          </Button>
        </form>
      </div>

      <div className="section">
        <h3 className="section-title">Histórico</h3>
        {movimentos.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>Nenhum movimento registrado ainda.</p>
        ) : (
          <div className="list">
            {movimentos.map((m) => (
              <div key={m.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title">
                    {m.tipo === "aporte" ? "Aporte" : m.tipo === "resgate" ? "Resgate" : "Rendimento"}
                  </span>
                  <span className="list-row-meta">{formatarData(m.data)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="list-row-value tabular">
                    {m.tipo === "resgate" ? "-" : "+"} {formatarMoeda(m.valor)}
                  </span>
                  <button className="icon-btn danger" onClick={() => handleExcluirMovimento(m.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
