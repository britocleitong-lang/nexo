import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Home, Wrench, TrendingUp, Paperclip } from "lucide-react";
import type { Imovel, ManutencaoImovel } from "../../types/entities";
import {
  buscarImovel, atualizarImovel, excluirImovel, TIPOS_IMOVEL,
  listarManutencoesImovel, criarManutencaoImovel, atualizarManutencaoImovel, excluirManutencaoImovel,
  custoTotalImovel,
} from "./imoveisRepository";
import { Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select, StatCard, Textarea } from "../../components/ui";
import { AnexosSection } from "../../components/AnexosSection";
import { contarAnexos } from "../anexos/anexosRepository";
import { formatarData, formatarMoeda, hojeISO } from "../../utils/format";
import { confirmar } from "../../components/Confirm";

export function ImovelDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [imovel, setImovel] = useState<Imovel | null | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  function recarregar() {
    if (!id) return;
    setImovel(buscarImovel(id));
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (imovel === undefined) return null;
  if (imovel === null) {
    return (
      <div>
        <PageHeader title="Imóvel não encontrado" />
        <Link to="/imoveis">← Voltar para Imóveis</Link>
      </div>
    );
  }

  return (
    <ImovelDetalheConteudo
      imovel={imovel}
      onVoltar={() => navigate("/imoveis")}
      onMudou={recarregar}
      onExcluido={() => navigate("/imoveis")}
      refreshKey={refreshKey}
    />
  );
}

function ImovelDetalheConteudo({
  imovel, onVoltar, onMudou, onExcluido, refreshKey,
}: {
  imovel: Imovel; onVoltar: () => void; onMudou: () => void; onExcluido: () => void; refreshKey: number;
}) {
  const [abertoEdicao, setAbertoEdicao] = useState(false);
  const custoManutencao = useMemo(() => custoTotalImovel(imovel.id), [imovel.id, refreshKey]);

  async function handleExcluir() {
    if (!(await confirmar({ titulo: "Excluir imóvel?", descricao: "Todas as manutenções registradas nele também serão apagadas." }))) return;
    await excluirImovel(imovel.id);
    onExcluido();
  }

  return (
    <div>
      <button className="voltar-link" onClick={onVoltar}><ArrowLeft size={15} /> Imóveis</button>

      <div className="veiculo-header">
        <div className="veiculo-header-icon" style={{ cursor: "default" }}>
          <div style={{ width: 110, height: 68, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
            <Home size={40} />
          </div>
        </div>
        <div className="veiculo-header-info">
          <h1 className="page-title">{imovel.apelido}</h1>
          <div className="list-row-meta" style={{ marginTop: 4 }}>
            <span>{TIPOS_IMOVEL.find((t) => t.valor === imovel.tipo)?.label}</span>
            {imovel.endereco && <span>{imovel.endereco}</span>}
            {imovel.area_m2 && <span>{imovel.area_m2} m²</span>}
          </div>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => setAbertoEdicao(true)}>Editar dados</Button>
          <Button variant="danger" icon={<Trash2 size={14} />} onClick={handleExcluir}>Excluir</Button>
        </div>
      </div>

      <div className="grid-2 section">
        <StatCard label="Valor atual" value={formatarMoeda(imovel.valor_atual ?? 0)} icon={<TrendingUp size={16} />} hint="Entra automaticamente no seu patrimônio" />
        <StatCard label="Gasto com manutenção" value={formatarMoeda(custoManutencao)} icon={<Wrench size={16} />} />
      </div>

      <div className="section">
        <h3 className="section-title"><Paperclip size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Documentos e anexos</h3>
        <Card>
          <div style={{ padding: 18 }}>
            <AnexosSection entidadeTipo="imovel" entidadeId={imovel.id} />
          </div>
        </Card>
      </div>

      <ManutencoesImovelSection imovel={imovel} onMudou={onMudou} refreshKey={refreshKey} />

      <Drawer open={abertoEdicao} title="Editar imóvel" onClose={() => setAbertoEdicao(false)}>
        <EditarImovelForm imovel={imovel} onSalvo={() => { setAbertoEdicao(false); onMudou(); }} />
      </Drawer>
    </div>
  );
}

function EditarImovelForm({ imovel, onSalvo }: { imovel: Imovel; onSalvo: () => void }) {
  const [apelido, setApelido] = useState(imovel.apelido);
  const [tipo, setTipo] = useState(imovel.tipo);
  const [endereco, setEndereco] = useState(imovel.endereco ?? "");
  const [areaM2, setAreaM2] = useState(imovel.area_m2 != null ? String(imovel.area_m2) : "");
  const [valorAtual, setValorAtual] = useState(imovel.valor_atual != null ? String(imovel.valor_atual) : "");
  const [valorCompra, setValorCompra] = useState(imovel.valor_compra != null ? String(imovel.valor_compra) : "");
  const [dataCompra, setDataCompra] = useState(imovel.data_compra ?? "");
  const [observacoes, setObservacoes] = useState(imovel.observacoes ?? "");

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!apelido.trim()) return;
    await atualizarImovel(imovel.id, {
      apelido: apelido.trim(),
      tipo,
      endereco: endereco.trim() || null,
      area_m2: areaM2 ? Number(areaM2) : null,
      valor_atual: valorAtual ? Number(valorAtual) : null,
      valor_compra: valorCompra ? Number(valorCompra) : null,
      data_compra: dataCompra || null,
      observacoes: observacoes.trim() || null,
    });
    onSalvo();
  }

  return (
    <form className="form-grid" onSubmit={handleSalvar}>
      <Field label="Apelido"><Input value={apelido} onChange={(e) => setApelido(e.target.value)} autoFocus /></Field>
      <Field label="Tipo">
        <Select value={tipo} onChange={(e) => setTipo(e.target.value as Imovel["tipo"])}>
          {TIPOS_IMOVEL.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
        </Select>
      </Field>
      <Field label="Endereço"><Input value={endereco} onChange={(e) => setEndereco(e.target.value)} /></Field>
      <div className="form-row-2">
        <Field label="Área (m²)"><Input type="number" value={areaM2} onChange={(e) => setAreaM2(e.target.value)} /></Field>
        <Field label="Valor atual"><Input type="number" value={valorAtual} onChange={(e) => setValorAtual(e.target.value)} /></Field>
      </div>
      <div className="form-row-2">
        <Field label="Valor de compra"><Input type="number" value={valorCompra} onChange={(e) => setValorCompra(e.target.value)} /></Field>
        <Field label="Data de compra"><Input type="date" value={dataCompra} onChange={(e) => setDataCompra(e.target.value)} /></Field>
      </div>
      <Field label="Observações"><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></Field>
      <Button type="submit" variant="primary">Salvar alterações</Button>
    </form>
  );
}

function ManutencoesImovelSection({ imovel, onMudou, refreshKey }: { imovel: Imovel; onMudou: () => void; refreshKey: number }) {
  const [manutencoes, setManutencoes] = useState<ManutencaoImovel[]>([]);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<ManutencaoImovel | null>(null);
  const [anexoDe, setAnexoDe] = useState<ManutencaoImovel | null>(null);
  const [tipo, setTipo] = useState("");
  const [data, setData] = useState(hojeISO());
  const [valor, setValor] = useState("");
  const [prestador, setPrestador] = useState("");
  const [proximaData, setProximaData] = useState("");

  function recarregar() {
    setManutencoes(listarManutencoesImovel(imovel.id));
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imovel.id, refreshKey]);

  function abrirNovo() {
    setEditando(null);
    setTipo(""); setData(hojeISO()); setValor(""); setPrestador(""); setProximaData("");
    setAberto(true);
  }

  function abrirEdicao(m: ManutencaoImovel) {
    setEditando(m);
    setTipo(m.tipo); setData(m.data); setValor(m.valor != null ? String(m.valor) : "");
    setPrestador(m.prestador ?? ""); setProximaData(m.proxima_data ?? "");
    setAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo.trim() || !data) return;
    const dados = {
      imovel_id: imovel.id,
      tipo: tipo.trim(),
      data,
      valor: valor ? Number(valor) : null,
      prestador: prestador.trim() || null,
      proxima_data: proximaData || null,
    };
    if (editando) {
      await atualizarManutencaoImovel(editando.id, dados);
    } else {
      await criarManutencaoImovel(dados);
    }
    setAberto(false);
    recarregar();
    onMudou();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir manutenção?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirManutencaoImovel(id);
    recarregar();
    onMudou();
  }

  return (
    <div className="section">
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h3 className="section-title" style={{ margin: 0 }}>Manutenções da casa</h3>
        <Button variant="primary" icon={<Wrench size={14} />} onClick={abrirNovo}>Registrar manutenção</Button>
      </div>
      <Card>
        {manutencoes.length === 0 ? (
          <EmptyState title="Nenhuma manutenção registrada" description="Ar-condicionado, gás, elétrica, pintura..." />
        ) : (
          <div className="list">
            {manutencoes.map((m) => (
              <div key={m.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title">{m.tipo}</span>
                  <span className="list-row-meta">
                    <span>{formatarData(m.data)}</span>
                    {m.prestador && <span>{m.prestador}</span>}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {m.valor != null && <span className="list-row-value tabular">{formatarMoeda(m.valor)}</span>}
                  <button className="icon-btn" onClick={() => setAnexoDe(m)} aria-label="Anexos">
                    <Paperclip size={14} />
                    {contarAnexos("manutencao_imovel", m.id) > 0 && <span className="anexo-badge">{contarAnexos("manutencao_imovel", m.id)}</span>}
                  </button>
                  <button className="icon-btn" onClick={() => abrirEdicao(m)}><Pencil size={14} /></button>
                  <button className="icon-btn danger" onClick={() => handleExcluir(m.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Drawer open={aberto} title={editando ? "Editar manutenção" : "Registrar manutenção"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Tipo"><Input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Ar-condicionado, gás, pintura..." autoFocus /></Field>
          <div className="form-row-2">
            <Field label="Data"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
            <Field label="Valor" hint="Cria lançamento no Financeiro"><Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
          </div>
          <Field label="Prestador"><Input value={prestador} onChange={(e) => setPrestador(e.target.value)} /></Field>
          <Field label="Próxima manutenção prevista"><Input type="date" value={proximaData} onChange={(e) => setProximaData(e.target.value)} /></Field>
          <Button type="submit" variant="primary">{editando ? "Salvar alterações" : "Registrar"}</Button>
        </form>
      </Drawer>

      <Drawer open={!!anexoDe} title={anexoDe ? `Anexos — ${anexoDe.tipo}` : "Anexos"} onClose={() => setAnexoDe(null)}>
        {anexoDe && <AnexosSection entidadeTipo="manutencao_imovel" entidadeId={anexoDe.id} />}
      </Drawer>
    </div>
  );
}
