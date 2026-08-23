import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import type { Pessoa } from "../types/entities";
import {
  pessoaPrincipal, criarPerfilPrincipal, atualizarPessoa, idadeDe,
} from "../features/pessoas/pessoasRepository";
import { Button, Drawer, Field, Input, Textarea } from "./ui";
import { LogoNexo } from "./LogoNexo";
import "./PerfilTopo.css";

/**
 * Topo da barra lateral: em vez do nome do produto, mostra quem está
 * usando. Clicar abre o perfil pra editar.
 *
 * A foto é guardada como data URL dentro do próprio banco, então ela vai
 * junto no backup — sem depender de arquivo externo que pode sumir.
 */
export function PerfilTopo() {
  const [perfil, setPerfil] = useState<Pessoa | null>(null);
  const [aberto, setAberto] = useState(false);

  function recarregar() { setPerfil(pessoaPrincipal()); }
  useEffect(() => { recarregar(); }, []);

  const idade = perfil ? idadeDe(perfil) : null;

  return (
    <>
      <button className="perfil-topo" onClick={() => setAberto(true)} title="Ver e editar perfil">
        {perfil?.foto ? (
          <img className="perfil-foto" src={perfil.foto} alt="" />
        ) : perfil ? (
          <span className="perfil-inicial">{perfil.nome.charAt(0).toUpperCase()}</span>
        ) : (
          <LogoNexo tamanho={34} />
        )}
        <span className="perfil-texto">
          <span className="perfil-nome">{perfil ? perfil.nome.split(" ")[0] : "Nexo"}</span>
          <span className="perfil-detalhe">
            {perfil ? (idade !== null ? `${idade} anos` : perfil.profissao ?? "Ver perfil") : "Criar seu perfil"}
          </span>
        </span>
      </button>

      <PerfilDrawer
        aberto={aberto}
        perfil={perfil}
        onClose={() => setAberto(false)}
        onSalvo={() => { setAberto(false); recarregar(); }}
      />
    </>
  );
}

function PerfilDrawer({
  aberto, perfil, onClose, onSalvo,
}: {
  aberto: boolean; perfil: Pessoa | null; onClose: () => void; onSalvo: () => void;
}) {
  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [profissao, setProfissao] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberto) return;
    setNome(perfil?.nome ?? "");
    setDataNascimento(perfil?.data_nascimento ?? "");
    setProfissao(perfil?.profissao ?? "");
    setEmail(perfil?.email ?? "");
    setTelefone(perfil?.telefone ?? "");
    setObservacoes(perfil?.observacoes ?? "");
    setFoto(perfil?.foto ?? null);
    setErro(null);
  }, [aberto, perfil]);

  /** Reduz a imagem antes de guardar — foto de celular tem vários MB. */
  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro(null);
    try {
      const bitmap = await createImageBitmap(arquivo);
      const lado = 256;
      const canvas = document.createElement("canvas");
      canvas.width = lado; canvas.height = lado;
      const ctx = canvas.getContext("2d")!;
      // recorte quadrado central, pra foto não distorcer no círculo
      const menor = Math.min(bitmap.width, bitmap.height);
      ctx.drawImage(
        bitmap,
        (bitmap.width - menor) / 2, (bitmap.height - menor) / 2, menor, menor,
        0, 0, lado, lado,
      );
      setFoto(canvas.toDataURL("image/jpeg", 0.82));
    } catch {
      setErro("Não consegui ler essa imagem. Tente um JPG ou PNG.");
    }
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setErro("Informe pelo menos o seu nome."); return; }
    const dados = {
      nome: nome.trim(),
      data_nascimento: dataNascimento || null,
      profissao: profissao.trim() || null,
      email: email.trim() || null,
      telefone: telefone.trim() || null,
      observacoes: observacoes.trim() || null,
      foto,
    };
    if (perfil) await atualizarPessoa(perfil.id, dados);
    else await criarPerfilPrincipal(dados);
    onSalvo();
  }

  return (
    <Drawer open={aberto} title={perfil ? "Seu perfil" : "Criar seu perfil"} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSalvar}>
        <div className="perfil-foto-editor">
          <div className="perfil-foto-preview">
            {foto ? <img src={foto} alt="" /> : <span>{nome ? nome.charAt(0).toUpperCase() : "?"}</span>}
          </div>
          <div className="perfil-foto-acoes">
            <Button type="button" variant="secondary" icon={<Camera size={14} />} onClick={() => inputFoto.current?.click()}>
              {foto ? "Trocar foto" : "Escolher foto"}
            </Button>
            {foto && (
              <Button type="button" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setFoto(null)}>
                Remover
              </Button>
            )}
            <input ref={inputFoto} type="file" accept="image/*" hidden onChange={aoEscolherFoto} />
          </div>
        </div>

        <Field label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Field>
        <div className="form-row-2">
          <Field label="Data de nascimento"><Input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} /></Field>
          <Field label="Profissão"><Input value={profissao} onChange={(e) => setProfissao(e.target.value)} /></Field>
        </div>
        <div className="form-row-2">
          <Field label="E-mail"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Telefone"><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Field>
        </div>
        <Field label="Observações"><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></Field>

        {erro && <p style={{ color: "var(--alerta)", fontSize: "var(--size-small)", margin: 0 }}>{erro}</p>}
        <Button type="submit" variant="primary">{perfil ? "Salvar perfil" : "Criar perfil"}</Button>
      </form>
    </Drawer>
  );
}
