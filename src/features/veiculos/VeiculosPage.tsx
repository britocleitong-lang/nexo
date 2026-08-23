import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Tag, ChevronRight, Search, RotateCcw } from "lucide-react";
import type { Veiculo, Conta } from "../../types/entities";
import {
  criarVeiculo, atualizarVeiculo, excluirVeiculo, listarVeiculosPorStatus,
  gastoFinanceiroTotalVeiculo, venderVeiculo, reativarVeiculo,
} from "./veiculosRepository";
import { BuscaFipeDrawer } from "./BuscaFipeDrawer";
import { listarContas } from "../financeiro/financeiroRepository";
import { VehicleVisual } from "../../components/VehicleIcon";
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select } from "../../components/ui";
import { formatarMoeda, formatarData, hojeISO } from "../../utils/format";
import { confirmar } from "../../components/Confirm";
import { FotoPicker } from "../../components/FotoPicker";
import "./VeiculosPage.css";

export function VeiculosPage() {
  const navigate = useNavigate();
  const [versao, setVersao] = useState(0);
  const [mostrarVendidos, setMostrarVendidos] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Veiculo | null>(null);
  const [vendendo, setVendendo] = useState<Veiculo | null>(null);

  const recarregar = () => setVersao((v) => v + 1);

  const ativos = useMemo(() => listarVeiculosPorStatus("ativo"), [versao]);
  const vendidos = useMemo(() => listarVeiculosPorStatus("vendido"), [versao]);

  useEffect(() => { recarregar(); }, []);

  async function handleExcluir(v: Veiculo) {
    const ok = await confirmar({
      titulo: `Excluir ${v.marca} ${v.modelo}?`,
      descricao: "Todo o histórico vai junto: manutenções, abastecimentos e quilometragem. "
        + "Se o veículo foi vendido, use a ação Vender — ela preserva tudo isso.",
    });
    if (!ok) return;
    await excluirVeiculo(v.id);
    recarregar();
  }

  return (
    <div>
      <PageHeader
        title="Veículos"
        subtitle="Cada veículo com valor, situação e as ações à mão."
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => { setEditando(null); setFormAberto(true); }}>
          Novo veículo
        </Button>}
      />

      {ativos.length === 0 && vendidos.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum veículo cadastrado"
            description="Cadastre pela busca da tabela FIPE: marca, modelo e ano vêm preenchidos, junto com o valor de mercado atual."
            action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setFormAberto(true)}>Cadastrar veículo</Button>}
          />
        </Card>
      ) : (
        <div className="vei-lista">
          {ativos.map((v) => (
            <Faceplate
              key={v.id} veiculo={v}
              onAbrir={() => navigate(`/veiculos/${v.id}`)}
              onEditar={() => { setEditando(v); setFormAberto(true); }}
              onVender={() => setVendendo(v)}
              onExcluir={() => handleExcluir(v)}
            />
          ))}
        </div>
      )}

      {vendidos.length > 0 && (
        <div className="section">
          <button className="link-sutil" onClick={() => setMostrarVendidos((x) => !x)}>
            {mostrarVendidos ? "Esconder vendidos" : `Ver ${vendidos.length} veículo(s) vendido(s)`}
          </button>
          {mostrarVendidos && (
            <div className="vei-lista vei-lista-vendidos">
              {vendidos.map((v) => (
                <Faceplate
                  key={v.id} veiculo={v}
                  onAbrir={() => navigate(`/veiculos/${v.id}`)}
                  onEditar={() => { setEditando(v); setFormAberto(true); }}
                  onReativar={async () => {
                    const ok = await confirmar({
                      titulo: "Trazer de volta como ativo?",
                      descricao: "A data e o valor de venda são apagados. O histórico continua intacto.",
                    });
                    if (!ok) return;
                    await reativarVeiculo(v.id);
                    recarregar();
                  }}
                  onExcluir={() => handleExcluir(v)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <FormVeiculo
        aberto={formAberto}
        veiculo={editando}
        onFechar={() => { setFormAberto(false); setEditando(null); }}
        onSalvo={() => { setFormAberto(false); setEditando(null); recarregar(); }}
      />

      <FormVenda
        veiculo={vendendo}
        onFechar={() => setVendendo(null)}
        onVendido={() => { setVendendo(null); recarregar(); }}
      />
    </div>
  );
}

// =====================================================================
// Faceplate — a linha inteira é o veículo
// =====================================================================

function Faceplate({ veiculo, onAbrir, onEditar, onVender, onExcluir, onReativar }: {
  veiculo: Veiculo;
  onAbrir: () => void;
  onEditar: () => void;
  onVender?: () => void;
  onExcluir: () => void;
  onReativar?: () => void;
}) {
  const vendido = veiculo.status === "vendido";
  const gasto = useMemo(() => gastoFinanceiroTotalVeiculo(veiculo.id), [veiculo.id]);
  const valorMostrado = vendido ? veiculo.valor_venda : (veiculo.valor_atual ?? veiculo.valor_compra);

  return (
    <div className={`vei-face ${vendido ? "vendido" : ""}`}>
      <button className="vei-face-corpo" onClick={onAbrir}>
        <span className="vei-face-foto">
          <VehicleVisual fotoUrl={veiculo.foto_url} cor={veiculo.cor} size={72} />
        </span>

        <span className="vei-face-identidade">
          <span className="vei-face-modelo">{veiculo.marca} {veiculo.modelo}</span>
          <span className="vei-face-detalhe">
            {[veiculo.ano, veiculo.placa, veiculo.combustivel].filter(Boolean).join(" · ")}
            {veiculo.km_atual != null && ` · ${veiculo.km_atual.toLocaleString("pt-BR")} km`}
          </span>
        </span>

        <span className="vei-face-valor">
          <span className="vei-face-valor-num tabular">
            {valorMostrado ? formatarMoeda(valorMostrado) : "—"}
          </span>
          <span className="vei-face-valor-label">
            {vendido
              ? `vendido em ${veiculo.data_venda ? formatarData(veiculo.data_venda) : "—"}`
              : veiculo.valor_atual ? "valor FIPE" : "valor de compra"}
          </span>
          {!vendido && gasto > 0 && (
            <span className="vei-face-gasto">{formatarMoeda(gasto)} já gastos</span>
          )}
        </span>

        <span className="vei-face-status">
          <Badge tone={vendido ? "muted" : "success"}>{vendido ? "Vendido" : "Ativo"}</Badge>
        </span>

        <ChevronRight size={17} className="vei-face-seta" />
      </button>

      <div className="vei-face-acoes">
        <button className="icon-btn" title="Editar" onClick={onEditar}><Pencil size={15} /></button>
        {onVender && (
          <button className="icon-btn" title="Registrar venda" onClick={onVender}><Tag size={15} /></button>
        )}
        {onReativar && (
          <button className="icon-btn" title="Voltar para ativo" onClick={onReativar}><RotateCcw size={15} /></button>
        )}
        <button className="icon-btn danger" title="Excluir" onClick={onExcluir}><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

// =====================================================================

function FormVeiculo({ aberto, veiculo, onFechar, onSalvo }: {
  aberto: boolean; veiculo: Veiculo | null; onFechar: () => void; onSalvo: () => void;
}) {
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [placa, setPlaca] = useState("");
  const [combustivel, setCombustivel] = useState("");
  const [kmAtual, setKmAtual] = useState("");
  const [valorCompra, setValorCompra] = useState("");
  const [valorAtual, setValorAtual] = useState("");
  const [dataCompra, setDataCompra] = useState("");
  const [consumoRef, setConsumoRef] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fipeAberto, setFipeAberto] = useState(false);
  const [fipeCodigos, setFipeCodigos] = useState<{ marca: string; modelo: string; ano: string } | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setMarca(veiculo?.marca ?? "");
    setModelo(veiculo?.modelo ?? "");
    setAno(veiculo?.ano != null ? String(veiculo.ano) : "");
    setPlaca(veiculo?.placa ?? "");
    setCombustivel(veiculo?.combustivel ?? "");
    setKmAtual(veiculo?.km_atual != null ? String(veiculo.km_atual) : "");
    setValorCompra(veiculo?.valor_compra != null ? String(veiculo.valor_compra) : "");
    setValorAtual(veiculo?.valor_atual != null ? String(veiculo.valor_atual) : "");
    setDataCompra(veiculo?.data_compra ?? "");
    setConsumoRef(veiculo?.consumo_referencia != null ? String(veiculo.consumo_referencia) : "");
    setFotoUrl(veiculo?.foto_url ?? null);
    setFipeCodigos(null);
  }, [aberto, veiculo]);

  return (
    <>
      <Drawer open={aberto} title={veiculo ? "Editar veículo" : "Novo veículo"} onClose={onFechar}>
        <form className="form-grid" onSubmit={async (e) => {
          e.preventDefault();
          if (!marca.trim() || !modelo.trim()) return;
          const dados = {
            marca: marca.trim(),
            modelo: modelo.trim(),
            ano: ano || null,
            placa: placa.trim().toUpperCase() || null,
            combustivel: combustivel || null,
            km_atual: kmAtual ? Number(kmAtual) : null,
            valor_compra: valorCompra ? Number(valorCompra) : null,
            valor_atual: valorAtual ? Number(valorAtual) : null,
            data_compra: dataCompra || null,
            consumo_referencia: consumoRef ? Number(consumoRef) : null,
            foto_url: fotoUrl,
            ...(fipeCodigos ? {
              fipe_marca_codigo: fipeCodigos.marca,
              fipe_modelo_codigo: fipeCodigos.modelo,
              fipe_ano_codigo: fipeCodigos.ano,
              fipe_atualizado_em: new Date().toISOString(),
            } : {}),
          };
          if (veiculo) await atualizarVeiculo(veiculo.id, dados);
          else await criarVeiculo(dados);
          onSalvo();
        }}>
          {/* A busca FIPE preenche marca, modelo, ano e valor de uma vez.
              Digitar isso à mão é onde as pessoas desistem do cadastro. */}
          <button type="button" className="vei-btn-fipe" onClick={() => setFipeAberto(true)}>
            <Search size={15} />
            <span>
              <strong>Buscar na tabela FIPE</strong>
              <em>Preenche marca, modelo, ano e o valor de mercado atual</em>
            </span>
          </button>

          <div className="form-row-2">
            <Field label="Marca">
              <Input value={marca} onChange={(e) => setMarca(e.target.value)} required />
            </Field>
            <Field label="Modelo">
              <Input value={modelo} onChange={(e) => setModelo(e.target.value)} required />
            </Field>
          </div>

          <div className="form-row-2">
            <Field label="Ano">
              <Input value={ano} onChange={(e) => setAno(e.target.value)} placeholder="2020" />
            </Field>
            <Field label="Placa">
              <Input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="ABC1D23" />
            </Field>
          </div>

          <div className="form-row-2">
            <Field label="Combustível">
              <Select value={combustivel} onChange={(e) => setCombustivel(e.target.value)}>
                <option value="">Não informar</option>
                <option value="Flex">Flex</option>
                <option value="Gasolina">Gasolina</option>
                <option value="Etanol">Etanol</option>
                <option value="Diesel">Diesel</option>
                <option value="Híbrido">Híbrido</option>
                <option value="Elétrico">Elétrico</option>
              </Select>
            </Field>
            <Field label="Quilometragem atual">
              <Input type="number" value={kmAtual} onChange={(e) => setKmAtual(e.target.value)} />
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

          <div className="form-row-2">
            <Field label="Data da compra">
              <Input type="date" value={dataCompra} onChange={(e) => setDataCompra(e.target.value)} />
            </Field>
            <Field label="Consumo de fábrica (km/l)" hint="Serve para comparar com o consumo real.">
              <Input type="number" step="0.1" value={consumoRef} onChange={(e) => setConsumoRef(e.target.value)} />
            </Field>
          </div>

          <Field label="Foto" hint="Sem foto, o app desenha o ícone do carro na cor escolhida.">
            <FotoPicker valor={fotoUrl} onChange={setFotoUrl} rotuloVazio="Sem foto — será usado o ícone" />
          </Field>

          <div className="page-actions">
            <Button type="button" onClick={onFechar}>Cancelar</Button>
            <Button type="submit" variant="primary">{veiculo ? "Salvar" : "Cadastrar"}</Button>
          </div>
        </form>
      </Drawer>

      <BuscaFipeDrawer
        aberto={fipeAberto}
        onClose={() => setFipeAberto(false)}
        onConfirmar={({ valor, marcaCodigo, modeloCodigo, anoCodigo }) => {
          setValorAtual(String(valor));
          setFipeCodigos({ marca: marcaCodigo, modelo: modeloCodigo, ano: anoCodigo });
          setFipeAberto(false);
        }}
      />
    </>
  );
}

// =====================================================================

function FormVenda({ veiculo, onFechar, onVendido }: {
  veiculo: Veiculo | null; onFechar: () => void; onVendido: () => void;
}) {
  const [data, setData] = useState(hojeISO());
  const [valor, setValor] = useState("");
  const [lancar, setLancar] = useState(true);
  const [contaId, setContaId] = useState("");
  const contas = useMemo(() => listarContas(), [veiculo]);

  useEffect(() => {
    if (!veiculo) return;
    setData(hojeISO());
    setValor(veiculo.valor_atual != null ? String(veiculo.valor_atual) : "");
    setLancar(true);
    setContaId("");
  }, [veiculo]);

  if (!veiculo) return null;

  const diferenca = valor && veiculo.valor_compra ? Number(valor) - veiculo.valor_compra : null;

  return (
    <Drawer open title={`Vender ${veiculo.marca} ${veiculo.modelo}`} onClose={onFechar}>
      <form className="form-grid" onSubmit={async (e) => {
        e.preventDefault();
        await venderVeiculo(veiculo.id, {
          data_venda: data,
          valor_venda: valor ? Number(valor) : null,
          lancarReceita: lancar,
          conta_id: contaId || null,
        });
        onVendido();
      }}>
        <p className="vei-nota-venda">
          O veículo sai da lista de ativos, mas nada é apagado. Manutenções, abastecimentos e
          quilometragem continuam registrados — e o veículo ainda precisa aparecer na declaração
          do ano em que a venda aconteceu.
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
          <div className={`vei-resultado-venda ${diferenca < 0 ? "prejuizo" : ""}`}>
            <span>Diferença em relação ao valor de compra</span>
            <strong className="tabular">{formatarMoeda(diferenca)}</strong>
          </div>
        )}

        <label className="vei-checkbox">
          <input type="checkbox" checked={lancar} onChange={(e) => setLancar(e.target.checked)} />
          <span>
            <strong>Lançar a venda como receita no Financeiro</strong>
            <em>Desmarque se o pagamento foi parcelado, houve troca com volta, ou o dinheiro não caiu numa conta cadastrada.</em>
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
