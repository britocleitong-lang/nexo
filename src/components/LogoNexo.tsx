/**
 * Marca do Nexo.
 *
 * O "N" é desenhado como um grafo: duas hastes ligadas por uma aresta, com
 * um nó em cada ponta. É a ideia do produto — as áreas da vida conectadas
 * entre si, não guardadas em gavetas separadas.
 *
 * Em SVG para acompanhar o tema e ficar nítido em qualquer tamanho.
 */
export function LogoNexo({ tamanho = 30, comFundo = true }: { tamanho?: number; comFundo?: boolean }) {
  const id = "nexo-grad";
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 100 100" role="img" aria-label="Nexo">
      {comFundo && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0%" stopColor="#166b62" />
              <stop offset="100%" stopColor="#0b3d38" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" rx="23" fill={`url(#${id})`} />
        </>
      )}

      {/* aresta diagonal ligando os dois nós */}
      <path
        d="M32 31 L68 69"
        stroke={comFundo ? "#f7faf9" : "currentColor"}
        strokeWidth="9.5"
        strokeLinecap="round"
      />
      {/* hastes */}
      <path
        d="M32 27 V73 M68 27 V73"
        stroke={comFundo ? "#f7faf9" : "currentColor"}
        strokeWidth="9.5"
        strokeLinecap="round"
      />
      {/* nós: anel vazado, marcando as conexões */}
      <circle cx="32" cy="31" r="7.4" fill="#8fc4bd" />
      <circle cx="32" cy="31" r="3.6" fill={comFundo ? "#10554e" : "var(--bg-card)"} />
      <circle cx="68" cy="69" r="7.4" fill="#8fc4bd" />
      <circle cx="68" cy="69" r="3.6" fill={comFundo ? "#10554e" : "var(--bg-card)"} />
    </svg>
  );
}
