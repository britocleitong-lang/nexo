import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Info, ArrowUp, ArrowDown, Filter, X } from "lucide-react";
import type { Conta, Transacao, TipoCategoria } from "../../types/entities";
import {
  listarTransacoes, criarTransacao, atualizarTransacao, excluirTransacao,
  listarCategorias, criarCategoria, listarContas,
} from "./financeiroRepository";
import { confirmar } from "../../components/Confirm";
import { mascarar } from "../../utils/visibilidadeValores";
import { hojeISO } from "../../utils/format";
import "./PlanilhaTab.css";

/**
 * Modo planilha — lançar em série sem abrir formulário.
 *
 * O comportamento segue o que se espera de uma planilha, porque é isso que
 * a mão já sabe fazer:
 *   • setas movem a seleção
 *   • digitar começa a editar (substituindo o conteúdo)
 *   • Enter confirma e desce · Tab confirma e vai pra direita
 *   • F2 ou duplo clique edita mantendo o valor atual
 *   • Esc cancela a edição
 *   • Delete/Backspace limpa a célula selecionada
 *   • colar do Excel (TSV) preenche várias linhas de uma vez
 *
 * Cada linha é uma transação real: sair da célula grava direto no banco.
 */

type IdColuna = "data" | "descricao" | "valor" | "tipo" | "natureza" | "categoria" | "conta";

interface Coluna {
  id: IdColuna;
  titulo: string;
  largura: number;
  tipo: "texto" | "numero" | "data" | "lista";
  alinhamento?: "direita";
}

const COLUNAS: Coluna[] = [
  { id: "data", titulo: "Data", largura: 116, tipo: "data" },
  { id: "descricao", titulo: "Descrição", largura: 260, tipo: "texto" },
  { id: "valor", titulo: "Valor", largura: 124, tipo: "numero", alinhamento: "direita" },
  { id: "tipo", titulo: "Tipo", largura: 104, tipo: "lista" },
  { id: "natureza", titulo: "Natureza", largura: 116, tipo: "lista" },
  { id: "categoria", titulo: "Categoria", largura: 168, tipo: "lista" },
  { id: "conta", titulo: "Conta", largura: 160, tipo: "lista" },
];

interface Celula { linha: number; coluna: number }

function formatarNumero(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Aceita "1.234,56", "1234.56" e "1234,56" — o usuário cola de qualquer lugar. */
function lerNumero(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : 0;
}

function formatarDataBR(iso: string): string {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

/** Aceita dd/mm/aaaa e aaaa-mm-dd. */
function lerData(texto: string): string {
  const t = texto.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const [, d, m, a] = br;
    const ano = a.length === 2 ? `20${a}` : a;
    return `${ano}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return hojeISO();
}

export function PlanilhaTab({ onMudou }: { onMudou: () => void }) {
  const [todas, setTodas] = useState<Transacao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState(listarCategorias());
  const [selecao, setSelecao] = useState<Celula>({ linha: 0, coluna: 0 });
  const [ancora, setAncora] = useState<Celula>({ linha: 0, coluna: 0 });
  const [editando, setEditando] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<{ coluna: IdColuna; desc: boolean } | null>(null);
  const [filtros, setFiltros] = useState<Partial<Record<IdColuna, string>>>({});
  const [painelFiltro, setPainelFiltro] = useState<IdColuna | null>(null);
  const [arrastando, setArrastando] = useState(false);

  // Solta o arraste mesmo se o mouse subir fora da grade.
  useEffect(() => {
    if (!arrastando) return;
    const soltar = () => setArrastando(false);
    window.addEventListener("mouseup", soltar);
    return () => window.removeEventListener("mouseup", soltar);
  }, [arrastando]);
  const gradeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function recarregar() {
    setTodas(listarTransacoes());
    setContas(listarContas());
    setCategorias(listarCategorias());
  }

  useEffect(() => { recarregar(); }, []);

  useEffect(() => {
    if (editando !== null) inputRef.current?.focus();
  }, [editando]);

  const opcoes = useMemo(() => ({
    tipo: [{ id: "despesa", label: "Despesa" }, { id: "receita", label: "Receita" }],
    natureza: [{ id: "fixo", label: "Fixo" }, { id: "variavel", label: "Variável" }, { id: "investimento", label: "Investimento" }],
    categoria: categorias.map((c) => ({ id: c.id, label: c.nome })),
    conta: contas.map((c) => ({ id: c.id, label: c.nome })),
  }), [categorias, contas]);

  /** Texto de uma célula sem depender do React — usado por ordenação e filtro. */
  function textoDe(t: Transacao, id: IdColuna): string {
    const col = COLUNAS.find((c) => c.id === id)!;
    return valorExibido(t, col);
  }

  /** A visão é o que a grade mostra: filtrada e ordenada, como no Excel. */
  const linhas = useMemo(() => {
    let saida = [...todas];

    for (const [id, termo] of Object.entries(filtros)) {
      if (!termo) continue;
      const alvo = termo.toLowerCase();
      saida = saida.filter((t) => textoDe(t, id as IdColuna).toLowerCase().includes(alvo));
    }

    if (ordem) {
      const col = COLUNAS.find((c) => c.id === ordem.coluna)!;
      saida.sort((a, b) => {
        let r: number;
        if (col.tipo === "numero") r = a.valor - b.valor;
        else if (col.tipo === "data") r = a.data.localeCompare(b.data);
        else r = textoDe(a, ordem.coluna).localeCompare(textoDe(b, ordem.coluna), "pt-BR");
        return ordem.desc ? -r : r;
      });
    }
    return saida;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todas, filtros, ordem, categorias, contas]);

  /** Retângulo selecionado — a seleção vai da âncora até a célula atual. */
  const intervalo = useMemo(() => ({
    l1: Math.min(ancora.linha, selecao.linha), l2: Math.max(ancora.linha, selecao.linha),
    c1: Math.min(ancora.coluna, selecao.coluna), c2: Math.max(ancora.coluna, selecao.coluna),
  }), [ancora, selecao]);

  function dentroDaSelecao(i: number, j: number): boolean {
    return i >= intervalo.l1 && i <= intervalo.l2 && j >= intervalo.c1 && j <= intervalo.c2;
  }

  /** Resumo do que está selecionado — igual à barra de status do Excel. */
  const resumo = useMemo(() => {
    const numeros: number[] = [];
    let celulas = 0;
    for (let i = intervalo.l1; i <= intervalo.l2 && i < linhas.length; i++) {
      for (let j = intervalo.c1; j <= intervalo.c2; j++) {
        const col = COLUNAS[j];
        if (!col) continue;
        celulas++;
        if (col.tipo === "numero") numeros.push(linhas[i].valor);
      }
    }
    const soma = numeros.reduce((s, n) => s + n, 0);
    return {
      celulas,
      contagem: numeros.length,
      soma,
      media: numeros.length ? soma / numeros.length : 0,
      minimo: numeros.length ? Math.min(...numeros) : 0,
      maximo: numeros.length ? Math.max(...numeros) : 0,
    };
  }, [intervalo, linhas]);

  function alternarOrdem(id: IdColuna) {
    setOrdem((o) => (o?.coluna === id ? (o.desc ? null : { coluna: id, desc: true }) : { coluna: id, desc: false }));
  }

  function valorExibido(t: Transacao, col: Coluna): string {
    switch (col.id) {
      case "data": return formatarDataBR(t.data);
      case "descricao": return t.descricao;
      case "valor": return formatarNumero(t.valor);
      case "tipo": return t.tipo === "receita" ? "Receita" : "Despesa";
      case "natureza":
        return t.natureza === "fixo" ? "Fixo" : t.natureza === "investimento" ? "Investimento" : t.natureza === "variavel" ? "Variável" : "";
      case "categoria": return categorias.find((c) => c.id === t.categoria_id)?.nome ?? "";
      case "conta": return contas.find((c) => c.id === t.conta_id)?.nome ?? "";
    }
  }

  /** Converte o texto digitado no campo real da transação e grava. */
  async function gravar(t: Transacao, col: Coluna, texto: string) {
    const v = texto.trim();
    let patch: Record<string, unknown> = {};

    switch (col.id) {
      case "data": patch = { data: lerData(v) }; break;
      case "descricao": patch = { descricao: v || "(sem descrição)" }; break;
      case "valor": patch = { valor: lerNumero(v) }; break;
      case "tipo": patch = { tipo: /rec/i.test(v) ? "receita" : "despesa" as TipoCategoria }; break;
      case "natureza":
        patch = { natureza: !v ? null : /fix/i.test(v) ? "fixo" : /invest/i.test(v) ? "investimento" : "variavel" };
        break;
      case "categoria": {
        if (!v) { patch = { categoria_id: null }; break; }
        const achada = categorias.find((c) => c.nome.toLowerCase() === v.toLowerCase());
        // Nome novo cria a categoria na hora — igual a digitar numa planilha.
        patch = { categoria_id: achada ? achada.id : await criarCategoria(v, t.tipo) };
        break;
      }
      case "conta": {
        const achada = contas.find((c) => c.nome.toLowerCase() === v.toLowerCase());
        patch = { conta_id: achada ? achada.id : null };
        break;
      }
    }

    await atualizarTransacao(t.id, patch);
    recarregar();
    onMudou();
  }

  async function novaLinha() {
    await criarTransacao({
      tipo: "despesa", descricao: "", valor: 0, data: hojeISO(), natureza: "variavel",
    });
    recarregar();
    onMudou();
    setSelecao({ linha: linhas.length, coluna: 1 });
  }

  async function removerLinha(t: Transacao) {
    if (!(await confirmar({ titulo: "Excluir lançamento?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirTransacao(t.id);
    recarregar();
    onMudou();
  }

  function mover(dLinha: number, dColuna: number, estender = false) {
    setSelecao((s) => {
      const destino = {
        linha: Math.max(0, Math.min(linhas.length - 1, s.linha + dLinha)),
        coluna: Math.max(0, Math.min(COLUNAS.length - 1, s.coluna + dColuna)),
      };
      if (!estender) setAncora(destino);
      return destino;
    });
  }

  async function aoTeclarNaGrade(e: React.KeyboardEvent) {
    if (editando !== null) return;
    const t = linhas[selecao.linha];
    const col = COLUNAS[selecao.coluna];

    if (e.key === "ArrowDown") { e.preventDefault(); mover(1, 0, e.shiftKey); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); mover(-1, 0, e.shiftKey); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); mover(0, 1, e.shiftKey); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); mover(0, -1, e.shiftKey); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      setAncora({ linha: 0, coluna: 0 });
      setSelecao({ linha: linhas.length - 1, coluna: COLUNAS.length - 1 });
      return;
    }
    if (e.key === "Tab") { e.preventDefault(); mover(0, e.shiftKey ? -1 : 1); return; }
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      if (t) setEditando(valorExibido(t, col));
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && t) {
      e.preventDefault();
      await gravar(t, col, "");
      return;
    }
    // Digitar direto começa a editar substituindo o conteúdo — como no Excel.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && t) {
      e.preventDefault();
      setEditando(e.key);
    }
  }

  async function confirmarEdicao(avancar: "baixo" | "direita" | null) {
    const t = linhas[selecao.linha];
    const col = COLUNAS[selecao.coluna];
    if (t && editando !== null) await gravar(t, col, editando);
    setEditando(null);
    if (avancar === "baixo") mover(1, 0);
    if (avancar === "direita") mover(0, 1);
    gradeRef.current?.focus();
  }

  /** Colar do Excel: cada linha do TSV vira um lançamento, a partir da célula atual. */
  async function aoColar(e: React.ClipboardEvent) {
    if (editando !== null) return;
    const texto = e.clipboardData.getData("text/plain");
    if (!texto.includes("\t") && !texto.includes("\n")) return;
    e.preventDefault();

    const matriz = texto.replace(/\r/g, "").split("\n").filter(Boolean).map((l) => l.split("\t"));
    for (let i = 0; i < matriz.length; i++) {
      let alvo = linhas[selecao.linha + i];
      if (!alvo) {
        await criarTransacao({ tipo: "despesa", descricao: "", valor: 0, data: hojeISO(), natureza: "variavel" });
        const atualizadas = listarTransacoes();
        alvo = atualizadas[selecao.linha + i];
        setTodas(atualizadas);
      }
      if (!alvo) continue;
      for (let j = 0; j < matriz[i].length; j++) {
        const col = COLUNAS[selecao.coluna + j];
        if (!col) break;
        await gravar(alvo, col, matriz[i][j]);
      }
    }
    recarregar();
    onMudou();
  }

  const larguraTotal = COLUNAS.reduce((s, c) => s + c.largura, 0) + 44;

  return (
    <div>
      <div className="planilha-barra">
        <span className="planilha-dica">
          <Info size={13} />
          Setas para navegar · digite para editar · Enter desce · Tab avança · cole direto do Excel
        </span>
        {Object.values(filtros).some(Boolean) && (
          <button className="planilha-filtros-ativos" onClick={() => setFiltros({})}>
            <Filter size={12} /> {Object.values(filtros).filter(Boolean).length} filtro(s) ativo(s) · limpar
          </button>
        )}
        <button className="btn btn-primary" onClick={novaLinha}>
          <span className="btn-icon"><Plus size={15} /></span>
          Nova linha
        </button>
      </div>

      <div className="planilha-moldura">
        <div
          onMouseDown={() => painelFiltro && setPainelFiltro(null)}
          className="planilha"
          style={{ minWidth: larguraTotal }}
          tabIndex={0}
          ref={gradeRef}
          onKeyDown={aoTeclarNaGrade}
          onPaste={aoColar}
        >
          <div className="planilha-cabecalho">
            <div className="planilha-celula planilha-canto" />
            {COLUNAS.map((col) => (
              <div key={col.id} className="planilha-celula planilha-th" style={{ width: col.largura }}>
                <button className="planilha-th-titulo" onClick={() => alternarOrdem(col.id)}>
                  {col.titulo}
                  {ordem?.coluna === col.id && (ordem.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
                </button>
                <button
                  className={`planilha-th-filtro ${filtros[col.id] ? "ativo" : ""}`}
                  onClick={() => setPainelFiltro((f) => (f === col.id ? null : col.id))}
                  aria-label={`Filtrar ${col.titulo}`}
                >
                  <Filter size={11} />
                </button>
                {painelFiltro === col.id && (
                  <div className="planilha-filtro-painel" onClick={(e) => e.stopPropagation()}>
                    <input
                      className="planilha-filtro-input"
                      autoFocus
                      placeholder={`Filtrar ${col.titulo.toLowerCase()}...`}
                      value={filtros[col.id] ?? ""}
                      onChange={(e) => setFiltros((f) => ({ ...f, [col.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setPainelFiltro(null); }}
                    />
                    <button className="planilha-filtro-limpar" onClick={() => { setFiltros((f) => ({ ...f, [col.id]: "" })); setPainelFiltro(null); }}>
                      <X size={12} /> Limpar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {linhas.length === 0 ? (
            <div className="planilha-vazia">
              Nenhum lançamento ainda. Clique em <strong>Nova linha</strong> para começar a digitar.
            </div>
          ) : (
            linhas.map((t, i) => (
              <div key={t.id} className={`planilha-linha ${selecao.linha === i ? "ativa" : ""}`}>
                <div className="planilha-celula planilha-numero">
                  <span>{i + 1}</span>
                  <button className="planilha-excluir" onClick={() => removerLinha(t)} aria-label="Excluir linha">
                    <Trash2 size={13} />
                  </button>
                </div>

                {COLUNAS.map((col, j) => {
                  const ativa = selecao.linha === i && selecao.coluna === j;
                  const emEdicao = ativa && editando !== null;
                  return (
                    <div
                      key={col.id}
                      className={`planilha-celula ${ativa ? "selecionada" : ""} ${dentroDaSelecao(i, j) && !ativa ? "no-bloco" : ""} ${col.alinhamento === "direita" ? "direita" : ""}`}
                      style={{ width: col.largura }}
                      onMouseDown={(e) => {
                        if (emEdicao) return;
                        e.preventDefault();
                        setSelecao({ linha: i, coluna: j });
                        // Shift mantém a âncora: estende a partir de onde já estava.
                        if (!e.shiftKey) setAncora({ linha: i, coluna: j });
                        setArrastando(true);
                        setEditando(null);
                        gradeRef.current?.focus();
                      }}
                      onMouseEnter={() => { if (arrastando) setSelecao({ linha: i, coluna: j }); }}
                      onDoubleClick={() => { setSelecao({ linha: i, coluna: j }); setEditando(valorExibido(t, col)); }}
                    >
                      {emEdicao ? (
                        <input
                          ref={inputRef}
                          className="planilha-input"
                          value={editando}
                          list={col.tipo === "lista" ? `opcoes-${col.id}` : undefined}
                          onChange={(e) => setEditando(e.target.value)}
                          onBlur={() => confirmarEdicao(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); confirmarEdicao("baixo"); }
                            if (e.key === "Tab") { e.preventDefault(); confirmarEdicao("direita"); }
                            if (e.key === "Escape") { e.preventDefault(); setEditando(null); gradeRef.current?.focus(); }
                          }}
                        />
                      ) : (
                        <span className={`planilha-texto ${col.tipo === "numero" || col.tipo === "data" ? "tabular" : ""}`}>
                          {col.id === "valor" ? mascarar(valorExibido(t, col)) : valorExibido(t, col)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="planilha-status">
        <span className="planilha-status-item">{linhas.length} de {todas.length} linhas</span>
        {resumo.celulas > 1 && <span className="planilha-status-item">{resumo.celulas} células</span>}
        {resumo.contagem > 0 && (
          <>
            <span className="planilha-status-item">Contagem <strong>{resumo.contagem}</strong></span>
            <span className="planilha-status-item">Soma <strong>{mascarar(formatarNumero(resumo.soma))}</strong></span>
            <span className="planilha-status-item">Média <strong>{mascarar(formatarNumero(resumo.media))}</strong></span>
            <span className="planilha-status-item">Mín <strong>{mascarar(formatarNumero(resumo.minimo))}</strong></span>
            <span className="planilha-status-item">Máx <strong>{mascarar(formatarNumero(resumo.maximo))}</strong></span>
          </>
        )}
      </div>

      {/* Sugestões nativas para as colunas de lista — digitar continua livre */}
      {(["tipo", "natureza", "categoria", "conta"] as const).map((id) => (
        <datalist key={id} id={`opcoes-${id}`}>
          {opcoes[id].map((o) => <option key={o.id} value={o.label} />)}
        </datalist>
      ))}
    </div>
  );
}
