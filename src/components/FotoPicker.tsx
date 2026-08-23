import { useRef, useState } from "react";
import { Camera, ImageUp, Trash2, Link2, Loader2 } from "lucide-react";
import "./FotoPicker.css";

// =====================================================================
// Escolha de foto — câmera, galeria ou link
// ---------------------------------------------------------------------
// A foto é guardada como data URL dentro da própria coluna de texto, e
// isso é uma decisão com consequência: o arquivo entra no .db, que é o
// que vai e volta no backup. Por isso a compressão não é opcional aqui.
//
// Uma foto de celular hoje tem 4 a 12 MB. Guardada crua, três carros e
// dois imóveis dobrariam o tamanho do banco inteiro. O redimensionamento
// para 1280 px no maior lado com JPEG a 78% derruba isso para 120-250 KB
// sem perda visível num card de 92 px — que é o tamanho em que a imagem
// realmente aparece.
//
// Sobre a câmera: `capture="environment"` faz o Android e o iOS abrirem
// direto a câmera traseira em vez do seletor de arquivos. No desktop o
// atributo é ignorado e o navegador abre o explorador normalmente, então
// os dois botões continuam fazendo sentido nas duas plataformas.
// =====================================================================

const LADO_MAXIMO = 1280;
const QUALIDADE = 0.78;
/** Acima disso o data URL passa a pesar no banco — vira aviso, não erro. */
const ALERTA_KB = 400;

export interface ResultadoCompressao {
  dataUrl: string;
  /** true quando a imagem foi preservada em PNG por ter transparência. */
  transparente: boolean;
  largura: number;
  altura: number;
}

export async function comprimirImagem(arquivo: File): Promise<ResultadoCompressao> {
  const bitmap = await criarBitmap(arquivo);

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Não consegui processar a imagem neste navegador.");

  // Desenha primeiro, SEM fundo, para poder inspecionar o canal alfa.
  // Pintar branco antes tornaria a checagem impossível — todo pixel
  // ficaria opaco e nenhuma logo com fundo vazado sobreviveria.
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, largura, altura);

  const transparente = temTransparencia(ctx, largura, altura);

  if (transparente) {
    // PNG mantém o canal alfa. Fica maior que JPEG, mas é a única saída
    // para logo de montadora, planta baixa vazada e recorte de imóvel —
    // forçar fundo branco nesses casos estraga a imagem.
    if ("close" in bitmap) (bitmap as ImageBitmap).close?.();
    return { dataUrl: canvas.toDataURL("image/png"), transparente: true, largura, altura };
  }

  // Sem transparência: JPEG, que é muito menor para fotografia. O fundo
  // branco entra por segurança — se sobrou algum pixel semitransparente
  // abaixo do limiar, ele viraria preto na conversão.
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);

  if ("close" in bitmap) (bitmap as ImageBitmap).close?.();
  return { dataUrl: canvas.toDataURL("image/jpeg", QUALIDADE), transparente: false, largura, altura };
}

/**
 * Procura pixels com alfa < 250, amostrando em grade.
 *
 * Amostragem em vez de varredura completa porque `getImageData` numa
 * imagem de 1280 px devolve mais de 6 milhões de valores, e percorrer
 * tudo trava a interface por um instante visível no celular. Um passo de
 * 4 px encontra qualquer transparência real — recorte, logo, borda
 * vazada — sem custo perceptível.
 *
 * O limiar é 250, não 255, e o efeito é o oposto do que parece: pixels com
 * alfa entre 251 e 254 — antialiasing de borda, ruído de compressão — são
 * tratados como OPACOS. Sem essa folga, uma foto comum com a borda um
 * pouquinho suave viraria PNG e ocuparia três vezes mais espaço sem ter
 * transparência de verdade. Fundo realmente vazado tem alfa 0 e é pego.
 */
function temTransparencia(ctx: CanvasRenderingContext2D, largura: number, altura: number): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, largura, altura);
    const passo = 4 * 4; // 4 canais × 4 pixels de intervalo
    for (let i = 3; i < data.length; i += passo) {
      if (data[i] < 250) return true;
    }
    return false;
  } catch {
    // Canvas "sujo" por imagem de outra origem bloqueia a leitura. Nesse
    // caso o mais seguro é assumir opaco e seguir com JPEG.
    return false;
  }
}

/**
 * createImageBitmap resolve a orientação EXIF sozinho na maioria dos
 * navegadores — sem isso, foto tirada na vertical aparece deitada. O
 * caminho por <img> fica como reserva para navegadores sem a API.
 */
async function criarBitmap(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    } catch {
      // cai no fallback
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Arquivo de imagem inválido.")); };
    img.src = url;
  });
}

export function tamanhoDataUrlKb(dataUrl: string | null): number {
  if (!dataUrl?.startsWith("data:")) return 0;
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.round((base64.length * 0.75) / 1024);
}

export function FotoPicker({ valor, onChange, formato = "paisagem", rotuloVazio = "Nenhuma foto" }: {
  valor: string | null;
  onChange: (dataUrl: string | null) => void;
  formato?: "paisagem" | "quadrado";
  rotuloVazio?: string;
}) {
  const inputCamera = useRef<HTMLInputElement>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const [transparente, setTransparente] = useState(false);
  const [modoLink, setModoLink] = useState(false);
  const [link, setLink] = useState("");

  async function receber(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    // Limpa o input para que escolher o MESMO arquivo de novo dispare o
    // evento — sem isso, tentar de novo depois de um erro não faz nada.
    e.target.value = "";
    if (!arquivo) return;

    if (!arquivo.type.startsWith("image/")) {
      setErro("Esse arquivo não é uma imagem.");
      return;
    }

    setErro("");
    setProcessando(true);
    try {
      const resultado = await comprimirImagem(arquivo);
      const kb = tamanhoDataUrlKb(resultado.dataUrl);
      setTransparente(resultado.transparente);

      if (kb > ALERTA_KB) {
        setErro(resultado.transparente
          ? `A imagem ficou com ${kb} KB. PNG com transparência não comprime como foto — se o fundo vazado não for necessário, um JPEG ficaria bem menor.`
          : `A foto ficou com ${kb} KB mesmo após compressão. Ela funciona, mas deixa o backup maior.`);
      }
      onChange(resultado.dataUrl);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui ler essa imagem.");
    } finally {
      setProcessando(false);
    }
  }

  const kb = tamanhoDataUrlKb(valor);

  return (
    <div className="fp-picker">
      {/* O xadrez atrás da imagem transparente é a convenção que todo
          editor usa — sem ele, fundo vazado e fundo branco ficam
          indistinguíveis na pré-visualização. */}
      <div className={`fp-preview ${formato} ${transparente ? "transparente" : ""}`}>
        {processando ? (
          <span className="fp-processando"><Loader2 size={20} className="girando" /></span>
        ) : valor ? (
          <img src={valor} alt="Foto" onError={() => setErro("Não consegui carregar essa imagem.")} />
        ) : (
          <span className="fp-vazia">{rotuloVazio}</span>
        )}
      </div>

      <div className="fp-acoes">
        {/* Dois inputs separados: o de câmera carrega `capture`, que no
            celular abre direto a lente traseira. */}
        <input
          ref={inputCamera} type="file" accept="image/*" capture="environment"
          onChange={receber} hidden
        />
        <input ref={inputArquivo} type="file" accept="image/*" onChange={receber} hidden />

        <button type="button" className="fp-btn" onClick={() => inputCamera.current?.click()} disabled={processando}>
          <Camera size={15} /> Tirar foto
        </button>
        <button type="button" className="fp-btn" onClick={() => inputArquivo.current?.click()} disabled={processando}>
          <ImageUp size={15} /> Escolher arquivo
        </button>
        <button type="button" className="fp-btn sutil" onClick={() => setModoLink((v) => !v)}>
          <Link2 size={15} /> Link
        </button>
        {valor && (
          <button type="button" className="fp-btn perigo" onClick={() => { onChange(null); setErro(""); setTransparente(false); }}>
            <Trash2 size={15} /> Remover
          </button>
        )}
      </div>

      {modoLink && (
        <div className="fp-link">
          <input
            className="input" placeholder="https://..." value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <button
            type="button" className="fp-btn"
            onClick={() => { if (link.trim()) { onChange(link.trim()); setLink(""); setModoLink(false); } }}
          >
            Usar
          </button>
        </div>
      )}

      {erro && <p className="fp-erro">{erro}</p>}

      {valor?.startsWith("data:") && kb > 0 && !erro && (
        <p className="fp-info">
          {transparente
            ? `Fundo transparente preservado (PNG) — ${kb} KB.`
            : `Guardada no aparelho, dentro do próprio banco — ${kb} KB.`}
          {" "}Nada é enviado para lugar nenhum.
        </p>
      )}
      {valor && !valor.startsWith("data:") && (
        <p className="fp-info">
          Link externo: a imagem só aparece com internet. Para funcionar offline, tire ou escolha uma foto.
        </p>
      )}
    </div>
  );
}
