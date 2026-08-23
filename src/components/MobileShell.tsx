import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Wallet, HeartPulse, Car, Menu, X,
  Search, Eye, EyeOff, Settings, ChevronRight,
} from "lucide-react";
import type { GrupoNav, ItemNav } from "./navegacao";
import { LogoNexo } from "./LogoNexo";
import { BotaoSync } from "./BotaoSync";
import "./MobileShell.css";

// =====================================================================
// Casca do celular
// ---------------------------------------------------------------------
// A versão anterior era a barra lateral do computador espremida no
// rodapé: dez itens do mesmo tamanho, rolando na horizontal, com o
// rótulo cortado. Funcionava e não parecia um aplicativo.
//
// Aqui a estrutura é a que todo app nativo usa, e por bons motivos:
//
//   BARRA SUPERIOR — onde você está e as ações da tela. Fixa, fina.
//   ABAS INFERIORES — quatro destinos, na zona que o polegar alcança.
//   FOLHA "MAIS"    — todo o resto, deslizando de baixo.
//
// Quatro abas, não seis: acima disso os alvos ficam menores que o
// polegar médio (que precisa de uns 48 px) e todo mundo erra o toque.
// A escolha das quatro é por frequência de uso real, não por importância
// conceitual — Financeiro é aberto todo dia, Patrimônio uma vez por mês.
// =====================================================================

const ABAS: ItemNav[] = [
  { to: "/", label: "Início", icon: LayoutDashboard, end: true },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/veiculos", label: "Veículos", icon: Car },
  { to: "/saude", label: "Saúde", icon: HeartPulse },
];

export function MobileShell({
  grupos, itensExtras, titulo, valoresVisiveis, aoAlternarValores, aoBuscar, alertas,
}: {
  grupos: GrupoNav[];
  itensExtras: ItemNav[];
  titulo: string;
  valoresVisiveis: boolean;
  aoAlternarValores: () => void;
  aoBuscar: () => void;
  alertas: Record<string, number>;
}) {
  const [folhaAberta, setFolhaAberta] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Trocar de tela fecha a folha. Sem isso, tocar num item deixaria o
  // painel aberto por cima da página que acabou de abrir.
  useEffect(() => { setFolhaAberta(false); }, [location.pathname]);

  // Trava a rolagem do fundo enquanto a folha está aberta — senão o dedo
  // arrasta a página atrás em vez do painel.
  useEffect(() => {
    document.body.style.overflow = folhaAberta ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [folhaAberta]);

  const emAba = ABAS.some((a) => (a.end ? location.pathname === a.to : location.pathname.startsWith(a.to)));

  return (
    <>
      <header className="mob-topo">
        <div className="mob-topo-esq">
          <LogoNexo tamanho={22} />
          <h1 className="mob-titulo">{titulo}</h1>
        </div>
        <div className="mob-topo-acoes">
          <button className="mob-icone" onClick={aoBuscar} aria-label="Buscar">
            <Search size={19} />
          </button>
          <button
            className="mob-icone"
            onClick={aoAlternarValores}
            aria-label={valoresVisiveis ? "Ocultar valores" : "Mostrar valores"}
          >
            {valoresVisiveis ? <Eye size={19} /> : <EyeOff size={19} />}
          </button>
        </div>
      </header>

      <nav className="mob-abas" aria-label="Navegação principal">
        {ABAS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to} to={to} end={end}
            className={({ isActive }) => `mob-aba ${isActive ? "ativa" : ""}`}
          >
            <Icon size={21} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}

        <button
          className={`mob-aba ${folhaAberta || !emAba ? "ativa" : ""}`}
          onClick={() => setFolhaAberta((v) => !v)}
          aria-label="Mais opções"
          aria-expanded={folhaAberta}
        >
          {folhaAberta ? <X size={21} /> : <Menu size={21} />}
          <span>Mais</span>
          {/* Avisos de módulos que não estão nas abas precisam de sinal
              aqui, senão ficam invisíveis no celular. */}
          {!folhaAberta && Object.values(alertas).reduce((s, n) => s + n, 0) > 0 && (
            <span className="mob-aba-ponto" />
          )}
        </button>
      </nav>

      {folhaAberta && (
        <>
          <div className="mob-veu" onClick={() => setFolhaAberta(false)} />
          <div className="mob-folha" role="dialog" aria-label="Mais opções">
            <div className="mob-folha-puxador" />

            <div className="mob-folha-conteudo">
              {grupos.map((grupo) => (
                <section key={grupo.id} className="mob-grupo" style={{ ["--hue-grupo" as never]: grupo.hue }}>
                  <h2>{grupo.label}</h2>
                  <div className="mob-grupo-itens">
                    {grupo.itens.map(({ to, label, icon: Icon }) => (
                      <button
                        key={to}
                        className={`mob-item ${location.pathname === to ? "ativo" : ""}`}
                        onClick={() => navigate(to)}
                      >
                        <span className="mob-item-icone"><Icon size={18} strokeWidth={1.9} /></span>
                        <span className="mob-item-rotulo">{label}</span>
                        <ChevronRight size={16} className="mob-item-seta" />
                      </button>
                    ))}
                  </div>
                </section>
              ))}

              <section className="mob-grupo">
                <h2>Sistema</h2>
                <div className="mob-grupo-itens">
                  {itensExtras.map(({ to, label, icon: Icon }) => (
                    <button
                      key={to}
                      className={`mob-item ${location.pathname === to ? "ativo" : ""}`}
                      onClick={() => navigate(to)}
                    >
                      <span className="mob-item-icone"><Icon size={18} strokeWidth={1.9} /></span>
                      <span className="mob-item-rotulo">{label}</span>
                      <ChevronRight size={16} className="mob-item-seta" />
                    </button>
                  ))}
                  <button
                    className={`mob-item ${location.pathname === "/configuracoes" ? "ativo" : ""}`}
                    onClick={() => navigate("/configuracoes")}
                  >
                    <span className="mob-item-icone"><Settings size={18} strokeWidth={1.9} /></span>
                    <span className="mob-item-rotulo">Configurações</span>
                    <ChevronRight size={16} className="mob-item-seta" />
                  </button>
                </div>
              </section>

              <div className="mob-folha-sync"><BotaoSync /></div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
