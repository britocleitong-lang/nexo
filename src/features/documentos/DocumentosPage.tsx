import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, FileText, Paperclip, ArrowLeft, Check, Search, Download, ExternalLink, History } from "lucide-react";
import type { Documento, Pessoa } from "../../types/entities";
import { criarDocumento, atualizarDocumento, excluirDocumento, listarDocumentos } from "./documentosRepository";
import { listarPessoas } from "../pessoas/pessoasRepository";
import { contarAnexos, listarAnexos, abrirAnexo, baixarAnexo } from "../anexos/anexosRepository";
import { TIPOS_DOCUMENTO_BR, GRUPOS_DOCUMENTO } from "./tiposDocumento";
import { confirmar } from "../../components/Confirm";
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select, Textarea } from "../../components/ui";
import { AnexosSection } from "../../components/AnexosSection";
import { diasAte, formatarData } from "../../utils/format";
import { obterDiasAlerta } from "../../utils/configuracoes";
import { VersoesDrawer } from "./VersoesDrawer";
import { versoesDo } from "./versoesRepository";
import "./DocumentosPage.css";

const SEM_PESSOA = "__sem_pessoa__";

function statusVencimento(dataValidade: string | null) {
  if (!dataValidade) return null;
  const dias = diasAte(dataValidade);
  if (dias === null) return null;
  const alerta = obterDiasAlerta();
  if (dias < 0) return { label: `Vencido há ${Math.abs(dias)}d`, tone: "danger" as const };
  if (dias <= alerta) return { label: `Vence em ${dias}d`, tone: "warn" as const };
  return { label: `Válido até ${formatarData(dataValidade)}`, tone: "muted" as const };
}

export function DocumentosPage() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [selecionada, setSelecionada] = useState<string | null>(null);

  function recarregar() {
    setPessoas(listarPessoas());
    setDocumentos(listarDocumentos());
  }

  useEffect(() => { recarregar(); }, []);

  if (selecionada) {
    const pessoa = pessoas.find((p) => p.id === selecionada) ?? null;
    return (
      <DocumentosDaPessoa
        pessoa={pessoa}
        documentos={documentos.filter((d) => (selecionada === SEM_PESSOA ? !d.pessoa_id : d.pessoa_id === selecionada))}
        onVoltar={() => setSelecionada(null)}
        onMudou={recarregar}
      />
    );
  }

  const semPessoa = documentos.filter((d) => !d.pessoa_id);

  return (
    <div>
      <PageHeader title="Documentos" subtitle="Escolha de quem você quer ver os documentos." />

      {pessoas.length === 0 && semPessoa.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma pessoa cadastrada ainda"
            description="Os documentos ficam organizados por pessoa. Cadastre você e sua família em Família para começar."
          />
        </Card>
      ) : (
        <div className="grid-3">
          {pessoas.map((p) => {
            const docs = documentos.filter((d) => d.pessoa_id === p.id);
            const vencendo = docs.filter((d) => {
              const dias = diasAte(d.data_validade);
              return dias !== null && dias <= obterDiasAlerta();
            }).length;
            return (
              <Card key={p.id} className="pessoa-card">
                <button className="pessoa-card-body" onClick={() => setSelecionada(p.id)}>
                  <span className="pessoa-avatar">{p.nome.charAt(0).toUpperCase()}</span>
                  <span className="pessoa-nome">{p.nome}</span>
                  <span className="pessoa-contagem">
                    {docs.length === 0 ? "Nenhum documento" : `${docs.length} ${docs.length === 1 ? "documento" : "documentos"}`}
                  </span>
                  {vencendo > 0 && <Badge tone="warn">{vencendo} vencendo</Badge>}
                </button>
              </Card>
            );
          })}

          {semPessoa.length > 0 && (
            <Card className="pessoa-card">
              <button className="pessoa-card-body" onClick={() => setSelecionada(SEM_PESSOA)}>
                <span className="pessoa-avatar sem-dono"><FileText size={18} /></span>
                <span className="pessoa-nome">Sem pessoa definida</span>
                <span className="pessoa-contagem">{semPessoa.length} documento(s)</span>
              </button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function DocumentosDaPessoa({
  pessoa, documentos, onVoltar, onMudou,
}: {
  pessoa: Pessoa | null;
  documentos: Documento[];
  onVoltar: () => void;
  onMudou: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Documento | null>(null);
  const [versoesDe, setVersoesDe] = useState<Documento | null>(null);
  const [mostrarPendentes, setMostrarPendentes] = useState(true);
  const [vendo, setVendo] = useState<Documento | null>(null);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("Identificação");
  const [dataEmissao, setDataEmissao] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [numero, setNumero] = useState("");
  const [orgaoEmissor, setOrgaoEmissor] = useState("");
  const [observacoes, setObservacoes] = useState("");

  function abrirNovo(tipoSugerido?: { nome: string; grupo: string }) {
    setEditando(null);
    setNome(tipoSugerido?.nome ?? "");
    setCategoria(tipoSugerido?.grupo ?? "Identificação");
    setDataEmissao(""); setDataValidade(""); setNumero(""); setOrgaoEmissor(""); setObservacoes("");
    setAberto(true);
  }

  function abrirEdicao(d: Documento) {
    setEditando(d);
    setNome(d.nome);
    setCategoria(d.categoria);
    setDataEmissao(d.data_emissao ?? "");
    setDataValidade(d.data_validade ?? "");
    setNumero(d.numero ?? "");
    setOrgaoEmissor(d.orgao_emissor ?? "");
    setObservacoes(d.observacoes ?? "");
    setAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    const dados = {
      nome: nome.trim(),
      categoria,
      pessoa_id: pessoa?.id ?? null,
      data_emissao: dataEmissao || null,
      data_validade: dataValidade || null,
      numero: numero.trim() || null,
      orgao_emissor: orgaoEmissor.trim() || null,
      observacoes: observacoes.trim() || null,
    };
    if (editando) await atualizarDocumento(editando.id, dados);
    else await criarDocumento(dados);
    setAberto(false);
    onMudou();
  }

  async function handleExcluir(d: Documento) {
    if (!(await confirmar({ titulo: "Excluir documento?", descricao: "Os arquivos anexados a ele também serão apagados." }))) return;
    await excluirDocumento(d.id);
    onMudou();
  }

  const faltando = useMemo(() => {
    const existentes = new Set(documentos.map((d) => d.nome.toLowerCase().trim()));
    return TIPOS_DOCUMENTO_BR.filter((t) => !existentes.has(t.nome.toLowerCase()));
  }, [documentos]);

  return (
    <div>
      <button className="voltar-link" onClick={onVoltar}><ArrowLeft size={15} /> Todas as pessoas</button>

      <PageHeader
        title={pessoa ? pessoa.nome : "Sem pessoa definida"}
        subtitle={`${documentos.length} cadastrado(s) · ${faltando.length} pendente(s) na lista de referência`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setMostrarPendentes((v) => !v)}>
              {mostrarPendentes ? "Ocultar pendentes" : `Mostrar pendentes (${faltando.length})`}
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => abrirNovo()}>Adicionar</Button>
          </>
        }
      />

      <Card>
        {documentos.length === 0 && !mostrarPendentes ? (
          <EmptyState
            title="Nenhum documento cadastrado ainda"
            description="Ative “Mostrar pendentes” para ver a lista dos documentos mais comuns no Brasil e preencher direto daqui."
            action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => abrirNovo()}>Adicionar documento</Button>}
          />
        ) : (
          <div className="list">
            {documentos.map((d) => {
              const status = statusVencimento(d.data_validade);
              const anexos = contarAnexos("documento", d.id);
              const completo = anexos > 0;
              return (
                <div key={d.id} className={`list-row doc-linha ${completo ? "completo" : "incompleto"}`}>
                  <span className="doc-marca" />
                  <div className="list-row-main">
                    <span className="list-row-title">{d.nome}</span>
                    <span className="list-row-meta">
                      <Badge tone="muted">{d.categoria}</Badge>
                      {d.numero && <span>nº {d.numero}</span>}
                      {d.orgao_emissor && <span>{d.orgao_emissor}</span>}
                      {anexos > 0
                        ? <span className="doc-com-anexo"><Paperclip size={11} /> {anexos} arquivo(s)</span>
                        : <span className="doc-sem-anexo">sem arquivo anexado</span>}
                      {/* Só aparece quando há mais de uma: num documento que
                          nunca foi renovado, "1 versão" seria ruído. */}
                      {versoesDo(d.id).length > 1 && (
                        <span className="doc-versoes"><History size={11} /> {versoesDo(d.id).length} versões</span>
                      )}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {status && <Badge tone={status.tone}>{status.label}</Badge>}
                    <button className="icon-btn" onClick={() => setVendo(d)} aria-label="Ver detalhes"><Search size={15} /></button>
                    <button className="icon-btn" onClick={() => setVersoesDe(d)} aria-label="Histórico de versões" title="Histórico de versões"><History size={15} /></button>
                    <button className="icon-btn" onClick={() => abrirEdicao(d)} aria-label="Editar"><Pencil size={14} /></button>
                    <button className="icon-btn danger" onClick={() => handleExcluir(d)} aria-label="Excluir"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}

            {/* Pendentes: não existem no banco ainda — são a lista de referência
                do que costuma existir no Brasil, mostrada apagada até você
                preencher. Evita criar dezenas de registros vazios. */}
            {mostrarPendentes && faltando.map((t) => (
              <button key={t.nome} className="list-row doc-linha pendente" onClick={() => abrirNovo(t)} title={t.dica}>
                <span className="doc-marca" />
                <div className="list-row-main">
                  <span className="list-row-title">{t.nome}</span>
                  <span className="list-row-meta">
                    <Badge tone="muted">{t.grupo}</Badge>
                    <span>{t.dica ?? "ainda não cadastrado"}</span>
                  </span>
                </div>
                <span className="doc-pendente-acao"><Plus size={13} /> cadastrar</span>
              </button>
            ))}

            {mostrarPendentes && faltando.length === 0 && (
              <div className="checklist-completo"><Check size={16} /> Todos os documentos da lista de referência já estão cadastrados.</div>
            )}
          </div>
        )}
      </Card>

      <Drawer open={!!vendo} title={vendo?.nome ?? ""} onClose={() => setVendo(null)}>
        {vendo && <DetalheDocumento documento={vendo} />}
      </Drawer>

      <Drawer open={aberto} title={editando ? "Editar documento" : "Adicionar documento"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Nome do documento">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} list="tipos-doc-br" autoFocus />
          </Field>
          <datalist id="tipos-doc-br">
            {TIPOS_DOCUMENTO_BR.map((t) => <option key={t.nome} value={t.nome} />)}
          </datalist>

          <Field label="Categoria">
            <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {GRUPOS_DOCUMENTO.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
          </Field>

          <div className="form-row-2">
            <Field label="Emissão"><Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} /></Field>
            <Field label="Validade"><Input type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} /></Field>
          </div>
          <div className="form-row-2">
            <Field label="Número"><Input value={numero} onChange={(e) => setNumero(e.target.value)} /></Field>
            <Field label="Órgão emissor"><Input value={orgaoEmissor} onChange={(e) => setOrgaoEmissor(e.target.value)} /></Field>
          </div>
          <Field label="Observações"><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></Field>

          <Button type="submit" variant="primary">{editando ? "Salvar alterações" : "Salvar"}</Button>
          {editando ? (
            <AnexosSection entidadeTipo="documento" entidadeId={editando.id} />
          ) : (
            <p style={{ fontSize: "var(--size-small)", color: "var(--text-muted)", margin: 0 }}>
              Salve o documento primeiro para poder anexar o arquivo digitalizado.
            </p>
          )}
        </form>
      </Drawer>

      <VersoesDrawer
        aberto={versoesDe !== null}
        documentoId={versoesDe?.id ?? null}
        documentoNome={versoesDe?.nome ?? ""}
        onFechar={() => setVersoesDe(null)}
        onMudou={onMudou}
      />
    </div>
  );
}

// --- Detalhe: ver informações e baixar o arquivo -----------------------------

function DetalheDocumento({ documento }: { documento: Documento }) {
  const anexos = listarAnexos("documento", documento.id);
  const linhas: Array<[string, string | null]> = [
    ["Categoria", documento.categoria],
    ["Número", documento.numero],
    ["Órgão emissor", documento.orgao_emissor],
    ["Emissão", documento.data_emissao ? formatarData(documento.data_emissao) : null],
    ["Validade", documento.data_validade ? formatarData(documento.data_validade) : null],
    ["Observações", documento.observacoes],
  ];

  return (
    <div className="doc-detalhe">
      <dl className="doc-detalhe-lista">
        {linhas.filter(([, v]) => v).map(([rotulo, valor]) => (
          <div key={rotulo} className="doc-detalhe-linha">
            <dt>{rotulo}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>

      <h3 className="section-title" style={{ marginTop: "var(--space-5)" }}>Arquivos</h3>
      {anexos.length === 0 ? (
        <p className="anexos-vazio">Nenhum arquivo anexado a este documento.</p>
      ) : (
        <div className="list">
          {anexos.map((a) => (
            <div key={a.id} className="list-row" style={{ paddingInline: 0 }}>
              <div className="list-row-main">
                <span className="list-row-title">{a.nome_arquivo}</span>
                <span className="list-row-meta">{a.tipo_mime ?? "arquivo"}</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="icon-btn" onClick={() => abrirAnexo(a.id)} aria-label="Abrir"><ExternalLink size={15} /></button>
                <button className="icon-btn" onClick={() => baixarAnexo(a.id, a.nome_arquivo)} aria-label="Baixar"><Download size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
