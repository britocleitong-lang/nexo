import { useMemo, useState } from "react";
import { History, Plus, Check, RotateCcw, Trash2, Pencil } from "lucide-react";
import {
  versoesDo, novaVersao, corrigirVersao, tornarVigente, excluirVersao,
  MOTIVOS, labelMotivo,
} from "./versoesRepository";
import { inferirTipoDocumento, sugerirValidade } from "./tiposDocumento";
import { Badge, Button, Drawer, Field, Input, Select, Textarea } from "../../components/ui";
import { formatarData } from "../../utils/format";
import { diasRestantes, textoPrazo } from "../../core/datas";
import { confirmar } from "../../components/Confirm";
import type { DocumentoVersao, MotivoVersao } from "../../types/entities";
import "./VersoesDrawer.css";

/**
 * Histórico de versões de um documento.
 *
 * O que a tela precisa deixar óbvio, e por isso a hierarquia é essa:
 * qual é a versão que vale AGORA (destaque, selo "Vigente", no topo), e
 * que as anteriores continuam ali (recuadas, mas legíveis).
 *
 * A ação principal é "Registrar nova versão" — renovar. Ela nunca
 * sobrescreve: a versão atual é carimbada como substituída e a nova
 * assume. Se foi engano, "Tornar vigente" na anterior desfaz sem perder
 * nenhuma das duas.
 */
export function VersoesDrawer({ documentoId, documentoNome, aberto, onFechar, onMudou }: {
  documentoId: string | null;
  documentoNome: string;
  aberto: boolean;
  onFechar: () => void;
  onMudou: () => void;
}) {
  const [versao, setVersao] = useState(0);
  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const versoes = useMemo(
    () => (documentoId ? versoesDo(documentoId) : []),
    [documentoId, versao, aberto],
  );

  const recarregar = () => { setVersao((v) => v + 1); onMudou(); };

  async function handleTornarVigente(v: DocumentoVersao) {
    const ok = await confirmar({
      titulo: `Tornar a versão ${v.versao} a vigente?`,
      descricao: "A versão que está valendo hoje volta para o histórico. Nada é apagado.",
    });
    if (!ok) return;
    await tornarVigente(v.id);
    recarregar();
  }

  async function handleExcluir(v: DocumentoVersao) {
    const resultado = await excluirVersao(v.id);
    if (!resultado.ok) {
      setErro(resultado.motivo ?? "Não foi possível excluir.");
      return;
    }
    setErro("");
    recarregar();
  }

  if (!documentoId) return null;

  return (
    <>
      <Drawer open={aberto} title={documentoNome} onClose={onFechar}>
        <div className="form-grid">
          <div className="ver-topo">
            <span className="ver-topo-icone"><History size={16} /></span>
            <div>
              <strong>{versoes.length === 1 ? "1 versão registrada" : `${versoes.length} versões registradas`}</strong>
              <p>
                Renovou, tirou segunda via ou corrigiu um dado? Registre como nova versão.
                A anterior fica no histórico, com o número e a validade que tinha.
              </p>
            </div>
          </div>

          <Button
            variant="primary" icon={<Plus size={15} />}
            onClick={() => { setEditandoId(null); setFormAberto(true); }}
          >
            Registrar nova versão
          </Button>

          {erro && <p className="ver-erro">{erro}</p>}

          <div className="ver-linha-tempo">
            {versoes.map((v) => {
              const vigente = v.vigente === 1;
              const dias = v.data_validade ? diasRestantes(v.data_validade) : null;
              return (
                <div key={v.id} className={`ver-item ${vigente ? "vigente" : ""}`}>
                  <span className="ver-marcador">
                    <span className="ver-numero">{v.versao}</span>
                  </span>

                  <div className="ver-conteudo">
                    <div className="ver-cabecalho">
                      <span className="ver-motivo">{labelMotivo(v.motivo)}</span>
                      {vigente
                        ? <Badge tone="success">Vigente</Badge>
                        : <Badge tone="muted">Histórico</Badge>}
                    </div>

                    <dl className="ver-campos">
                      {v.numero && (
                        <><dt>Número</dt><dd className="tabular">{v.numero}</dd></>
                      )}
                      {v.orgao_emissor && (
                        <><dt>Emissor</dt><dd>{v.orgao_emissor}</dd></>
                      )}
                      {v.data_emissao && (
                        <><dt>Emitido</dt><dd>{formatarData(v.data_emissao)}</dd></>
                      )}
                      {v.data_validade && (
                        <>
                          <dt>Validade</dt>
                          <dd>
                            {formatarData(v.data_validade)}
                            {vigente && dias !== null && (
                              <em className={dias < 0 ? "vencido" : dias < 90 ? "vencendo" : ""}>
                                {" "}({textoPrazo(dias)})
                              </em>
                            )}
                          </dd>
                        </>
                      )}
                      {v.substituida_em && (
                        <>
                          <dt>Substituída</dt>
                          <dd>{formatarData(v.substituida_em.slice(0, 10))}</dd>
                        </>
                      )}
                    </dl>

                    {v.observacoes && <p className="ver-obs">{v.observacoes}</p>}

                    <div className="ver-acoes">
                      <button className="icon-btn" title="Corrigir esta versão"
                        onClick={() => { setEditandoId(v.id); setFormAberto(true); }}>
                        <Pencil size={14} />
                      </button>
                      {!vigente && (
                        <button className="icon-btn" title="Tornar esta a vigente"
                          onClick={() => handleTornarVigente(v)}>
                          <RotateCcw size={14} />
                        </button>
                      )}
                      {versoes.length > 1 && !vigente && (
                        <button className="icon-btn danger" title="Excluir do histórico"
                          onClick={() => handleExcluir(v)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Drawer>

      <FormVersao
        aberto={formAberto}
        documentoId={documentoId}
        documentoNome={documentoNome}
        versaoExistente={editandoId ? versoes.find((v) => v.id === editandoId) ?? null : null}
        onFechar={() => { setFormAberto(false); setEditandoId(null); }}
        onSalvo={() => { setFormAberto(false); setEditandoId(null); recarregar(); }}
      />
    </>
  );
}

function FormVersao({ aberto, documentoId, documentoNome, versaoExistente, onFechar, onSalvo }: {
  aberto: boolean;
  documentoId: string;
  documentoNome: string;
  versaoExistente: DocumentoVersao | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [motivo, setMotivo] = useState<MotivoVersao>("renovacao");
  const [numero, setNumero] = useState("");
  const [orgao, setOrgao] = useState("");
  const [emissao, setEmissao] = useState("");
  const [validade, setValidade] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [inicializado, setInicializado] = useState(false);

  // Reinicializa quando o drawer abre, e só então.
  if (aberto && !inicializado) {
    setMotivo((versaoExistente?.motivo as MotivoVersao) ?? "renovacao");
    setNumero(versaoExistente?.numero ?? "");
    setOrgao(versaoExistente?.orgao_emissor ?? "");
    setEmissao(versaoExistente?.data_emissao ?? "");
    setValidade(versaoExistente?.data_validade ?? "");
    setObservacoes(versaoExistente?.observacoes ?? "");
    setInicializado(true);
  }
  if (!aberto && inicializado) setInicializado(false);

  const tipo = inferirTipoDocumento(documentoNome);
  const validadeSugerida = emissao && !validade ? sugerirValidade(documentoNome, emissao) : null;

  return (
    <Drawer
      open={aberto}
      title={versaoExistente ? `Corrigir versão ${versaoExistente.versao}` : "Nova versão"}
      onClose={onFechar}
    >
      <form className="form-grid" onSubmit={async (e) => {
        e.preventDefault();
        const dados = {
          motivo,
          numero: numero.trim() || null,
          orgao_emissor: orgao.trim() || null,
          data_emissao: emissao || null,
          data_validade: validade || null,
          observacoes: observacoes.trim() || null,
        };
        if (versaoExistente) await corrigirVersao(versaoExistente.id, dados);
        else await novaVersao(documentoId, dados);
        onSalvo();
      }}>
        {!versaoExistente && (
          <p className="ver-aviso">
            A versão que está valendo hoje vai para o histórico com os dados que tem agora.
            Ela não é apagada e pode voltar a ser a vigente depois.
          </p>
        )}

        <Field label="O que aconteceu" hint={MOTIVOS.find((m) => m.valor === motivo)?.descricao}>
          <Select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoVersao)}>
            {MOTIVOS.filter((m) => versaoExistente || m.valor !== "primeira")
              .map((m) => <option key={m.valor} value={m.valor}>{m.label}</option>)}
          </Select>
        </Field>

        <div className="form-row-2">
          <Field label="Número">
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
          </Field>
          <Field label="Órgão emissor">
            <Input value={orgao} onChange={(e) => setOrgao(e.target.value)} placeholder="SSP/SC, DETRAN..." />
          </Field>
        </div>

        <div className="form-row-2">
          <Field label="Data de emissão">
            <Input type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} />
          </Field>
          <Field
            label="Validade"
            hint={tipo?.natureza === "permanente" ? "Este documento não costuma vencer." : undefined}
          >
            <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
          </Field>
        </div>

        {validadeSugerida && (
          <button type="button" className="ver-sugestao" onClick={() => setValidade(validadeSugerida)}>
            <Check size={13} />
            {/* A validade típica do tipo evita abrir o documento só para
                conferir uma data que segue regra fixa. É sugestão: o número
                só entra no campo se a pessoa clicar. */}
            Usar {formatarData(validadeSugerida)} — validade típica de {tipo?.validadeAnos} ano(s) para este documento
          </button>
        )}

        <Field label="Observações">
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </Field>

        <div className="page-actions">
          <Button type="button" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" variant="primary">
            {versaoExistente ? "Salvar correção" : "Registrar versão"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
