import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Fuel, Gauge, Wrench, TrendingDown, Info, AlertTriangle } from "lucide-react";
import {
  calcularCustoPorKm, analisarConsumo, preverManutencoes,
  mediaKmPorDiaRecente, compararVeiculos,
} from "./veiculoAnaliseRepository";
import { buscarVeiculo } from "./veiculosRepository";
import { Badge, Button, Card, EmptyState, PageHeader, StatCard } from "../../components/ui";
import { formatarData, formatarMoeda } from "../../utils/format";
import { textoPrazo } from "../../core/datas";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import "./AnaliseVeiculoPage.css";

export function AnaliseVeiculoPage() {
  const { id } = useParams<{ id: string }>();
  const [comparando, setComparando] = useState(false);

  const veiculo = useMemo(() => (id ? buscarVeiculo(id) : null), [id]);
  const custo = useMemo(() => (id ? calcularCustoPorKm(id) : null), [id]);
  const consumo = useMemo(() => (id ? analisarConsumo(id) : null), [id]);
  const previsoes = useMemo(() => (id ? preverManutencoes(id) : []), [id]);
  const kmPorDia = useMemo(() => (id ? mediaKmPorDiaRecente(id) : null), [id]);
  const comparativo = useMemo(() => (comparando ? compararVeiculos() : []), [comparando]);

  if (!veiculo || !custo || !consumo) {
    return <Card><EmptyState title="Veículo não encontrado" /></Card>;
  }

  const semDados = custo.kmRodados === 0 && consumo.trechos.length === 0;

  return (
    <div>
      <Link to={`/veiculos/${veiculo.id}`} className="voltar-link">
        <ArrowLeft size={15} /> Voltar para o veículo
      </Link>

      <PageHeader
        title={`${veiculo.marca} ${veiculo.modelo}`}
        subtitle="Quanto esse carro custa de verdade por quilômetro rodado, e como o consumo real se compara."
        actions={<Button onClick={() => setComparando((v) => !v)}>
          {comparando ? "Esconder comparativo" : "Comparar com os outros"}
        </Button>}
      />

      {semDados && (
        <Card className="anv-vazio">
          <Info size={16} />
          <p>
            Ainda não há dados suficientes. O custo por km precisa de registros de quilometragem
            (pelo menos dois, para saber quanto foi rodado) e o consumo precisa de abastecimentos
            de tanque cheio. Registre alguns na tela do veículo e volte aqui.
          </p>
        </Card>
      )}

      <div className="grid-4 section">
        <StatCard
          label="Custo por km"
          value={custo.custoPorKm ? formatarMoeda(custo.custoPorKm) : "—"}
          hint={custo.kmRodados > 0 ? `${custo.kmRodados.toLocaleString("pt-BR")} km rodados` : "Faltam registros de km"}
          icon={<Gauge size={15} />}
        />
        <StatCard
          label="Custo por mês"
          value={custo.custoPorMes ? formatarMoeda(custo.custoPorMes) : "—"}
          hint={custo.diasDePosse ? `${Math.round(custo.diasDePosse / 30)} meses de posse` : undefined}
        />
        <StatCard
          label="Consumo real"
          value={consumo.mediaKmPorLitro ? `${consumo.mediaKmPorLitro.toFixed(1)} km/l` : "—"}
          hint={consumo.trechos.length > 0 ? `${consumo.trechos.length} trechos medidos` : "Faltam tanques cheios"}
          icon={<Fuel size={15} />}
        />
        <StatCard
          label="Preço médio do litro"
          value={consumo.precoMedioLitro ? formatarMoeda(consumo.precoMedioLitro) : "—"}
          hint={consumo.custoCombustivelPorKm ? `${formatarMoeda(consumo.custoCombustivelPorKm)}/km só de combustível` : undefined}
        />
      </div>

      {custo.gastoTotal > 0 && (
        <div className="section">
          <h3 className="section-title">Onde o dinheiro foi</h3>
          <Card>
            <div className="anv-composicao">
              {[
                ["Combustível", custo.gastoCombustivel, "var(--chart-3)"],
                ["Manutenção", custo.gastoManutencao, "var(--chart-1)"],
                ["Outros (IPVA, seguro...)", custo.gastoOutros, "var(--chart-2)"],
              ].map(([rotulo, valor, cor]) => {
                const v = valor as number;
                const pct = (v / custo.gastoTotal) * 100;
                return (
                  <div key={String(rotulo)} className="anv-linha-custo">
                    <span className="anv-rotulo">{String(rotulo)}</span>
                    <div className="anv-barra-fundo">
                      <div className="anv-barra" style={{ width: `${pct}%`, background: String(cor) }} />
                    </div>
                    <span className="anv-valor tabular">{formatarMoeda(v)}</span>
                    <span className="anv-pct">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>

            <div className="anv-total">
              <span>Total gasto com o veículo</span>
              <strong className="tabular">{formatarMoeda(custo.gastoTotal)}</strong>
            </div>

            {custo.depreciacao !== null && custo.depreciacao > 0 && (
              <p className="anv-nota">
                <TrendingDown size={13} />
                <span>
                  Somando a depreciação de {formatarMoeda(custo.depreciacao)} (diferença entre o que
                  foi pago e o valor atual), o custo real sobe para{" "}
                  <strong>{custo.custoPorKmComDepreciacao ? formatarMoeda(custo.custoPorKmComDepreciacao) : "—"}</strong> por km.
                  Depreciação é o custo que ninguém sente no bolso todo mês, e costuma ser o maior de todos.
                </span>
              </p>
            )}
          </Card>
        </div>
      )}

      {consumo.trechos.length > 0 && (
        <div className="section">
          <h3 className="section-title">Consumo ao longo do tempo</h3>
          <Card>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={consumo.trechos.map((t) => ({
                  data: formatarData(t.dataFim).slice(0, 5),
                  consumo: Number(t.kmPorLitro.toFixed(2)),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false}
                    domain={["dataMin - 1", "dataMax + 1"]} />
                  <Tooltip
                    formatter={(v) => `${Number(v).toFixed(1)} km/l`}
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="consumo" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="anv-consumo-resumo">
              <div><span>Melhor</span><strong>{consumo.melhorKmPorLitro?.toFixed(1)} km/l</strong></div>
              <div><span>Pior</span><strong>{consumo.piorKmPorLitro?.toFixed(1)} km/l</strong></div>
              {veiculo.consumo_referencia && (
                <div>
                  <span>Fabricante</span>
                  <strong>{veiculo.consumo_referencia.toFixed(1)} km/l</strong>
                </div>
              )}
              {consumo.desvioPercentualDaReferencia !== null && (
                <div>
                  <span>Diferença</span>
                  <strong className={consumo.desvioPercentualDaReferencia < -10 ? "anv-ruim" : "anv-bom"}>
                    {consumo.desvioPercentualDaReferencia > 0 ? "+" : ""}
                    {consumo.desvioPercentualDaReferencia.toFixed(0)}%
                  </strong>
                </div>
              )}
            </div>

            <p className="anv-nota">
              <Info size={13} />
              <span>
                O consumo só é calculado entre dois abastecimentos de <strong>tanque cheio</strong>.
                Num abastecimento parcial não se sabe quanto já havia no tanque, então a conta não
                significaria nada.
                {consumo.abastecimentosParciaisIgnorados > 0
                  && ` ${consumo.abastecimentosParciaisIgnorados} abastecimento(s) parcial(is) ficaram de fora do cálculo — mas contam no custo total.`}
                {" "}Trechos com consumo absurdo (abaixo de 1 ou acima de 40 km/l) também são
                descartados: quase sempre é dígito faltando na quilometragem.
              </span>
            </p>
          </Card>
        </div>
      )}

      {previsoes.length > 0 && (
        <div className="section">
          <h3 className="section-title">Manutenção prevista</h3>
          <Card>
            <div className="list">
              {previsoes.map((p) => (
                <div key={p.manutencao.id} className={`list-row ${p.vencida ? "anv-vencida" : ""}`}>
                  <span className="anv-icone-man"><Wrench size={14} /></span>
                  <div className="list-row-main">
                    <div className="list-row-title">{p.manutencao.tipo}</div>
                    <div className="list-row-meta">
                      {p.gatilho === "km" && p.kmFaltando !== null && (
                        p.kmFaltando <= 0
                          ? `Passou ${Math.abs(Math.round(p.kmFaltando)).toLocaleString("pt-BR")} km do previsto`
                          : `Faltam ${Math.round(p.kmFaltando).toLocaleString("pt-BR")} km`
                      )}
                      {p.gatilho === "data" && p.manutencao.proxima_data && (
                        `Prevista para ${formatarData(p.manutencao.proxima_data)}`
                      )}
                      {p.gatilho === "ambos" && "Data e quilometragem chegam juntas"}
                      {p.diasEstimadosAteKm !== null && p.diasEstimadosAteKm > 0 && p.gatilho === "km" && (
                        ` · no seu ritmo, cerca de ${p.diasEstimadosAteKm} dias`
                      )}
                    </div>
                  </div>
                  <Badge tone={p.vencida ? "danger" : "warn"}>
                    {p.vencida ? "vencida"
                      : p.gatilho === "km" ? "por km"
                      : textoPrazo(p.diasAteData)}
                  </Badge>
                </div>
              ))}
            </div>

            {kmPorDia && (
              <p className="anv-nota">
                <Info size={13} />
                <span>
                  A estimativa de "quantos dias até bater o km" usa a sua média dos últimos 6 meses:{" "}
                  <strong>{Math.round(kmPorDia)} km por dia</strong>. Se o seu uso mudar, a previsão muda junto.
                </span>
              </p>
            )}
          </Card>
        </div>
      )}

      {comparando && comparativo.length > 1 && (
        <div className="section">
          <h3 className="section-title">Comparativo entre veículos</h3>
          <Card>
            <div className="anv-tabela">
              <div className="anv-linha-tabela anv-cabecalho">
                <span>Veículo</span><span>Custo/km</span><span>Custo/mês</span><span>Consumo</span><span>Total gasto</span>
              </div>
              {comparativo.map((c) => (
                <div key={c.veiculo.id} className={`anv-linha-tabela ${c.veiculo.id === veiculo.id ? "atual" : ""}`}>
                  <span className="anv-nome-veiculo">{c.veiculo.marca} {c.veiculo.modelo}</span>
                  <span className="tabular">{c.custo.custoPorKm ? formatarMoeda(c.custo.custoPorKm) : "—"}</span>
                  <span className="tabular">{c.custo.custoPorMes ? formatarMoeda(c.custo.custoPorMes) : "—"}</span>
                  <span className="tabular">{c.consumo.mediaKmPorLitro ? `${c.consumo.mediaKmPorLitro.toFixed(1)} km/l` : "—"}</span>
                  <span className="tabular">{formatarMoeda(c.custo.gastoTotal)}</span>
                </div>
              ))}
            </div>
            <p className="anv-nota">
              <AlertTriangle size={13} />
              <span>
                Comparar custo por km entre um carro novo e um antigo tende a favorecer o antigo,
                porque a depreciação do novo não aparece nessa coluna. Olhe também o custo por mês.
              </span>
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
