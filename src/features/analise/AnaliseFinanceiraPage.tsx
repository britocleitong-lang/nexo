import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, PiggyBank, Wallet, PieChart as PieChartIcon } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import { despesasPorNatureza, evolucaoMensal, totaisPeriodo } from "./../financeiro/financeiroRepository";
import { Card, PageHeader, StatCard } from "../../components/ui";
import { formatarData, formatarMoeda, hojeISO } from "../../utils/format";
import { Input } from "../../components/ui";

type Periodo = "mes" | "3meses" | "6meses" | "ano" | "personalizado";

const CORES_NATUREZA = {
  fixo: "var(--chart-2)",
  variavel: "var(--chart-3)",
  investimento: "var(--chart-1)",
  naoClassificado: "var(--chart-4)",
};

/** Dias corridos no intervalo, inclusive as duas pontas. */
function diasNoPeriodo(inicio: string, fim: string): number {
  const [ai, mi, di] = inicio.split("-").map(Number);
  const [af, mf, df] = fim.split("-").map(Number);
  const ms = Date.UTC(af, mf - 1, df) - Date.UTC(ai, mi - 1, di);
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

export function AnaliseFinanceiraPage() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(hojeISO());

  const { inicio, fim, label } = useMemo(() => {
    const hoje = new Date();
    if (periodo === "personalizado") {
      return { inicio: dataInicio, fim: dataFim, label: `${formatarData(dataInicio)} a ${formatarData(dataFim)}` };
    }
    if (periodo === "3meses") {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
      return { inicio: inicio.toISOString().slice(0, 10), fim: hojeISO(), label: "últimos 3 meses" };
    }
    if (periodo === "6meses") {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
      return { inicio: inicio.toISOString().slice(0, 10), fim: hojeISO(), label: "últimos 6 meses" };
    }
    if (periodo === "ano") {
      const inicio = new Date(hoje.getFullYear(), 0, 1);
      return { inicio: inicio.toISOString().slice(0, 10), fim: hojeISO(), label: "este ano" };
    }
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return { inicio: inicio.toISOString().slice(0, 10), fim: hojeISO(), label: "este mês" };
  }, [periodo, dataInicio, dataFim]);

  const totais = useMemo(() => totaisPeriodo(inicio, fim), [inicio, fim]);
  const natureza = useMemo(() => despesasPorNatureza(inicio, fim), [inicio, fim]);
  const evolucao = useMemo(() => evolucaoMensal(periodo === "ano" ? 12 : periodo === "6meses" ? 6 : periodo === "3meses" ? 3 : 6), [periodo]);

  const totalDespesas = natureza.fixo + natureza.variavel + natureza.investimento + natureza.naoClassificado;
  const taxaPoupanca = totais.receitas > 0 ? ((totais.receitas - totais.despesas) / totais.receitas) * 100 : null;

  // O espaço aqui era um texto explicando o que é gasto fixo e variável.
  // Depois de duas leituras isso não ensina mais nada e ocupa a mesma área
  // nobre do gráfico. Trocado por números que mudam a cada período — que é
  // o que faz alguém voltar nesta tela.
  const indicadores = useMemo(() => {
    const lista: Array<{ rotulo: string; valor: string; nota: string; tom: string }> = [];

    const comprometimento = totais.receitas > 0 ? (natureza.fixo / totais.receitas) * 100 : null;
    lista.push({
      rotulo: "Custo fixo sobre a renda",
      valor: comprometimento != null ? `${comprometimento.toFixed(0)}%` : "—",
      // 50% é onde o orçamento deixa de ter folga pra imprevisto: metade da
      // renda já está comprometida antes de qualquer decisão do mês.
      nota: comprometimento == null ? "Sem receita no período"
        : comprometimento > 50 ? "Acima da metade da renda — pouca folga pra imprevisto"
        : "Sobra espaço para decisões no mês",
      tom: comprometimento != null && comprometimento > 50 ? "alerta" : "ok",
    });

    lista.push({
      rotulo: "Taxa de poupança",
      valor: taxaPoupanca != null ? `${taxaPoupanca.toFixed(0)}%` : "—",
      nota: taxaPoupanca == null ? "Sem receita no período"
        : taxaPoupanca < 0 ? "Você gastou mais do que entrou"
        : taxaPoupanca >= 20 ? "Bom ritmo de acumulação"
        : "Abaixo dos 20% que costumam ser tomados como referência",
      tom: taxaPoupanca == null ? "neutro" : taxaPoupanca < 0 ? "alerta" : taxaPoupanca >= 20 ? "ok" : "atencao",
    });

    const proporcaoVariavel = totalDespesas > 0 ? (natureza.variavel / totalDespesas) * 100 : null;
    lista.push({
      rotulo: "Quanto do gasto é variável",
      valor: proporcaoVariavel != null ? `${proporcaoVariavel.toFixed(0)}%` : "—",
      // Variável é a parte que responde rápido a uma decisão sua. Fixo exige
      // cancelar contrato; variável muda na próxima ida ao mercado.
      nota: proporcaoVariavel == null ? "Sem despesas no período"
        : "É a fatia que você consegue mexer sem cancelar contrato",
      tom: "neutro",
    });

    const naoClassificado = totalDespesas > 0 ? (natureza.naoClassificado / totalDespesas) * 100 : 0;
    if (naoClassificado > 5) {
      lista.push({
        rotulo: "Despesas sem classificação",
        valor: `${naoClassificado.toFixed(0)}%`,
        nota: "Essa fatia distorce toda a análise acima — vale classificar no Financeiro",
        tom: naoClassificado > 25 ? "alerta" : "atencao",
      });
    } else {
      const mediaDiaria = totalDespesas > 0 ? totalDespesas / Math.max(1, diasNoPeriodo(inicio, fim)) : 0;
      lista.push({
        rotulo: "Gasto médio por dia",
        valor: formatarMoeda(mediaDiaria),
        nota: `Considerando ${diasNoPeriodo(inicio, fim)} dias de ${label}`,
        tom: "neutro",
      });
    }

    return lista;
  }, [totais, natureza, totalDespesas, taxaPoupanca, inicio, fim, label]);

  const dadosPizza = [
    { nome: "Fixo", valor: natureza.fixo, cor: CORES_NATUREZA.fixo },
    { nome: "Variável", valor: natureza.variavel, cor: CORES_NATUREZA.variavel },
    { nome: "Investimento", valor: natureza.investimento, cor: CORES_NATUREZA.investimento },
    { nome: "Não classificado", valor: natureza.naoClassificado, cor: CORES_NATUREZA.naoClassificado },
  ].filter((d) => d.valor > 0);

  return (
    <div>
      <PageHeader
        title="Análise financeira"
        subtitle={`Renda, gastos fixos e variáveis — ${label}.`}
        actions={
          <div className="ana-filtros">
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab ${periodo === "mes" ? "active" : ""}`} onClick={() => setPeriodo("mes")}>Mês</button>
            <button className={`tab ${periodo === "3meses" ? "active" : ""}`} onClick={() => setPeriodo("3meses")}>3 meses</button>
            <button className={`tab ${periodo === "6meses" ? "active" : ""}`} onClick={() => setPeriodo("6meses")}>6 meses</button>
            <button className={`tab ${periodo === "ano" ? "active" : ""}`} onClick={() => setPeriodo("ano")}>Ano</button>
            <button className={`tab ${periodo === "personalizado" ? "active" : ""}`} onClick={() => setPeriodo("personalizado")}>Personalizado</button>
          </div>

          {periodo === "personalizado" && (
            <div className="ana-datas">
              <Input type="date" value={dataInicio} max={dataFim} onChange={(e) => setDataInicio(e.target.value)} />
              <span>até</span>
              <Input type="date" value={dataFim} min={dataInicio} max={hojeISO()} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          )}
          </div>
        }
      />

      <div className="grid-4 section">
        <StatCard label="Receitas" value={formatarMoeda(totais.receitas)} icon={<TrendingUp size={16} />} />
        <StatCard label="Gastos fixos" value={formatarMoeda(natureza.fixo)} icon={<Wallet size={16} />} />
        <StatCard label="Gastos variáveis" value={formatarMoeda(natureza.variavel)} icon={<TrendingDown size={16} />} />
        <StatCard label="Investido" value={formatarMoeda(natureza.investimento)} tone={natureza.investimento > 0 ? "success" : "default"} icon={<PiggyBank size={16} />}
          hint={taxaPoupanca != null ? `Taxa de poupança: ${taxaPoupanca.toFixed(0)}%` : undefined} />
      </div>

      <div className="grid-2">
        <div className="section">
          <h3 className="section-title"><PieChartIcon size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Despesas por natureza</h3>
          <Card>
            {totalDespesas === 0 ? (
              <p style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>
                Nenhuma despesa classificada neste período ainda.
              </p>
            ) : (
              <div style={{ padding: 16, height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dadosPizza} dataKey="valor" nameKey="nome" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {dadosPizza.map((d) => <Cell key={d.nome} fill={d.cor} />)}
                    </Pie>
                    <Tooltip formatter={((v: any) => formatarMoeda(Number(v))) as any} contentStyle={{ fontSize: 12.5, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        <div className="section">
          <h3 className="section-title">Indicadores do período</h3>
          <Card>
            <div className="ana-indicadores">
              {indicadores.map((ind) => (
                <div key={ind.rotulo} className={`ana-indicador ${ind.tom}`}>
                  <span className="ana-ind-rotulo">{ind.rotulo}</span>
                  <strong className="ana-ind-valor tabular">{ind.valor}</strong>
                  <span className="ana-ind-nota">{ind.nota}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Evolução mensal</h3>
        <Card>
          <div style={{ padding: "16px 16px 6px", height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={56} />
                <Tooltip formatter={((v: any) => formatarMoeda(Number(v))) as any} contentStyle={{ fontSize: 12.5, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receitas" name="Receitas" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="despesasFixas" name="Fixas" fill={CORES_NATUREZA.fixo} radius={[3, 3, 0, 0]} />
                <Bar dataKey="despesasVariaveis" name="Variáveis" fill={CORES_NATUREZA.variavel} radius={[3, 3, 0, 0]} />
                <Bar dataKey="investido" name="Investido" fill={CORES_NATUREZA.investimento} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
