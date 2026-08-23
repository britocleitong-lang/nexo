import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Eye, EyeOff, Copy, Check, Lock, Unlock, RefreshCw, KeyRound, ExternalLink } from "lucide-react";
import type { SenhaGuardada, Pessoa } from "../../types/entities";
import { listarSenhas, criarSenha, atualizarSenha, excluirSenha, revelarSenha, CATEGORIAS_SENHA } from "./senhasRepository";
import { listarPessoas } from "../pessoas/pessoasRepository";
import {
  cofreJaConfigurado, cofreDestrancado, configurarCofre, destrancarCofre, trancarCofre,
  gerarSenha, forcaSenha,
} from "../../utils/cofre";
import { confirmar } from "../../components/Confirm";
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select, Textarea } from "../../components/ui";
import "./SenhasPage.css";

export function SenhasPage() {
  const [destrancado, setDestrancado] = useState(cofreDestrancado());

  if (!destrancado) {
    return <PortaDoCofre onAbrir={() => setDestrancado(true)} />;
  }
  return <CofreAberto onTrancar={() => { trancarCofre(); setDestrancado(false); }} />;
}

// --- Porta: definir ou digitar a senha-mestra --------------------------------

function PortaDoCofre({ onAbrir }: { onAbrir: () => void }) {
  const configurado = cofreJaConfigurado();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!senha) return;

    setOcupado(true);
    try {
      if (configurado) {
        const ok = await destrancarCofre(senha);
        if (!ok) { setErro("Senha-mestra incorreta."); return; }
      } else {
        if (senha.length < 8) { setErro("Use pelo menos 8 caracteres na senha-mestra."); return; }
        if (senha !== confirmacao) { setErro("As duas senhas não coincidem."); return; }
        await configurarCofre(senha);
      }
      onAbrir();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Senhas"
        subtitle="Guarde suas senhas cifradas neste dispositivo."
      />
      <div className="cofre-porta">
        <Card>
          <form className="cofre-porta-form" onSubmit={handleSubmit}>
            <div className="cofre-cadeado"><KeyRound size={22} /></div>
            <h2 className="cofre-porta-titulo">
              {configurado ? "Cofre trancado" : "Criar sua senha-mestra"}
            </h2>
            <p className="cofre-porta-texto">
              {configurado
                ? "Digite a senha-mestra para abrir o cofre. Ela não fica salva — ao recarregar a página, o cofre tranca de novo."
                : "Suas senhas serão cifradas com AES-256 usando esta senha-mestra. Ela não é gravada em lugar nenhum."}
            </p>

            <Field label="Senha-mestra">
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoFocus
                autoComplete={configurado ? "current-password" : "new-password"}
              />
            </Field>

            {!configurado && (
              <Field label="Repita a senha-mestra">
                <Input
                  type="password"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
            )}

            {erro && <p className="cofre-erro">{erro}</p>}

            {!configurado && (
              <p className="cofre-aviso">
                <strong>Guarde esta senha em lugar seguro.</strong> Se você esquecê-la, não há como recuperar
                o que estiver no cofre — nem por mim, nem por ninguém. Uma forma de recuperar seria também
                uma forma de outra pessoa entrar sem a senha.
              </p>
            )}

            <Button type="submit" variant="primary" icon={<Unlock size={15} />} disabled={ocupado}>
              {configurado ? "Abrir cofre" : "Criar cofre"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

// --- Cofre aberto -------------------------------------------------------------

function CofreAberto({ onTrancar }: { onTrancar: () => void }) {
  const [itens, setItens] = useState<SenhaGuardada[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<SenhaGuardada | null>(null);
  const [reveladas, setReveladas] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [url, setUrl] = useState("");
  const [categoria, setCategoria] = useState("Outro");
  const [pessoaId, setPessoaId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [mostrarSenhaForm, setMostrarSenhaForm] = useState(false);

  function recarregar() {
    setItens(listarSenhas());
    setPessoas(listarPessoas());
  }

  useEffect(() => { recarregar(); }, []);

  function abrirNovo() {
    setEditando(null);
    setTitulo(""); setUsuario(""); setSenha(""); setUrl("");
    setCategoria("Outro"); setPessoaId(""); setObservacoes("");
    setMostrarSenhaForm(false);
    setAberto(true);
  }

  function abrirEdicao(s: SenhaGuardada) {
    setEditando(s);
    setTitulo(s.titulo); setUsuario(s.usuario ?? ""); setSenha("");
    setUrl(s.url ?? ""); setCategoria(s.categoria ?? "Outro");
    setPessoaId(s.pessoa_id ?? ""); setObservacoes(s.observacoes ?? "");
    setMostrarSenhaForm(false);
    setAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    const dados = {
      titulo: titulo.trim(),
      usuario: usuario.trim() || null,
      url: url.trim() || null,
      categoria,
      pessoa_id: pessoaId || null,
      observacoes: observacoes.trim() || null,
    };
    if (editando) {
      await atualizarSenha(editando.id, { ...dados, senha });
    } else {
      if (!senha) return;
      await criarSenha({ ...dados, senha });
    }
    setAberto(false);
    recarregar();
  }

  async function handleExcluir(s: SenhaGuardada) {
    if (!(await confirmar({ titulo: "Excluir senha?", descricao: `"${s.titulo}" será removido do cofre. Essa ação não pode ser desfeita.` }))) return;
    await excluirSenha(s.id);
    setReveladas((r) => { const c = { ...r }; delete c[s.id]; return c; });
    recarregar();
  }

  async function alternarRevelar(s: SenhaGuardada) {
    if (reveladas[s.id]) {
      setReveladas((r) => { const c = { ...r }; delete c[s.id]; return c; });
      return;
    }
    const aberta = await revelarSenha(s);
    setReveladas((r) => ({ ...r, [s.id]: aberta }));
  }

  async function copiar(s: SenhaGuardada) {
    const valor = reveladas[s.id] ?? (await revelarSenha(s));
    await navigator.clipboard.writeText(valor);
    setCopiado(s.id);
    setTimeout(() => setCopiado((c) => (c === s.id ? null : c)), 1800);
  }

  const filtrados = itens.filter((s) => {
    const t = busca.toLowerCase().trim();
    if (!t) return true;
    return [s.titulo, s.usuario, s.url, s.categoria].some((v) => v?.toLowerCase().includes(t));
  });

  const forca = senha ? forcaSenha(senha) : null;

  return (
    <div>
      <PageHeader
        title="Senhas"
        subtitle="Cifradas com AES-256 neste dispositivo. O cofre tranca sozinho ao recarregar a página."
        actions={
          <>
            <Button variant="secondary" icon={<Lock size={15} />} onClick={onTrancar}>Trancar</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Nova senha</Button>
          </>
        }
      />

      {itens.length > 0 && (
        <div className="section">
          <Input placeholder="Buscar por título, usuário ou site..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      )}

      <Card>
        {filtrados.length === 0 ? (
          <EmptyState
            title={itens.length === 0 ? "Cofre vazio" : "Nada encontrado"}
            description={itens.length === 0 ? "Guarde aqui as senhas que você não quer deixar anotadas em qualquer lugar." : "Tente outro termo de busca."}
            action={itens.length === 0 ? <Button variant="primary" icon={<Plus size={16} />} onClick={abrirNovo}>Nova senha</Button> : undefined}
          />
        ) : (
          <div className="list">
            {filtrados.map((s) => {
              const pessoa = pessoas.find((p) => p.id === s.pessoa_id);
              return (
                <div key={s.id} className="list-row">
                  <div className="list-row-main">
                    <span className="list-row-title">{s.titulo}</span>
                    <span className="list-row-meta">
                      {s.categoria && <Badge tone="muted">{s.categoria}</Badge>}
                      {s.usuario && <span>{s.usuario}</span>}
                      {pessoa && <span>{pessoa.nome}</span>}
                      {s.url && (
                        <a href={s.url.startsWith("http") ? s.url : `https://${s.url}`} target="_blank" rel="noreferrer" className="senha-link">
                          {s.url} <ExternalLink size={11} />
                        </a>
                      )}
                    </span>
                    {reveladas[s.id] && <code className="senha-revelada">{reveladas[s.id]}</code>}
                  </div>
                  <div className="list-row-actions">
                    <button className="icon-btn" onClick={() => alternarRevelar(s)} aria-label={reveladas[s.id] ? "Ocultar" : "Revelar"}>
                      {reveladas[s.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button className="icon-btn" onClick={() => copiar(s)} aria-label="Copiar senha">
                      {copiado === s.id ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                    <button className="icon-btn" onClick={() => abrirEdicao(s)} aria-label="Editar"><Pencil size={14} /></button>
                    <button className="icon-btn danger" onClick={() => handleExcluir(s)} aria-label="Excluir"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Drawer open={aberto} title={editando ? "Editar senha" : "Nova senha"} onClose={() => setAberto(false)}>
        <form className="form-grid" onSubmit={handleSalvar}>
          <Field label="Título"><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Banco Itaú, Gmail pessoal..." autoFocus /></Field>
          <Field label="Usuário / e-mail"><Input value={usuario} onChange={(e) => setUsuario(e.target.value)} /></Field>

          <Field label={editando ? "Nova senha (deixe em branco para manter)" : "Senha"}>
            <div className="senha-campo">
              <Input
                type={mostrarSenhaForm ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="new-password"
              />
              <button type="button" className="icon-btn" onClick={() => setMostrarSenhaForm((v) => !v)} aria-label="Mostrar senha">
                {mostrarSenhaForm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <button type="button" className="icon-btn" onClick={() => { setSenha(gerarSenha()); setMostrarSenhaForm(true); }} aria-label="Gerar senha forte">
                <RefreshCw size={15} />
              </button>
            </div>
          </Field>

          {forca && (
            <div className={`senha-forca nivel-${forca.nivel}`}>
              <div className="senha-forca-barra"><span /></div>
              <span>{forca.rotulo}</span>
            </div>
          )}

          <div className="form-row-2">
            <Field label="Site"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="itau.com.br" /></Field>
            <Field label="Categoria">
              <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {CATEGORIAS_SENHA.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Pessoa">
            <Select value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
              <option value="">Nenhuma específica</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
          </Field>

          <Field label="Observações"><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></Field>
          <Button type="submit" variant="primary">{editando ? "Salvar alterações" : "Salvar"}</Button>
        </form>
      </Drawer>
    </div>
  );
}
