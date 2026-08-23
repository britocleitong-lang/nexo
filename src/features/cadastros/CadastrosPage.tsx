import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, EmptyState, Input, PageHeader } from "../../components/ui";
import {
  listarCategorias,
  criarCategoria,
  excluirCategoria,
} from "../financeiro/financeiroRepository";
import {
  listarOpcoes,
  criarOpcao,
  excluirOpcao,
  GRUPO_DOCUMENTO_CATEGORIA,
  GRUPO_EVENTO_TIPO,
  GRUPO_BEM_CATEGORIA,
} from "./opcoesRepository";
import type { Categoria } from "../../types/entities";
import type { Opcao } from "./opcoesRepository";
import { confirmar } from "../../components/Confirm";

type AbaCadastro = "receita" | "despesa" | "documento" | "evento" | "bem";

const ABAS: Array<{ id: AbaCadastro; label: string }> = [
  { id: "despesa", label: "Categorias de despesa" },
  { id: "receita", label: "Categorias de receita" },
  { id: "documento", label: "Categorias de documento" },
  { id: "evento", label: "Tipos de evento" },
  { id: "bem", label: "Categorias de bem" },
];

export function CadastrosPage() {
  const [aba, setAba] = useState<AbaCadastro>("despesa");

  return (
    <div>
      <PageHeader
        title="Cadastros"
        subtitle="Gerencie as classificações usadas nos formulários do sistema. Você também pode adicionar uma opção nova direto na hora de preencher, sem precisar vir aqui."
      />

      <div className="tabs">
        {ABAS.map((a) => (
          <button key={a.id} className={`tab ${aba === a.id ? "active" : ""}`} onClick={() => setAba(a.id)}>
            {a.label}
          </button>
        ))}
      </div>

      {(aba === "receita" || aba === "despesa") && <ListaCategoriasFinanceiras tipo={aba} />}
      {aba === "documento" && <ListaOpcoes grupo={GRUPO_DOCUMENTO_CATEGORIA} rotulo="categoria de documento" />}
      {aba === "evento" && <ListaOpcoes grupo={GRUPO_EVENTO_TIPO} rotulo="tipo de evento" />}
      {aba === "bem" && <ListaOpcoes grupo={GRUPO_BEM_CATEGORIA} rotulo="categoria de bem" />}
    </div>
  );
}

// --- Categorias financeiras (tabela categorias, com tipo receita/despesa) ---

function ListaCategoriasFinanceiras({ tipo }: { tipo: "receita" | "despesa" }) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [novoNome, setNovoNome] = useState("");

  function recarregar() {
    setCategorias(listarCategorias(tipo));
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    await criarCategoria(novoNome.trim(), tipo);
    setNovoNome("");
    recarregar();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir categoria?", descricao: "Os lançamentos que usavam essa categoria ficarão sem categoria." }))) return;
    await excluirCategoria(id);
    recarregar();
  }

  return (
    <div>
      <form className="cadastro-add-row" onSubmit={handleAdicionar}>
        <Input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder={`Nova categoria de ${tipo}...`}
        />
        <Button type="submit" variant="primary" icon={<Plus size={15} />}>Adicionar</Button>
      </form>

      <Card>
        {categorias.length === 0 ? (
          <EmptyState title="Nenhuma categoria cadastrada" />
        ) : (
          <div className="list">
            {categorias.map((c) => (
              <div key={c.id} className="list-row">
                <span className="list-row-title">{c.nome}</span>
                <button className="icon-btn danger" onClick={() => handleExcluir(c.id)} aria-label="Excluir">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// --- Listas genéricas (opcoes_personalizadas) --------------------------------

function ListaOpcoes({ grupo, rotulo }: { grupo: string; rotulo: string }) {
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [novoValor, setNovoValor] = useState("");

  function recarregar() {
    setOpcoes(listarOpcoes(grupo));
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupo]);

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoValor.trim()) return;
    await criarOpcao(grupo, novoValor.trim());
    setNovoValor("");
    recarregar();
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir opção?", descricao: "Essa ação não pode ser desfeita." }))) return;
    await excluirOpcao(id);
    recarregar();
  }

  return (
    <div>
      <form className="cadastro-add-row" onSubmit={handleAdicionar}>
        <Input value={novoValor} onChange={(e) => setNovoValor(e.target.value)} placeholder={`Nova ${rotulo}...`} />
        <Button type="submit" variant="primary" icon={<Plus size={15} />}>Adicionar</Button>
      </form>

      <Card>
        {opcoes.length === 0 ? (
          <EmptyState title="Nenhuma opção cadastrada" />
        ) : (
          <div className="list">
            {opcoes.map((o) => (
              <div key={o.id} className="list-row">
                <span className="list-row-title">{o.valor}</span>
                <button className="icon-btn danger" onClick={() => handleExcluir(o.id)} aria-label="Excluir">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
