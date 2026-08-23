import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Tag, ChevronRight, RotateCcw, Home, Building2, Trees, Store } from "lucide-react";
import type { Imovel, Conta } from "../../types/entities";
import {
  criarImovel, atualizarImovel, excluirImovel, listarImoveisPorStatus,
  custoTotalImovel, venderImovel, reativarImovel, TIPOS_IMOVEL,
} from "./imoveisRepository";
import { listarContas } from "../financeiro/financeiroRepository";
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select, Textarea } from "../../components/ui";
import { formatarMoeda, formatarData, hojeISO } from "../../utils/format";
import { confirmar } from "../../components/Confirm";
import { FotoPicker } from "../../components/FotoPicker";
import "./ImoveisPage.css";

/** Ícone por tipo — dá identidade visual quando não há foto cadastrada. */
const ICONE_TIPO: Record<string, typeof Home> = {
  casa: Home,
  apartamento: Building2,
  terreno: Trees,
  comercial: Store,
};

export function ImoveisPage() {
  const navigate = useNavigate();
  const [versao, setVersao] = useState(0);
  const [mostrarVendidos, setMostrarVendidos] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Imovel | null>(null);
  const [vendendo, setVendendo] = useState<Imovel | null>(null);

  const recarregar = () => setVersao((v) => v + 1);
  const ativos = useMemo(() => listarImoveisPorStatus("ativo"), [versao]);
  const vendidos = useMemo(() => listarImoveisPorStatus("vendido"), [versao]);

  useEffect(() => { recarregar(); }, []);

  async function handleExcluir(i: Imovel) {
    const ok = await confirmar({
      titulo: `Excluir ${i.apelido}?`,
      descricao: "Todo o histórico de manutenções e reformas vai junto. "
        + "Se o imóvel foi vendido, use a ação Vender — ela preserva tudo isso.",
    });
    if (!ok) return;
    await excluirImovel(i.id);
    recarregar();
  }

  return (
    <div>
      <PageHeader
        title="Imóveis"
        subtitle="Cada imóvel com valor, situação e as ações à mão."
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => { setEditando(null); setFormAberto(true); }}>
          Novo imóvel
        </Button>}
      />

      {ativos.length === 0 && vendidos.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum imóvel cadastrado"
            description="Casa, apartamento, terreno ou ponto comercial. As reformas e o IPTU lançados aqui já entram no Financeiro, e o valor entra no Patrimônio sozinho."
            action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setFormAberto(true)}>Cadastrar imóvel</Button>}
          />
        </Card>
      ) : (
        <div className="imo-lista">
          {ativos.map((i) => (
            <Faceplate
              key={i.id} imovel={i}
              onAbrir={() => navigate(`/imoveis/${i.id}`)}
              onEditar={() => { setEditando(i); setFormAberto(true); }}
              onVender={() => setVendendo(i)}
              onExcluir={() => handleExcluir(i)}
            />
          ))}
        </div>
      )}

      {vendidos.length > 0 && (
        <div className="section">
          <button className="link-sutil" onClick={() => setMostrarVendidos((x) => !x)}>
            {mostrarVendidos ? "Esconder vendidos" : `Ver ${vendidos.length} imóvel(is) vendido(s)`}
          </button>
          {mostrarVendidos && (
            <div className="imo-lista imo-lista-vendidos">
              {vendidos.map((i) => (
                <Faceplate
                  key={i.id} imovel={i}
                  onAbrir={() => navigate(`/imoveis/${i.id}`)}
                  onEditar={() => { setEditando(i); setFormAberto(true); }}
                  onReativar={async () => {
                    const ok = await confirmar({
                      titulo: "Trazer de volta como ativo?",
                      descricao: "A data e o valor de venda são apagados. O histórico continua intacto.",
                    });
                    if (!ok) return;
                    await reativarImovel(i.id);
                    recarregar();
                  }}
                  onExcluir={() => handleExcluir(i)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <FormImovel
        aberto={formAberto}
        imovel={editando}
        onFechar={() => { setFormAberto(false); setEditando(null); }}
        onSalvo={() => { setFormAberto(false); setEditando(null); recarregar(); }}
      />

      <FormVenda
        imovel={vendendo}
        onFechar={() => setVendendo(null)}
        onVendido={() => { setVendendo(null); recarregar(); }}
      />
    </div>
  );
}

function Faceplate({ imovel, onAbrir, onEditar, onVender, onExcluir, onReativar }: {
  imovel: Imovel;
  onAbrir: () => void;
  onEditar: () => void;
  onVender?: () => void;
  onExcluir: () => void;
  onReativar?: () => void;
}) {
  const vendido = imovel.status === "vendido";
  const custo = useMemo(() => custoTotalImovel(imovel.id), [imovel.id]);
  const Icone = ICONE_TIPO[imovel.tipo] ?? Home;
  const valorMostrado = vendido ? imovel.valor_venda : (imovel.valor_atual ?? imovel.valor_compra);
  const tipoLabel = TIPOS_IMOVEL.find((t) => t.valor === imovel.tipo)?.label ?? imovel.tipo;

  return (
    <div className={`imo-face ${vendido ? "vendido" : ""}`}>
      <button className="imo-face-corpo" onClick={onAbrir}>
        <span className="imo-face-foto">
          {imovel.foto_url
            ? <img src={imovel.foto_url} alt={imovel.apelido} />
            : <Icone size={28} strokeWidth={1.6} />}
        </span>

        <span className="imo-face-identidade">
          <span className="imo-face-nome">{imovel.apelido}</span>
          <span className="imo-face-detalhe">
            {[tipoLabel, imovel.endereco, imovel.area_m2 ? `${imovel.area_m2} m²` : null]
              .filter(Boolean).join(" · ")}
          </span>
        </span>

        <span className="imo-face-valor">
          <span className="imo-face-valor-num tabular">
            {valorMostrado ? formatarMoeda(valorMostrado) : "—"}
          </span>
          <span className="imo-face-valor-label">
            {vendido
              ? `vendido em ${imovel.data_venda ? formatarData(imovel.data_venda) : "—"}`
              : imovel.valor_atual ? "valor atual" : "valor de compra"}
          </span>
          {!vendido && custo > 0 && (
            <span className="imo-face-gasto">{formatarMoeda(custo)} já gastos</span>
          )}
        </span>

        <span className="imo-face-status">
          <Badge tone={vendido ? "muted" : "success"}>{vendido ? "Vendido" : "Ativo"}</Badge>
        </span>

        <ChevronRight size={17} className="imo-face-seta" />
      </button>

      <div className="imo-face-acoes">
        <button className="icon-btn" title="Editar" onClick={onEditar}><Pencil size={15} /></button>
        {onVender && <button className="icon-btn" title="Registrar venda" onClick={onVender}><Tag size={15} /></button>}
        {onReativar && <button className="icon-btn" title="Voltar para ativo" onClick={onReativar}><RotateCcw size={15} /></button>}
        <button className="icon-btn danger" title="Excluir" onClick={onExcluir}><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

function FormImovel({ aberto, imovel, onFechar, onSalvo }: {
  aberto: boolean; imovel: Imovel | null; onFechar: () => void; onSalvo: () => void;
}) {
  const [apelido, setApelido] = useState("");
  const [tipo, setTipo] = useState<Imovel["tipo"]>("casa");
  const [endereco, setEndereco] = useState("");
  const [area, setArea] = useState("");
  const [valorCompra, setValorCompra] = useState("");
  const [valorAtual, setValorAtual] = useState("");
  const [dataCompra, setDataCompra] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setApelido(imovel?.apelido ?? "");
    setTipo(imovel?.tipo ?? "casa");
    setEndereco(imovel?.endereco ?? "");
    setArea(imovel?.area_m2 != null ? String(imovel.area_m2) : "");
    setValorCompra(imovel?.valor_compra != null ? String(imovel.valor_compra) : "");
    setValorAtual(imovel?.valor_atual != null ? String(imovel.valor_atual) : "");
    setDataCompra(imovel?.data_compra ?? "");
    setFotoUrl(imovel?.foto_url ?? "");
    setObservacoes(imovel?.observacoes ?? "");
  }, [aberto, imovel]);

  return (
    <Drawer open={aberto} title={imovel ? "Editar imóvel" : "Novo imóvel"} onClose={onFechar}>
      <form className="form-grid" onSubmit={async (e) => {
        e.preventDefault();
        if (!apelido.trim()) return;
        const dados = {
          apelido: apelido.trim(),
          tipo,
          endereco: endereco.trim() || null,
          area_m2: area ? Number(area) : null,
          valor_compra: valorCompra ? Number(valorCompra) : null,
          valor_atual: valorAtual ? Number(valorAtual) : null,
          data_compra: dataCompra || null,
          foto_url: fotoUrl.trim() || null,
          observacoes: observacoes.trim() || null,
        };
        if (imovel) await atualizarImovel(imovel.id, dados);
        else await criarImovel(dados);
        onSalvo();
      }}>
        <div className="form-row-2">
          <Field label="Apelido" hint="Como você chama esse imóvel no dia a dia.">
            <Input autoFocus value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Casa da praia" required />
          </Field>
          <Field label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as Imovel["tipo"])}>
              {TIPOS_IMOVEL.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Endereço">
          <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        </Field>

        <div className="form-row-2">
          <Field label="Área (m²)">
            <Input type="number" step="0.01" value={area} onChange={(e) => setArea(e.target.value)} />
          </Field>
          <Field label="Data da compra">
            <Input type="date" value={dataCompra} onChange={(e) => setDataCompra(e.target.value)} />
          </Field>
        </div>

        <div className="form-row-2">
          <Field label="Valor de compra" hint="É este o valor que vai para o IR.">
            <Input type="number" step="0.01" value={valorCompra} onChange={(e) => setValorCompra(e.target.value)} />
          </Field>
          <Field label="Valor atual (mercado)">
            <Input type="number" step="0.01" value={valorAtual} onChange={(e) => setValorAtual(e.target.value)} />
          </Field>
        </div>

        <Field label="Foto" hint="Sem foto, o app usa o ícone do tipo do imóvel.">
          <FotoPicker valor={fotoUrl || null} onChange={(v) => setFotoUrl(v ?? "")} />
        </Field>

        <Field label="Observações">
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </Field>

        <div className="page-actions">
          <Button type="button" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" variant="primary">{imovel ? "Salvar" : "Cadastrar"}</Button>
        </div>
      </form>
    </Drawer>
  );
}

function FormVenda({ imovel, onFechar, onVendido }: {
  imovel: Imovel | null; onFechar: () => void; onVendido: () => void;
}) {
  const [data, setData] = useState(hojeISO());
  const [valor, setValor] = useState("");
  const [lancar, setLancar] = useState(true);
  const [contaId, setContaId] = useState("");
  const contas = useMemo(() => listarContas(), [imovel]);

  useEffect(() => {
    if (!imovel) return;
    setData(hojeISO());
    setValor(imovel.valor_atual != null ? String(imovel.valor_atual) : "");
    setLancar(true);
    setContaId("");
  }, [imovel]);

  if (!imovel) return null;

  const diferenca = valor && imovel.valor_compra ? Number(valor) - imovel.valor_compra : null;

  return (
    <Drawer open title={`Vender ${imovel.apelido}`} onClose={onFechar}>
      <form className="form-grid" onSubmit={async (e) => {
        e.preventDefault();
        await venderImovel(imovel.id, {
          data_venda: data,
          valor_venda: valor ? Number(valor) : null,
          lancarReceita: lancar,
          conta_id: contaId || null,
        });
        onVendido();
      }}>
        <p className="imo-nota-venda">
          O imóvel sai da lista de ativos e deixa de contar no patrimônio, mas nada é apagado.
          Reformas, IPTU e manutenções continuam registrados — e ele ainda precisa aparecer na
          declaração do ano em que a venda aconteceu.
        </p>

        <div className="form-row-2">
          <Field label="Data da venda">
            <Input type="date" autoFocus value={data} onChange={(e) => setData(e.target.value)} required />
          </Field>
          <Field label="Valor da venda">
            <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
          </Field>
        </div>

        {diferenca !== null && (
          <div className={`imo-resultado-venda ${diferenca < 0 ? "prejuizo" : ""}`}>
            <span>Diferença em relação ao valor de compra</span>
            <strong className="tabular">{formatarMoeda(diferenca)}</strong>
          </div>
        )}

        <label className="imo-checkbox">
          <input type="checkbox" checked={lancar} onChange={(e) => setLancar(e.target.checked)} />
          <span>
            <strong>Lançar a venda como receita no Financeiro</strong>
            <em>Desmarque se houve financiamento pelo comprador ou o valor não caiu numa conta cadastrada.</em>
          </span>
        </label>

        {lancar && (
          <Field label="Em qual conta o dinheiro entrou">
            <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
              <option value="">Não vincular a uma conta</option>
              {contas.map((c: Conta) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </Field>
        )}

        <div className="page-actions">
          <Button type="button" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" variant="primary" icon={<Tag size={15} />}>Registrar venda</Button>
        </div>
      </form>
    </Drawer>
  );
}
