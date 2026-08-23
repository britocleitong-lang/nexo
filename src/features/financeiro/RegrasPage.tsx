import { useEffect, useState } from "react";
import { Plus, Trash2, Wand2, Play, Pause, Sparkles, Check } from "lucide-react";
import type { Categoria, ModoRegra, NaturezaTransacao, RegraCategorizacao } from "../../types/entities";
import {
  listarRegrasComCategoria, criarRegra, atualizarRegra, excluirRegra,
  sugerirRegras, aplicarRegrasEmPendentes, classificar, MODOS_REGRA, type SugestaoRegra,
} from "./regrasRepository";
import { listarCategorias } from "./financeiroRepository";
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select } from "../../components/ui";
import { confirmar } from "../../components/Confirm";
import { useModoLeitura } from "../../core/modoLeitura";
import "./RegrasPage.css";

export function RegrasPage() {
  const somenteLeitura = useModoLeitura();
  const [regras, setRegras] = useState<Array<RegraCategorizacao & { categoria_nome: string | null }>>([]);
  const [sugestoes, setSugestoes] = useState<SugestaoRegra[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const [padrao, setPadrao] = useState("");
  const [modo, setModo] = useState<ModoRegra>("contem");
  const [categoriaId, setCategoriaId] = useState("");
  const [natureza, setNatureza] = useState<NaturezaTransacao | "">("");
  const [teste, setTeste] = useState("");

  function recarregar() {
    setRegras(listarRegrasComCategoria());
    setSugestoes(sugerirRegras());
    setCategorias(listarCategorias("despesa"));
  }

  useEffect(() => { recarregar(); }, []);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!padrao.trim() || !categoriaId) return;
    await criarRegra({
      padrao: padrao.trim(), modo, categoria_id: categoriaId,
      natureza: (natureza || null) as NaturezaTransacao | null,
    });
    setPadrao(""); setCategoriaId(""); setNatureza(""); setModo("contem");
    setAberto(false);
    recarregar();
  }

  async function handleExcluir(r: RegraCategorizacao) {
    const ok = await confirmar({
      titulo: `Excluir a regra "${r.padrao}"?`,
      descricao: "Os lançamentos já categorizados por ela continuam como estão.",
    });
    if (!ok) return;
    await excluirRegra(r.id);
    recarregar();
  }

  async function handleAceitarSugestao(s: SugestaoRegra) {
    await criarRegra({ padrao: s.padrao, modo: "contem", categoria_id: s.categoria_id });
    recarregar();
  }

  async function handleAplicarTodas() {
    const ok = await confirmar({
      titulo: "Aplicar as regras nos lançamentos sem categoria?",
      descricao: "Só mexe no que está sem categoria hoje. Nada que você já classificou é sobrescrito.",
    });
    if (!ok) return;
    const n = await aplicarRegrasEmPendentes();
    setMensagem(n === 0
      ? "Nenhum lançamento sem categoria casou com as regras atuais."
      : `${n} lançamento(s) foram categorizados.`);
    recarregar();
  }

  // Teste ao vivo: mostra qual regra pegaria o texto digitado. Sem isso,
  // depurar por que uma linha caiu na categoria errada vira adivinhação.
  const resultadoTeste = teste.trim() ? classificar(teste) : null;
  const categoriaTeste = resultadoTeste?.categoria_id
    ? listarCategorias().find((c) => c.id === resultadoTeste.categoria_id)?.nome
    : null;

  return (
    <div>
      <PageHeader
        title="Regras de categorização"
        subtitle="Ensine o Nexo a categorizar sozinho o que vem do extrato. Primeira regra que casar, ganha."
        actions={!somenteLeitura && (
          <>
            <Button icon={<Wand2 size={16} />} onClick={handleAplicarTodas}>Aplicar nos sem categoria</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAberto(true)}>Nova regra</Button>
          </>
        )}
      />

      {mensagem && (
        <div className="section">
          <Card className="regra-mensagem"><Check size={16} /> {mensagem}</Card>
        </div>
      )}

      {sugestoes.length > 0 && !somenteLeitura && (
        <div className="section">
          <Card className="regra-sugestoes">
            <div className="regra-sugestoes-topo">
              <span className="regra-sugestoes-icone"><Sparkles size={16} /></span>
              <div>
                <strong>Sugestões a partir do que você já categorizou</strong>
                <p>
                  Estas palavras apareceram várias vezes e você sempre escolheu a mesma categoria.
                  Virar regra poupa esse trabalho na próxima importação.
                </p>
              </div>
            </div>
            <div className="regra-sugestoes-lista">
              {sugestoes.map((s) => (
                <div key={s.padrao} className="regra-sugestao">
                  <code>{s.padrao}</code>
                  <span className="regra-seta">→</span>
                  <span className="regra-sugestao-cat">{s.categoria_nome}</span>
                  <span className="regra-sugestao-n">{s.ocorrencias}×</span>
                  <Button onClick={() => handleAceitarSugestao(s)}>Criar</Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div className="section">
        <Card className="regra-teste">
          <Field label="Testar uma descrição" hint="Cole aqui uma descrição do seu extrato para ver qual regra pegaria.">
            <Input value={teste} onChange={(e) => setTeste(e.target.value)} placeholder="Ex: PIX ENVIADO MERC SAO JOAO" />
          </Field>
          {teste.trim() && (
            <div className={`regra-teste-resultado ${resultadoTeste ? "casou" : "vazio"}`}>
              {resultadoTeste
                ? <>Casa com a regra <code>{resultadoTeste.regra_padrao}</code> → <strong>{categoriaTeste}</strong></>
                : <>Nenhuma regra casa com esse texto — o lançamento entraria sem categoria.</>}
            </div>
          )}
        </Card>
      </div>

      {regras.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma regra criada"
            description="Uma regra diz: quando a descrição contiver tal texto, use tal categoria. É o que transforma 80 linhas cruas de extrato em lançamentos já classificados."
            action={!somenteLeitura && <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAberto(true)}>Criar primeira regra</Button>}
          />
        </Card>
      ) : (
        <Card>
          <div className="list">
            {regras.map((r) => (
              <div key={r.id} className={`list-row ${r.ativa === 0 ? "regra-inativa" : ""}`}>
                <div className="list-row-main">
                  <div className="list-row-title regra-linha">
                    <code>{r.padrao}</code>
                    <span className="regra-seta">→</span>
                    <span>{r.categoria_nome ?? "categoria removida"}</span>
                  </div>
                  <div className="list-row-meta">
                    {MODOS_REGRA.find((m) => m.valor === r.modo)?.label}
                    {r.natureza && ` · marca como ${r.natureza}`}
                    {r.vezes_aplicada > 0 && ` · aplicada ${r.vezes_aplicada}×`}
                  </div>
                </div>
                {r.vezes_aplicada === 0 && <Badge tone="muted">nunca usada</Badge>}
                {!somenteLeitura && (
                  <div className="list-row-actions">
                    <button
                      className="icon-btn"
                      title={r.ativa === 0 ? "Ativar" : "Desativar"}
                      onClick={async () => { await atualizarRegra(r.id, { ativa: r.ativa ? 0 : 1 }); recarregar(); }}
                    >
                      {r.ativa === 0 ? <Play size={15} /> : <Pause size={15} />}
                    </button>
                    <button className="icon-btn danger" title="Excluir" onClick={() => handleExcluir(r)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Drawer open={aberto} title="Nova regra" onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Texto a procurar" hint="Não diferencia maiúsculas nem acentos.">
            <Input value={padrao} onChange={(e) => setPadrao(e.target.value)} placeholder="Ex: uber" required />
          </Field>

          <Field label="Como comparar">
            <Select value={modo} onChange={(e) => setModo(e.target.value as ModoRegra)}>
              {MODOS_REGRA.map((m) => <option key={m.valor} value={m.valor}>{m.label}</option>)}
            </Select>
          </Field>

          <Field label="Categoria a aplicar">
            <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required>
              <option value="">Escolha a categoria</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </Field>

          <Field label="Natureza" hint="Opcional — ajuda a análise de fixo vs. variável.">
            <Select value={natureza} onChange={(e) => setNatureza(e.target.value as NaturezaTransacao | "")}>
              <option value="">Não definir</option>
              <option value="fixo">Fixo</option>
              <option value="variavel">Variável</option>
              <option value="investimento">Investimento</option>
            </Select>
          </Field>

          <div className="page-actions">
            <Button type="button" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Criar regra</Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
