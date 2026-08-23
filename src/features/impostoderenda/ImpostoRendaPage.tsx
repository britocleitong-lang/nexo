import { useMemo, useState } from "react";
import { AlertTriangle, FileText } from "lucide-react";
import { listarBens, listarDividas, TIPOS_DIVIDA } from "../patrimonio/patrimonioRepository";
import { listarVeiculos } from "../veiculos/veiculosRepository";
import { listarImoveis } from "../imoveis/imoveisRepository";
import { listarInvestimentos, TIPOS_INVESTIMENTO } from "../investimentos/investimentosRepository";
import { listarContas, saldoConta, rendimentosPorPessoaAno, pagamentosDedutiveisPorPessoaAno } from "../financeiro/financeiroRepository";
import { Card, PageHeader } from "../../components/ui";
import { formatarMoeda } from "../../utils/format";
import "./ImpostoRendaPage.css";

const CODIGO_IMOVEL: Record<string, string> = {
  casa: "12 — Casa",
  apartamento: "11 — Apartamento",
  terreno: "13 — Terreno",
  outro: "19 — Outros bens imóveis",
};

const CODIGO_INVESTIMENTO: Record<string, string> = {
  reserva_emergencia: "45 — Aplicação de renda fixa / poupança",
  renda_fixa: "45 — Aplicação de renda fixa",
  renda_variavel: "46/31 — Ações ou ouro, conforme o caso",
  fundo: "47 — Fundos de investimento",
  previdencia: "97 — Previdência privada (VGBL/PGBL)",
  outro: "99 — Outros bens e direitos",
};

export function ImpostoRendaPage() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual - 1);

  const bens = listarBens();
  const veiculos = listarVeiculos();
  const imoveis = listarImoveis();
  const investimentos = listarInvestimentos();
  const contas = listarContas();
  const dividas = listarDividas();

  const rendimentos = useMemo(() => rendimentosPorPessoaAno(ano), [ano]);
  const dedutiveis = useMemo(() => pagamentosDedutiveisPorPessoaAno(ano), [ano]);

  const totalBensImoveis = imoveis.reduce((s, i) => s + (i.valor_atual ?? 0), 0);
  const totalBensVeiculos = veiculos.reduce((s, v) => s + (v.valor_atual ?? 0), 0);
  const totalContas = contas.reduce((s, c) => s + saldoConta(c.id), 0);
  const totalInvestimentos = investimentos.reduce((s, i) => s + i.valor_atual, 0);
  const totalBensManuais = bens.reduce((s, b) => s + (b.valor_atual ?? 0), 0);
  const totalGeralBens = totalBensImoveis + totalBensVeiculos + totalContas + totalInvestimentos + totalBensManuais;
  const totalDividas = dividas.reduce((s, d) => s + (d.valor_total - d.valor_pago), 0);
  const totalRendimentos = rendimentos.reduce((s, r) => s + r.total, 0);
  const totalDedutiveis = dedutiveis.reduce((s, d) => s + d.total, 0);

  return (
    <div>
      <PageHeader
        title="Imposto de Renda"
        subtitle="Organiza os dados que você já tem no Nexo no formato usado pela declaração anual."
        actions={
          <select className="input" value={ano} onChange={(e) => setAno(Number(e.target.value))} style={{ maxWidth: 140 }}>
            {[anoAtual - 1, anoAtual - 2, anoAtual - 3].map((a) => (
              <option key={a} value={a}>Ano-base {a}</option>
            ))}
          </select>
        }
      />

      <div className="ir-aviso">
        <AlertTriangle size={16} />
        <span>
          Isso <strong>não substitui um contador</strong> nem o programa oficial da Receita Federal. Os códigos de
          grupo sugeridos abaixo são uma referência geral — eles mudam de ano a ano, então confirme os códigos
          exatos no programa da declaração antes de enviar. Isso só organiza o que você já cadastrou no Nexo.
        </span>
      </div>

      <div className="section">
        <h3 className="section-title"><FileText size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Bens e direitos</h3>
        <Card>
          <table className="ir-tabela">
            <thead>
              <tr><th>Descrição</th><th>Grupo/código sugerido</th><th>Valor em 31/12</th></tr>
            </thead>
            <tbody>
              {imoveis.map((im) => (
                <tr key={im.id}>
                  <td>{im.apelido}</td>
                  <td>01 — Bens Imóveis · {CODIGO_IMOVEL[im.tipo] ?? CODIGO_IMOVEL.outro}</td>
                  <td className="tabular">{formatarMoeda(im.valor_atual ?? 0)}</td>
                </tr>
              ))}
              {veiculos.map((v) => (
                <tr key={v.id}>
                  <td>{v.marca} {v.modelo}{v.ano ? ` (${v.ano})` : ""}</td>
                  <td>02 — Bens Móveis · 21 — Veículo automotor terrestre</td>
                  <td className="tabular">{formatarMoeda(v.valor_atual ?? 0)}</td>
                </tr>
              ))}
              {contas.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome} ({c.instituicao ?? "conta"})</td>
                  <td>03 — Contas e aplicações · 31 — Conta corrente/poupança</td>
                  <td className="tabular">{formatarMoeda(saldoConta(c.id))}</td>
                </tr>
              ))}
              {investimentos.map((i) => (
                <tr key={i.id}>
                  <td>{i.nome} ({TIPOS_INVESTIMENTO.find((t) => t.valor === i.tipo)?.label})</td>
                  <td>04 — Aplicações e investimentos · {CODIGO_INVESTIMENTO[i.tipo] ?? CODIGO_INVESTIMENTO.outro}</td>
                  <td className="tabular">{formatarMoeda(i.valor_atual)}</td>
                </tr>
              ))}
              {bens.map((b) => (
                <tr key={b.id}>
                  <td>{b.descricao} ({b.categoria})</td>
                  <td>09 — Outros bens e direitos · 99 — Outros</td>
                  <td className="tabular">{formatarMoeda(b.valor_atual ?? 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={2}><strong>Total de bens e direitos</strong></td><td className="tabular"><strong>{formatarMoeda(totalGeralBens)}</strong></td></tr>
            </tfoot>
          </table>
        </Card>
      </div>

      <div className="section">
        <h3 className="section-title">Dívidas e ônus reais</h3>
        <Card>
          {dividas.length === 0 ? (
            <p style={{ padding: 18, fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>Nenhuma dívida cadastrada.</p>
          ) : (
            <table className="ir-tabela">
              <thead><tr><th>Descrição</th><th>Tipo</th><th>Saldo devedor em 31/12</th></tr></thead>
              <tbody>
                {dividas.map((d) => (
                  <tr key={d.id}>
                    <td>{d.descricao}</td>
                    <td>{TIPOS_DIVIDA.find((t) => t.valor === d.tipo)?.label}</td>
                    <td className="tabular">{formatarMoeda(d.valor_total - d.valor_pago)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={2}><strong>Total de dívidas</strong></td><td className="tabular"><strong>{formatarMoeda(totalDividas)}</strong></td></tr>
              </tfoot>
            </table>
          )}
        </Card>
      </div>

      <div className="grid-2">
        <div className="section">
          <h3 className="section-title">Rendimentos do ano ({ano})</h3>
          <Card>
            {rendimentos.length === 0 ? (
              <p style={{ padding: 18, fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>Nenhuma receita lançada em {ano}.</p>
            ) : (
              <table className="ir-tabela">
                <thead><tr><th>Pessoa</th><th>Total recebido</th></tr></thead>
                <tbody>
                  {rendimentos.map((r) => <tr key={r.pessoa_nome}><td>{r.pessoa_nome}</td><td className="tabular">{formatarMoeda(r.total)}</td></tr>)}
                </tbody>
                <tfoot>
                  <tr><td><strong>Total</strong></td><td className="tabular"><strong>{formatarMoeda(totalRendimentos)}</strong></td></tr>
                </tfoot>
              </table>
            )}
          </Card>
        </div>

        <div className="section">
          <h3 className="section-title">Pagamentos dedutíveis (Saúde/Educação)</h3>
          <Card>
            {dedutiveis.length === 0 ? (
              <p style={{ padding: 18, fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>Nenhum gasto de saúde/educação classificado em {ano}.</p>
            ) : (
              <table className="ir-tabela">
                <thead><tr><th>Pessoa</th><th>Categoria</th><th>Total</th></tr></thead>
                <tbody>
                  {dedutiveis.map((d) => (
                    <tr key={`${d.pessoa_nome}-${d.categoria}`}>
                      <td>{d.pessoa_nome}</td><td>{d.categoria}</td><td className="tabular">{formatarMoeda(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={2}><strong>Total</strong></td><td className="tabular"><strong>{formatarMoeda(totalDedutiveis)}</strong></td></tr>
                </tfoot>
              </table>
            )}
          </Card>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 8 }}>
        Dica: pra essa seção ficar completa, lance os pagamentos de plano de saúde, consultas e mensalidade
        escolar como despesas no Financeiro, marcando a categoria (Saúde/Educação) e a pessoa correspondente.
      </p>
    </div>
  );
}
