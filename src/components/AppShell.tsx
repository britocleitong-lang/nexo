import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  Car,
  FileText,
  HeartPulse,
  CalendarDays,
  Building2,
  Users,
  CheckSquare,
  Settings,
  Search,
  PiggyBank,
  Sparkles,
  BarChart3,
  Home,
  Contact,
  FileBarChart2,
  Calculator,
  GraduationCap,
  KeyRound,
  ChevronDown,
  Eye,
  EyeOff,
  TrendingUp,
  LibraryBig,
  Dumbbell,
  Apple,
  Syringe,
} from "lucide-react";
import "./AppShell.css";
import { useEffect, useMemo, useState } from "react";
import { GlobalSearch } from "./GlobalSearch";
import { BotaoSync } from "./BotaoSync";
import { useValoresVisiveis, alternarVisibilidadeValores } from "../utils/visibilidadeValores";
import { PerfilTopo } from "./PerfilTopo";
import { resumoAlertas } from "../core/alertas/alertasEngine";
import { useAtalhoBusca } from "../core/atalhos";
import { iniciarVigilancia } from "../core/notificacoes/notificacoes";

interface ItemNav { to: string; label: string; icon: any; end?: boolean }
interface GrupoNav { id: string; label: string; hue: string; itens: ItemNav[] }

const ITENS_SOLTOS_TOPO: ItemNav[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
];

const GRUPOS: GrupoNav[] = [
  {
    id: "financeiro",
    hue: "var(--hue-financeiro)",
    label: "Financeiro",
    itens: [
      { to: "/financeiro", label: "Financeiro", icon: Wallet },
      { to: "/investimentos", label: "Investimentos", icon: PiggyBank },
    ],
  },
  {
    id: "analise",
    hue: "var(--hue-analise)",
    label: "Análise",
    itens: [
      { to: "/analise", label: "Análise financeira", icon: BarChart3 },
      { to: "/projecao", label: "Projeção de fluxo", icon: TrendingUp },
      { to: "/relatorios", label: "Relatórios", icon: FileBarChart2 },
      { to: "/imposto-de-renda", label: "Imposto de Renda", icon: Calculator },
    ],
  },
  {
    id: "bens",
    hue: "var(--hue-bens)",
    label: "Bens",
    itens: [
      { to: "/veiculos", label: "Veículos", icon: Car },
      { to: "/imoveis", label: "Imóveis", icon: Home },
      { to: "/patrimonio", label: "Patrimônio", icon: Building2 },
    ],
  },
  {
    id: "pessoal",
    hue: "var(--hue-pessoal)",
    label: "Pessoal",
    itens: [
      { to: "/familia", label: "Família", icon: Users },
      { to: "/documentos", label: "Documentos", icon: FileText },
      { to: "/educacao", label: "Educação", icon: GraduationCap },
      { to: "/contatos", label: "Contatos", icon: Contact },
      { to: "/senhas", label: "Senhas", icon: KeyRound },
      { to: "/agenda", label: "Agenda", icon: CalendarDays },
      { to: "/tarefas", label: "Tarefas", icon: CheckSquare },
    ],
  },
];

// Bem-estar ganha grupo próprio. Saúde saiu de "Pessoal" de propósito: ao
// lado de Treinos e Alimentação ela deixa de ser um arquivo de exames e
// passa a fazer parte de um conjunto que se cruza — o gasto com academia
// entra no Financeiro, o peso registrado no treino conversa com a evolução
// de exames, a vacina vira alerta.
const GRUPO_BEMESTAR: GrupoNav = {
  id: "bemestar",
  hue: "var(--hue-bemestar)",
  label: "Bem-estar",
  itens: [
    { to: "/saude", label: "Saúde", icon: HeartPulse },
    { to: "/vacinas", label: "Vacinação", icon: Syringe },
    { to: "/treinos", label: "Treinos", icon: Dumbbell },
    { to: "/alimentacao", label: "Alimentação", icon: Apple },
  ],
};

const ITENS_SOLTOS_BASE: ItemNav[] = [
  { to: "/assistente", label: "Assistente", icon: Sparkles },
  // Cadastros era um dos quatro itens do menu "Dados", que saiu. Ele não
  // podia sair junto: é onde vivem as categorias personalizadas, sem as
  // quais o Financeiro não funciona. Voltou a ser item solto, como era antes.
  { to: "/cadastros", label: "Cadastros", icon: LibraryBig },
];

GRUPOS.push(GRUPO_BEMESTAR);

const CHAVE_GRUPOS_ABERTOS = "nexo:grupos-abertos";

function grupoContemRota(grupo: GrupoNav, pathname: string): boolean {
  return grupo.itens.some((i) => pathname === i.to || pathname.startsWith(i.to + "/"));
}

export function AppShell() {
  const [buscaAberta, setBuscaAberta] = useState(false);
  const location = useLocation();
  const valoresVisiveis = useValoresVisiveis();

  // O contador de avisos é recalculado a cada navegação: é barato (consultas
  // indexadas) e garante que o badge some no instante em que o item é
  // resolvido, sem precisar de um store global só pra isso.
  const alertas = useMemo(() => resumoAlertas(), [location.pathname]);

  // Notificações do sistema: a vigilância vive aqui, no shell, porque é o
  // único componente que permanece montado enquanto o app estiver aberto.
  useEffect(() => iniciarVigilancia(), []);

  const [abertos, setAbertos] = useState<Set<string>>(() => {
    const salvos = localStorage.getItem(CHAVE_GRUPOS_ABERTOS);
    if (salvos) return new Set(JSON.parse(salvos));
    const grupoAtivo = GRUPOS.find((g) => grupoContemRota(g, location.pathname));
    return new Set(grupoAtivo ? [grupoAtivo.id] : []);
  });

  // sempre garante que o grupo da rota atual esteja aberto (não fecha os outros)
  useEffect(() => {
    const grupoAtivo = GRUPOS.find((g) => grupoContemRota(g, location.pathname));
    if (grupoAtivo && !abertos.has(grupoAtivo.id)) {
      setAbertos((prev) => new Set(prev).add(grupoAtivo.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem(CHAVE_GRUPOS_ABERTOS, JSON.stringify([...abertos]));
  }, [abertos]);

  // Só ⌘K/Ctrl+K, que é convenção universal e ninguém precisa aprender.
  // As sequências "g <letra>" saíram junto com a tela que as explicava:
  // atalho que depende de uma tela de ajuda pra ser lembrado não é atalho.
  useAtalhoBusca(() => setBuscaAberta(true), () => setBuscaAberta(false));

  function alternarGrupo(id: string) {
    setAbertos((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <PerfilTopo />

        <div className="sidebar-acoes">
          <button className="search-trigger" onClick={() => setBuscaAberta(true)}>
            <Search size={15} />
            <span>Buscar</span>
            <kbd className="search-atalho">⌘K</kbd>
          </button>
          <button
            className={`olho-trigger ${valoresVisiveis ? "visivel" : ""}`}
            onClick={alternarVisibilidadeValores}
            title={valoresVisiveis ? "Ocultar valores" : "Mostrar valores"}
            aria-label={valoresVisiveis ? "Ocultar valores" : "Mostrar valores"}
          >
            {valoresVisiveis ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
          {/* Compacto na barra lateral: aqui o espaço é estreito e o
              contador de pendências vira um ponto. O botão some sozinho
              quando a sincronização não está configurada. */}
          <BotaoSync compacto />
        </div>

        <nav className="nav">
          {ITENS_SOLTOS_TOPO.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Icon size={17} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}

          {GRUPOS.map((grupo) => {
            const aberto = abertos.has(grupo.id);
            const itensVisiveis = grupo.itens;
            if (itensVisiveis.length === 0) return null;
            const doGrupo = alertas.porGrupo[grupo.id] ?? 0;
            return (
              <div key={grupo.id} className="nav-grupo" style={{ ["--hue-grupo" as any]: grupo.hue }}>
                <button className="nav-grupo-header" onClick={() => alternarGrupo(grupo.id)}>
                  <span>{grupo.label}</span>
                  {/* Quando o grupo está fechado, o ponto avisa que tem algo
                      lá dentro. Aberto, o ponto some — os itens já se explicam. */}
                  {!aberto && doGrupo > 0 && <span className="nav-grupo-ponto" aria-label={`${doGrupo} avisos`} />}
                  <ChevronDown size={14} className={`nav-grupo-chevron ${aberto ? "aberto" : ""}`} />
                </button>
                {aberto && (
                  <div className="nav-grupo-itens">
                    {itensVisiveis.map(({ to, label, icon: Icon, end }) => (
                      <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                        <Icon size={16} strokeWidth={2} />
                        <span>{label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="nav-separador" />

          {ITENS_SOLTOS_BASE.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Icon size={17} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <NavLink to="/configuracoes" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <Settings size={17} />
            <span>Configurações</span>
          </NavLink>
        </div>
      </aside>

      <main className="content">
        <Outlet key={valoresVisiveis ? "visivel" : "oculto"} />
      </main>

      {buscaAberta && <GlobalSearch onClose={() => setBuscaAberta(false)} />}

    </div>
  );
}
