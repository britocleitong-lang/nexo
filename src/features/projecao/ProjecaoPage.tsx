import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingDown, AlertTriangle, CalendarClock, Wallet, Info } from "lucide-react";
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  projetarFluxo, detectarApertos, mediaVariavelMensal, comprometimentoMesAtual,
  folgaMensalCerta, type MesProjetado,
} from "../financeiro/projecaoRepository";
import { listarPrevistos, totaisPrevistos, definirPago, saldoTotalGeral } from "../financeiro/financeiroRepository";
import { Badge, Button, Card, EmptyState, PageHeader, Select, StatCard } from "../../components/ui";
import { formatarData, formatarMoeda } from "../../utils/format";
import { textoPrazo, diasRestantes } from "../../core/datas";
import { valoresVisiveis } from "../../utils/visibilidadeValores";
import type { Transacao } from "../../types/entities";
import "./ProjecaoPage.css";

export function ProjecaoPage() {
  const [meses, setMeses] = useState(6);
  const [incluirEstimativa, setIncluirEstimativa] = useState(true);
  const [previstos, setPrevistos] = useState<Transacao[]>([]);
  const [versao, setVersao] = useState(0);

  useEffect(() => { setPrevistos(listarPrevistos(90)); }, [versao]);

  const projecao = useMemo(() => projetarFluxo(meses, incluirEstimativa), [meses, incluirEstimativa, versao]);
  const apertos = useMemo(() => detectarApertos(projecao), [projecao]);
  const media = useMemo(() => mediaVariavelMensal(), [versao]);
  const comprometimento = useMemo(() => comprometimentoMesAtual(), [versao]);
  const folga = useMemo(() => folgaMensalCerta(), [versao]);
  const saldoHoje = useMemo(() => saldoTotalGeral(), [versao]);
  const totais = useMemo(() => totaisPrevistos(30), [versao]);

  const ocultos = !valoresVisiveis();

  const dadosGrafico = projecao.map((m) => ({
    mes: m.label,
    Certo: Math.round(m.saldoAcumuladoCerto),
    Estimado: Math.round(m.saldoAcumuladoEstimado),
    Entradas: Math.round(m.receitasAgendadas + m.receitasRecorrentes),
    Saidas: -Math.round(m.despesasAgendadas + m.despesasRecorrentes + m.despesasEstimadas),
  }));

  async function confirmarPagamento(t: Transacao) {
    await definirPago(t.id, true);
    setVersao((v) => v + 1);
  }

  const primeiroAperto = apertos[0];

  return (
    <div>
      <PageHeader
        title="Projeção de fluxo"
        subtitle="O que já está comprometido nos próximos meses, e onde o caixa aperta se nada mudar."
        actions={
          <Select value={String(meses)} onChange={(e) => setMeses(Number(e.target.value))} style={{ width: 150 }}>
            <option value="3">Próximos 3 meses</option>
            <option value="6">Próximos 6 meses</option>
            <option value="12">Próximos 12 meses</option>
          </Select>
        }
      />

      {primeiroAperto && (
        <div className="section">
          <Card className={`proj-alerta ${primeiroAperto.tipo}`}>
            <span className="proj-alerta-icone">
              {primeiroAperto.tipo === "negativo" ? <TrendingDown size={18} /> : <AlertTriangle size={18} />}
            </span>
            <div>
              <strong>
                {primeiroAperto.tipo === "negativo"
                  ? `O saldo fica negativo em ${primeiroAperto.label}.`
                  : `${primeiroAperto.label} deve ficar apertado.`}
              </strong>
              <p>
                Projeção de {formatarMoeda(primeiroAperto.saldo)} naquele mês, contando o que já está
                agendado, as recorrências ativas e a média dos seus gastos variáveis.
                {apertos.length > 1 && ` Outros ${apertos.length - 1} mês(es) também ficam sob pressão.`}
              </p>
            </div>
          </Card>
        </div>
      )}

      <div className="grid-4 section">
        <StatCard label="Saldo hoje" value={formatarMoeda(saldoHoje)} icon={<Wallet size={15} />} />
        <StatCard
          label="A pagar em 30 dias"
          value={formatarMoeda(totais.aPagar)}
          tone={totais.aPagar > saldoHoje ? "danger" : "default"}
          icon={<CalendarClock size={15} />}
        />
        <StatCard
          label="Renda comprometida"
          value={comprometimento.receita > 0 ? `${Math.round(comprometimento.percentual)}%` : "—"}
          hint="Contas fixas e parcelas sobre a renda do mês"
          tone={comprometimento.percentual >= 90 ? "danger" : comprometimento.percentual >= 70 ? "warn" : "default"}
        />
        <StatCard
          label="Folga mensal"
          value={formatarMoeda(folga)}
          hint="Média do que sobra contando só o certo"
          tone={folga < 0 ? "danger" : "success"}
        />
      </div>

      <div className="section">
        <div className="proj-cabecalho">
          <h2 className="section-title" style={{ margin: 0 }}>Saldo projetado</h2>
          <label className="proj-toggle">
            <input
              type="checkbox"
              checked={incluirEstimativa}
              onChange={(e) => setIncluirEstimativa(e.target.checked)}
            />
            Incluir estimativa de gastos variáveis
          </label>
        </div>

        <Card>
          {ocultos ? (
            <EmptyState
              title="Valores ocultos"
              description="O gráfico de projeção mostra números diretamente no eixo. Ative a exibição de valores no menu lateral para vê-lo."
            />
          ) : (
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <ComposedChart data={dadosGrafico} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v) => formatarMoeda(Math.abs(Number(v ?? 0)))}
                    contentStyle={{
                      background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)", fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Entradas" fill="var(--chart-1)" opacity={0.25} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Saidas" name="Saídas" fill="var(--chart-3)" opacity={0.25} radius={[0, 0, 3, 3]} />
                  {/* A área é o piso: só o que está agendado e é certo.
                      A linha tracejada inclui a estimativa. Ver as duas juntas
                      é o ponto — o espaço entre elas é o tamanho do chute. */}
                  <Area
                    type="monotone" dataKey="Certo" name="Saldo certo"
                    stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.12} strokeWidth={2}
                  />
                  {incluirEstimativa && (
                    <Line
                      type="monotone" dataKey="Estimado" name="Saldo estimado"
                      stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="5 4" dot={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          <p className="proj-metodologia">
            <Info size={13} />
            <span>
              A <strong>área cheia</strong> é o piso: só lançamentos já agendados e recorrências ativas.
              A <strong>linha tracejada</strong> soma a média de {formatarMoeda(media)}/mês dos seus gastos
              variáveis dos últimos 3 meses. A distância entre as duas é o tamanho da incerteza —
              um número único de "saldo previsto" esconderia isso.
            </span>
          </p>
        </Card>
      </div>

      <div className="section">
        <h2 className="section-title">Mês a mês</h2>
        <Card>
          <div className="proj-tabela">
            <div className="proj-linha proj-cabecalho-tabela">
              <span>Mês</span>
              <span>Entradas</span>
              <span>Saídas certas</span>
              <span>Estimadas</span>
              <span>Resultado</span>
              <span>Saldo ao fim</span>
            </div>
            {projecao.map((m: MesProjetado) => {
              const entradas = m.receitasAgendadas + m.receitasRecorrentes;
              const saidasCertas = m.despesasAgendadas + m.despesasRecorrentes;
              const negativo = m.saldoAcumuladoEstimado < 0;
              return (
                <div key={m.mes} className={`proj-linha ${negativo ? "negativo" : ""}`}>
                  <span className="proj-mes">{m.label}</span>
                  <span className="tabular">{entradas > 0 ? formatarMoeda(entradas) : "—"}</span>
                  <span className="tabular">{saidasCertas > 0 ? formatarMoeda(saidasCertas) : "—"}</span>
                  <span className="tabular proj-suave">{m.despesasEstimadas > 0 ? formatarMoeda(m.despesasEstimadas) : "—"}</span>
                  <span className={`tabular ${m.resultadoEstimado < 0 ? "proj-vermelho" : "proj-verde"}`}>
                    {m.resultadoEstimado < 0 ? "−" : "+"}{formatarMoeda(Math.abs(m.resultadoEstimado))}
                  </span>
                  <span className={`tabular proj-saldo ${negativo ? "proj-vermelho" : ""}`}>
                    {formatarMoeda(m.saldoAcumuladoEstimado)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="section">
        <h2 className="section-title">Agendado e ainda não pago</h2>
        {previstos.length === 0 ? (
          <Card>
            <EmptyState
              title="Nada agendado à frente"
              description="Parcelas de compras e contas a pagar cadastradas com vencimento futuro aparecem aqui. Elas não entram no saldo até serem confirmadas."
              action={<Link to="/financeiro"><Button>Ver recorrências</Button></Link>}
            />
          </Card>
        ) : (
          <Card>
            <div className="list">
              {previstos.map((t) => {
                const venc = t.data_vencimento ?? t.data;
                const dias = diasRestantes(venc);
                return (
                  <div key={t.id} className="list-row">
                    <div className="list-row-main">
                      <div className="list-row-title">{t.descricao}</div>
                      <div className="list-row-meta">
                        vence {formatarData(venc)}
                        {t.parcela_numero && t.parcelas_totais && ` · parcela ${t.parcela_numero} de ${t.parcelas_totais}`}
                      </div>
                    </div>
                    {dias !== null && dias <= 10 && (
                      <Badge tone={dias < 0 ? "danger" : "warn"}>{textoPrazo(dias)}</Badge>
                    )}
                    <div className={`list-row-value tabular ${t.tipo}`}>
                      {t.tipo === "receita" ? "+" : "−"}{formatarMoeda(t.valor)}
                    </div>
                    {(
                      <div className="list-row-actions">
                        <Button onClick={() => confirmarPagamento(t)}>
                          {t.tipo === "receita" ? "Recebi" : "Paguei"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
