import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, GraduationCap } from "lucide-react";
import type { Documento, Pessoa } from "../../types/entities";
import { criarDocumento, atualizarDocumento, excluirDocumento, listarDocumentos } from "../documentos/documentosRepository";
import { listarPessoas } from "../pessoas/pessoasRepository";
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select, Textarea } from "../../components/ui";
import { AnexosSection } from "../../components/AnexosSection";
import { formatarData } from "../../utils/format";
import { confirmar } from "../../components/Confirm";

const CATEGORIA_EDUCACAO = "Educação";

export function EducacaoPage() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Documento | null>(null);

  const [nome, setNome] = useState("");
  const [pessoaId, setPessoaId] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const [dataConclusao, setDataConclusao] = useState("");
  const [numero, setNumero] = useState("");
  const [observacoes, setObservacoes] = useState("");

  function recarregar() {
    setDocumentos(listarDocumentos().filter((d) => d.categoria === CATEGORIA_EDUCACAO));
    setPessoas(listarPessoas());
  }

  useEffect(() => {
    recarregar();
  }, []);

  function abrirNovo() {
    setEditando(null);
    setNome(""); setPessoaId(""); setInstituicao(""); setDataConclusao(""); setNumero(""); setObservacoes("");
    setAberto(true);
  }

  function abrirEdicao(d: Documento) {
    setEditando(d);
    setNome(d.nome);
    setPessoaId(d.pessoa_id ?? "");
    setInstituicao(d.orgao_emissor ?? "");
    setDataConclusao(d.data_emissao ?? "");
    setNumero(d.numero ?? "");
    setObservacoes(d.observacoes ?? "");
    setAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    const dados = {
      nome: nome.trim(),
      categoria: CATEGORIA_EDUCACAO,
      pessoa_id: pessoaId || null,
      orgao_emissor: instituicao.trim() || null,
      data_emissao: dataConclusao || null,
      numero: numero.trim() || null,
      observacoes: observacoes.trim() || null,
    };
    if (editando) {
      await atualizarDocumento(editando.id, dados);
    } else {
      await criarDocumento(dados);
    }
    setAberto(false);
    recarregar();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir documento?", descricao: "Os arquivos anexados a ele também serão apagados." }))) return;
    await excluirDocumento(id);
    recarregar();
  }

  return (
    <div>
      <PageHeader
        title="Educação"
        subtitle="Diplomas, certificados e histórico escolar da família."
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Adicionar</Button>}
      />

      <Card>
        {documentos.length === 0 ? (
          <EmptyState
            title="Nenhum registro educacional ainda"
            description="Cadastre diplomas, certificados de curso e histórico escolar."
            action={<Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Adicionar</Button>}
          />
        ) : (
          <div className="list">
            {documentos.map((d) => {
              const pessoa = pessoas.find((p) => p.id === d.pessoa_id);
              return (
                <div key={d.id} className="list-row">
                  <div className="list-row-main">
                    <span className="list-row-title">
                      <GraduationCap size={14} style={{ marginRight: 6, verticalAlign: -2, color: "var(--text-muted)" }} />
                      {d.nome}
                    </span>
                    <span className="list-row-meta">
                      {d.orgao_emissor && <span>{d.orgao_emissor}</span>}
                      {pessoa && <Badge tone="muted">{pessoa.nome}</Badge>}
                      {d.data_emissao && <span>Concluído em {formatarData(d.data_emissao)}</span>}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="icon-btn" onClick={() => abrirEdicao(d)}><Pencil size={14} /></button>
                    <button className="icon-btn danger" onClick={() => handleExcluir(d.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Drawer open={aberto} title={editando ? "Editar registro" : "Adicionar registro educacional"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Curso / Diploma / Certificado">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ensino Médio, Engenharia, Curso de Excel..." autoFocus />
          </Field>
          <Field label="Instituição">
            <Input value={instituicao} onChange={(e) => setInstituicao(e.target.value)} />
          </Field>
          <div className="form-row-2">
            <Field label="Pessoa">
              <Select value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
                <option value="">Selecione</option>
                {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
            </Field>
            <Field label="Data de conclusão">
              <Input type="date" value={dataConclusao} onChange={(e) => setDataConclusao(e.target.value)} />
            </Field>
          </div>
          <Field label="Número do registro/diploma">
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
          </Field>
          <Field label="Observações">
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary">{editando ? "Salvar alterações" : "Salvar"}</Button>
          {editando ? (
            <AnexosSection entidadeTipo="documento" entidadeId={editando.id} />
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              Salve primeiro para poder anexar o diploma/certificado digitalizado.
            </p>
          )}
        </form>
      </Drawer>
    </div>
  );
}
