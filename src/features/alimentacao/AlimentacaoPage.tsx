import { useEffect, useMemo, useState } from "react";
import {
  Plus, Trash2, Apple, Droplets, ChevronLeft, ChevronRight,
  Star, Search, Info, Utensils,
} from "lucide-react";
import {
  refeicoesDoDia, criarRefeicao, excluirRefeicao, adicionarItem, excluirItem,
  totaisDoDia, mediaDiaria, evolucaoKcal, buscarAlimentos, medidasDoAlimento,
  criarAlimento, alternarFavorito, registrarAgua, desfazerUltimaAgua,
  TIPOS_REFEICAO, labelRefeicao, NIVEIS_ATIVIDADE, calcularTMB, calcularGastoDiario,
  AVISO_ESTIMATIVA, type Alimento, type TipoRefeicao, type MedidaCaseira, type NivelAtividade,
} from "./alimentacaoRepository";
import { Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select, StatCard } from "../../components/ui";
import { formatarData } from "../../utils/format";
import { hoje, somarDias } from "../../core/datas";
import { confirmar } from "../../components/Confirm";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import "./AlimentacaoPage.css";

const COPO_ML = 250;

export function AlimentacaoPage() {
  const [data, setData] = useState(hoje());
  const [versao, setVersao] = useState(0);
  const [buscaAberta, setBuscaAberta] = useState<string | null>(null);
  const [refeicaoNova, setRefeicaoNova] = useState(false);
  const [calculadoraAberta, setCalculadoraAberta] = useState(false);

  const recarregar = () => setVersao((v) => v + 1);

  const refeicoes = useMemo(() => refeicoesDoDia(data), [data, versao]);
  const totais = useMemo(() => totaisDoDia(data), [data, versao]);
  const media = useMemo(() => mediaDiaria(7), [versao]);
  const evolucao = useMemo(() => evolucaoKcal(14), [versao]);

  const ehHoje = data === hoje();

  return (
    <div>
      <PageHeader
        title="Alimentação"
        subtitle="Registro do que foi comido, em medidas caseiras. Base TACO — os valores batem com a comida daqui."
        actions={(
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setRefeicaoNova(true)}>
            Nova refeição
          </Button>
        )}
      />

      <div className="ali-navegador section">
        <button className="icon-btn" onClick={() => setData(somarDias(data, -1))} aria-label="Dia anterior">
          <ChevronLeft size={17} />
        </button>
        <span className="ali-data">{ehHoje ? "Hoje" : formatarData(data)}</span>
        <button
          className="icon-btn"
          onClick={() => setData(somarDias(data, 1))}
          disabled={ehHoje}
          aria-label="Próximo dia"
        >
          <ChevronRight size={17} />
        </button>
      </div>

      <div className="grid-4 section">
        <StatCard
          label="Energia"
          value={`${Math.round(totais.kcal)} kcal`}
          hint={media.kcal > 0 ? `média de ${Math.round(media.kcal)} nos dias registrados` : undefined}
          icon={<Apple size={15} />}
        />
        <StatCard label="Proteína" value={`${Math.round(totais.proteina)} g`} />
        <StatCard label="Carboidrato" value={`${Math.round(totais.carboidrato)} g`} />
        <StatCard label="Gordura" value={`${Math.round(totais.gordura)} g`} />
      </div>

      <div className="section">
        <Card className="ali-agua">
          <div className="ali-agua-topo">
            <span className="ali-agua-icone"><Droplets size={17} /></span>
            <div>
              <strong>Água</strong>
              <span>{(totais.agua_ml / 1000).toFixed(2)} L hoje · {Math.round(totais.agua_ml / COPO_ML)} copos</span>
            </div>
            {(
              <div className="ali-agua-acoes">
                <Button onClick={async () => { await registrarAgua(COPO_ML, null, data); recarregar(); }}>
                  + 1 copo
                </Button>
                <Button onClick={async () => { await registrarAgua(500, null, data); recarregar(); }}>
                  + 500 ml
                </Button>
                {totais.agua_ml > 0 && (
                  <button className="icon-btn" onClick={async () => { await desfazerUltimaAgua(data); recarregar(); }}
                    title="Desfazer último registro">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="ali-copos">
            {Array.from({ length: Math.max(8, Math.ceil(totais.agua_ml / COPO_ML)) }).map((_, i) => (
              <span key={i} className={`ali-copo ${i < totais.agua_ml / COPO_ML ? "cheio" : ""}`} />
            ))}
          </div>
        </Card>
      </div>

      {refeicoes.length === 0 ? (
        <Card>
          <EmptyState
            title={ehHoje ? "Nada registrado hoje" : "Nada registrado nesse dia"}
            description="Crie uma refeição e vá adicionando o que comeu. A busca aceita medida caseira — 'duas colheres de arroz' em vez de 43 gramas."
            action={(
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => setRefeicaoNova(true)}>
                Adicionar refeição
              </Button>
            )}
          />
        </Card>
      ) : (
        refeicoes.map((r) => {
          const kcalRefeicao = r.itens.reduce((s, i) => s + i.kcal, 0);
          return (
            <div key={r.id} className="section">
              <div className="ali-refeicao-header">
                <h3><Utensils size={15} /> {labelRefeicao(r.tipo)}</h3>
                <span className="ali-refeicao-kcal tabular">{Math.round(kcalRefeicao)} kcal</span>
                {(
                  <button className="icon-btn danger" onClick={async () => {
                    const ok = await confirmar({
                      titulo: `Excluir ${labelRefeicao(r.tipo).toLowerCase()}?`,
                      descricao: "Todos os itens registrados nela serão apagados.",
                    });
                    if (!ok) return;
                    await excluirRefeicao(r.id);
                    recarregar();
                  }}><Trash2 size={15} /></button>
                )}
              </div>

              <Card>
                {r.itens.length === 0 ? (
                  <p className="ali-vazio">Nenhum item ainda.</p>
                ) : (
                  <div className="ali-itens">
                    {r.itens.map((i) => (
                      <div key={i.id} className="ali-item">
                        <div className="ali-item-corpo">
                          <span className="ali-item-nome">{i.nome}</span>
                          <span className="ali-item-qtd">
                            {i.medida_nome && i.medida_quantidade
                              ? `${i.medida_quantidade} ${i.medida_nome} · ${Math.round(i.quantidade_g)} g`
                              : `${Math.round(i.quantidade_g)} g`}
                          </span>
                        </div>
                        <span className="ali-item-macros">
                          <em>P {i.proteina.toFixed(0)}</em>
                          <em>C {i.carboidrato.toFixed(0)}</em>
                          <em>G {i.gordura.toFixed(0)}</em>
                        </span>
                        <span className="ali-item-kcal tabular">{Math.round(i.kcal)}</span>
                        {(
                          <button className="icon-btn danger" onClick={async () => {
                            await excluirItem(i.id);
                            recarregar();
                          }}><Trash2 size={14} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {(
                  <button className="ali-add" onClick={() => setBuscaAberta(r.id)}>
                    <Plus size={14} /> Adicionar alimento
                  </button>
                )}
              </Card>
            </div>
          );
        })
      )}

      {evolucao.some((d) => d.kcal > 0) && (
        <div className="section">
          <h3 className="section-title">Últimos 14 dias</h3>
          <Card>
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer>
                <LineChart data={evolucao.map((d) => ({ ...d, dia: d.data.slice(8, 10) + "/" + d.data.slice(5, 7) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v, n) => [`${Math.round(Number(v))} ${n === "kcal" ? "kcal" : "g"}`, n === "kcal" ? "Energia" : "Proteína"]}
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="kcal" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="proteina" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="ali-nota">
              Dias em branco são dias sem registro, não dias sem comer — a média de referência
              considera apenas os dias em que algo foi anotado.
            </p>
          </Card>
        </div>
      )}

      <div className="section">
        <Card className="ali-referencia">
          <div className="ali-referencia-topo">
            <span className="ali-referencia-icone"><Info size={16} /></span>
            <div>
              <strong>Quer uma referência de gasto energético?</strong>
              <p>
                O app calcula uma estimativa a partir de peso, altura, idade e rotina.
                É ponto de partida para conversar com um nutricionista, não meta a perseguir —
                o erro individual dessas fórmulas passa de 10% com facilidade.
              </p>
            </div>
            <Button onClick={() => setCalculadoraAberta(true)}>Calcular</Button>
          </div>
        </Card>
      </div>

      <NovaRefeicao
        aberto={refeicaoNova}
        data={data}
        onFechar={() => setRefeicaoNova(false)}
        onCriada={() => { setRefeicaoNova(false); recarregar(); }}
      />

      <BuscaAlimento
        refeicaoId={buscaAberta}
        onFechar={() => setBuscaAberta(null)}
        onAdicionado={() => { setBuscaAberta(null); recarregar(); }}
      />

      <Calculadora aberto={calculadoraAberta} onFechar={() => setCalculadoraAberta(false)} />
    </div>
  );
}

// =====================================================================

function NovaRefeicao({ aberto, data, onFechar, onCriada }: {
  aberto: boolean; data: string; onFechar: () => void; onCriada: () => void;
}) {
  const [tipo, setTipo] = useState<TipoRefeicao>("almoco");
  const [hora, setHora] = useState("");

  useEffect(() => {
    // Sugere o tipo pela hora do dia — na maioria das vezes acerta e
    // poupa um toque.
    const h = new Date().getHours();
    const sugerido: TipoRefeicao =
      h < 10 ? "cafe" : h < 11.5 ? "lanche_manha" : h < 14.5 ? "almoco"
      : h < 18 ? "lanche_tarde" : h < 21.5 ? "jantar" : "ceia";
    setTipo(sugerido);
    setHora(TIPOS_REFEICAO.find((t) => t.valor === sugerido)?.horaSugerida ?? "");
  }, [aberto]);

  return (
    <Drawer open={aberto} title="Nova refeição" onClose={onFechar}>
      <form className="form-grid" onSubmit={async (e) => {
        e.preventDefault();
        await criarRefeicao({ data, tipo, hora: hora || null });
        onCriada();
      }}>
        <Field label="Qual refeição">
          <Select value={tipo} onChange={(e) => {
            const novo = e.target.value as TipoRefeicao;
            setTipo(novo);
            setHora(TIPOS_REFEICAO.find((t) => t.valor === novo)?.horaSugerida ?? "");
          }}>
            {TIPOS_REFEICAO.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
          </Select>
        </Field>
        <Field label="Hora">
          <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </Field>
        <div className="page-actions">
          <Button type="button" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" variant="primary">Criar</Button>
        </div>
      </form>
    </Drawer>
  );
}

// =====================================================================

function BuscaAlimento({ refeicaoId, onFechar, onAdicionado }: {
  refeicaoId: string | null; onFechar: () => void; onAdicionado: () => void;
}) {
  const [termo, setTermo] = useState("");
  const [escolhido, setEscolhido] = useState<Alimento | null>(null);
  const [medidas, setMedidas] = useState<MedidaCaseira[]>([]);
  const [medidaNome, setMedidaNome] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [gramas, setGramas] = useState("");
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [versao, setVersao] = useState(0);

  const resultados = useMemo(() => buscarAlimentos(termo), [termo, versao]);

  useEffect(() => {
    if (!escolhido) return;
    const m = medidasDoAlimento(escolhido.id);
    setMedidas(m);
    if (m.length > 0) {
      setMedidaNome(m[0].nome);
      setQuantidade("1");
      setGramas(String(m[0].gramas));
    } else {
      setMedidaNome("");
      setGramas(String(escolhido.porcao_padrao_g ?? 100));
    }
  }, [escolhido]);

  // Ao mudar medida ou quantidade, recalcula as gramas — mas o campo de
  // gramas continua editável, para quem tem balança.
  function recalcular(nomeMedida: string, qtd: string) {
    const m = medidas.find((x) => x.nome === nomeMedida);
    if (m) setGramas(String(Math.round(m.gramas * (Number(qtd) || 0) * 10) / 10));
  }

  const fator = (Number(gramas) || 0) / 100;

  if (!refeicaoId) return null;

  return (
    <Drawer open title={escolhido ? escolhido.nome : "Adicionar alimento"} onClose={() => { setEscolhido(null); onFechar(); }}>
      {!escolhido ? (
        <div className="form-grid">
          <div className="ali-busca-campo">
            <Search size={15} />
            <input
              autoFocus className="input" placeholder="Buscar alimento..."
              value={termo} onChange={(e) => setTermo(e.target.value)}
            />
          </div>

          <div className="ali-resultados">
            {resultados.map((a) => (
              <button key={a.id} className="ali-resultado" onClick={() => setEscolhido(a)}>
                <span className="ali-resultado-corpo">
                  <span className="ali-resultado-nome">
                    {a.favorito === 1 && <Star size={11} className="ali-estrela" />}
                    {a.nome}
                  </span>
                  <span className="ali-resultado-meta">
                    {a.grupo} · {Math.round(a.kcal ?? 0)} kcal/100 g
                    {a.fonte === "proprio" && " · seu cadastro"}
                  </span>
                </span>
              </button>
            ))}
            {resultados.length === 0 && (
              <p className="ali-vazio">Nenhum alimento com esse nome.</p>
            )}
          </div>

          {criandoNovo ? (
            <FormAlimentoNovo
              nomeInicial={termo}
              onCriado={(id) => {
                setCriandoNovo(false);
                setVersao((v) => v + 1);
                const novo = buscarAlimentos(termo).find((a) => a.id === id);
                if (novo) setEscolhido(novo);
              }}
              onCancelar={() => setCriandoNovo(false)}
            />
          ) : (
            <Button icon={<Plus size={15} />} onClick={() => setCriandoNovo(true)}>
              Cadastrar alimento que não está na lista
            </Button>
          )}
        </div>
      ) : (
        <form className="form-grid" onSubmit={async (e) => {
          e.preventDefault();
          const g = Number(gramas);
          if (!g || g <= 0) return;
          await adicionarItem({
            refeicao_id: refeicaoId,
            alimento_id: escolhido.id,
            quantidade_g: g,
            medida_nome: medidaNome || null,
            medida_quantidade: medidaNome ? Number(quantidade) : null,
          });
          setEscolhido(null);
          setTermo("");
          onAdicionado();
        }}>
          {medidas.length > 0 && (
            <div className="form-row-2">
              <Field label="Quantidade">
                <Input
                  type="number" step="0.5" min="0" autoFocus value={quantidade}
                  onChange={(e) => { setQuantidade(e.target.value); recalcular(medidaNome, e.target.value); }}
                />
              </Field>
              <Field label="Medida">
                <Select value={medidaNome} onChange={(e) => { setMedidaNome(e.target.value); recalcular(e.target.value, quantidade); }}>
                  {medidas.map((m) => <option key={m.id} value={m.nome}>{m.nome} ({m.gramas} g)</option>)}
                  <option value="">Direto em gramas</option>
                </Select>
              </Field>
            </div>
          )}

          <Field label="Peso em gramas" hint="Editável — se você pesou, use o valor da balança.">
            <Input type="number" step="1" min="0" value={gramas} onChange={(e) => { setGramas(e.target.value); setMedidaNome(""); }} />
          </Field>

          <div className="ali-preview">
            <div><span>Energia</span><strong>{Math.round((escolhido.kcal ?? 0) * fator)} kcal</strong></div>
            <div><span>Proteína</span><strong>{((escolhido.proteina_g ?? 0) * fator).toFixed(1)} g</strong></div>
            <div><span>Carboidrato</span><strong>{((escolhido.carboidrato_g ?? 0) * fator).toFixed(1)} g</strong></div>
            <div><span>Gordura</span><strong>{((escolhido.gordura_g ?? 0) * fator).toFixed(1)} g</strong></div>
          </div>

          <div className="page-actions">
            <Button type="button" onClick={() => setEscolhido(null)}>Voltar</Button>
            <button
              type="button" className="btn btn-secondary"
              onClick={async () => { await alternarFavorito(escolhido.id); setVersao((v) => v + 1); }}
            >
              <Star size={15} /> {escolhido.favorito ? "Remover dos favoritos" : "Favoritar"}
            </button>
            <Button type="submit" variant="primary">Adicionar</Button>
          </div>
        </form>
      )}
    </Drawer>
  );
}

function FormAlimentoNovo({ nomeInicial, onCriado, onCancelar }: {
  nomeInicial: string; onCriado: (id: string) => void; onCancelar: () => void;
}) {
  const [nome, setNome] = useState(nomeInicial);
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [g, setG] = useState("");

  return (
    <div className="form-grid ali-form-novo">
      <p className="ali-nota" style={{ marginTop: 0 }}>
        Copie os valores do rótulo. Atenção: rótulo brasileiro costuma vir <strong>por porção</strong>,
        e aqui os campos são <strong>por 100 g</strong> — se a porção for 30 g, multiplique por 3,33.
      </p>
      <Field label="Nome">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} />
      </Field>
      <div className="form-row-2">
        <Field label="Energia (kcal / 100 g)">
          <Input type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} />
        </Field>
        <Field label="Proteína (g / 100 g)">
          <Input type="number" step="0.1" value={p} onChange={(e) => setP(e.target.value)} />
        </Field>
      </div>
      <div className="form-row-2">
        <Field label="Carboidrato (g / 100 g)">
          <Input type="number" step="0.1" value={c} onChange={(e) => setC(e.target.value)} />
        </Field>
        <Field label="Gordura (g / 100 g)">
          <Input type="number" step="0.1" value={g} onChange={(e) => setG(e.target.value)} />
        </Field>
      </div>
      <div className="page-actions">
        <Button type="button" onClick={onCancelar}>Cancelar</Button>
        <Button type="button" variant="primary" onClick={async () => {
          if (!nome.trim()) return;
          const id = await criarAlimento({
            nome: nome.trim(), fonte: "rotulo",
            kcal: kcal ? Number(kcal) : null,
            proteina_g: p ? Number(p) : null,
            carboidrato_g: c ? Number(c) : null,
            gordura_g: g ? Number(g) : null,
            porcao_padrao_g: 100, porcao_padrao_nome: "100 g",
          });
          onCriado(id);
        }}>Cadastrar</Button>
      </div>
    </div>
  );
}

// =====================================================================

function Calculadora({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [idade, setIdade] = useState("");
  const [sexo, setSexo] = useState<"M" | "F">("M");
  const [nivel, setNivel] = useState<NivelAtividade>("moderado");

  const tmb = peso && altura && idade
    ? calcularTMB(Number(peso), Number(altura), Number(idade), sexo) : null;
  const gasto = tmb ? calcularGastoDiario(tmb, nivel) : null;

  return (
    <Drawer open={aberto} title="Referência de gasto energético" onClose={onFechar}>
      <div className="form-grid">
        <div className="form-row-2">
          <Field label="Peso (kg)">
            <Input type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} />
          </Field>
          <Field label="Altura (cm)">
            <Input type="number" value={altura} onChange={(e) => setAltura(e.target.value)} />
          </Field>
        </div>
        <div className="form-row-2">
          <Field label="Idade">
            <Input type="number" value={idade} onChange={(e) => setIdade(e.target.value)} />
          </Field>
          <Field label="Sexo biológico" hint="A fórmula usa essa variável no cálculo.">
            <Select value={sexo} onChange={(e) => setSexo(e.target.value as "M" | "F")}>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </Select>
          </Field>
        </div>
        <Field label="Rotina" hint={NIVEIS_ATIVIDADE.find((n) => n.valor === nivel)?.descricao}>
          <Select value={nivel} onChange={(e) => setNivel(e.target.value as NivelAtividade)}>
            {NIVEIS_ATIVIDADE.map((n) => <option key={n.valor} value={n.valor}>{n.label}</option>)}
          </Select>
        </Field>

        {gasto && (
          <div className="ali-resultado-calc">
            <div>
              <span>Metabolismo basal</span>
              <strong>{Math.round(tmb!)} kcal</strong>
              <em>O que o corpo gasta em repouso absoluto</em>
            </div>
            <div>
              <span>Gasto diário estimado</span>
              <strong>{Math.round(gasto)} kcal</strong>
              <em>Basal × fator da sua rotina</em>
            </div>
          </div>
        )}

        <p className="ali-aviso-forte">{AVISO_ESTIMATIVA}</p>
      </div>
    </Drawer>
  );
}
