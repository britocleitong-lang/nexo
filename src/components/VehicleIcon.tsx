import { useState } from "react";

// Ícone de veículo vetorial, com a cor da lataria controlada via prop.
// Não é uma foto do carro real — como expliquei, a única forma de ter fotos
// reais e customizáveis por cor para qualquer modelo (IMAGIN.studio) é um
// produto B2B pago, sem tabela pública, então não entra aqui sem você decidir
// contratar. Este ícone é a alternativa gratuita e sempre disponível; o campo
// "Foto real (opcional)" na tela do veículo permite colar uma foto de verdade
// quando você tiver uma (Wikipedia, site da montadora, foto própria).

function sombrear(hex: string, percentual: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + percentual));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + percentual));
  const b = Math.min(255, Math.max(0, (num & 0xff) + percentual));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function VehicleIcon({
  cor = "#2f6fed",
  size = 64,
  className = "",
}: {
  cor?: string | null;
  size?: number;
  className?: string;
}) {
  const corBase = cor || "#2f6fed";
  const corClara = sombrear(corBase, 42);
  const corEscura = sombrear(corBase, -38);
  const gradId = `carro-grad-${corBase.replace("#", "")}`;

  return (
    <svg
      width={size}
      height={size * 0.62}
      viewBox="0 0 120 74"
      className={className}
      role="img"
      aria-label="Ícone do veículo"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={corClara} />
          <stop offset="55%" stopColor={corBase} />
          <stop offset="100%" stopColor={corEscura} />
        </linearGradient>
      </defs>

      <ellipse cx="60" cy="61.5" rx="42" ry="4" fill="#0f1a2b" opacity="0.16" />

      <path
        d="M13 47
           C13 40 17 35 25 34
           L33 33
           C38 22 48 14 60 14
           L76 14
           C86 14 94 20 99 29
           L103 34
           C111 35 117 41 117 48
           C117 51 115 53 112 53
           L108 53
           C108 44 100 37 91 37
           C82 37 74 44 74 53
           L46 53
           C46 44 38 37 29 37
           C20 37 12 44 12 53
           L11 53
           C10 53 9 52 9 50
           L9 48
           Z"
        fill={`url(#${gradId})`}
        stroke={corEscura}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* vidros */}
      <path
        d="M40 32 C44 24 51 18 60 18 L73 18 C80 18 86 22 90 29 L92 33 L40 33 Z"
        fill="#16233a"
        opacity="0.92"
      />
      <line x1="65" y1="18" x2="63" y2="33" stroke="#0a1220" strokeWidth="1.3" opacity="0.5" />
      <path
        d="M45 29 C48 24 52 20 57 19"
        stroke="white"
        strokeWidth="1.3"
        opacity="0.32"
        fill="none"
        strokeLinecap="round"
      />

      {/* friso lateral */}
      <path d="M24 42 L106 42" stroke={corEscura} strokeWidth="0.8" opacity="0.3" />

      {/* faróis */}
      <path d="M108 32 L114 34 C115 35.5 114.5 37 113 37 L107 36 Z" fill="#fde68a" opacity="0.95" />
      <ellipse cx="15" cy="38" rx="3.4" ry="2.2" fill="#f87171" opacity="0.85" />

      {/* rodas */}
      <circle cx="29" cy="53" r="11.5" fill="#0d1524" />
      <circle cx="29" cy="53" r="5.2" fill="#c7ccd4" />
      <circle cx="91" cy="53" r="11.5" fill="#0d1524" />
      <circle cx="91" cy="53" r="5.2" fill="#c7ccd4" />
    </svg>
  );
}

/** Paleta de sugestão rápida pra troca de cor do veículo. */
export const CORES_VEICULO_SUGERIDAS = [
  "#2f6fed", // azul
  "#c23b3b", // vermelho
  "#1f8a5f", // verde
  "#16233a", // grafite
  "#e8e8e8", // branco/prata
  "#0f1a2b", // preto
  "#b5730a", // âmbar
  "#7c3aed", // roxo
];

/**
 * Mostra a foto real do veículo se o usuário colou um link; se não houver
 * link, ou se a imagem falhar ao carregar, cai automaticamente no ícone.
 */
export function VehicleVisual({
  fotoUrl,
  cor,
  size = 64,
  className = "",
}: {
  fotoUrl?: string | null;
  cor?: string | null;
  size?: number;
  className?: string;
}) {
  const [erro, setErro] = useState(false);

  if (fotoUrl && !erro) {
    return (
      <img
        src={fotoUrl}
        alt="Foto do veículo"
        className={className}
        style={{ width: size, height: size * 0.62, objectFit: "contain" }}
        onError={() => setErro(true)}
      />
    );
  }

  return <VehicleIcon cor={cor} size={size} className={className} />;
}
