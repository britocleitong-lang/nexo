import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Repeat, Play, Pause, SkipForward, Check, Zap, Hand } from "lucide-react";
import type { Recorrencia, Frequencia, TipoCategoria, Categoria, Conta, Cartao, NaturezaTransacao } from "../../types/entities";
import {
  listarRecorrencias, criarRecorrencia, atualizarRecorrencia, excluirRecorrencia,
  alternarAtiva, ocorrenciasPendentes, materializar, pularProxima,
  totalMensalRecorrente, valorMensalizado, type OcorrenciaPendente,
} from "../../core/recorrencia/recorrenciaRepository";
import { FREQUENCIAS, labelFrequencia, hoje, textoPrazo, diasRestantes } from "../../core/datas";
import { listarCategorias, listarContas, listarCartoes } from "../financeiro/financeiroRepository";
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, Select, StatCard, Textarea } from "../../components/ui";
import { formatarData, formatarMoeda } from "../../utils/format";
import { confirmar } from "../../components/Confirm";
import "./RecorrenciasTab.css";

export function RecorrenciasTab({ onMudou }: { onMudou?: () => void }) {
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [pendentes, setPendentes] = useState<OcorrenciaPendente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Recorrencia | null>(null);
  const [processando, setProcessando] = useState(false);
  const [ignoradas, setIgnoradas] = useState<Set<string>>(new Set());

  const [tipo, setTipo] = useState<TipoCategoria>("despesa");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [frequencia, setFrequencia] = useState<Frequencia>("mensal");
  const [dataInicio, setDataInicio] = useState(hoje());
  const [dataFim, setDataFim] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [contaId, setContaId] = useState("");
  const [cartaoId, setCartaoId] = useState("");
  const [natureza, setNatureza] = useState<NaturezaTransacao | "">("fixo");
  const [automatico, setAutomatico] = useState(false);
  const [observacoes, setObservacoes] = useState("");

  function recarregar() {
    onMudou?.();
    setRecorrencias(listarRecorrencias(true));
    setPendentes(ocorrenciasPendentes());
    setCategorias(listarCategorias());
    setContas(listarContas());
    setCartoes(listarCartoes());
  }

  useEffect(() => { recarregar(); }, []);

  const totais = useMemo(() => totalMensalRecorrente(), [recorrencias]);
  const chavePendente = (o: OcorrenciaPendente) => `${o.recorrencia.id}:${o.data}`;
  const selecionadas = pendentes.filter((o) => !ignoradas.has(chavePendente(o)));
  const totalPendente = selecionadas.reduce(
    (s, o) => s + (o.recorrencia.tipo === "receita" ? o.recorrencia.valor : -o.recorrencia.valor), 0);

  function limparForm() {
    setTipo("despesa"); setDescricao(""); setValor(""); setFrequencia("mensal");
    setDataInicio(hoje()); setDataFim(""); setCategoriaId(""); setContaId("");
    setCartaoId(""); setNatureza("fixo"); setAutomatico(false); setObservacoes("");
  }

  function abrirNovo() { setEditando(null); limparForm(); setAberto(true); }

  function abrirEdicao(r: Recorrencia) {
    setEditando(r);
    setTipo(r.tipo); setDescricao(r.descricao); setValor(String(r.valor));
    setFrequencia(r.frequencia); setDataInicio(r.data_inicio); setDataFim(r.data_fim ?? "");
    setCategoriaId(r.categoria_id ?? ""); setContaId(r.conta_id ?? "");
    setCartaoId(r.cartao_id ?? ""); setNatureza(r.natureza ?? "");
    setAutomatico(r.lancar_automatico === 1); setObservacoes(r.observacoes ?? "");
    setAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim() || !valor) return;
    const dados = {
      tipo, descricao: descricao.trim(), valor: Number(valor), frequencia,
      data_inicio: dataInicio, data_fim: dataFim || null,
      categoria_id: categoriaId || null, conta_id: contaId || null, cartao_id: cartaoId || null,
      natureza: (natureza || null) as NaturezaTransacao | null,
      lancar_automatico: automatico ? 1 : 0,
      observacoes: observacoes.trim() || null,
    };
    if (editando) await atualizarRecorrencia(editando.id, dados);
    else await criarRecorrencia(dados);
    setAberto(false);
    recarregar();
  }

  async function handleExcluir(r: Recorrencia) {
    const ok = await confirmar({
      titulo: `Excluir a recorrência "${r.descricao}"?`,
      descricao: "Os lançamentos que ela já gerou continuam no Financeiro — só o molde é apagado.",
    });
    if (!ok) return;
    await excluirRecorrencia(r.id);
    recarregar();
  }

  async function handleLancarSelecionadas() {
    if (selecionadas.length === 0) return;
    const ok = await confirmar({
      titulo: `Lançar ${selecionadas.length} ocorrência(s)?`,
      descricao: "Elas entram no Financeiro como lançamentos efetivados e o saldo é atualizado.",
    });
    if (!ok) return;
    setProcessando(true);
    try {
      await materializar(selecionadas);
      setIgnoradas(new Set());
      recarregar();
    } finally {
      setProcessando(false);
    }
  }

  async function handlePular(r: Recorrencia) {
    const ok = await confirmar({
      titulo: "Pular esta ocorrência?",
      descricao: "Nada é lançado e a recorrência avança para a próxima data.",
    });
    if (!ok) return;
    await pularProxima(r.id);
    recarregar();
  }

  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipo);

  return (
    <div>
      <div className="rec-topo">
        <p className="rec-intro">
          O que se repete todo mês — salário, aluguel, assinaturas. O Nexo repõe os lançamentos que faltarem.
        </p>
        <Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Nova recorrência</Button>
      </div>

      <div className="grid-3 section">
        <StatCard label="Entra todo mês" value={formatarMoeda(totais.receitas)} tone="success" icon={<Repeat size={15} />} />
        <StatCard label="Sai todo mês" value={formatarMoeda(totais.despesas)} tone={totais.despesas > totais.receitas ? "danger" : "default"} icon={<Repeat size={15} />} />
        <StatCard
          label="Sobra fixa"
          value={formatarMoeda(totais.receitas - totais.despesas)}
          hint="Antes dos gastos variáveis"
          tone={totais.receitas - totais.despesas < 0 ? "danger" : "default"}
        />
      </div>

      {pendentes.length > 0 && (
        <div className="section">
          <Card className="rec-pendentes">
            <div className="rec-pendentes-topo">
              <div>
                <h2 className="rec-pendentes-titulo">
                  {pendentes.length === 1 ? "1 lançamento previsto ainda não entrou" : `${pendentes.length} lançamentos previstos ainda não entraram`}
                </h2>
                <p className="rec-pendentes-sub">
                  Nada foi gravado ainda. Confira a lista e confirme o que realmente aconteceu.
                </p>
              </div>
              {(
                <Button variant="primary" icon={<Check size={16} />} onClick={handleLancarSelecionadas} disabled={processando || selecionadas.length === 0}>
                  Lançar {selecionadas.length > 0 ? selecionadas.length : ""}
                </Button>
              )}
            </div>

            <div className="rec-pendentes-lista">
              {pendentes.map((o) => {
                const chave = chavePendente(o);
                const marcada = !ignoradas.has(chave);
                return (
                  <label key={chave} className={`rec-pendente-item ${marcada ? "" : "ignorada"}`}>
                    <input
                      type="checkbox"
                      checked={marcada}
                      onChange={() => setIgnoradas((prev) => {
                        const novo = new Set(prev);
                        if (novo.has(chave)) novo.delete(chave); else novo.add(chave);
                        return novo;
                      })}
                    />
                    <span className="rec-pendente-corpo">
                      <span className="rec-pendente-desc">{o.recorrencia.descricao}</span>
                      <span className="rec-pendente-meta">{formatarData(o.data)} · {labelFrequencia(o.recorrencia.frequencia)}</span>
                    </span>
                    <span className={`rec-pendente-valor tabular ${o.recorrencia.tipo}`}>
                      {o.recorrencia.tipo === "receita" ? "+" : "−"}{formatarMoeda(o.recorrencia.valor)}
                    </span>
                  </label>
                );
              })}
            </div>

            {selecionadas.length > 0 && (
              <div className="rec-pendentes-rodape">
                <span>Efeito no saldo</span>
                <strong className={`tabular ${totalPendente < 0 ? "negativo" : "positivo"}`}>
                  {totalPendente < 0 ? "−" : "+"}{formatarMoeda(Math.abs(totalPendente))}
                </strong>
              </div>
            )}
          </Card>
        </div>
      )}

      <div className="section">
        <h2 className="section-title">Moldes cadastrados</h2>
        {recorrencias.length === 0 ? (
          <Card>
            <EmptyState
              title="Nenhuma recorrência cadastrada"
              description="Cadastre o que se repete — salário, aluguel, internet, streaming. O Nexo passa a repor esses lançamentos sozinho e a projeção do futuro fica confiável."
              action={<Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Nova recorrência</Button>}
            />
          </Card>
        ) : (
          <Card>
            <div className="list">
              {recorrencias.map((r) => {
                const dias = diasRestantes(r.proxima_ocorrencia);
                const inativa = r.ativa === 0;
                return (
                  <div key={r.id} className={`list-row ${inativa ? "rec-inativa" : ""}`}>
                    <span className={`rec-icone ${r.tipo}`}>
                      {r.lancar_automatico ? <Zap size={14} /> : <Hand size={14} />}
                    </span>
                    <div className="list-row-main">
                      <div className="list-row-title">{r.descricao}</div>
                      <div className="list-row-meta">
                        {labelFrequencia(r.frequencia)}
                        {" · "}
                        {inativa ? "pausada" : `próxima ${formatarData(r.proxima_ocorrencia)}`}
                        {r.data_fim && ` · até ${formatarData(r.data_fim)}`}
                        {" · "}
                        {formatarMoeda(valorMensalizado(r))}/mês
                      </div>
                    </div>
                    {!inativa && dias !== null && dias <= 7 && (
                      <Badge tone={dias < 0 ? "danger" : "warn"}>{textoPrazo(dias)}</Badge>
                    )}
                    {r.lancar_automatico === 1 && <Badge tone="muted">automática</Badge>}
                    <div className={`list-row-value tabular ${r.tipo}`}>
                      {r.tipo === "receita" ? "+" : "−"}{formatarMoeda(r.valor)}
                    </div>
                    {(
                      <div className="list-row-actions">
                        <button className="icon-btn" title={inativa ? "Retomar" : "Pausar"}
                          onClick={async () => { await alternarAtiva(r.id); recarregar(); }}>
                          {inativa ? <Play size={15} /> : <Pause size={15} />}
                        </button>
                        <button className="icon-btn" title="Pular a próxima" onClick={() => handlePular(r)}>
                          <SkipForward size={15} />
                        </button>
                        <button className="icon-btn" title="Editar" onClick={() => abrirEdicao(r)}>
                          <Pencil size={15} />
                        </button>
                        <button className="icon-btn danger" title="Excluir" onClick={() => handleExcluir(r)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      <Drawer open={aberto} title={editando ? "Editar recorrência" : "Nova recorrência"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <div className="form-row-2">
            <Field label="Tipo">
              <Select value={tipo} onChange={(e) => { setTipo(e.target.value as TipoCategoria); setCategoriaId(""); }}>
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
              </Select>
            </Field>
            <Field label="Valor">
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required />
            </Field>
          </div>

          <Field label="Descrição">
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Aluguel, Salário, Netflix" required />
          </Field>

          <div className="form-row-2">
            <Field label="Frequência">
              <Select value={frequencia} onChange={(e) => setFrequencia(e.target.value as Frequencia)}>
                {FREQUENCIAS.map((f) => <option key={f.valor} value={f.valor}>{f.label}</option>)}
              </Select>
            </Field>
            <Field label="Primeira ocorrência" hint="O dia daqui vira o dia de referência dos meses seguintes.">
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
            </Field>
          </div>

          <Field label="Termina em" hint="Deixe vazio se não tem fim previsto.">
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </Field>

          <div className="form-row-2">
            <Field label="Categoria">
              <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                <option value="">Sem categoria</option>
                {categoriasDoTipo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Field>
            <Field label="Natureza">
              <Select value={natureza} onChange={(e) => setNatureza(e.target.value as NaturezaTransacao | "")}>
                <option value="">Não classificar</option>
                <option value="fixo">Fixo</option>
                <option value="variavel">Variável</option>
                <option value="investimento">Investimento</option>
              </Select>
            </Field>
          </div>

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

          <label className="rec-checkbox">
            <input type="checkbox" checked={automatico} onChange={(e) => setAutomatico(e.target.checked)} />
            <span>
              <strong>Lançar automaticamente</strong>
              <em>
                Marque só para o que é certo e de valor fixo — assinatura, aluguel.
                Se o valor varia (conta de luz), deixe desmarcado: o Nexo pergunta antes
                em vez de gravar um número errado.
              </em>
            </span>
          </label>

          <Field label="Observações">
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </Field>

          <div className="page-actions">
            <Button type="button" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">{editando ? "Salvar" : "Criar recorrência"}</Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
