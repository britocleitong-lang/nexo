import { useMemo, useState } from "react";
import { Syringe, Check, Plus, AlertTriangle, Trash2, ShieldCheck } from "lucide-react";
import {
  carteirasDaFamilia, registrarDose, excluirDose, listarVacinasAplicadas,
  type CarteiraVacinal,
} from "./vacinasRepository";
import { LABEL_SITUACAO_DOSE, AVISO_ESQUEMA, publicoDaIdade, type ItemConferencia } from "./esquemaVacinal";
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, StatCard, Textarea } from "../../components/ui";
import { formatarData } from "../../utils/format";
import { hoje } from "../../core/datas";
import { confirmar } from "../../components/Confirm";
import "./VacinasPage.css";

export function VacinasPage() {
  const [versao, setVersao] = useState(0);
  const [pessoaAtiva, setPessoaAtiva] = useState(0);
  const [registrando, setRegistrando] = useState<{ pessoaId: string; item: ItemConferencia } | null>(null);
  const [mostrarFuturas, setMostrarFuturas] = useState(false);

  const carteiras = useMemo(() => carteirasDaFamilia(), [versao]);
  const carteira: CarteiraVacinal | undefined = carteiras[pessoaAtiva];

  if (carteiras.length === 0) {
    return (
      <div>
        <PageHeader title="Carteira de vacinação" subtitle="Conferência do esquema vacinal pelo calendário do PNI." />
        <Card>
          <EmptyState
            title="Nenhuma pessoa cadastrada"
            description="A conferência usa a data de nascimento para saber o que já era devido. Cadastre as pessoas em Família primeiro."
          />
        </Card>
      </div>
    );
  }

  const publicos = publicoDaIdade(carteira?.itens[0]?.idadeMesesPessoa ?? null);
  const itensRelevantes = (carteira?.itens ?? []).filter((i) =>
    i.vacina.publico.some((p) => publicos.includes(p)));

  const atrasadas = itensRelevantes.filter((i) => i.situacao === "atrasada");
  const pendentes = itensRelevantes.filter((i) => i.situacao === "pendente");
  const aplicadas = itensRelevantes.filter((i) => i.situacao === "aplicada");
  const futuras = itensRelevantes.filter((i) => i.situacao === "futura");

  return (
    <div>
      <PageHeader
        title="Carteira de vacinação"
        subtitle="Compara o que está registrado com o calendário do PNI e mostra o que falta."
      />

      {carteiras.length > 1 && (
        <div className="tabs section">
          {carteiras.map((c, i) => (
            <button key={c.pessoa.id} className={`tab ${pessoaAtiva === i ? "active" : ""}`} onClick={() => setPessoaAtiva(i)}>
              {c.pessoa.nome}
              {c.resumo.atrasadas > 0 && <span className="vac-tab-ponto" />}
            </button>
          ))}
        </div>
      )}

      {!carteira?.pessoa.data_nascimento && (
        <Card className="vac-aviso-nascimento">
          <AlertTriangle size={16} />
          <span>
            {carteira?.pessoa.nome} está sem data de nascimento cadastrada. Sem ela não dá pra saber
            o que já era devido — todas as doses aparecem como pendentes. Preencha em Família.
          </span>
        </Card>
      )}

      <div className="grid-4 section">
        <StatCard
          label="Em atraso"
          value={String(atrasadas.length)}
          tone={atrasadas.length > 0 ? "danger" : "success"}
          icon={<Syringe size={15} />}
        />
        <StatCard label="Está na hora" value={String(pendentes.length)} tone={pendentes.length > 0 ? "warn" : "default"} />
        <StatCard label="Aplicadas" value={String(aplicadas.length)} icon={<ShieldCheck size={15} />} />
        <StatCard
          label="Cobertura"
          value={`${Math.round(carteira?.resumo.cobertura ?? 0)}%`}
          hint="Do que já era devido para a idade"
          tone={(carteira?.resumo.cobertura ?? 0) >= 90 ? "success" : "warn"}
        />
      </div>

      {[
        ["Em atraso", atrasadas, "atrasada"],
        ["Está na hora", pendentes, "pendente"],
        ["Já aplicadas", aplicadas, "aplicada"],
      ].map(([titulo, lista]) => {
        const itens = lista as ItemConferencia[];
        if (itens.length === 0) return null;
        return (
          <div key={String(titulo)} className="section">
            <h3 className="section-title">{String(titulo)}</h3>
            <Card>
              <div className="vac-lista">
                {itens.map((item) => (
                  <LinhaDose
                    key={`${item.vacina.chave}:${item.dose.chave}`}
                    item={item}
                    pessoaId={carteira!.pessoa.id}
                    onRegistrar={() => setRegistrando({ pessoaId: carteira!.pessoa.id, item })}
                    onMudou={() => setVersao((v) => v + 1)}
                  />
                ))}
              </div>
            </Card>
          </div>
        );
      })}

      {futuras.length > 0 && (
        <div className="section">
          <button className="link-sutil" onClick={() => setMostrarFuturas((v) => !v)}>
            {mostrarFuturas ? "Esconder" : `Ver as ${futuras.length} doses que ainda vão chegar`}
          </button>
          {mostrarFuturas && (
            <Card className="vac-card-futuras">
              <div className="vac-lista">
                {futuras.map((item) => (
                  <LinhaDose
                    key={`${item.vacina.chave}:${item.dose.chave}`}
                    item={item}
                    pessoaId={carteira!.pessoa.id}
                    onRegistrar={() => setRegistrando({ pessoaId: carteira!.pessoa.id, item })}
                    onMudou={() => setVersao((v) => v + 1)}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <Card className="vac-disclaimer">
        <AlertTriangle size={15} />
        <p>{AVISO_ESQUEMA}</p>
      </Card>

      <RegistrarDose
        dados={registrando}
        onFechar={() => setRegistrando(null)}
        onSalvo={() => { setRegistrando(null); setVersao((v) => v + 1); }}
      />
    </div>
  );
}

function LinhaDose({ item, pessoaId, onRegistrar, onMudou }: {
  item: ItemConferencia; pessoaId: string;
  onRegistrar: () => void; onMudou: () => void;
}) {
  const tom = item.situacao === "atrasada" ? "danger"
    : item.situacao === "pendente" ? "warn"
    : item.situacao === "aplicada" ? "success" : "muted";

  async function apagar() {
    const registro = listarVacinasAplicadas(pessoaId)
      .find((v) => v.vacina_chave === item.vacina.chave && v.dose_chave === item.dose.chave);
    if (!registro) return;
    const ok = await confirmar({
      titulo: `Desfazer o registro de ${item.vacina.nome}?`,
      descricao: "A dose volta a aparecer como pendente.",
    });
    if (!ok) return;
    await excluirDose(registro.id);
    onMudou();
  }

  return (
    <div className={`vac-item sit-${item.situacao}`}>
      <span className="vac-icone"><Syringe size={14} /></span>
      <div className="vac-corpo">
        <span className="vac-nome">
          {item.vacina.nome}
          <em>{item.dose.rotulo}</em>
        </span>
        <span className="vac-meta">
          {item.vacina.protegeContra}
          {item.dataAplicacao && ` · aplicada em ${formatarData(item.dataAplicacao)}`}
          {!item.dataAplicacao && item.dataPrevista && ` · prevista para ${formatarData(item.dataPrevista)}`}
        </span>
        {item.vacina.observacao && <span className="vac-obs">{item.vacina.observacao}</span>}
      </div>
      <Badge tone={tom}>{LABEL_SITUACAO_DOSE[item.situacao]}</Badge>
      {(
        <div className="vac-acoes">
          {item.situacao === "aplicada" ? (
            <button className="icon-btn danger" onClick={apagar} title="Desfazer registro">
              <Trash2 size={15} />
            </button>
          ) : (
            <button className="icon-btn" onClick={onRegistrar} title="Registrar aplicação">
              <Check size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RegistrarDose({ dados, onFechar, onSalvo }: {
  dados: { pessoaId: string; item: ItemConferencia } | null;
  onFechar: () => void; onSalvo: () => void;
}) {
  const [data, setData] = useState(hoje());
  const [lote, setLote] = useState("");
  const [local, setLocal] = useState("");
  const [observacoes, setObservacoes] = useState("");

  if (!dados) return null;

  return (
    <Drawer open title={`${dados.item.vacina.nome} — ${dados.item.dose.rotulo}`} onClose={onFechar}>
      <form className="form-grid" onSubmit={async (e) => {
        e.preventDefault();
        await registrarDose({
          pessoa_id: dados.pessoaId,
          vacina_chave: dados.item.vacina.chave,
          dose_chave: dados.item.dose.chave,
          data,
          lote: lote.trim() || null,
          local: local.trim() || null,
          observacoes: observacoes.trim() || null,
        });
        setLote(""); setLocal(""); setObservacoes("");
        onSalvo();
      }}>
        <Field label="Data da aplicação">
          <Input type="date" autoFocus value={data} max={hoje()} onChange={(e) => setData(e.target.value)} required />
        </Field>
        <div className="form-row-2">
          <Field label="Lote" hint="Está no carimbo da carteirinha.">
            <Input value={lote} onChange={(e) => setLote(e.target.value)} />
          </Field>
          <Field label="Onde foi aplicada">
            <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="UBS, clínica..." />
          </Field>
        </div>
        <Field label="Observações">
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </Field>

        {dados.item.vacina.reforcoAnos && (
          <p className="vac-nota-reforco">
            Esta vacina tem reforço a cada {dados.item.vacina.reforcoAnos} ano(s).
            Ao salvar, o Nexo já cria o lembrete do próximo — que é justamente o tipo de coisa
            que ninguém lembra sozinho dez anos depois.
          </p>
        )}

        <div className="page-actions">
          <Button type="button" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" variant="primary" icon={<Plus size={15} />}>Registrar dose</Button>
        </div>
      </form>
    </Drawer>
  );
}
