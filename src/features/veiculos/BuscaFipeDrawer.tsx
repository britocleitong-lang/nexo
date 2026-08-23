import { useEffect, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button, Drawer, Field, Select } from "../../components/ui";
import {
  listarMarcasFipe,
  listarModelosFipe,
  listarAnosFipe,
  consultarValorFipe,
  precoFipeParaNumero,
  type FipeMarca,
  type FipeModelo,
  type FipeAno,
  type FipeValor,
} from "./fipeService";
import { formatarMoeda } from "../../utils/format";

export function BuscaFipeDrawer({
  aberto,
  onClose,
  onConfirmar,
}: {
  aberto: boolean;
  onClose: () => void;
  onConfirmar: (dados: { valor: number; marcaCodigo: string; modeloCodigo: string; anoCodigo: string }) => void;
}) {
  const [marcas, setMarcas] = useState<FipeMarca[]>([]);
  const [modelos, setModelos] = useState<FipeModelo[]>([]);
  const [anos, setAnos] = useState<FipeAno[]>([]);
  const [marcaCodigo, setMarcaCodigo] = useState("");
  const [modeloCodigo, setModeloCodigo] = useState("");
  const [anoCodigo, setAnoCodigo] = useState("");
  const [resultado, setResultado] = useState<FipeValor | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setMarcaCodigo("");
    setModeloCodigo("");
    setAnoCodigo("");
    setResultado(null);
    setErro(null);
    setCarregando(true);
    listarMarcasFipe()
      .then(setMarcas)
      .catch((e) => setErro(String(e.message || e)))
      .finally(() => setCarregando(false));
  }, [aberto]);

  async function handleMarcaChange(codigo: string) {
    setMarcaCodigo(codigo);
    setModeloCodigo("");
    setAnoCodigo("");
    setResultado(null);
    setModelos([]);
    if (!codigo) return;
    setCarregando(true);
    setErro(null);
    try {
      setModelos(await listarModelosFipe(codigo));
    } catch (e: any) {
      setErro(String(e.message || e));
    } finally {
      setCarregando(false);
    }
  }

  async function handleModeloChange(codigo: string) {
    setModeloCodigo(codigo);
    setAnoCodigo("");
    setResultado(null);
    setAnos([]);
    if (!codigo || !marcaCodigo) return;
    setCarregando(true);
    setErro(null);
    try {
      setAnos(await listarAnosFipe(marcaCodigo, codigo));
    } catch (e: any) {
      setErro(String(e.message || e));
    } finally {
      setCarregando(false);
    }
  }

  async function handleAnoChange(codigo: string) {
    setAnoCodigo(codigo);
    setResultado(null);
    if (!codigo || !marcaCodigo || !modeloCodigo) return;
    setCarregando(true);
    setErro(null);
    try {
      setResultado(await consultarValorFipe(marcaCodigo, modeloCodigo, codigo));
    } catch (e: any) {
      setErro(String(e.message || e));
    } finally {
      setCarregando(false);
    }
  }

  function handleConfirmar() {
    if (!resultado) return;
    onConfirmar({
      valor: precoFipeParaNumero(resultado.price),
      marcaCodigo,
      modeloCodigo,
      anoCodigo,
    });
  }

  return (
    <Drawer open={aberto} title="Consultar tabela FIPE" onClose={onClose}>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: -6 }}>
        Consulta a API pública da FIPE em tempo real — a única função do Nexo que precisa de internet.
      </p>

      <div className="form-grid">
        <Field label="Marca">
          <Select value={marcaCodigo} onChange={(e) => handleMarcaChange(e.target.value)}>
            <option value="">Selecione a marca</option>
            {marcas.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
          </Select>
        </Field>

        {marcaCodigo && (
          <Field label="Modelo">
            <Select value={modeloCodigo} onChange={(e) => handleModeloChange(e.target.value)}>
              <option value="">Selecione o modelo</option>
              {modelos.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
            </Select>
          </Field>
        )}

        {modeloCodigo && (
          <Field label="Ano/versão">
            <Select value={anoCodigo} onChange={(e) => handleAnoChange(e.target.value)}>
              <option value="">Selecione o ano</option>
              {anos.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
            </Select>
          </Field>
        )}

        {carregando && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
            <Loader2 size={15} className="spin" /> Consultando...
          </div>
        )}

        {erro && <p style={{ color: "var(--danger)", fontSize: 13 }}>{erro}</p>}

        {resultado && (
          <div className="fipe-resultado">
            <div className="fipe-resultado-valor tabular">{formatarMoeda(precoFipeParaNumero(resultado.price))}</div>
            <div className="fipe-resultado-meta">
              {resultado.brand} {resultado.model} · {resultado.modelYear} · {resultado.fuel}
            </div>
            <div className="fipe-resultado-meta">Referência: {resultado.referenceMonth}</div>
            <Button variant="primary" icon={<Search size={14} />} onClick={handleConfirmar}>
              Usar este valor
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}
