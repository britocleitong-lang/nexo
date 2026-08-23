import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Pencil, Trash2, Wrench, Wand2, TrendingUp, Gauge,
  Plus, RefreshCw, Palette, Paperclip, Receipt,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import type { Veiculo, Manutencao, Modificacao, RegistroKm, Transacao } from "../../types/entities";
import {
  buscarVeiculo, atualizarVeiculo, excluirVeiculo, atualizarCorVeiculo, atualizarFipeVeiculo, atualizarFotoVeiculo,
  listarManutencoes, criarManutencao, atualizarManutencao, excluirManutencao,
  listarModificacoes, criarModificacao, atualizarModificacao, excluirModificacao,
  listarKmRegistros, registrarKm, excluirKmRegistro, mediaKmPorDia,
  listarLancamentosFinanceirosVeiculo, gastoFinanceiroTotalVeiculo,
} from "./veiculosRepository";
import { BuscaFipeDrawer } from "./BuscaFipeDrawer";
import { VehicleIcon, VehicleVisual, CORES_VEICULO_SUGERIDAS } from "../../components/VehicleIcon";
import { FotoPicker } from "../../components/FotoPicker";
import {
  Button, Card, Drawer, EmptyState, Field, Input, PageHeader, StatCard, Textarea,
} from "../../components/ui";
import { AnexosSection } from "../../components/AnexosSection";
import { contarAnexos } from "../anexos/anexosRepository";
import { formatarData, formatarMoeda, hojeISO } from "../../utils/format";
import { confirmar } from "../../components/Confirm";

export function VeiculoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [veiculo, setVeiculo] = useState<Veiculo | null | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  function recarregar() {
    if (!id) return;
    setVeiculo(buscarVeiculo(id));
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (veiculo === undefined) return null;

  if (veiculo === null) {
    return (
      <div>
        <PageHeader title="Veículo não encontrado" />
        <Link to="/veiculos">← Voltar para Veículos</Link>
      </div>
    );
  }

  return (
    <VeiculoDetalheConteudo
      veiculo={veiculo}
      onVoltar={() => navigate("/veiculos")}
      onMudou={recarregar}
      onExcluido={() => navigate("/veiculos")}
      refreshKey={refreshKey}
    />
  );
}

function VeiculoDetalheConteudo({
  veiculo,
  onVoltar,
  onMudou,
  onExcluido,
  refreshKey,
}: {
  veiculo: Veiculo;
  onVoltar: () => void;
  onMudou: () => void;
  onExcluido: () => void;
  refreshKey: number;
}) {
  const [abertoEdicao, setAbertoEdicao] = useState(false);
  const [abertoFipe, setAbertoFipe] = useState(false);
  const [abertoCor, setAbertoCor] = useState(false);
  const [abertoFoto, setAbertoFoto] = useState(false);

  const gastoTotal = useMemo(() => gastoFinanceiroTotalVeiculo(veiculo.id), [veiculo.id, refreshKey]);
  const mediaDia = useMemo(() => mediaKmPorDia(veiculo.id), [veiculo.id, refreshKey]);

  async function handleExcluirVeiculo() {
    if (!(await confirmar({ titulo: "Excluir veículo?", descricao: "Manutenções, modificações e histórico de quilometragem também serão apagados." }))) return;
    await excluirVeiculo(veiculo.id);
    onExcluido();
  }

  async function handleConfirmarFipe(dados: { valor: number; marcaCodigo: string; modeloCodigo: string; anoCodigo: string }) {
    await atualizarFipeVeiculo(veiculo.id, {
      valor_atual: dados.valor,
      fipe_marca_codigo: dados.marcaCodigo,
      fipe_modelo_codigo: dados.modeloCodigo,
      fipe_ano_codigo: dados.anoCodigo,
    });
    setAbertoFipe(false);
    onMudou();
  }

  async function handleEscolherCor(cor: string) {
    await atualizarCorVeiculo(veiculo.id, cor);
    onMudou();
  }

  async function handleSalvarFoto(url: string | null) {
    await atualizarFotoVeiculo(veiculo.id, url);
    setAbertoFoto(false);
    onMudou();
  }

  return (
    <div>
      <button className="voltar-link" onClick={onVoltar}>
        <ArrowLeft size={15} /> Veículos
      </button>

      <div className="veiculo-header">
        <button className="veiculo-header-icon" onClick={() => setAbertoCor(true)} title="Trocar cor">
          <VehicleVisual fotoUrl={veiculo.foto_url} cor={veiculo.cor} size={110} />
          {!veiculo.foto_url && <span className="veiculo-header-icon-badge"><Palette size={12} /></span>}
        </button>
        <div className="veiculo-header-info">
          <h1 className="page-title">{veiculo.marca} {veiculo.modelo}</h1>
          <div className="list-row-meta" style={{ marginTop: 4 }}>
            {veiculo.ano && <span>{veiculo.ano}</span>}
            {veiculo.placa && <span>{veiculo.placa}</span>}
            {veiculo.combustivel && <span>{veiculo.combustivel}</span>}
          </div>
          <button className="link-sutil" onClick={() => setAbertoFoto(true)}>
            {veiculo.foto_url ? "Trocar foto" : "+ Adicionar foto"}
          </button>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => setAbertoEdicao(true)}>Editar dados</Button>
          <Button variant="danger" icon={<Trash2 size={14} />} onClick={handleExcluirVeiculo}>Excluir</Button>
        </div>
      </div>

      <div className="grid-3 section">
        <StatCard label="Valor de mercado" value={formatarMoeda(veiculo.valor_atual ?? 0)} icon={<TrendingUp size={16} />}
          hint={veiculo.fipe_atualizado_em ? `FIPE em ${formatarData(veiculo.fipe_atualizado_em)}` : "Nunca consultado na FIPE"} />
        <StatCard label="Gasto total (financeiro)" value={formatarMoeda(gastoTotal)} icon={<Receipt size={16} />}
          hint="Soma de todos os lançamentos vinculados a este veículo" />
        <StatCard label="Uso médio" value={mediaDia != null ? `${mediaDia.toFixed(1)} km/dia` : "—"} icon={<Gauge size={16} />} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <Button variant="secondary" icon={<RefreshCw size={14} />} onClick={() => setAbertoFipe(true)}>
          {veiculo.fipe_atualizado_em ? "Atualizar valor pela FIPE" : "Consultar valor na FIPE"}
        </Button>
      </div>

      <div className="section">
        <h3 className="section-title"><Paperclip size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Documentos e anexos</h3>
        <Card>
          <div style={{ padding: 18 }}>
            <AnexosSection entidadeTipo="veiculo" entidadeId={veiculo.id} />
          </div>
        </Card>
      </div>

      <LancamentosFinanceirosSection veiculo={veiculo} refreshKey={refreshKey} />
      <QuilometragemSection veiculo={veiculo} onMudou={onMudou} refreshKey={refreshKey} />
      <ManutencoesSection veiculo={veiculo} onMudou={onMudou} refreshKey={refreshKey} />
      <ModificacoesSection veiculo={veiculo} onMudou={onMudou} refreshKey={refreshKey} />

      <Drawer open={abertoEdicao} title="Editar veículo" onClose={() => setAbertoEdicao(false)}>
        <EditarVeiculoForm veiculo={veiculo} onSalvo={() => { setAbertoEdicao(false); onMudou(); }} />
      </Drawer>

      <BuscaFipeDrawer aberto={abertoFipe} onClose={() => setAbertoFipe(false)} onConfirmar={handleConfirmarFipe} />

      <Drawer open={abertoCor} title="Cor do veículo" onClose={() => setAbertoCor(false)}>
        <div className="cor-preview">
          <VehicleIcon cor={veiculo.cor} size={140} />
        </div>
        <div className="cor-swatches">
          {CORES_VEICULO_SUGERIDAS.map((c) => (
            <button
              key={c}
              className={`cor-swatch ${veiculo.cor === c ? "selecionado" : ""}`}
              style={{ background: c }}
              onClick={() => handleEscolherCor(c)}
              aria-label={c}
            />
          ))}
        </div>
        <Field label="Cor personalizada (hex)">
          <Input
            type="color"
            value={veiculo.cor || "#2f6fed"}
            onChange={(e) => handleEscolherCor(e.target.value)}
            style={{ height: 42, padding: 4 }}
          />
        </Field>
      </Drawer>

      <FotoRealDrawer
        aberto={abertoFoto}
        fotoAtual={veiculo.foto_url}
        onClose={() => setAbertoFoto(false)}
        onSalvar={handleSalvarFoto}
      />
    </div>
  );
}

// --- Foto real (opcional) ---------------------------------------------------

function FotoRealDrawer({
  aberto,
  fotoAtual,
  onClose,
  onSalvar,
}: {
  aberto: boolean;
  fotoAtual: string | null;
  onClose: () => void;
  onSalvar: (url: string | null) => void;
}) {
  const [foto, setFoto] = useState<string | null>(fotoAtual);

  useEffect(() => { setFoto(fotoAtual); }, [fotoAtual, aberto]);

  return (
    <Drawer open={aberto} title="Foto do veículo" onClose={onClose}>
      <div className="form-grid">
        <p className="veiculo-foto-nota">
          Tire a foto na hora pelo celular, escolha uma da galeria, ou cole um link.
          A imagem é reduzida e guardada dentro do próprio banco — funciona offline
          e vai junto no backup. Sem foto, o app desenha o ícone na cor escolhida.
        </p>

        <FotoPicker
          valor={foto}
          onChange={setFoto}
          rotuloVazio="Sem foto — será usado o ícone"
        />

        <div className="page-actions">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => onSalvar(foto)}>Salvar</Button>
        </div>
      </div>
    </Drawer>
  );
}

// --- Formulário de edição dos dados básicos ---------------------------------

function EditarVeiculoForm({ veiculo, onSalvo }: { veiculo: Veiculo; onSalvo: () => void }) {
  const [marca, setMarca] = useState(veiculo.marca);
  const [modelo, setModelo] = useState(veiculo.modelo);
  const [ano, setAno] = useState(veiculo.ano ?? "");
  const [placa, setPlaca] = useState(veiculo.placa ?? "");
  const [combustivel, setCombustivel] = useState(veiculo.combustivel ?? "");
  const [valorCompra, setValorCompra] = useState(veiculo.valor_compra != null ? String(veiculo.valor_compra) : "");
  const [valorAtual, setValorAtual] = useState(veiculo.valor_atual != null ? String(veiculo.valor_atual) : "");
  const [dataCompra, setDataCompra] = useState(veiculo.data_compra ?? "");
  const [renavam, setRenavam] = useState(veiculo.renavam ?? "");
  const [observacoes, setObservacoes] = useState(veiculo.observacoes ?? "");

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!marca.trim() || !modelo.trim()) return;
    await atualizarVeiculo(veiculo.id, {
      marca: marca.trim(),
      modelo: modelo.trim(),
      ano: ano || null,
      placa: placa.trim() || null,
      combustivel: combustivel || null,
      valor_compra: valorCompra ? Number(valorCompra) : null,
      valor_atual: valorAtual ? Number(valorAtual) : null,
      data_compra: dataCompra || null,
      renavam: renavam.trim() || null,
      observacoes: observacoes.trim() || null,
    });
    onSalvo();
  }

  return (
    <form className="form-grid" onSubmit={handleSalvar}>
      <div className="form-row-2">
        <Field label="Marca"><Input value={marca} onChange={(e) => setMarca(e.target.value)} autoFocus /></Field>
        <Field label="Modelo"><Input value={modelo} onChange={(e) => setModelo(e.target.value)} /></Field>
      </div>
      <div className="form-row-2">
        <Field label="Ano"><Input value={ano} onChange={(e) => setAno(e.target.value)} /></Field>
        <Field label="Placa"><Input value={placa} onChange={(e) => setPlaca(e.target.value)} /></Field>
      </div>
      <div className="form-row-2">
        <Field label="Combustível"><Input value={combustivel} onChange={(e) => setCombustivel(e.target.value)} /></Field>
        <Field label="Renavam"><Input value={renavam} onChange={(e) => setRenavam(e.target.value)} /></Field>
      </div>
      <div className="form-row-2">
        <Field label="Valor de compra"><Input type="number" value={valorCompra} onChange={(e) => setValorCompra(e.target.value)} /></Field>
        <Field label="Data de compra"><Input type="date" value={dataCompra} onChange={(e) => setDataCompra(e.target.value)} /></Field>
      </div>
      <Field label="Valor atual (mercado)" hint="Preenchido pela FIPE, ou edite manualmente aqui — entra no seu patrimônio">
        <Input type="number" value={valorAtual} onChange={(e) => setValorAtual(e.target.value)} />
      </Field>
      <Field label="Observações"><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></Field>
      <Button type="submit" variant="primary">Salvar alterações</Button>
    </form>
  );
}

// --- Lançamentos financeiros (cruzamento com o Financeiro) -------------------

function LancamentosFinanceirosSection({ veiculo, refreshKey }: { veiculo: Veiculo; refreshKey: number }) {
  const [lancamentos, setLancamentos] = useState<Transacao[]>([]);

  useEffect(() => {
    setLancamentos(listarLancamentosFinanceirosVeiculo(veiculo.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veiculo.id, refreshKey]);

  return (
    <div className="section">
      <h3 className="section-title">Lançamentos financeiros deste veículo</h3>
      <Card>
        {lancamentos.length === 0 ? (
          <EmptyState
            title="Nenhum lançamento vinculado ainda"
            description="Manutenções e modificações com valor entram aqui automaticamente. Você também pode escolher este veículo ao lançar qualquer despesa no Financeiro (combustível, seguro, IPVA...)."
          />
        ) : (
          <div className="list">
            {lancamentos.map((t) => (
              <div key={t.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title">{t.descricao}</span>
                  <span className="list-row-meta"><span>{formatarData(t.data)}</span></span>
                </div>
                <span className="list-row-value tabular">
                  {t.tipo === "receita" ? "+" : "-"} {formatarMoeda(t.valor)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// --- Quilometragem -----------------------------------------------------------

function QuilometragemSection({ veiculo, onMudou, refreshKey }: { veiculo: Veiculo; onMudou: () => void; refreshKey: number }) {
  const [registros, setRegistros] = useState<RegistroKm[]>([]);
  const [aberto, setAberto] = useState(false);
  const [km, setKm] = useState("");
  const [data, setData] = useState(hojeISO());

  function recarregar() {
    setRegistros(listarKmRegistros(veiculo.id));
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veiculo.id, refreshKey]);

  async function handleRegistrar(e: React.FormEvent) {
    e.preventDefault();
    if (!km) return;
    await registrarKm(veiculo.id, data, Number(km));
    setKm("");
    setData(hojeISO());
    setAberto(false);
    recarregar();
    onMudou();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir registro de quilometragem?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirKmRegistro(id);
    recarregar();
    onMudou();
  }

  const dadosGrafico = registros.map((r) => ({ data: formatarData(r.data), km: r.km }));

  return (
    <div className="section">
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>Quilometragem</h3>
          <p style={{ fontSize: 13.5, color: "var(--text-secondary)", margin: "4px 0 0" }}>
            Atual: <strong className="tabular">{veiculo.km_atual != null ? `${veiculo.km_atual.toLocaleString("pt-BR")} km` : "não informado"}</strong>
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setAberto(true)}>Atualizar quilometragem</Button>
      </div>

      <Card>
        {registros.length === 0 ? (
          <EmptyState
            title="Nenhuma leitura registrada"
            description="Anote a quilometragem de vez em quando para acompanhar o uso do veículo ao longo do tempo."
          />
        ) : registros.length === 1 ? (
          <p style={{ padding: "18px", margin: 0, fontSize: "var(--size-small)", color: "var(--text-muted)" }}>
            Registre mais uma leitura em outra data para ver o gráfico de evolução.
          </p>
        ) : (
          <div style={{ padding: "18px 18px 6px", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosGrafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="data" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  width={56}
                  domain={["dataMin - 200", "dataMax + 200"]}
                />
                <Tooltip
                  formatter={((v: any) => [`${Number(v).toLocaleString("pt-BR")} km`, "Quilometragem"]) as any}
                  contentStyle={{ fontSize: 12.5, borderRadius: 8 }}
                />
                <Line type="monotone" dataKey="km" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {registros.length > 0 && (
          <div className="list" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            {[...registros].reverse().slice(0, 6).map((r) => (
              <div key={r.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title tabular">{r.km.toLocaleString("pt-BR")} km</span>
                  <span className="list-row-meta">{formatarData(r.data)}</span>
                </div>
                <button className="icon-btn danger" onClick={() => handleExcluir(r.id)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Drawer open={aberto} title="Atualizar quilometragem" onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleRegistrar}>
          <Field label="Quilometragem atual">
            <Input type="number" value={km} onChange={(e) => setKm(e.target.value)} autoFocus />
          </Field>
          <Field label="Data da leitura">
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary">Registrar</Button>
        </form>
      </Drawer>
    </div>
  );
}

// --- Manutenções -----------------------------------------------------------

function ManutencoesSection({ veiculo, onMudou, refreshKey }: { veiculo: Veiculo; onMudou: () => void; refreshKey: number }) {
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Manutencao | null>(null);
  const [anexoDe, setAnexoDe] = useState<Manutencao | null>(null);
  const [tipo, setTipo] = useState("");
  const [data, setData] = useState(hojeISO());
  const [km, setKm] = useState("");
  const [valor, setValor] = useState("");
  const [oficina, setOficina] = useState("");
  const [proximaData, setProximaData] = useState("");

  function recarregar() {
    setManutencoes(listarManutencoes(veiculo.id));
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veiculo.id, refreshKey]);

  function abrirNovo() {
    setEditando(null);
    setTipo(""); setKm(""); setValor(""); setOficina(""); setProximaData(""); setData(hojeISO());
    setAberto(true);
  }

  function abrirEdicao(m: Manutencao) {
    setEditando(m);
    setTipo(m.tipo);
    setData(m.data);
    setKm(m.km != null ? String(m.km) : "");
    setValor(m.valor != null ? String(m.valor) : "");
    setOficina(m.oficina ?? "");
    setProximaData(m.proxima_data ?? "");
    setAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo.trim() || !data) return;
    const dados = {
      veiculo_id: veiculo.id,
      tipo: tipo.trim(),
      data,
      km: km ? Number(km) : null,
      valor: valor ? Number(valor) : null,
      oficina: oficina.trim() || null,
      proxima_data: proximaData || null,
    };
    if (editando) {
      await atualizarManutencao(editando.id, dados);
    } else {
      await criarManutencao(dados);
    }
    setAberto(false);
    recarregar();
    onMudou();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir manutenção?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirManutencao(id);
    recarregar();
    onMudou();
  }

  return (
    <div className="section">
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h3 className="section-title" style={{ margin: 0 }}>Manutenções</h3>
        <Button variant="primary" icon={<Wrench size={14} />} onClick={abrirNovo}>Registrar manutenção</Button>
      </div>
      <Card>
        {manutencoes.length === 0 ? (
          <EmptyState title="Nenhuma manutenção registrada" />
        ) : (
          <div className="list">
            {manutencoes.map((m) => (
              <div key={m.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title">{m.tipo}</span>
                  <span className="list-row-meta">
                    <span>{formatarData(m.data)}</span>
                    {m.km != null && <span>{m.km.toLocaleString("pt-BR")} km</span>}
                    {m.oficina && <span>{m.oficina}</span>}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {m.valor != null && <span className="list-row-value tabular">{formatarMoeda(m.valor)}</span>}
                  <button className="icon-btn" onClick={() => setAnexoDe(m)} aria-label="Anexos">
                    <Paperclip size={14} />
                    {contarAnexos("manutencao", m.id) > 0 && <span className="anexo-badge">{contarAnexos("manutencao", m.id)}</span>}
                  </button>
                  <button className="icon-btn" onClick={() => abrirEdicao(m)} aria-label="Editar"><Pencil size={14} /></button>
                  <button className="icon-btn danger" onClick={() => handleExcluir(m.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Drawer open={aberto} title={editando ? "Editar manutenção" : "Registrar manutenção"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Tipo"><Input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Troca de óleo, pneus..." autoFocus /></Field>
          <div className="form-row-2">
            <Field label="Data"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
            <Field label="Km na ocasião"><Input type="number" value={km} onChange={(e) => setKm(e.target.value)} /></Field>
          </div>
          <div className="form-row-2">
            <Field label="Valor" hint="Cria um lançamento no Financeiro automaticamente"><Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
            <Field label="Oficina"><Input value={oficina} onChange={(e) => setOficina(e.target.value)} /></Field>
          </div>
          <Field label="Próxima manutenção prevista" hint="Opcional — usado nos alertas do dashboard">
            <Input type="date" value={proximaData} onChange={(e) => setProximaData(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary">{editando ? "Salvar alterações" : "Registrar"}</Button>
        </form>
      </Drawer>

      <Drawer open={!!anexoDe} title={anexoDe ? `Anexos — ${anexoDe.tipo}` : "Anexos"} onClose={() => setAnexoDe(null)}>
        {anexoDe && <AnexosSection entidadeTipo="manutencao" entidadeId={anexoDe.id} />}
      </Drawer>
    </div>
  );
}

// --- Modificações -----------------------------------------------------------

function ModificacoesSection({ veiculo, onMudou, refreshKey }: { veiculo: Veiculo; onMudou: () => void; refreshKey: number }) {
  const [modificacoes, setModificacoes] = useState<Modificacao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Modificacao | null>(null);
  const [anexoDe, setAnexoDe] = useState<Modificacao | null>(null);
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(hojeISO());
  const [valor, setValor] = useState("");
  const [observacoes, setObservacoes] = useState("");

  function recarregar() {
    setModificacoes(listarModificacoes(veiculo.id));
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veiculo.id, refreshKey]);

  function abrirNovo() {
    setEditando(null);
    setDescricao(""); setValor(""); setObservacoes(""); setData(hojeISO());
    setAberto(true);
  }

  function abrirEdicao(m: Modificacao) {
    setEditando(m);
    setDescricao(m.descricao);
    setData(m.data);
    setValor(m.valor != null ? String(m.valor) : "");
    setObservacoes(m.observacoes ?? "");
    setAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim()) return;
    const dados = {
      veiculo_id: veiculo.id,
      descricao: descricao.trim(),
      data,
      valor: valor ? Number(valor) : null,
      observacoes: observacoes.trim() || null,
    };
    if (editando) {
      await atualizarModificacao(editando.id, dados);
    } else {
      await criarModificacao(dados);
    }
    setAberto(false);
    recarregar();
    onMudou();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir modificação?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirModificacao(id);
    recarregar();
    onMudou();
  }

  return (
    <div className="section">
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h3 className="section-title" style={{ margin: 0 }}>Modificações</h3>
        <Button variant="primary" icon={<Wand2 size={14} />} onClick={abrirNovo}>Registrar modificação</Button>
      </div>
      <Card>
        {modificacoes.length === 0 ? (
          <EmptyState title="Nenhuma modificação registrada" description="Personalizações, upgrades e acessórios instalados no veículo." />
        ) : (
          <div className="list">
            {modificacoes.map((m) => (
              <div key={m.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title">{m.descricao}</span>
                  <span className="list-row-meta"><span>{formatarData(m.data)}</span></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {m.valor != null && <span className="list-row-value tabular">{formatarMoeda(m.valor)}</span>}
                  <button className="icon-btn" onClick={() => setAnexoDe(m)} aria-label="Anexos">
                    <Paperclip size={14} />
                    {contarAnexos("modificacao", m.id) > 0 && <span className="anexo-badge">{contarAnexos("modificacao", m.id)}</span>}
                  </button>
                  <button className="icon-btn" onClick={() => abrirEdicao(m)} aria-label="Editar"><Pencil size={14} /></button>
                  <button className="icon-btn danger" onClick={() => handleExcluir(m.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Drawer open={aberto} title={editando ? "Editar modificação" : "Registrar modificação"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Descrição"><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Rebaixamento, som, rodas..." autoFocus /></Field>
          <div className="form-row-2">
            <Field label="Data"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
            <Field label="Valor" hint="Cria um lançamento no Financeiro automaticamente"><Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
          </div>
          <Field label="Observações"><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></Field>
          <Button type="submit" variant="primary">{editando ? "Salvar alterações" : "Registrar"}</Button>
        </form>
      </Drawer>

      <Drawer open={!!anexoDe} title={anexoDe ? `Anexos — ${anexoDe.descricao}` : "Anexos"} onClose={() => setAnexoDe(null)}>
        {anexoDe && <AnexosSection entidadeTipo="modificacao" entidadeId={anexoDe.id} />}
      </Drawer>
    </div>
  );
}
