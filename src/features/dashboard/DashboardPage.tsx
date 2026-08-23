import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Check, FileText, Wrench, HeartPulse, CalendarDays, CheckSquare, PiggyBank,
  Wallet, ArrowRight, Clock, Repeat, Target, Syringe, Landmark,
} from "lucide-react";
import { Card, StatCard, Badge } from "../../components/ui";
import { VehicleVisual } from "../../components/VehicleIcon";
import { saldoTotalGeral, totaisPeriodo } from "../financeiro/financeiroRepository";
import { listarVeiculos } from "../veiculos/veiculosRepository";
import type { Veiculo } from "../../types/entities";
import { tarefasPendentesCount } from "../tarefas/tarefasRepository";
import { calcularPatrimonioLiquido } from "../patrimonio/patrimonioRepository";
import { valorTotalInvestimentos } from "../investimentos/investimentosRepository";
import { formatarMoeda, hojeISO } from "../../utils/format";
import { listarAlertas, type Alerta, type OrigemAlerta } from "../../core/alertas/alertasEngine";
import { adiarAlerta, dispensarAlerta } from "../../core/alertas/alertasRepository";
import { textoPrazo } from "../../core/datas";
import "./DashboardPage.css";

const ICONES_ORIGEM: Record<OrigemAlerta, typeof FileText> = {
  documento: FileText, veiculo: Wrench, imovel: Wrench, saude: HeartPulse,
  agenda: CalendarDays, tarefa: CheckSquare, financeiro: Wallet,
  recorrencia: Repeat, orcamento: PiggyBank, meta: Target, vacina: Syringe,
};

function badgeTom(a: Alerta): "muted" | "warn" | "danger" {
  if (a.severidade === "atrasado") return "danger";
  if (a.severidade === "urgente") return "warn";
  return "muted";
}

/** Saudação pela hora do dia — o app abre falando com você, não relatando. */
function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function DashboardPage() {
  const navigate = useNavigate();
  const [carregado, setCarregado] = useState(false);
  const [saldo, setSaldo] = useState(0);
  const [receitasMes, setReceitasMes] = useState(0);
  const [despesasMes, setDespesasMes] = useState(0);
  const [patrimonio, setPatrimonio] = useState(0);
  const [investido, setInvestido] = useState(0);
  const [tarefasPendentes, setTarefasPendentes] = useState(0);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [atencao, setAtencao] = useState<Alerta[]>([]);

  function carregar() {
    const inicioMes = `${hojeISO().slice(0, 7)}-01`;
    const totais = totaisPeriodo(inicioMes, hojeISO());

    setSaldo(saldoTotalGeral());
    setReceitasMes(totais.receitas);
    setDespesasMes(totais.despesas);
    setPatrimonio(calcularPatrimonioLiquido().liquido);
    setInvestido(valorTotalInvestimentos());
    setTarefasPendentes(tarefasPendentesCount());
    setVeiculos(listarVeiculos());

    // A montagem desta lista morava aqui dentro. Agora vem do motor central
    // de alertas — o mesmo que alimenta o badge da barra lateral, a
    // notificação do Windows e o resumo do assistente. Antes, cada um desses
    // lugares teria a sua própria ideia de "o que é urgente"; agora os quatro
    // concordam por construção, e dispensar um aviso vale em todos.
    setAtencao(listarAlertas());
    setCarregado(true);
  }

  useEffect(() => { carregar(); }, []);

  async function handleDispensar(a: Alerta) {
    await dispensarAlerta(a.chave);
    setAtencao(listarAlertas());
  }

  async function handleAdiar(a: Alerta) {
    await adiarAlerta(a.chave, 7);
    setAtencao(listarAlertas());
  }

  const hoje = new Date();
  const dataExtenso = `${DIAS_SEMANA[hoje.getDay()]}, ${hoje.getDate()} de ${MESES[hoje.getMonth()]}`;

  // Quanto da receita do mês já foi consumida — a proporção diz mais que os
  // valores isolados.
  const proporcaoGasta = useMemo(() => {
    if (receitasMes <= 0) return despesasMes > 0 ? 100 : 0;
    return Math.min(100, (despesasMes / receitasMes) * 100);
  }, [receitasMes, despesasMes]);

  const sobra = receitasMes - despesasMes;

  if (!carregado) return null;

  return (
    <div>
      <h1 className="dash-saudacao">{saudacao()}</h1>
      <p className="dash-data">{dataExtenso}</p>

      <div className="dash-principal">
        {/* A projeção é o destino natural de quem acabou de olhar o saldo:
            a pergunta seguinte é sempre "e daqui pra frente?". */}
        <Link to="/projecao" className="dash-ver-projecao">
          Ver projeção <ArrowRight size={13} />
        </Link>

        <div className="dash-principal-label">Disponível em conta</div>
        <div className="dash-principal-valor">{formatarMoeda(saldo)}</div>

        {(receitasMes > 0 || despesasMes > 0) && (
          <div className="dash-fluxo-barra">
            <div
              className={`dash-fluxo-gasto ${sobra < 0 ? "excedido" : ""}`}
              style={{ width: `${proporcaoGasta}%` }}
            />
          </div>
        )}

        <div className="dash-principal-rodape">
          <div>
            <div className="dash-mini-label">Entrou este mês</div>
            <div className="dash-mini-valor">{formatarMoeda(receitasMes)}</div>
          </div>
          <div>
            <div className="dash-mini-label">Saiu este mês</div>
            <div className="dash-mini-valor">{formatarMoeda(despesasMes)}</div>
          </div>
          <div>
            <div className="dash-mini-label">{sobra < 0 ? "Excedeu" : "Sobrou"}</div>
            <div className="dash-mini-valor">{formatarMoeda(Math.abs(sobra))}</div>
          </div>
        </div>
      </div>

      {/* Avisos e veículos lado a lado. Empilhados, os veículos ficavam
          abaixo da dobra e a coluna de avisos desperdiçava metade da
          largura da tela em espaço vazio. Em duas colunas, as duas coisas
          cabem na primeira tela e cada uma ganha o espaço que usa. */}
      <div className="dash-colunas section">
        <div className="dash-coluna">
          <div className="dash-atencao-header">
            <h2 className="section-title" style={{ margin: 0 }}>Precisa de você</h2>
            {atencao.length > 0 && <span className="dash-atencao-contagem">{atencao.length}</span>}
          </div>
          <Card>
            {atencao.length === 0 ? (
              <div className="dash-tudo-em-dia">
                <Check size={17} />
                Nada vencendo nos próximos dias.
              </div>
            ) : (
              atencao.slice(0, 12).map((item) => {
                const Icone = ICONES_ORIGEM[item.origem];
                return (
                  <div key={item.chave} className={`dash-item sev-${item.severidade}`}>
                    <button className="dash-item-principal" onClick={() => navigate(item.destino)}>
                      <span className="dash-item-icone"><Icone size={15} /></span>
                      <span className="dash-item-corpo">
                        <span className="dash-item-titulo">{item.titulo}</span>
                        <span className="dash-item-origem">
                          {item.origemLabel}{item.detalhe && ` · ${item.detalhe}`}
                        </span>
                      </span>
                      <Badge tone={badgeTom(item)}>
                        {item.dias !== null ? textoPrazo(item.dias) : "atenção"}
                      </Badge>
                    </button>
                    {/* Resolver o aviso direto daqui evita a viagem até o
                        módulo só pra dizer "já fiz isso". */}
                    <span className="dash-item-acoes">
                      <button className="icon-btn" title="Lembrar em 7 dias" onClick={() => handleAdiar(item)}>
                        <Clock size={14} />
                      </button>
                      <button className="icon-btn" title="Já resolvi" onClick={() => handleDispensar(item)}>
                        <Check size={14} />
                      </button>
                    </span>
                  </div>
                );
              })
            )}
          </Card>
        </div>

        {veiculos.length > 0 && (
          <div className="dash-coluna">
            <div className="dash-atencao-header">
              <h2 className="section-title" style={{ margin: 0 }}>Veículos</h2>
              <Link to="/veiculos" className="link-sutil dash-ver-todos">Ver todos</Link>
            </div>
            <div className="dash-veiculos">
              {veiculos.map((v) => (
                <button key={v.id} className="dash-veiculo" onClick={() => navigate(`/veiculos/${v.id}`)}>
                  <span className="dash-veiculo-foto">
                    <VehicleVisual fotoUrl={v.foto_url} cor={v.cor} size={96} />
                  </span>
                  <span className="dash-veiculo-info">
                    <span className="dash-veiculo-nome">{v.marca} {v.modelo}</span>
                    <span className="dash-veiculo-meta">
                      {[v.ano, v.placa].filter(Boolean).join(" · ")}
                    </span>
                    {v.km_atual != null && (
                      <span className="dash-veiculo-km tabular">{v.km_atual.toLocaleString("pt-BR")} km</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="dash-resumo">
        <Link to="/patrimonio"><StatCard label="Patrimônio líquido" value={formatarMoeda(patrimonio)} icon={<Landmark size={15} />} /></Link>
        <Link to="/investimentos"><StatCard label="Investido" value={formatarMoeda(investido)} icon={<PiggyBank size={15} />} /></Link>
        <Link to="/tarefas"><StatCard label="Tarefas abertas" value={String(tarefasPendentes)} icon={<CheckSquare size={15} />} /></Link>
      </div>
    </div>
  );
}
