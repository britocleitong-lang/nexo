import { useMemo, useRef, useState } from "react";
import { Upload, FileText, Check, AlertTriangle, Link2, Plus, Ban, Wand2 } from "lucide-react";
import { lerExtrato, type ResultadoLeitura } from "./extratoParser";
import { conciliar, aplicarConciliacao, divergenciasNoPeriodo, LABEL_SITUACAO, type ItemConciliado, type ResultadoImportacao, type SituacaoConciliacao } from "./conciliacao";
import { listarContas, listarCategorias } from "../financeiro/financeiroRepository";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, StatCard } from "../../components/ui";
import { formatarData, formatarMoeda } from "../../utils/format";
import { confirmar } from "../../components/Confirm";
import type { Transacao } from "../../types/entities";
import "./ImportacaoPage.css";

const TOM_SITUACAO: Record<SituacaoConciliacao, "success" | "warn" | "muted" | "default"> = {
  novo: "success",
  confirma: "warn",
  confere: "muted",
  ja_importado: "default",
};

const ICONE_SITUACAO: Record<SituacaoConciliacao, typeof Plus> = {
  novo: Plus,
  confirma: Check,
  confere: Link2,
  ja_importado: Ban,
};

export function ImportacaoPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [leitura, setLeitura] = useState<ResultadoLeitura | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [contaId, setContaId] = useState("");
  const [itens, setItens] = useState<ItemConciliado[]>([]);
  const [divergencias, setDivergencias] = useState<Transacao[]>([]);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [processando, setProcessando] = useState(false);
  const [filtro, setFiltro] = useState<SituacaoConciliacao | "todos">("todos");

  const contas = useMemo(() => listarContas(), []);
  const categorias = useMemo(() => listarCategorias(), []);

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setNomeArquivo(arquivo.name);
    setResultado(null);

    // ISO-8859-1 primeiro: é a codificação que a maioria dos OFX de banco
    // brasileiro usa. Ler como UTF-8 quebraria todo "ã" e "ç" na descrição.
    const bytes = await arquivo.arrayBuffer();
    let texto = new TextDecoder("iso-8859-1").decode(bytes);
    // Se o arquivo declarar UTF-8, relê com o decodificador certo.
    if (/encoding=["']?UTF-8|CHARSET:UTF-8/i.test(texto.slice(0, 500))) {
      texto = new TextDecoder("utf-8").decode(bytes);
    }

    const resultadoLeitura = lerExtrato(texto, arquivo.name);
    setLeitura(resultadoLeitura);
    reconciliar(resultadoLeitura, contaId);
  }

  function reconciliar(resultadoLeitura: ResultadoLeitura, conta: string) {
    const conciliados = conciliar(resultadoLeitura.lancamentos, conta || null);
    setItens(conciliados);
    if (conta && resultadoLeitura.periodo) {
      setDivergencias(divergenciasNoPeriodo(
        conta, resultadoLeitura.periodo.inicio, resultadoLeitura.periodo.fim, resultadoLeitura.lancamentos,
      ));
    } else {
      setDivergencias([]);
    }
  }

  function trocarConta(novaConta: string) {
    setContaId(novaConta);
    if (leitura) reconciliar(leitura, novaConta);
  }

  function alternarItem(indice: number) {
    setItens((prev) => prev.map((item, i) => i === indice ? { ...item, selecionado: !item.selecionado } : item));
  }

  function mudarCategoria(indice: number, categoriaId: string) {
    setItens((prev) => prev.map((item, i) => {
      if (i !== indice) return item;
      const cat = categorias.find((c) => c.id === categoriaId);
      return { ...item, categoria_id: categoriaId || null, categoria_nome: cat?.nome ?? null };
    }));
  }

  const contagens = useMemo(() => {
    const c: Record<SituacaoConciliacao, number> = { novo: 0, confirma: 0, confere: 0, ja_importado: 0 };
    for (const i of itens) c[i.situacao] += 1;
    return c;
  }, [itens]);

  const selecionados = itens.filter((i) => i.selecionado && i.situacao !== "ja_importado");
  const visiveis = filtro === "todos" ? itens : itens.filter((i) => i.situacao === filtro);

  async function handleImportar() {
    if (selecionados.length === 0) return;
    const ok = await confirmar({
      titulo: `Importar ${selecionados.length} lançamento(s)?`,
      descricao: `${contagens.novo} novo(s) serão criados, ${contagens.confirma} previsto(s) serão confirmados e ${contagens.confere} existente(s) serão vinculados.`,
    });
    if (!ok) return;
    setProcessando(true);
    try {
      const res = await aplicarConciliacao(itens, contaId || null);
      setResultado(res);
      setItens([]);
      setLeitura(null);
      setDivergencias([]);
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Importar extrato"
        subtitle="Traga o OFX ou CSV do banco. O Nexo confere com o que já está lançado antes de gravar qualquer coisa."
      />

      {resultado && (
        <div className="section">
          <Card className="imp-resultado">
            <Check size={18} />
            <div>
              <strong>Importação concluída.</strong>
              <p>
                {resultado.criados} lançamento(s) criado(s), {resultado.confirmados} previsto(s) confirmado(s),
                {" "}{resultado.vinculados} existente(s) vinculado(s) e {resultado.ignorados} ignorado(s).
              </p>
            </div>
          </Card>
        </div>
      )}

      <div className="section">
        <Card>
          <div className="imp-passo1">
            <Field label="Conta de destino" hint="O extrato é de qual conta? Isso melhora a conferência e evita casar lançamentos de contas diferentes.">
              <Select value={contaId} onChange={(e) => trocarConta(e.target.value)}>
                <option value="">Não vincular a uma conta</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Field>

            <div className="imp-arquivo">
              <input
                ref={inputRef}
                type="file"
                accept=".ofx,.OFX,.csv,.CSV,.txt,text/csv"
                onChange={handleArquivo}
                id="imp-input"
                hidden
              />
              <label htmlFor="imp-input" className="btn btn-primary imp-botao-arquivo">
                <Upload size={16} />
                Escolher arquivo
              </label>
              {nomeArquivo && <span className="imp-nome-arquivo"><FileText size={14} /> {nomeArquivo}</span>}
            </div>
          </div>

          <p className="imp-nota">
            O arquivo é lido inteiramente dentro do seu navegador. Nada é enviado para lugar nenhum —
            é a mesma premissa do resto do Nexo.
          </p>
        </Card>
      </div>

      {leitura && leitura.avisos.length > 0 && (
        <div className="section">
          <Card className="imp-avisos">
            <AlertTriangle size={16} />
            <ul>{leitura.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </Card>
        </div>
      )}

      {leitura && leitura.lancamentos.length > 0 && (
        <>
          <div className="grid-4 section">
            <StatCard label="Novos" value={String(contagens.novo)} tone="success" hint="Ainda não existem no app" />
            <StatCard label="Confirmam previsto" value={String(contagens.confirma)} tone="warn" hint="Parcela ou conta agendada que caiu" />
            <StatCard label="Já lançados" value={String(contagens.confere)} hint="Serão só vinculados, sem duplicar" />
            <StatCard label="Já importados" value={String(contagens.ja_importado)} hint="Ignorados automaticamente" />
          </div>

          {leitura.banco && (
            <p className="imp-origem">
              {leitura.banco}
              {leitura.conta && ` · conta ${leitura.conta}`}
              {leitura.periodo && ` · ${formatarData(leitura.periodo.inicio)} a ${formatarData(leitura.periodo.fim)}`}
            </p>
          )}

          <div className="section">
            <div className="imp-cabecalho-lista">
              <div className="tabs imp-filtros">
                {(["todos", "novo", "confirma", "confere", "ja_importado"] as const).map((f) => (
                  <button
                    key={f}
                    className={`tab ${filtro === f ? "active" : ""}`}
                    onClick={() => setFiltro(f)}
                  >
                    {f === "todos" ? `Todos (${itens.length})` : `${LABEL_SITUACAO[f]} (${contagens[f]})`}
                  </button>
                ))}
              </div>
              <Button variant="primary" icon={<Check size={16} />} onClick={handleImportar} disabled={processando || selecionados.length === 0}>
                Importar {selecionados.length > 0 ? selecionados.length : ""}
              </Button>
            </div>

            <Card>
              <div className="imp-tabela">
                {visiveis.map((item) => {
                  const indiceReal = itens.indexOf(item);
                  const Icone = ICONE_SITUACAO[item.situacao];
                  const bloqueado = item.situacao === "ja_importado";
                  return (
                    <div key={`${item.extrato.fitid ?? ""}-${indiceReal}`} className={`imp-linha ${bloqueado ? "bloqueada" : ""} ${item.selecionado ? "" : "desmarcada"}`}>
                      <input
                        type="checkbox"
                        checked={item.selecionado}
                        disabled={bloqueado}
                        onChange={() => alternarItem(indiceReal)}
                      />
                      <span className={`imp-situacao imp-situacao-${item.situacao}`} title={LABEL_SITUACAO[item.situacao]}>
                        <Icone size={13} />
                      </span>
                      <span className="imp-data tabular">{formatarData(item.extrato.data)}</span>
                      <span className="imp-descricao">
                        {item.extrato.descricao}
                        {item.correspondente && (
                          <em className="imp-correspondente">
                            {item.situacao === "confirma" ? "confirma" : "já lançado como"} “{item.correspondente.descricao}”
                          </em>
                        )}
                      </span>
                      <span className="imp-categoria">
                        {bloqueado || item.correspondente ? (
                          <Badge tone={TOM_SITUACAO[item.situacao]}>{LABEL_SITUACAO[item.situacao]}</Badge>
                        ) : (
                          <select
                            className="imp-select-categoria"
                            value={item.categoria_id ?? ""}
                            onChange={(e) => mudarCategoria(indiceReal, e.target.value)}
                          >
                            <option value="">Sem categoria</option>
                            {categorias
                              .filter((c) => c.tipo === item.extrato.tipo)
                              .map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                          </select>
                        )}
                        {item.regra_id && !item.correspondente && (
                          <span className="imp-regra" title={`Sugerido pela regra "${item.categoria_nome}"`}>
                            <Wand2 size={11} />
                          </span>
                        )}
                      </span>
                      <span className={`imp-valor tabular ${item.extrato.tipo}`}>
                        {item.extrato.tipo === "receita" ? "+" : "−"}{formatarMoeda(item.extrato.valor)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {divergencias.length > 0 && (
            <div className="section">
              <h2 className="section-title">Está no app, mas não apareceu no extrato</h2>
              <Card className="imp-divergencias">
                <p className="imp-nota">
                  Estes lançamentos estão marcados como pagos nessa conta dentro do período do extrato,
                  mas o banco não os registrou. Pode ser lançamento em duplicidade, valor digitado errado,
                  ou algo que foi pago por outro meio.
                </p>
                <div className="list">
                  {divergencias.map((t) => (
                    <div key={t.id} className="list-row">
                      <div className="list-row-main">
                        <div className="list-row-title">{t.descricao}</div>
                        <div className="list-row-meta">{formatarData(t.data)}</div>
                      </div>
                      <div className="list-row-value tabular">{formatarMoeda(t.valor)}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {!leitura && !resultado && (
        <Card>
          <EmptyState
            title="Nenhum extrato carregado"
            description="Baixe o extrato em OFX no seu internet banking — quase todos oferecem, geralmente como 'OFX', 'Money' ou 'exportar para gerenciador financeiro'. O OFX é melhor que o CSV porque traz um identificador único por lançamento, o que impede importar a mesma coisa duas vezes."
          />
        </Card>
      )}
    </div>
  );
}
