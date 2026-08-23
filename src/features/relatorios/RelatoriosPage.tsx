import { useState } from "react";
import { Printer, FileBarChart2 } from "lucide-react";
import { totaisPeriodo, despesasPorNatureza, despesasPorCategoriaMesAtual } from "../financeiro/financeiroRepository";
import { listarVeiculos, gastoFinanceiroTotalVeiculo } from "../veiculos/veiculosRepository";
import { listarImoveis, custoTotalImovel } from "../imoveis/imoveisRepository";
import { gastosSaudePorPessoa } from "../saude/saudeRepository";
import { calcularPatrimonioLiquido } from "../patrimonio/patrimonioRepository";
import { listarInvestimentos, valorTotalInvestimentos, TIPOS_INVESTIMENTO } from "../investimentos/investimentosRepository";
import { listarDividas, valorPassivos, TIPOS_DIVIDA } from "../patrimonio/patrimonioRepository";
import { documentosProximosVencimento } from "../documentos/documentosRepository";
import { listarTarefas } from "../tarefas/tarefasRepository";
import { Button, Card, PageHeader } from "../../components/ui";
import { formatarData, formatarMoeda, hojeISO } from "../../utils/format";
import "./RelatoriosPage.css";

type PeriodoOpcao = "mes" | "mes_passado" | "3meses" | "6meses" | "ano" | "personalizado";

const SECOES = [
  { chave: "financeiro", label: "Resumo financeiro (receitas x despesas)" },
  { chave: "natureza", label: "Gastos por natureza (fixo/variável/investimento)" },
  { chave: "categorias", label: "Gastos por categoria" },
  { chave: "veiculos", label: "Veículos (custo de cada um)" },
  { chave: "imoveis", label: "Imóveis (custo de manutenção)" },
  { chave: "saude", label: "Saúde (gasto por pessoa)" },
  { chave: "patrimonio", label: "Patrimônio líquido" },
  { chave: "investimentos", label: "Investimentos" },
  { chave: "dividas", label: "Dívidas em aberto" },
  { chave: "documentos", label: "Documentos vencendo" },
  { chave: "tarefas", label: "Tarefas pendentes" },
] as const;

type Chave = typeof SECOES[number]["chave"];

export function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<PeriodoOpcao>("mes");
  const [dataInicioPersonalizada, setDataInicioPersonalizada] = useState(`${hojeISO().slice(0, 7)}-01`);
  const [dataFimPersonalizada, setDataFimPersonalizada] = useState(hojeISO());
  const [selecionadas, setSelecionadas] = useState<Set<Chave>>(new Set(SECOES.map((s) => s.chave)));
  const [gerado, setGerado] = useState(false);

  function alternar(chave: Chave) {
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  function calcularPeriodo(): { inicio: string; fim: string; label: string } {
    const hoje = new Date();
    if (periodo === "mes_passado") {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10), label: "Mês passado" };
    }
    if (periodo === "3meses") {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
      return { inicio: inicio.toISOString().slice(0, 10), fim: hojeISO(), label: "Últimos 3 meses" };
    }
    if (periodo === "6meses") {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
      return { inicio: inicio.toISOString().slice(0, 10), fim: hojeISO(), label: "Últimos 6 meses" };
    }
    if (periodo === "ano") {
      const inicio = new Date(hoje.getFullYear(), 0, 1);
      return { inicio: inicio.toISOString().slice(0, 10), fim: hojeISO(), label: "Este ano" };
    }
    if (periodo === "personalizado") {
      return { inicio: dataInicioPersonalizada, fim: dataFimPersonalizada, label: `${formatarData(dataInicioPersonalizada)} a ${formatarData(dataFimPersonalizada)}` };
    }
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return { inicio: inicio.toISOString().slice(0, 10), fim: hojeISO(), label: "Este mês" };
  }

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Escolha o que incluir e o período — gere um relatório pra imprimir ou salvar em PDF." />

      {!gerado ? (
        <Card>
          <div style={{ padding: 20 }}>
            <h3 className="section-title">Período</h3>
            <div className="relatorio-periodos">
              {([
                ["mes", "Este mês"], ["mes_passado", "Mês passado"], ["3meses", "Últimos 3 meses"],
                ["6meses", "Últimos 6 meses"], ["ano", "Este ano"], ["personalizado", "Personalizado"],
              ] as [PeriodoOpcao, string][]).map(([valor, label]) => (
                <button key={valor} className={`tab ${periodo === valor ? "active" : ""}`} onClick={() => setPeriodo(valor)}>{label}</button>
              ))}
            </div>

            {periodo === "personalizado" && (
              <div className="form-row-2" style={{ marginTop: 12, maxWidth: 400 }}>
                <label className="field">
                  <span className="field-label">De</span>
                  <input type="date" className="input" value={dataInicioPersonalizada} onChange={(e) => setDataInicioPersonalizada(e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">Até</span>
                  <input type="date" className="input" value={dataFimPersonalizada} onChange={(e) => setDataFimPersonalizada(e.target.value)} />
                </label>
              </div>
            )}

            <h3 className="section-title" style={{ marginTop: 24 }}>O que incluir</h3>
            <div className="relatorio-checklist">
              {SECOES.map((s) => (
                <label key={s.chave} className="relatorio-check-item">
                  <input type="checkbox" checked={selecionadas.has(s.chave)} onChange={() => alternar(s.chave)} />
                  {s.label}
                </label>
              ))}
            </div>

            <Button variant="primary" icon={<FileBarChart2 size={16} />} onClick={() => setGerado(true)} style={{ marginTop: 20 }}>
              Gerar relatório
            </Button>
          </div>
        </Card>
      ) : (
        <RelatorioGerado
          periodo={calcularPeriodo()}
          selecionadas={selecionadas}
          onVoltar={() => setGerado(false)}
        />
      )}
    </div>
  );
}

function RelatorioGerado({
  periodo,
  selecionadas,
  onVoltar,
}: {
  periodo: { inicio: string; fim: string; label: string };
  selecionadas: Set<Chave>;
  onVoltar: () => void;
}) {
  const totais = totaisPeriodo(periodo.inicio, periodo.fim);
  const natureza = despesasPorNatureza(periodo.inicio, periodo.fim);
  const categorias = despesasPorCategoriaMesAtual();
  const veiculos = listarVeiculos();
  const imoveis = listarImoveis();
  const saude = gastosSaudePorPessoa();
  const { ativos, passivos, liquido } = calcularPatrimonioLiquido();
  const investimentos = listarInvestimentos();
  const dividas = listarDividas();
  const documentos = documentosProximosVencimento(90);
  const tarefasPendentes = listarTarefas().filter((t) => t.status !== "concluida");

  return (
    <div>
      <div className="relatorio-acoes-topo">
        <Button variant="ghost" onClick={onVoltar}>← Ajustar seleção</Button>
        <Button variant="primary" icon={<Printer size={15} />} onClick={() => window.print()}>Imprimir / Salvar PDF</Button>
      </div>

      <div className="relatorio-imprimivel">
        <div className="relatorio-cabecalho">
          <h1>Relatório — Nexo</h1>
          <p>{periodo.label} · Gerado em {formatarData(hojeISO())}</p>
        </div>

        {selecionadas.has("financeiro") && (
          <section className="relatorio-secao">
            <h2>Resumo financeiro</h2>
            <table className="relatorio-tabela">
              <tbody>
                <tr><td>Receitas</td><td className="tabular">{formatarMoeda(totais.receitas)}</td></tr>
                <tr><td>Despesas</td><td className="tabular">{formatarMoeda(totais.despesas)}</td></tr>
                <tr><td><strong>Saldo do período</strong></td><td className="tabular"><strong>{formatarMoeda(totais.receitas - totais.despesas)}</strong></td></tr>
              </tbody>
            </table>
          </section>
        )}

        {selecionadas.has("natureza") && (
          <section className="relatorio-secao">
            <h2>Gastos por natureza</h2>
            <table className="relatorio-tabela">
              <tbody>
                <tr><td>Fixo</td><td className="tabular">{formatarMoeda(natureza.fixo)}</td></tr>
                <tr><td>Variável</td><td className="tabular">{formatarMoeda(natureza.variavel)}</td></tr>
                <tr><td>Investimento</td><td className="tabular">{formatarMoeda(natureza.investimento)}</td></tr>
                {natureza.naoClassificado > 0 && <tr><td>Não classificado</td><td className="tabular">{formatarMoeda(natureza.naoClassificado)}</td></tr>}
              </tbody>
            </table>
          </section>
        )}

        {selecionadas.has("categorias") && (
          <section className="relatorio-secao">
            <h2>Gastos por categoria (mês atual)</h2>
            {categorias.length === 0 ? <p className="relatorio-vazio">Nenhum gasto categorizado.</p> : (
              <table className="relatorio-tabela">
                <tbody>
                  {categorias.map((c) => <tr key={c.categoria}><td>{c.categoria}</td><td className="tabular">{formatarMoeda(c.total)}</td></tr>)}
                </tbody>
              </table>
            )}
          </section>
        )}

        {selecionadas.has("veiculos") && (
          <section className="relatorio-secao">
            <h2>Veículos</h2>
            {veiculos.length === 0 ? <p className="relatorio-vazio">Nenhum veículo cadastrado.</p> : (
              <table className="relatorio-tabela">
                <tbody>
                  {veiculos.map((v) => (
                    <tr key={v.id}>
                      <td>{v.marca} {v.modelo}</td>
                      <td className="tabular">{formatarMoeda(v.valor_atual ?? 0)}</td>
                      <td className="tabular">Gasto total: {formatarMoeda(gastoFinanceiroTotalVeiculo(v.id))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {selecionadas.has("imoveis") && (
          <section className="relatorio-secao">
            <h2>Imóveis</h2>
            {imoveis.length === 0 ? <p className="relatorio-vazio">Nenhum imóvel cadastrado.</p> : (
              <table className="relatorio-tabela">
                <tbody>
                  {imoveis.map((im) => (
                    <tr key={im.id}>
                      <td>{im.apelido}</td>
                      <td className="tabular">{formatarMoeda(im.valor_atual ?? 0)}</td>
                      <td className="tabular">Manutenção: {formatarMoeda(custoTotalImovel(im.id))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {selecionadas.has("saude") && (
          <section className="relatorio-secao">
            <h2>Saúde (gasto por pessoa)</h2>
            {saude.length === 0 ? <p className="relatorio-vazio">Nenhum gasto de saúde registrado.</p> : (
              <table className="relatorio-tabela">
                <tbody>
                  {saude.map((s) => <tr key={s.pessoa_nome}><td>{s.pessoa_nome}</td><td className="tabular">{formatarMoeda(s.total)}</td></tr>)}
                </tbody>
              </table>
            )}
          </section>
        )}

        {selecionadas.has("patrimonio") && (
          <section className="relatorio-secao">
            <h2>Patrimônio líquido</h2>
            <table className="relatorio-tabela">
              <tbody>
                <tr><td>Ativos</td><td className="tabular">{formatarMoeda(ativos)}</td></tr>
                <tr><td>Passivos</td><td className="tabular">{formatarMoeda(passivos)}</td></tr>
                <tr><td><strong>Patrimônio líquido</strong></td><td className="tabular"><strong>{formatarMoeda(liquido)}</strong></td></tr>
              </tbody>
            </table>
          </section>
        )}

        {selecionadas.has("investimentos") && (
          <section className="relatorio-secao">
            <h2>Investimentos</h2>
            {investimentos.length === 0 ? <p className="relatorio-vazio">Nenhum investimento cadastrado.</p> : (
              <table className="relatorio-tabela">
                <tbody>
                  {investimentos.map((i) => (
                    <tr key={i.id}>
                      <td>{i.nome} ({TIPOS_INVESTIMENTO.find((t) => t.valor === i.tipo)?.label})</td>
                      <td className="tabular">{formatarMoeda(i.valor_atual)}</td>
                    </tr>
                  ))}
                  <tr><td><strong>Total</strong></td><td className="tabular"><strong>{formatarMoeda(valorTotalInvestimentos())}</strong></td></tr>
                </tbody>
              </table>
            )}
          </section>
        )}

        {selecionadas.has("dividas") && (
          <section className="relatorio-secao">
            <h2>Dívidas em aberto</h2>
            {dividas.length === 0 ? <p className="relatorio-vazio">Nenhuma dívida cadastrada.</p> : (
              <table className="relatorio-tabela">
                <tbody>
                  {dividas.map((d) => (
                    <tr key={d.id}>
                      <td>{d.descricao} ({TIPOS_DIVIDA.find((t) => t.valor === d.tipo)?.label})</td>
                      <td className="tabular">{formatarMoeda(d.valor_total - d.valor_pago)}</td>
                    </tr>
                  ))}
                  <tr><td><strong>Total em aberto</strong></td><td className="tabular"><strong>{formatarMoeda(valorPassivos())}</strong></td></tr>
                </tbody>
              </table>
            )}
          </section>
        )}

        {selecionadas.has("documentos") && (
          <section className="relatorio-secao">
            <h2>Documentos vencendo (90 dias)</h2>
            {documentos.length === 0 ? <p className="relatorio-vazio">Nenhum documento vencendo.</p> : (
              <table className="relatorio-tabela">
                <tbody>
                  {documentos.map((d) => <tr key={d.id}><td>{d.nome}</td><td className="tabular">{formatarData(d.data_validade)}</td></tr>)}
                </tbody>
              </table>
            )}
          </section>
        )}

        {selecionadas.has("tarefas") && (
          <section className="relatorio-secao">
            <h2>Tarefas pendentes</h2>
            {tarefasPendentes.length === 0 ? <p className="relatorio-vazio">Nenhuma tarefa pendente.</p> : (
              <ul className="relatorio-lista-simples">
                {tarefasPendentes.map((t) => <li key={t.id}>{t.titulo} ({t.prioridade})</li>)}
              </ul>
            )}
          </section>
        )}

        <p className="relatorio-rodape">Gerado automaticamente pelo Nexo a partir dos seus dados locais.</p>
      </div>
    </div>
  );
}
