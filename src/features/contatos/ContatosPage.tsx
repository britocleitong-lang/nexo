import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Phone, Mail, User } from "lucide-react";
import type { Contato, CategoriaContato, Pessoa } from "../../types/entities";
import { listarContatos, criarContato, atualizarContato, excluirContato, CATEGORIAS_CONTATO } from "./contatosRepository";
import { listarPessoas } from "../pessoas/pessoasRepository";
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select } from "../../components/ui";
import { confirmar } from "../../components/Confirm";

export function ContatosPage() {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Contato | null>(null);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<CategoriaContato>("medico");
  const [especialidade, setEspecialidade] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [pessoaId, setPessoaId] = useState("");

  function recarregar() {
    setContatos(listarContatos());
    setPessoas(listarPessoas());
  }

  useEffect(() => {
    recarregar();
  }, []);

  function abrirNovo() {
    setEditando(null);
    setNome(""); setCategoria("medico"); setEspecialidade(""); setEmpresa("");
    setTelefone(""); setEmail(""); setPessoaId("");
    setAberto(true);
  }

  function abrirEdicao(c: Contato) {
    setEditando(c);
    setNome(c.nome);
    setCategoria(c.categoria);
    setEspecialidade(c.especialidade ?? "");
    setEmpresa(c.empresa ?? "");
    setTelefone(c.telefone ?? "");
    setEmail(c.email ?? "");
    setPessoaId(c.pessoa_id ?? "");
    setAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    const dados = {
      nome: nome.trim(),
      categoria,
      especialidade: especialidade.trim() || null,
      empresa: empresa.trim() || null,
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      pessoa_id: pessoaId || null,
    };
    if (editando) {
      await atualizarContato(editando.id, dados);
    } else {
      await criarContato(dados);
    }
    setAberto(false);
    recarregar();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir contato?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirContato(id);
    recarregar();
  }

  return (
    <div>
      <PageHeader
        title="Contatos"
        subtitle="Médico, mecânico, contador e outros profissionais que cuidam da sua vida."
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Adicionar contato</Button>}
      />

      <Card>
        {contatos.length === 0 ? (
          <EmptyState title="Nenhum contato cadastrado" description="Cadastre médico, mecânico, contador e outros profissionais importantes." />
        ) : (
          <div className="list">
            {contatos.map((c) => {
              const pessoa = pessoas.find((p) => p.id === c.pessoa_id);
              return (
                <div key={c.id} className="list-row">
                  <div className="list-row-main">
                    <span className="list-row-title">
                      <User size={14} style={{ marginRight: 6, verticalAlign: -2, color: "var(--text-muted)" }} />
                      {c.nome}
                    </span>
                    <span className="list-row-meta">
                      <Badge tone="muted">{CATEGORIAS_CONTATO.find((cat) => cat.valor === c.categoria)?.label}</Badge>
                      {c.especialidade && <span>{c.especialidade}</span>}
                      {c.empresa && <span>{c.empresa}</span>}
                      {c.telefone && <span><Phone size={11} style={{ verticalAlign: -1 }} /> {c.telefone}</span>}
                      {c.email && <span><Mail size={11} style={{ verticalAlign: -1 }} /> {c.email}</span>}
                      {pessoa && <span>{pessoa.nome}</span>}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="icon-btn" onClick={() => abrirEdicao(c)}><Pencil size={14} /></button>
                    <button className="icon-btn danger" onClick={() => handleExcluir(c.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Drawer open={aberto} title={editando ? "Editar contato" : "Adicionar contato"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Field>
          <Field label="Categoria">
            <Select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaContato)}>
              {CATEGORIAS_CONTATO.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
            </Select>
          </Field>
          <div className="form-row-2">
            <Field label="Especialidade"><Input value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} placeholder="Cardiologista, funilaria..." /></Field>
            <Field label="Empresa/Clínica"><Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} /></Field>
          </div>
          <div className="form-row-2">
            <Field label="Telefone"><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Field>
            <Field label="E-mail"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          </div>
          <Field label="Pessoa relacionada">
            <Select value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
              <option value="">Nenhuma específica</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
          </Field>
          <Button type="submit" variant="primary">{editando ? "Salvar alterações" : "Salvar"}</Button>
        </form>
      </Drawer>
    </div>
  );
}
