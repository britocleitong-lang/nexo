import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Pencil } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import type { Bem, Divida, TipoDivida, Pessoa, PatrimonioHistorico } from "../../types/entities";
import {
  criarBem, atualizarBem, excluirBem, listarBens,
  listarDividas, criarDivida, atualizarDivida, excluirDivida, TIPOS_DIVIDA,
  calcularPatrimonioLiquido, registrarSnapshotHoje, listarHistoricoPatrimonio, listarBensAutomaticos,
  type BemAutomatico,
} from "./patrimonioRepository";
import { listarOpcoes, criarOpcao, GRUPO_BEM_CATEGORIA } from "../cadastros/opcoesRepository";
import { listarPessoas } from "../pessoas/pessoasRepository";
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select, SelectCriavel } from "../../components/ui";
import { AnexosSection } from "../../components/AnexosSection";
import "./PatrimonioPage.css";
import { formatarData, formatarMoeda } from "../../utils/format";
import { confirmar } from "../../components/Confirm";

type Aba = "bens" | "dividas";

export function PatrimonioPage() {
  const [aba, setAba] = useState<Aba>("bens");
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [historico, setHistorico] = useState<PatrimonioHistorico[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  function recarregar() {
    setPessoas(listarPessoas());
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    registrarSnapshotHoje().then(() => {
      setHistorico(listarHistoricoPatrimonio());
      recarregar();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { ativos, passivos, liquido } = useMemo(() => calcularPatrimonioLiquido(), [refreshKey]);

  async function handleMudou() {
    await registrarSnapshotHoje();
    setHistorico(listarHistoricoPatrimonio());
    recarregar();
  }

  return (
    <div>
      <PageHeader title="Patrimônio" />

      {/* Um número principal, dois de apoio. Três StatCards do mesmo peso
          faziam o olho procurar qual importa — o líquido é a resposta, os
          outros dois são a conta que leva até ela. */}
      <div className="pat-destaque section">
        <div className="pat-liquido">
          <span className="pat-liquido-label">Patrimônio líquido</span>
          <strong className={`pat-liquido-valor tabular ${liquido < 0 ? "negativo" : ""}`}>
            {formatarMoeda(liquido)}
          </strong>
        </div>
        <div className="pat-composicao">
          <div>
            <span>Ativos</span>
            <strong className="tabular">{formatarMoeda(ativos)}</strong>
          </div>
          <span className="pat-menos">−</span>
          <div>
            <span>Passivos</span>
            <strong className="tabular">{formatarMoeda(passivos)}</strong>
          </div>
        </div>
      </div>

      {historico.length >= 2 && (
        <div className="section">
          <Card>
            {/* Só a linha do líquido. As de ativos e passivos duplicavam a
                informação que já está nos números acima, e três linhas
                tracejadas competindo tornavam a tendência mais difícil de ver. */}
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historico.map((h) => ({ data: formatarData(h.data).slice(0, 5), valor: h.valor_liquido }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="data" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false}
                    width={52} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={((v: any) => formatarMoeda(Number(v))) as any}
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, fontSize: 12 }} />
                  <Line type="monotone" dataKey="valor" name="Líquido" stroke="var(--accent)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${aba === "bens" ? "active" : ""}`} onClick={() => setAba("bens")}>Bens (ativos)</button>
        <button className={`tab ${aba === "dividas" ? "active" : ""}`} onClick={() => setAba("dividas")}>Dívidas (passivos)</button>
      </div>

      {aba === "bens" && <BensTab pessoas={pessoas} onMudou={handleMudou} />}
      {aba === "dividas" && <DividasTab onMudou={handleMudou} />}
    </div>
  );
}

// --- Bens ---------------------------------------------------------------

function BensTab({ pessoas, onMudou }: { pessoas: Pessoa[]; onMudou: () => void }) {
  const [bens, setBens] = useState<Bem[]>([]);
  const [bensAutomaticos, setBensAutomaticos] = useState<BemAutomatico[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Bem | null>(null);

  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valorAquisicao, setValorAquisicao] = useState("");
  const [valorAtual, setValorAtual] = useState("");
  const [dataAquisicao, setDataAquisicao] = useState("");

  function recarregar() {
    setBens(listarBens());
    setBensAutomaticos(listarBensAutomaticos());
    setCategorias(listarOpcoes(GRUPO_BEM_CATEGORIA).map((o) => o.valor));
  }

  useEffect(() => { recarregar(); }, []);

  function abrirNovo() {
    setEditando(null);
    setDescricao("");
    setCategoria(categorias[0] ?? "");
    setValorAquisicao("");
    setValorAtual("");
    setDataAquisicao("");
    setAberto(true);
  }

  function abrirEdicao(b: Bem) {
    setEditando(b);
    setDescricao(b.descricao);
    setCategoria(b.categoria);
    setValorAquisicao(b.valor_aquisicao != null ? String(b.valor_aquisicao) : "");
    setValorAtual(b.valor_atual != null ? String(b.valor_atual) : "");
    setDataAquisicao(b.data_aquisicao ?? "");
    setAberto(true);
  }

  async function handleCriarCategoria(nome: string): Promise<string> {
    const valor = await criarOpcao(GRUPO_BEM_CATEGORIA, nome);
    setCategorias(listarOpcoes(GRUPO_BEM_CATEGORIA).map((o) => o.valor));
    return valor;
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim() || !categoria) return;
    const dados = {
      descricao: descricao.trim(),
      categoria,
      valor_aquisicao: valorAquisicao ? Number(valorAquisicao) : null,
      valor_atual: valorAtual ? Number(valorAtual) : null,
      data_aquisicao: dataAquisicao || null,
    };
    if (editando) {
      await atualizarBem(editando.id, dados);
    } else {
      await criarBem(dados);
    }
    setAberto(false);
    recarregar();
    onMudou();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir bem?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirBem(id);
    recarregar();
    onMudou();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Adicionar bem</Button>
      </div>

      {bensAutomaticos.length > 0 && (
        <div className="section">
          <h3 className="section-title">Veículos e imóveis</h3>
          <Card>
            <div className="list">
              {bensAutomaticos.map((b) => (
                <Link key={b.id} to={b.origem === "veiculo" ? `/veiculos/${b.id}` : `/imoveis/${b.id}`} className="list-row" style={{ textDecoration: "none", color: "inherit" }}>
                  <div className="list-row-main">
                    <span className="list-row-title">{b.descricao}</span>
                    <span className="list-row-meta">{b.categoria}</span>
                  </div>
                  <span className="list-row-value tabular">{formatarMoeda(b.valor_atual)}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      )}

      <h3 className="section-title">Outros bens</h3>
      <Card>
        {bens.length === 0 ? (
          <EmptyState title="Nenhum bem cadastrado" description="Cadastre joias, equipamentos e outros bens de valor que não sejam veículo ou imóvel." />
        ) : (
          <div className="list">
            {bens.map((b) => {
              const pessoa = pessoas.find((p) => p.id === b.pessoa_id);
              return (
                <div key={b.id} className="list-row">
                  <div className="list-row-main">
                    <span className="list-row-title">{b.descricao}</span>
                    <span className="list-row-meta">
                      {b.categoria}
                      {b.data_aquisicao && <span>Adquirido em {formatarData(b.data_aquisicao)}</span>}
                      {pessoa && <span>{pessoa.nome}</span>}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {b.valor_atual != null && <span className="list-row-value tabular">{formatarMoeda(b.valor_atual)}</span>}
                    <button className="icon-btn" onClick={() => abrirEdicao(b)}><Pencil size={14} /></button>
                    <button className="icon-btn danger" onClick={() => handleExcluir(b.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Drawer open={aberto} title={editando ? "Editar bem" : "Adicionar bem"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Descrição">
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} autoFocus />
          </Field>
          <Field label="Categoria">
            <SelectCriavel
              value={categoria}
              onChange={setCategoria}
              opcoes={categorias.map((c) => ({ id: c, label: c }))}
              onCriarOpcao={handleCriarCategoria}
            />
          </Field>
          <div className="form-row-2">
            <Field label="Valor de aquisição">
              <Input type="number" value={valorAquisicao} onChange={(e) => setValorAquisicao(e.target.value)} />
            </Field>
            <Field label="Valor atual">
              <Input type="number" value={valorAtual} onChange={(e) => setValorAtual(e.target.value)} />
            </Field>
          </div>
          <Field label="Data de aquisição">
            <Input type="date" value={dataAquisicao} onChange={(e) => setDataAquisicao(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary">{editando ? "Salvar alterações" : "Salvar"}</Button>
          {editando ? (
            <AnexosSection entidadeTipo="bem" entidadeId={editando.id} />
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              Salve o bem primeiro para poder anexar nota fiscal, contrato ou escritura.
            </p>
          )}
        </form>
      </Drawer>
    </div>
  );
}

// --- Dívidas ---------------------------------------------------------------

function DividasTab({ onMudou }: { onMudou: () => void }) {
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Divida | null>(null);

  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<TipoDivida>("emprestimo");
  const [valorTotal, setValorTotal] = useState("");
  const [valorPago, setValorPago] = useState("");
  const [parcelasTotais, setParcelasTotais] = useState("");
  const [parcelasPagas, setParcelasPagas] = useState("");
  const [dataVencimentoFinal, setDataVencimentoFinal] = useState("");

  function recarregar() {
    setDividas(listarDividas());
  }

  useEffect(() => { recarregar(); }, []);

  function abrirNovo() {
    setEditando(null);
    setDescricao("");
    setTipo("emprestimo");
    setValorTotal("");
    setValorPago("");
    setParcelasTotais("");
    setParcelasPagas("");
    setDataVencimentoFinal("");
    setAberto(true);
  }

  function abrirEdicao(d: Divida) {
    setEditando(d);
    setDescricao(d.descricao);
    setTipo(d.tipo);
    setValorTotal(String(d.valor_total));
    setValorPago(String(d.valor_pago));
    setParcelasTotais(d.parcelas_totais != null ? String(d.parcelas_totais) : "");
    setParcelasPagas(d.parcelas_pagas != null ? String(d.parcelas_pagas) : "");
    setDataVencimentoFinal(d.data_vencimento_final ?? "");
    setAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim() || !valorTotal) return;
    const dados = {
      descricao: descricao.trim(),
      tipo,
      valor_total: Number(valorTotal),
      valor_pago: valorPago ? Number(valorPago) : 0,
      parcelas_totais: parcelasTotais ? Number(parcelasTotais) : null,
      parcelas_pagas: parcelasPagas ? Number(parcelasPagas) : null,
      data_vencimento_final: dataVencimentoFinal || null,
    };
    if (editando) {
      await atualizarDivida(editando.id, dados);
    } else {
      await criarDivida(dados);
    }
    setAberto(false);
    recarregar();
    onMudou();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir dívida?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirDivida(id);
    recarregar();
    onMudou();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Adicionar dívida</Button>
      </div>

      <Card>
        {dividas.length === 0 ? (
          <EmptyState title="Nenhuma dívida cadastrada" description="Empréstimos, financiamentos e outras dívidas em aberto." />
        ) : (
          <div className="list">
            {dividas.map((d) => {
              const saldoDevedor = d.valor_total - d.valor_pago;
              const percentualPago = d.valor_total > 0 ? (d.valor_pago / d.valor_total) * 100 : 0;
              return (
                <div key={d.id} className="list-row">
                  <div className="list-row-main">
                    <span className="list-row-title">{d.descricao}</span>
                    <span className="list-row-meta">
                      <Badge tone="muted">{TIPOS_DIVIDA.find((t) => t.valor === d.tipo)?.label}</Badge>
                      {d.parcelas_totais && <span>{d.parcelas_pagas ?? 0}/{d.parcelas_totais} parcelas</span>}
                      {d.data_vencimento_final && <span>Até {formatarData(d.data_vencimento_final)}</span>}
                      <span>{percentualPago.toFixed(0)}% pago</span>
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="list-row-value tabular" style={{ color: "var(--danger)" }}>{formatarMoeda(saldoDevedor)}</span>
                    <button className="icon-btn" onClick={() => abrirEdicao(d)}><Pencil size={14} /></button>
                    <button className="icon-btn danger" onClick={() => handleExcluir(d.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Drawer open={aberto} title={editando ? "Editar dívida" : "Adicionar dívida"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Descrição">
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Financiamento do carro, empréstimo pessoal..." autoFocus />
          </Field>
          <Field label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDivida)}>
              {TIPOS_DIVIDA.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </Select>
          </Field>
          <div className="form-row-2">
            <Field label="Valor total"><Input type="number" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} /></Field>
            <Field label="Já pago"><Input type="number" value={valorPago} onChange={(e) => setValorPago(e.target.value)} /></Field>
          </div>
          <div className="form-row-2">
            <Field label="Parcelas totais"><Input type="number" value={parcelasTotais} onChange={(e) => setParcelasTotais(e.target.value)} /></Field>
            <Field label="Parcelas pagas"><Input type="number" value={parcelasPagas} onChange={(e) => setParcelasPagas(e.target.value)} /></Field>
          </div>
          <Field label="Vencimento final">
            <Input type="date" value={dataVencimentoFinal} onChange={(e) => setDataVencimentoFinal(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary">{editando ? "Salvar alterações" : "Salvar"}</Button>
          {editando ? (
            <AnexosSection entidadeTipo="divida" entidadeId={editando.id} />
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              Salve a dívida primeiro para poder anexar o contrato.
            </p>
          )}
        </form>
      </Drawer>
    </div>
  );
}
