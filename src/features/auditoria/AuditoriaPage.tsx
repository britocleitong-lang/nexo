import { useEffect, useMemo, useState } from "react";
import { History, Trash2, Plus, Pencil, Download } from "lucide-react";
import {
  listarAuditoria, camposAlterados, descreverAuditoria, totalAuditoria,
  limparAuditoria, TABELAS_AUDITADAS,
} from "../../core/auditoria/auditoria";
import { Badge, Button, Card, EmptyState, PageHeader, Select, StatCard } from "../../components/ui";
import { formatarDataHora } from "../../utils/format";
import { confirmar } from "../../components/Confirm";
import { baixarCsv } from "../../core/exportacao/exportarDados";
import type { RegistroAuditoria } from "../../types/entities";
import "./AuditoriaPage.css";

const ICONE_ACAO = { criar: Plus, atualizar: Pencil, excluir: Trash2 } as const;
const TOM_ACAO = { criar: "success", atualizar: "muted", excluir: "danger" } as const;

/** Nomes de coluna do banco não significam nada pra quem lê a tela. */
const NOME_CAMPO: Record<string, string> = {
  descricao: "descrição", valor: "valor", data: "data", tipo: "tipo",
  categoria_id: "categoria", conta_id: "conta", cartao_id: "cartão",
  pessoa_id: "pessoa", veiculo_id: "veículo", natureza: "natureza",
  pago: "situação de pagamento", data_vencimento: "vencimento",
  valor_limite: "limite", valor_atual: "valor atual", valor_alvo: "meta",
  proxima_ocorrencia: "próxima ocorrência", ativa: "ativa", frequencia: "frequência",
  saldo_inicial: "saldo inicial", nome: "nome", observacoes: "observações",
};

const NOME_TABELA: Record<string, string> = {
  transacoes: "Lançamentos", contas: "Contas", cartoes: "Cartões",
  recorrencias: "Recorrências", parcelamentos: "Parcelamentos",
  orcamentos: "Orçamentos", investimentos: "Investimentos",
  movimentos_investimento: "Movimentos de investimento",
  dividas: "Dívidas", metas: "Metas",
};

export function AuditoriaPage() {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
  const [filtroTabela, setFiltroTabela] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    setRegistros(listarAuditoria(300, filtroTabela || undefined));
  }, [filtroTabela, versao]);

  const total = useMemo(() => totalAuditoria(), [versao]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, RegistroAuditoria[]>();
    for (const r of registros) {
      const dia = r.criado_em.slice(0, 10);
      if (!mapa.has(dia)) mapa.set(dia, []);
      mapa.get(dia)!.push(r);
    }
    return [...mapa.entries()];
  }, [registros]);

  async function handleLimpar() {
    const ok = await confirmar({
      titulo: "Apagar todo o histórico de alterações?",
      descricao: "Os dados em si não são afetados — só o registro de quem mudou o quê. Isso não pode ser desfeito.",
    });
    if (!ok) return;
    await limparAuditoria();
    setVersao((v) => v + 1);
  }

  function rotularDia(iso: string): string {
    const hojeIso = new Date().toISOString().slice(0, 10);
    if (iso === hojeIso) return "Hoje";
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    if (iso === ontem.toISOString().slice(0, 10)) return "Ontem";
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
  }

  return (
    <div>
      <PageHeader
        title="Histórico de alterações"
        subtitle="Quem mexeu no quê, e o que estava antes. Só as tabelas que envolvem dinheiro são registradas."
        actions={
          <>
            <Button icon={<Download size={16} />} onClick={() => baixarCsv("auditoria")}>Exportar CSV</Button>
            {total > 0 && <Button variant="danger" onClick={handleLimpar}>Limpar histórico</Button>}
          </>
        }
      />

      <div className="grid-3 section">
        <StatCard label="Registros guardados" value={String(total)} icon={<History size={15} />} />
        <StatCard label="Tabelas monitoradas" value={String(TABELAS_AUDITADAS.size)} hint="Financeiro, investimentos, metas e dívidas" />
        <StatCard label="Limite" value="5.000" hint="Os mais antigos saem sozinhos para o banco não inchar" />
      </div>

      <div className="section">
        <Select value={filtroTabela} onChange={(e) => setFiltroTabela(e.target.value)} style={{ maxWidth: 260 }}>
          <option value="">Todas as áreas</option>
          {[...TABELAS_AUDITADAS].map((t) => (
            <option key={t} value={t}>{NOME_TABELA[t] ?? t}</option>
          ))}
        </Select>
      </div>

      {registros.length === 0 ? (
        <Card>
          <EmptyState
            title="Nada registrado ainda"
            description="Assim que você criar, editar ou excluir um lançamento, conta, recorrência ou meta, a alteração aparece aqui — com o valor anterior guardado."
          />
        </Card>
      ) : (
        porDia.map(([dia, doDia]) => (
          <div key={dia} className="section">
            <h2 className="section-title aud-dia">{rotularDia(dia)}</h2>
            <Card>
              <div className="aud-lista">
                {doDia.map((r) => {
                  const Icone = ICONE_ACAO[r.acao];
                  const mudancas = camposAlterados(r);
                  const aberto = expandido === r.id;
                  return (
                    <div key={r.id} className="aud-item">
                      <button
                        className="aud-cabecalho"
                        onClick={() => setExpandido(aberto ? null : r.id)}
                        disabled={mudancas.length === 0}
                      >
                        <span className={`aud-icone acao-${r.acao}`}><Icone size={13} /></span>
                        <span className="aud-corpo">
                          <span className="aud-resumo">{descreverAuditoria(r)}</span>
                          <span className="aud-meta">
                            {formatarDataHora(r.criado_em)}
                            {r.perfil && ` · ${r.perfil}`}
                            {mudancas.length > 0 && ` · ${mudancas.length} campo(s) alterado(s)`}
                          </span>
                        </span>
                        <Badge tone={TOM_ACAO[r.acao]}>{NOME_TABELA[r.tabela] ?? r.tabela}</Badge>
                      </button>

                      {aberto && mudancas.length > 0 && (
                        <div className="aud-diff">
                          {mudancas.map((m) => (
                            <div key={m.campo} className="aud-diff-linha">
                              <span className="aud-campo">{NOME_CAMPO[m.campo] ?? m.campo}</span>
                              <span className="aud-antes">{m.antes}</span>
                              <span className="aud-seta">→</span>
                              <span className="aud-depois">{m.depois}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        ))
      )}
    </div>
  );
}
