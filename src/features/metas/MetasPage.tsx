import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Target, Link2, Hand } from "lucide-react";
import type { Investimento, Conta, Pessoa } from "../../types/entities";
import {
  listarProgressos, criarMeta, atualizarMeta, excluirMeta, marcarConcluidasAtingidas,
  LABEL_RITMO, TOM_RITMO, type ProgressoMeta,
} from "./metasRepository";
import { listarInvestimentos } from "../investimentos/investimentosRepository";
import { listarContas } from "../financeiro/financeiroRepository";
import { listarPessoas } from "../pessoas/pessoasRepository";
import { folgaMensalCerta } from "../financeiro/projecaoRepository";
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select, Textarea } from "../../components/ui";
import { formatarData, formatarMoeda } from "../../utils/format";
import { textoPrazo, hoje } from "../../core/datas";
import { confirmar } from "../../components/Confirm";
import { useModoLeitura } from "../../core/modoLeitura";
import "./MetasPage.css";

export function MetasPage() {
  const somenteLeitura = useModoLeitura();
  const [progressos, setProgressos] = useState<ProgressoMeta[]>([]);
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [folga, setFolga] = useState(0);

  const [nome, setNome] = useState("");
  const [valorAlvo, setValorAlvo] = useState("");
  const [valorInicial, setValorInicial] = useState("");
  const [dataAlvo, setDataAlvo] = useState("");
  const [investimentoId, setInvestimentoId] = useState("");
  const [contaId, setContaId] = useState("");
  const [pessoaId, setPessoaId] = useState("");
  const [observacoes, setObservacoes] = useState("");

  async function recarregar() {
    await marcarConcluidasAtingidas();
    setProgressos(listarProgressos(true));
    setInvestimentos(listarInvestimentos());
    setContas(listarContas());
    setPessoas(listarPessoas());
    setFolga(folgaMensalCerta());
  }

  useEffect(() => { void recarregar(); }, []);

  function limpar() {
    setNome(""); setValorAlvo(""); setValorInicial(""); setDataAlvo("");
    setInvestimentoId(""); setContaId(""); setPessoaId(""); setObservacoes("");
  }

  function abrirNovo() { setEditandoId(null); limpar(); setAberto(true); }

  function abrirEdicao(p: ProgressoMeta) {
    const m = p.meta;
    setEditandoId(m.id);
    setNome(m.nome); setValorAlvo(String(m.valor_alvo));
    setValorInicial(String(m.valor_inicial)); setDataAlvo(m.data_alvo ?? "");
    setInvestimentoId(m.investimento_id ?? ""); setContaId(m.conta_id ?? "");
    setPessoaId(m.pessoa_id ?? ""); setObservacoes(m.observacoes ?? "");
    setAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !valorAlvo) return;
    const dados = {
      nome: nome.trim(),
      valor_alvo: Number(valorAlvo),
      valor_inicial: valorInicial ? Number(valorInicial) : 0,
      data_alvo: dataAlvo || null,
      investimento_id: investimentoId || null,
      conta_id: investimentoId ? null : contaId || null,
      pessoa_id: pessoaId || null,
      observacoes: observacoes.trim() || null,
    };
    if (editandoId) await atualizarMeta(editandoId, dados);
    else await criarMeta(dados);
    setAberto(false);
    await recarregar();
  }

  async function handleExcluir(p: ProgressoMeta) {
    const ok = await confirmar({
      titulo: `Excluir a meta "${p.meta.nome}"?`,
      descricao: "O investimento vinculado e o dinheiro guardado não são afetados — só a meta some.",
    });
    if (!ok) return;
    await excluirMeta(p.meta.id);
    await recarregar();
  }

  const visiveis = progressos.filter((p) => mostrarConcluidas || p.meta.concluida === 0);
  const emAndamento = progressos.filter((p) => p.meta.concluida === 0);
  const totalNecessario = emAndamento.reduce((s, p) => s + (p.aporteMensalNecessario ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Metas"
        subtitle="Objetivos com valor e prazo. Amarrados a um investimento, o progresso se atualiza sozinho."
        actions={!somenteLeitura && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Nova meta</Button>
        )}
      />

      {emAndamento.length > 0 && totalNecessario > 0 && (
        <div className="section">
          <Card className={`meta-resumo ${folga > 0 && totalNecessario > folga ? "apertado" : ""}`}>
            <div>
              <span className="meta-resumo-label">Para cumprir todas as metas no prazo</span>
              <strong className="tabular">{formatarMoeda(totalNecessario)}/mês</strong>
            </div>
            <div>
              <span className="meta-resumo-label">Sua folga mensal projetada</span>
              <strong className={`tabular ${folga < totalNecessario ? "insuficiente" : ""}`}>
                {formatarMoeda(folga)}/mês
              </strong>
            </div>
            {folga > 0 && totalNecessario > folga && (
              <p className="meta-resumo-aviso">
                As metas juntas pedem mais do que sobra hoje. Não é impedimento —
                mas alguma vai precisar de mais prazo ou de um alvo menor.
              </p>
            )}
          </Card>
        </div>
      )}

      {progressos.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma meta ainda"
            description="Meta é um valor com prazo: trocar de carro em 2 anos, juntar a reserva de emergência, a entrada de um imóvel. Se você amarrar a meta a um investimento que já existe, ela se atualiza sozinha a cada aporte."
            action={!somenteLeitura && <Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Criar primeira meta</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="grid-2">
            {visiveis.map((p) => {
              const concluida = p.meta.concluida === 1 || p.faltam === 0;
              return (
                <Card key={p.meta.id} className={`meta-card ${concluida ? "concluida" : ""}`}>
                  <div className="meta-card-topo">
                    <span className="meta-icone"><Target size={16} /></span>
                    <div className="meta-titulo-bloco">
                      <h3 className="meta-nome">{p.meta.nome}</h3>
                      <span className="meta-fonte">
                        {p.fonte === "investimento" ? (
                          <><Link2 size={11} /> lê o saldo de {p.investimentoNome}</>
                        ) : p.fonte === "conta" ? (
                          <><Link2 size={11} /> soma os aportes da conta</>
                        ) : (
                          <><Hand size={11} /> valor atualizado à mão</>
                        )}
                      </span>
                    </div>
                    <Badge tone={TOM_RITMO[p.ritmo]}>{LABEL_RITMO[p.ritmo]}</Badge>
                  </div>

                  <div className="meta-valores">
                    <span className="meta-atual tabular">{formatarMoeda(p.valorAtual)}</span>
                    <span className="meta-alvo">de {formatarMoeda(p.meta.valor_alvo)}</span>
                  </div>

                  <div className="meta-barra-fundo">
                    <div
                      className={`meta-barra ${concluida ? "cheia" : ""}`}
                      style={{ width: `${Math.max(2, p.percentual)}%` }}
                    />
                  </div>

                  <div className="meta-linha-info">
                    <span>{p.percentual.toFixed(0)}%</span>
                    {p.meta.data_alvo && (
                      <span>{concluida ? formatarData(p.meta.data_alvo) : textoPrazo(p.diasRestantes)}</span>
                    )}
                  </div>

                  {!concluida && (
                    <div className="meta-rodape">
                      {p.aporteMensalNecessario !== null && p.aporteMensalNecessario > 0 ? (
                        <p className="meta-necessario">
                          Guardando <strong>{formatarMoeda(p.aporteMensalNecessario)}</strong> por mês, você chega no prazo.
                          {p.cabeNaFolga === false && (
                            <em> Isso é mais do que a sua folga mensal atual.</em>
                          )}
                          {p.cabeNaFolga === true && (
                            <em className="cabe"> Cabe na sua folga.</em>
                          )}
                        </p>
                      ) : (
                        <p className="meta-necessario">
                          Faltam <strong>{formatarMoeda(p.faltam)}</strong>.
                          {!p.meta.data_alvo && " Defina um prazo para saber quanto guardar por mês."}
                        </p>
                      )}
                    </div>
                  )}

                  {!somenteLeitura && (
                    <div className="meta-acoes">
                      <button className="icon-btn" title="Editar" onClick={() => abrirEdicao(p)}>
                        <Pencil size={15} />
                      </button>
                      <button className="icon-btn danger" title="Excluir" onClick={() => handleExcluir(p)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {progressos.some((p) => p.meta.concluida === 1) && (
            <button className="link-sutil meta-ver-concluidas" onClick={() => setMostrarConcluidas((v) => !v)}>
              {mostrarConcluidas ? "Esconder metas alcançadas" : `Ver metas alcançadas (${progressos.filter((p) => p.meta.concluida === 1).length})`}
            </button>
          )}
        </>
      )}

      <Drawer open={aberto} title={editandoId ? "Editar meta" : "Nova meta"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="O que você quer alcançar">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Reserva de emergência, entrada do apartamento" required />
          </Field>

          <div className="form-row-2">
            <Field label="Valor alvo">
              <Input type="number" step="0.01" value={valorAlvo} onChange={(e) => setValorAlvo(e.target.value)} required />
            </Field>
            <Field label="Prazo" hint="Sem prazo, o app não consegue calcular quanto guardar por mês.">
              <Input type="date" value={dataAlvo} min={hoje()} onChange={(e) => setDataAlvo(e.target.value)} />
            </Field>
          </div>

          <Field
            label="Ler o progresso de um investimento"
            hint="Esta é a opção que faz a meta se manter viva sozinha: o valor guardado passa a ser lido do saldo real daquele investimento, a cada aporte que você lançar."
          >
            <Select value={investimentoId} onChange={(e) => setInvestimentoId(e.target.value)}>
              <option value="">Não vincular — vou atualizar à mão</option>
              {investimentos.map((i) => (
                <option key={i.id} value={i.id}>{i.nome} ({formatarMoeda(i.valor_atual)})</option>
              ))}
            </Select>
          </Field>

          {!investimentoId && (
            <>
              <Field label="Ou somar os aportes de uma conta" hint="Conta só os lançamentos marcados com natureza 'investimento'.">
                <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
                  <option value="">Nenhuma</option>
                  {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>
              </Field>

              <Field label="Valor já guardado" hint="Ponto de partida, para metas que você começou antes de cadastrar aqui.">
                <Input type="number" step="0.01" value={valorInicial} onChange={(e) => setValorInicial(e.target.value)} />
              </Field>
            </>
          )}

          <Field label="Para quem">
            <Select value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
              <option value="">Ninguém em específico</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
          </Field>

          <Field label="Observações">
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </Field>

          <div className="page-actions">
            <Button type="button" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">{editandoId ? "Salvar" : "Criar meta"}</Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
