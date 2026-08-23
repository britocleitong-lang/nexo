import { useState } from "react";
import { Stethoscope, Copy, RotateCw, Check, AlertTriangle, Info, Download } from "lucide-react";
import { coletarDiagnostico, formatarParaCopiar, VERSAO_APP, type ItemDiagnostico } from "../../core/sync/diagnostico";
import { sincronizar } from "../../core/sync/sincronizacao";
import { Button } from "../../components/ui";
import { confirmar } from "../../components/Confirm";
import "./DiagnosticoSync.css";

/**
 * Força o aparelho a baixar a versão nova do código.
 *
 * Necessário porque o service worker de um PWA instalado guarda o app
 * inteiro e só troca quando TODAS as janelas fecham — e um app na tela
 * inicial do celular raramente é fechado de verdade. O resultado é um
 * aparelho rodando código de semanas atrás sem nenhum sinal na tela.
 *
 * Aqui a gente desmonta o cache na marra: remove os registros do service
 * worker, apaga os caches e recarrega. Os DADOS não são tocados — eles
 * vivem no OPFS e no banco, não no cache do navegador.
 */
async function forcarAtualizacao(): Promise<void> {
  try {
    const registros = await navigator.serviceWorker?.getRegistrations?.() ?? [];
    for (const registro of registros) await registro.unregister();
  } catch { /* navegador sem service worker */ }

  try {
    const chaves = await caches?.keys?.() ?? [];
    for (const chave of chaves) await caches.delete(chave);
  } catch { /* Cache API ausente */ }

  // reload(true) foi removido dos navegadores; trocar a URL com um
  // parâmetro novo é o que garante que o HTML venha da rede.
  const url = new URL(window.location.href);
  url.searchParams.set("atualizar", String(Date.now()));
  window.location.replace(url.toString());
}

export function DiagnosticoSync() {
  const [itens, setItens] = useState<ItemDiagnostico[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [resultadoForcado, setResultadoForcado] = useState("");

  async function executar() {
    setCarregando(true);
    try {
      setItens(await coletarDiagnostico());
    } finally {
      setCarregando(false);
    }
  }

  /**
   * Reprocessa tudo que está no Drive, ignorando o registro do que já foi
   * visto. Serve quando as operações foram marcadas como conhecidas mas
   * não chegaram a ser gravadas — cenário possível se o app fechou no
   * meio de uma sincronização.
   */
  async function baixarTudo() {
    const ok = await confirmar({
      titulo: "Reprocessar tudo que está no Drive?",
      descricao: "O app vai reler todos os arquivos dos outros aparelhos e reaplicar as operações. "
        + "Nada é apagado — no pior caso ele reescreve o que já estava certo.",
    });
    if (!ok) return;

    setCarregando(true);
    try {
      const { limparAplicadas } = await import("../../core/sync/oplog");
      await limparAplicadas();
      const resultado = await sincronizar(true);
      setResultadoForcado(resultado.erro
        ? resultado.erro
        : `${resultado.recebidas} operação(ões) lidas, ${resultado.aplicadas} aplicada(s).`);
      setItens(await coletarDiagnostico());
    } finally {
      setCarregando(false);
    }
  }

  const ICONE = { ok: Check, atencao: AlertTriangle, erro: AlertTriangle, neutro: Info };

  return (
    <div className="diag">
      <div className="diag-topo">
        <span className="diag-icone"><Stethoscope size={16} /></span>
        <div>
          <strong>Diagnóstico</strong>
          <p>Rode nos dois aparelhos e compare a versão.</p>
        </div>
        <Button onClick={executar} disabled={carregando}>
          {carregando ? "Verificando..." : "Verificar"}
        </Button>
      </div>

      {itens && (
        <>
          <div className="diag-lista">
            {itens.map((item) => {
              const Icone = ICONE[item.situacao];
              return (
                <div key={item.rotulo} className={`diag-item sit-${item.situacao}`}>
                  <Icone size={14} className="diag-item-icone" />
                  <div className="diag-item-corpo">
                    <span className="diag-item-rotulo">{item.rotulo}</span>
                    <span className="diag-item-valor">{item.valor}</span>
                    {item.dica && <span className="diag-item-dica">{item.dica}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="diag-acoes">
            <Button
              icon={copiado ? <Check size={15} /> : <Copy size={15} />}
              onClick={async () => {
                await navigator.clipboard?.writeText(formatarParaCopiar(itens));
                setCopiado(true);
                window.setTimeout(() => setCopiado(false), 2000);
              }}
            >
              {copiado ? "Copiado" : "Copiar resultado"}
            </Button>
            <Button icon={<Download size={15} />} onClick={baixarTudo} disabled={carregando}>
              Reprocessar o Drive
            </Button>
          </div>

          {resultadoForcado && <p className="diag-resultado">{resultadoForcado}</p>}
        </>
      )}

      <div className="diag-atualizar">
        <div>
          <strong>Forçar atualização do app</strong>
          <p>Limpa o cache e recarrega. <em>Os dados não são tocados.</em></p>
          <span className="diag-versao">Versão: <code>{VERSAO_APP}</code></span>
        </div>
        <Button
          variant="primary"
          icon={<RotateCw size={15} />}
          onClick={async () => {
            const ok = await confirmar({
              titulo: "Recarregar o app com a versão mais nova?",
              descricao: "O cache do navegador é limpo e a página recarrega. Os dados do banco "
                + "e as configurações continuam intactos.",
            });
            if (ok) await forcarAtualizacao();
          }}
        >
          Atualizar agora
        </Button>
      </div>
    </div>
  );
}
