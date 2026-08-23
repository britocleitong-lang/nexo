import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, ArrowUpCircle, ArrowDownCircle, Wallet, CreditCard, Paperclip } from "lucide-react";
import type { Conta, Cartao, Transacao, TipoCategoria, Pessoa, Veiculo } from "../../types/entities";
import {
  listarContas,
  criarConta,
  atualizarConta,
  excluirConta,
  saldoConta,
  saldoTotalGeral,
  listarCartoes,
  criarCartao,
  atualizarCartao,
  excluirCartao,
  listarCategorias,
  criarCategoria,
  listarTransacoes,
  criarTransacao,
  atualizarTransacao,
  excluirTransacao,
  totaisPeriodo,
  listarOrcamentosComGasto,
  definirOrcamento,
  excluirOrcamento,
  type OrcamentoComGasto,
} from "./financeiroRepository";
import { listarPessoas } from "../pessoas/pessoasRepository";
import { listarVeiculos } from "../veiculos/veiculosRepository";
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select, SelectCriavel, StatCard } from "../../components/ui";
import { AnexosSection } from "../../components/AnexosSection";
import { anexarArquivo } from "../anexos/anexosRepository";
import { formatarData, formatarMoeda, hojeISO } from "../../utils/format";
import { confirmar } from "../../components/Confirm";
import { RecorrenciasTab } from "../recorrencias/RecorrenciasTab";
import { PlanilhaTab } from "./PlanilhaTab";

type Aba = "transacoes" | "planilha" | "recorrencia" | "orcamento" | "contas" | "cartoes";

export function FinanceiroPage() {
  const [aba, setAba] = useState<Aba>("transacoes");
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  function recarregar() {
    setContas(listarContas());
    setCartoes(listarCartoes());
    setTransacoes(listarTransacoes());
    setPessoas(listarPessoas());
    setVeiculos(listarVeiculos());
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    recarregar();
  }, []);

  const saldoGeral = useMemo(() => saldoTotalGeral(), [refreshKey]);
  const inicioMes = `${hojeISO().slice(0, 7)}-01`;
  const totaisMes = useMemo(() => totaisPeriodo(inicioMes, hojeISO()), [refreshKey]);

  return (
    <div>
      <PageHeader title="Financeiro" subtitle="Contas, cartões, receitas e despesas." />

      <div className="grid-3 section">
        <StatCard label="Saldo geral" value={formatarMoeda(saldoGeral)} tone={saldoGeral < 0 ? "danger" : "default"} icon={<Wallet size={16} />} />
        <StatCard label="Receitas do mês" value={formatarMoeda(totaisMes.receitas)} icon={<ArrowUpCircle size={16} />} />
        <StatCard
          label="Despesas do mês"
          value={formatarMoeda(totaisMes.despesas)}
          tone={totaisMes.despesas > totaisMes.receitas && totaisMes.receitas > 0 ? "danger" : "default"}
          icon={<ArrowDownCircle size={16} />}
          hint={totaisMes.despesas > totaisMes.receitas && totaisMes.receitas > 0 ? "Acima das receitas do mês" : undefined}
        />
      </div>

      <div className="tabs">
        <button className={`tab ${aba === "transacoes" ? "active" : ""}`} onClick={() => setAba("transacoes")}>Transações</button>
        <button className={`tab ${aba === "planilha" ? "active" : ""}`} onClick={() => setAba("planilha")}>Planilha</button>
        <button className={`tab ${aba === "recorrencia" ? "active" : ""}`} onClick={() => setAba("recorrencia")}>Recorrência</button>
        <button className={`tab ${aba === "orcamento" ? "active" : ""}`} onClick={() => setAba("orcamento")}>Orçamento</button>
        <button className={`tab ${aba === "contas" ? "active" : ""}`} onClick={() => setAba("contas")}>Contas</button>
        <button className={`tab ${aba === "cartoes" ? "active" : ""}`} onClick={() => setAba("cartoes")}>Cartões</button>
      </div>

      {aba === "transacoes" && (
        <TransacoesTab
          transacoes={transacoes}
          contas={contas}
          cartoes={cartoes}
          pessoas={pessoas}
          veiculos={veiculos}
          onChange={recarregar}
        />
      )}
      {aba === "planilha" && <PlanilhaTab onMudou={recarregar} />}
      {aba === "recorrencia" && <RecorrenciasTab onMudou={recarregar} />}
      {aba === "orcamento" && <OrcamentoTab />}
      {aba === "contas" && <ContasTab contas={contas} onChange={recarregar} />}
      {aba === "cartoes" && <CartoesTab cartoes={cartoes} onChange={recarregar} />}
    </div>
  );
}

// --- Transações -----------------------------------------------------------

function TransacoesTab({
  transacoes,
  contas,
  cartoes,
  pessoas,
  veiculos,
  onChange,
}: {
  transacoes: Transacao[];
  contas: Conta[];
  cartoes: Cartao[];
  pessoas: Pessoa[];
  veiculos: Veiculo[];
  onChange: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Transacao | null>(null);
  const [tipo, setTipo] = useState<TipoCategoria>("despesa");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());
  const [categoriaId, setCategoriaId] = useState("");
  const [contaId, setContaId] = useState("");
  const [cartaoId, setCartaoId] = useState("");
  const [pessoaId, setPessoaId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [natureza, setNatureza] = useState<"fixo" | "variavel" | "">("variavel");
  const [categorias, setCategorias] = useState(listarCategorias(tipo));
  const [arquivoAnexo, setArquivoAnexo] = useState<File | null>(null);

  useEffect(() => {
    setCategorias(listarCategorias(tipo));
  }, [tipo]);

  function abrirNovo() {
    setEditando(null);
    setTipo("despesa");
    setDescricao("");
    setValor("");
    setData(hojeISO());
    setCategoriaId("");
    setContaId("");
    setCartaoId("");
    setPessoaId("");
    setVeiculoId("");
    setNatureza("variavel");
    setArquivoAnexo(null);
    setAberto(true);
  }

  function abrirEdicao(t: Transacao) {
    setEditando(t);
    setTipo(t.tipo);
    setDescricao(t.descricao);
    setValor(String(t.valor));
    setData(t.data);
    setCategoriaId(t.categoria_id ?? "");
    setContaId(t.conta_id ?? "");
    setCartaoId(t.cartao_id ?? "");
    setPessoaId(t.pessoa_id ?? "");
    setVeiculoId(t.veiculo_id ?? "");
    setNatureza((t.natureza as "fixo" | "variavel") ?? "variavel");
    setAberto(true);
  }

  async function handleCriarCategoria(nome: string): Promise<string> {
    const id = await criarCategoria(nome, tipo);
    setCategorias(listarCategorias(tipo));
    return id;
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim() || !valor) return;
    const dados = {
      tipo,
      descricao: descricao.trim(),
      valor: Number(valor),
      data,
      categoria_id: categoriaId || null,
      conta_id: contaId || null,
      cartao_id: cartaoId || null,
      pessoa_id: pessoaId || null,
      veiculo_id: veiculoId || null,
      natureza: tipo === "despesa" ? (natureza || null) : null,
    };
    if (editando) {
      await atualizarTransacao(editando.id, dados);
    } else {
      const novoId = await criarTransacao(dados);
      if (arquivoAnexo) {
        await anexarArquivo("transacao", novoId, arquivoAnexo);
      }
    }
    setAberto(false);
    onChange();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir lançamento?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirTransacao(id);
    onChange();
  }

  return (
    <div>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Novo lançamento</Button>
      </div>

      <Card>
        {transacoes.length === 0 ? (
          <EmptyState title="Nenhum lançamento ainda" description="Registre receitas e despesas para acompanhar seu financeiro." />
        ) : (
          <div className="list">
            {transacoes.map((t) => {
              const conta = contas.find((c) => c.id === t.conta_id);
              const cartao = cartoes.find((c) => c.id === t.cartao_id);
              const pessoa = pessoas.find((p) => p.id === t.pessoa_id);
              const veiculo = veiculos.find((v) => v.id === t.veiculo_id);
              return (
                <div key={t.id} className="list-row">
                  <div className="list-row-main">
                    <span className="list-row-title">{t.descricao}</span>
                    <span className="list-row-meta">
                      <span>{formatarData(t.data)}</span>
                      {conta && <span>{conta.nome}</span>}
                      {cartao && <span>{cartao.nome}</span>}
                      {pessoa && <span>{pessoa.nome}</span>}
                      {veiculo && <span>{veiculo.marca} {veiculo.modelo}</span>}
                      {t.natureza && (
                        <Badge tone="muted">
                          {t.natureza === "fixo" ? "Fixo" : t.natureza === "investimento" ? "Investimento" : "Variável"}
                        </Badge>
                      )}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="list-row-value tabular">
                      {t.tipo === "receita" ? "+" : "-"} {formatarMoeda(t.valor)}
                    </span>
                    <button className="icon-btn" onClick={() => abrirEdicao(t)} aria-label="Editar">
                      <Pencil size={14} />
                    </button>
                    <button className="icon-btn danger" onClick={() => handleExcluir(t.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Drawer open={aberto} title={editando ? "Editar lançamento" : "Novo lançamento"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <div className="form-row-2">
            <button type="button" className={`tab ${tipo === "despesa" ? "active" : ""}`} onClick={() => setTipo("despesa")}>Despesa</button>
            <button type="button" className={`tab ${tipo === "receita" ? "active" : ""}`} onClick={() => setTipo("receita")}>Receita</button>
          </div>
          <Field label="Descrição">
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} autoFocus />
          </Field>
          <div className="form-row-2">
            <Field label="Valor">
              <Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} />
            </Field>
            <Field label="Data">
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </Field>
          </div>
          <Field label="Categoria">
            <SelectCriavel
              value={categoriaId}
              onChange={setCategoriaId}
              opcoes={categorias.map((c) => ({ id: c.id, label: c.nome }))}
              onCriarOpcao={handleCriarCategoria}
              placeholder="Sem categoria"
            />
          </Field>
          {tipo === "despesa" && (
            <Field label="Natureza do gasto" hint="Base do módulo de Análise financeira">
              <div className="form-row-2">
                <button type="button" className={`tab ${natureza === "fixo" ? "active" : ""}`} onClick={() => setNatureza("fixo")}>Fixo</button>
                <button type="button" className={`tab ${natureza === "variavel" ? "active" : ""}`} onClick={() => setNatureza("variavel")}>Variável</button>
              </div>
            </Field>
          )}
          <div className="form-row-2">
            <Field label="Conta">
              <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
                <option value="">Nenhuma</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Field>
            <Field label="Cartão">
              <Select value={cartaoId} onChange={(e) => setCartaoId(e.target.value)}>
                <option value="">Nenhum</option>
                {cartoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Field>
          </div>
          <div className="form-row-2">
            <Field label="Pessoa relacionada">
              <Select value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
                <option value="">Nenhuma</option>
                {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
            </Field>
            <Field label="Veículo relacionado">
              <Select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)}>
                <option value="">Nenhum</option>
                {veiculos.map((v) => <option key={v.id} value={v.id}>{v.marca} {v.modelo}</option>)}
              </Select>
            </Field>
          </div>

          {!editando && (
            <Field label="Comprovante (opcional)" hint="Anexa junto com o lançamento, sem precisar editar depois">
              <label className="anexos-botao">
                <Paperclip size={13} />
                {arquivoAnexo ? arquivoAnexo.name : "Escolher arquivo"}
                <input type="file" onChange={(e) => setArquivoAnexo(e.target.files?.[0] ?? null)} />
              </label>
            </Field>
          )}

          <Button type="submit" variant="primary">{editando ? "Salvar alterações" : "Salvar"}</Button>
          {editando && <AnexosSection entidadeTipo="transacao" entidadeId={editando.id} />}
        </form>
      </Drawer>
    </div>
  );
}

// --- Orçamento mensal por categoria ------------------------------------------

function OrcamentoTab() {
  const [orcamentos, setOrcamentos] = useState<OrcamentoComGasto[]>([]);
  const [categoriasDespesa, setCategoriasDespesa] = useState(listarCategorias("despesa"));
  const [aberto, setAberto] = useState(false);
  const [categoriaId, setCategoriaId] = useState("");
  const [valorLimite, setValorLimite] = useState("");

  function recarregar() {
    setOrcamentos(listarOrcamentosComGasto());
    setCategoriasDespesa(listarCategorias("despesa"));
  }

  useEffect(() => {
    recarregar();
  }, []);

  const categoriasSemOrcamento = categoriasDespesa.filter((c) => !orcamentos.some((o) => o.categoria_id === c.id));

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!categoriaId || !valorLimite) return;
    await definirOrcamento(categoriaId, Number(valorLimite));
    setCategoriaId("");
    setValorLimite("");
    setAberto(false);
    recarregar();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir orçamento?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirOrcamento(id);
    recarregar();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => { setCategoriaId(categoriasSemOrcamento[0]?.id ?? ""); setAberto(true); }}
          disabled={categoriasSemOrcamento.length === 0}
        >
          Definir orçamento
        </Button>
      </div>

      <Card>
        {orcamentos.length === 0 ? (
          <EmptyState
            title="Nenhum orçamento definido"
            description="Defina um limite mensal por categoria de despesa e acompanhe o quanto já gastou, ao estilo YNAB/Monarch."
            action={
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => { setCategoriaId(categoriasSemOrcamento[0]?.id ?? ""); setAberto(true); }}>
                Definir orçamento
              </Button>
            }
          />
        ) : (
          <div className="list">
            {orcamentos.map((o) => {
              const percentual = o.valor_limite > 0 ? Math.min(100, (o.gasto_mes_atual / o.valor_limite) * 100) : 0;
              const estourou = o.gasto_mes_atual > o.valor_limite;
              return (
                <div key={o.id} className="orcamento-item">
                  <div className="orcamento-item-topo">
                    <span className="list-row-title">{o.categoria_nome}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="tabular" style={{ fontSize: 13, color: estourou ? "var(--danger)" : "var(--text-secondary)" }}>
                        {formatarMoeda(o.gasto_mes_atual)} / {formatarMoeda(o.valor_limite)}
                      </span>
                      <button className="icon-btn danger" onClick={() => handleExcluir(o.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="orcamento-barra-fundo">
                    <div
                      className="orcamento-barra-preenchida"
                      style={{ width: `${percentual}%`, background: estourou ? "var(--danger)" : "var(--accent)" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Drawer open={aberto} title="Definir orçamento mensal" onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Categoria">
            <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              {categoriasSemOrcamento.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </Field>
          <Field label="Limite mensal">
            <Input type="number" value={valorLimite} onChange={(e) => setValorLimite(e.target.value)} autoFocus />
          </Field>
          <Button type="submit" variant="primary">Salvar</Button>
        </form>
      </Drawer>
    </div>
  );
}

// --- Contas -----------------------------------------------------------

function ContasTab({ contas, onChange }: { contas: Conta[]; onChange: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Conta | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<Conta["tipo"]>("corrente");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [instituicao, setInstituicao] = useState("");

  function abrirNovo() {
    setEditando(null);
    setNome("");
    setTipo("corrente");
    setSaldoInicial("");
    setInstituicao("");
    setAberto(true);
  }

  function abrirEdicao(c: Conta) {
    setEditando(c);
    setNome(c.nome);
    setTipo(c.tipo);
    setSaldoInicial(String(c.saldo_inicial));
    setInstituicao(c.instituicao ?? "");
    setAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    const dados = { nome: nome.trim(), tipo, saldo_inicial: Number(saldoInicial) || 0, instituicao: instituicao.trim() || null };
    if (editando) {
      await atualizarConta(editando.id, dados);
    } else {
      await criarConta(dados);
    }
    setAberto(false);
    onChange();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir conta?", descricao: "Os lançamentos vinculados a ela ficarão sem conta." }))) return;
    await excluirConta(id);
    onChange();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Nova conta</Button>
      </div>
      <Card>
        {contas.length === 0 ? (
          <EmptyState title="Nenhuma conta cadastrada" description="Cadastre suas contas correntes, poupanças e investimentos." />
        ) : (
          <div className="list">
            {contas.map((c) => (
              <div key={c.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title"><Wallet size={13} style={{ marginRight: 6, verticalAlign: -2 }} />{c.nome}</span>
                  <span className="list-row-meta"><Badge tone="muted">{c.tipo}</Badge>{c.instituicao && <span>{c.instituicao}</span>}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="list-row-value tabular">{formatarMoeda(saldoConta(c.id))}</span>
                  <button className="icon-btn" onClick={() => abrirEdicao(c)}><Pencil size={14} /></button>
                  <button className="icon-btn danger" onClick={() => handleExcluir(c.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Drawer open={aberto} title={editando ? "Editar conta" : "Nova conta"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Field>
          <Field label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as Conta["tipo"])}>
              <option value="corrente">Conta corrente</option>
              <option value="poupanca">Poupança</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="investimento">Investimento</option>
              <option value="outra">Outra</option>
            </Select>
          </Field>
          <Field label="Saldo inicial"><Input type="number" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} /></Field>
          <Field label="Instituição"><Input value={instituicao} onChange={(e) => setInstituicao(e.target.value)} /></Field>
          <Button type="submit" variant="primary">{editando ? "Salvar alterações" : "Salvar"}</Button>
        </form>
      </Drawer>
    </div>
  );
}

// --- Cartões -----------------------------------------------------------

function CartoesTab({ cartoes, onChange }: { cartoes: Cartao[]; onChange: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Cartao | null>(null);
  const [nome, setNome] = useState("");
  const [limite, setLimite] = useState("");
  const [diaFechamento, setDiaFechamento] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("");

  function abrirNovo() {
    setEditando(null);
    setNome("");
    setLimite("");
    setDiaFechamento("");
    setDiaVencimento("");
    setAberto(true);
  }

  function abrirEdicao(c: Cartao) {
    setEditando(c);
    setNome(c.nome);
    setLimite(c.limite != null ? String(c.limite) : "");
    setDiaFechamento(c.dia_fechamento != null ? String(c.dia_fechamento) : "");
    setDiaVencimento(c.dia_vencimento != null ? String(c.dia_vencimento) : "");
    setAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    const dados = {
      nome: nome.trim(),
      limite: limite ? Number(limite) : null,
      dia_fechamento: diaFechamento ? Number(diaFechamento) : null,
      dia_vencimento: diaVencimento ? Number(diaVencimento) : null,
    };
    if (editando) {
      await atualizarCartao(editando.id, dados);
    } else {
      await criarCartao(dados);
    }
    setAberto(false);
    onChange();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir cartão?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirCartao(id);
    onChange();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Novo cartão</Button>
      </div>
      <Card>
        {cartoes.length === 0 ? (
          <EmptyState title="Nenhum cartão cadastrado" description="Cadastre seus cartões de crédito para acompanhar limite e vencimento." />
        ) : (
          <div className="list">
            {cartoes.map((c) => (
              <div key={c.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title"><CreditCard size={13} style={{ marginRight: 6, verticalAlign: -2 }} />{c.nome}</span>
                  <span className="list-row-meta">
                    {c.limite != null && <span>Limite: {formatarMoeda(c.limite)}</span>}
                    {c.dia_fechamento && <span>Fecha dia {c.dia_fechamento}</span>}
                    {c.dia_vencimento && <span>Vence dia {c.dia_vencimento}</span>}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="icon-btn" onClick={() => abrirEdicao(c)}><Pencil size={14} /></button>
                  <button className="icon-btn danger" onClick={() => handleExcluir(c.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Drawer open={aberto} title={editando ? "Editar cartão" : "Novo cartão"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Field>
          <Field label="Limite"><Input type="number" value={limite} onChange={(e) => setLimite(e.target.value)} /></Field>
          <div className="form-row-2">
            <Field label="Dia de fechamento"><Input type="number" value={diaFechamento} onChange={(e) => setDiaFechamento(e.target.value)} /></Field>
            <Field label="Dia de vencimento"><Input type="number" value={diaVencimento} onChange={(e) => setDiaVencimento(e.target.value)} /></Field>
          </div>
          <Button type="submit" variant="primary">{editando ? "Salvar alterações" : "Salvar"}</Button>
        </form>
      </Drawer>
    </div>
  );
}
