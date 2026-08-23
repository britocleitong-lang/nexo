/**
 * Ilustrações das lições.
 *
 * São SVGs desenhados aqui mesmo, com as cores do tema (inclusive no modo
 * escuro, já que usam as variáveis CSS). Nada de imagem externa: mantém o
 * app funcionando offline e não adiciona peso de download.
 */

export type ChaveIlustracao =
  | "mapa" | "balanca" | "escudo" | "escada" | "corrente" | "cofrinho"
  | "semente" | "bussola" | "relogio" | "ponte" | "guardachuva" | "farol";

const A = "var(--brand-700)";
const B = "var(--brand-300)";
const C = "var(--atencao)";
const F = "var(--brand-50)";

export function IlustracaoLicao({ chave, tamanho = 120 }: { chave: ChaveIlustracao; tamanho?: number }) {
  const props = { width: tamanho, height: tamanho, viewBox: "0 0 120 120", fill: "none" as const };

  switch (chave) {
    case "mapa": // para onde o dinheiro vai
      return (
        <svg {...props}>
          <circle cx="60" cy="60" r="52" fill={F} />
          <path d="M28 78 L52 40 L72 62 L94 34" stroke={A} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="52" cy="40" r="5" fill={A} />
          <circle cx="72" cy="62" r="5" fill={B} />
          <circle cx="94" cy="34" r="6" fill={C} />
          <path d="M26 92 H96" stroke={B} strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "balanca": // equilíbrio, patrimônio
      return (
        <svg {...props}>
          <circle cx="60" cy="60" r="52" fill={F} />
          <path d="M60 30 V86" stroke={A} strokeWidth="4" strokeLinecap="round" />
          <path d="M32 44 H88" stroke={A} strokeWidth="4" strokeLinecap="round" />
          <circle cx="60" cy="30" r="5" fill={A} />
          <path d="M22 44 L32 66 H12 Z" fill={B} />
          <path d="M88 44 L98 62 H78 Z" fill={C} />
          <path d="M44 90 H76" stroke={A} strokeWidth="5" strokeLinecap="round" />
        </svg>
      );
    case "escudo": // reserva, proteção
      return (
        <svg {...props}>
          <circle cx="60" cy="60" r="52" fill={F} />
          <path d="M60 26 L88 38 V62 C88 78 74 90 60 96 C46 90 32 78 32 62 V38 Z" fill={B} />
          <path d="M60 34 L80 43 V62 C80 73 70 82 60 87 C50 82 40 73 40 62 V43 Z" fill={A} />
          <path d="M50 62 L57 70 L72 53" stroke={F} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "escada": // progresso por etapas
      return (
        <svg {...props}>
          <circle cx="60" cy="60" r="52" fill={F} />
          <rect x="26" y="72" width="20" height="20" rx="4" fill={B} />
          <rect x="50" y="56" width="20" height="36" rx="4" fill={A} />
          <rect x="74" y="36" width="20" height="56" rx="4" fill={C} />
          <path d="M22 96 H98" stroke={A} strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "corrente": // dívidas
      return (
        <svg {...props}>
          <circle cx="60" cy="60" r="52" fill={F} />
          <rect x="30" y="50" width="30" height="20" rx="10" stroke={C} strokeWidth="5" />
          <rect x="58" y="50" width="30" height="20" rx="10" stroke={A} strokeWidth="5" />
          <path d="M34 84 L86 36" stroke={B} strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    case "cofrinho": // poupança
      return (
        <svg {...props}>
          <circle cx="60" cy="60" r="52" fill={F} />
          <path d="M34 62 C34 48 48 40 62 40 C78 40 90 50 90 62 C90 74 80 82 68 84 L66 92 H56 L54 84 C42 82 34 74 34 62 Z" fill={A} />
          <circle cx="76" cy="58" r="3.5" fill={F} />
          <path d="M56 34 V44" stroke={C} strokeWidth="5" strokeLinecap="round" />
          <path d="M40 84 V92" stroke={A} strokeWidth="5" strokeLinecap="round" />
        </svg>
      );
    case "semente": // crescimento, juros compostos
      return (
        <svg {...props}>
          <circle cx="60" cy="60" r="52" fill={F} />
          <path d="M60 92 V54" stroke={A} strokeWidth="5" strokeLinecap="round" />
          <path d="M60 62 C60 48 48 40 36 40 C36 56 46 64 60 62 Z" fill={B} />
          <path d="M60 54 C60 40 72 30 86 30 C86 46 74 56 60 54 Z" fill={A} />
          <path d="M42 96 H78" stroke={C} strokeWidth="5" strokeLinecap="round" />
        </svg>
      );
    case "bussola": // objetivos, direção
      return (
        <svg {...props}>
          <circle cx="60" cy="60" r="52" fill={F} />
          <circle cx="60" cy="60" r="30" stroke={A} strokeWidth="5" />
          <path d="M72 48 L54 54 L48 72 L66 66 Z" fill={C} />
          <circle cx="60" cy="60" r="4" fill={A} />
        </svg>
      );
    case "relogio": // tempo, prazo
      return (
        <svg {...props}>
          <circle cx="60" cy="60" r="52" fill={F} />
          <circle cx="60" cy="60" r="32" stroke={A} strokeWidth="5" />
          <path d="M60 42 V60 L74 68" stroke={C} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "ponte": // transição, planejamento
      return (
        <svg {...props}>
          <circle cx="60" cy="60" r="52" fill={F} />
          <path d="M22 74 C40 46 80 46 98 74" stroke={A} strokeWidth="5" strokeLinecap="round" />
          <path d="M22 74 H98" stroke={B} strokeWidth="5" strokeLinecap="round" />
          <path d="M38 74 V60 M60 74 V52 M82 74 V60" stroke={C} strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    case "guardachuva": // seguros, proteção
      return (
        <svg {...props}>
          <circle cx="60" cy="60" r="52" fill={F} />
          <path d="M26 62 C26 42 42 30 60 30 C78 30 94 42 94 62 Z" fill={A} />
          <path d="M60 62 V86 C60 92 66 94 70 90" stroke={C} strokeWidth="5" strokeLinecap="round" />
          <path d="M26 62 C34 54 42 54 48 62 C54 54 66 54 72 62 C78 54 86 54 94 62" stroke={F} strokeWidth="3" />
        </svg>
      );
    case "farol": // visão de longo prazo
    default:
      return (
        <svg {...props}>
          <circle cx="60" cy="60" r="52" fill={F} />
          <path d="M50 92 L54 46 H66 L70 92 Z" fill={A} />
          <rect x="50" y="36" width="20" height="12" rx="3" fill={C} />
          <path d="M42 42 L26 34 M78 42 L94 34" stroke={B} strokeWidth="4" strokeLinecap="round" />
          <path d="M40 92 H80" stroke={A} strokeWidth="5" strokeLinecap="round" />
        </svg>
      );
  }
}
