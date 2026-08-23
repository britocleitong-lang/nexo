import { useEffect, useState } from "react";
import { Plus, Trash2, UserRound, Pencil } from "lucide-react";
import type { Pessoa } from "../../types/entities";
import { criarPessoa, atualizarPessoa, excluirPessoa, listarPessoas } from "./pessoasRepository";
import { Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Textarea } from "../../components/ui";
import { formatarData } from "../../utils/format";
import { confirmar } from "../../components/Confirm";

export function PessoasPage() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Pessoa | null>(null);
  const [nome, setNome] = useState("");
  const [parentesco, setParentesco] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  function recarregar() {
    setPessoas(listarPessoas());
  }

  useEffect(() => {
    recarregar();
  }, []);

  function abrirNovo() {
    setEditando(null);
    setNome("");
    setParentesco("");
    setNascimento("");
    setObservacoes("");
    setAberto(true);
  }

  function abrirEdicao(p: Pessoa) {
    setEditando(p);
    setNome(p.nome);
    setParentesco(p.parentesco ?? "");
    setNascimento(p.data_nascimento ?? "");
    setObservacoes(p.observacoes ?? "");
    setAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    const dados = {
      nome: nome.trim(),
      parentesco: parentesco.trim() || undefined,
      data_nascimento: nascimento || undefined,
      observacoes: observacoes.trim() || undefined,
    };
    if (editando) {
      await atualizarPessoa(editando.id, dados);
    } else {
      await criarPessoa(dados);
    }
    setAberto(false);
    recarregar();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir pessoa?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirPessoa(id);
    recarregar();
  }

  return (
    <div>
      <PageHeader
        title="Família"
        subtitle="Pessoas que compartilham documentos, saúde, veículos e finanças com você."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>
            Adicionar pessoa
          </Button>
        }
      />

      <Card>
        {pessoas.length === 0 ? (
          <EmptyState
            title="Nenhuma pessoa cadastrada ainda"
            description="Adicione você mesmo e os demais membros da família para começar a relacionar documentos, saúde e mais."
            action={
              <Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>
                Adicionar pessoa
              </Button>
            }
          />
        ) : (
          <div className="list">
            {pessoas.map((p) => (
              <div key={p.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title">
                    <UserRound size={14} style={{ marginRight: 6, verticalAlign: -2, color: "var(--text-muted)" }} />
                    {p.nome}
                  </span>
                  <span className="list-row-meta">
                    {p.parentesco && <span>{p.parentesco}</span>}
                    {p.data_nascimento && <span>Nascimento: {formatarData(p.data_nascimento)}</span>}
                  </span>
                </div>
                <div className="list-row-actions">
                  <button className="icon-btn" onClick={() => abrirEdicao(p)} aria-label="Editar">
                    <Pencil size={14} />
                  </button>
                  <button className="icon-btn danger" onClick={() => handleExcluir(p.id)} aria-label="Excluir">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Drawer open={aberto} title={editando ? "Editar pessoa" : "Adicionar pessoa"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Nome">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" autoFocus />
          </Field>
          <Field label="Parentesco">
            <Input
              value={parentesco}
              onChange={(e) => setParentesco(e.target.value)}
              placeholder="Titular, cônjuge, filho(a)..."
            />
          </Field>
          <Field label="Data de nascimento">
            <Input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} />
          </Field>
          <Field label="Observações">
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary">
            {editando ? "Salvar alterações" : "Salvar"}
          </Button>
        </form>
      </Drawer>
    </div>
  );
}
