import { useEffect, useState } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { initDatabase } from "./database/db";
import { temPinConfigurado } from "./utils/pin";
import { LockScreen } from "./components/LockScreen";
import { sincronizarSilenciosamente } from "./core/sync/sincronizacao";
import { podarLog } from "./core/sync/oplog";
import { AppShell } from "./components/AppShell";
import { ConfirmHost } from "./components/Confirm";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { FinanceiroPage } from "./features/financeiro/FinanceiroPage";
import { VeiculosPage } from "./features/veiculos/VeiculosPage";
import { VeiculoDetalhePage } from "./features/veiculos/VeiculoDetalhePage";
import { DocumentosPage } from "./features/documentos/DocumentosPage";
import { SaudePage } from "./features/saude/SaudePage";
import { AgendaPage } from "./features/agenda/AgendaPage";
import { PatrimonioPage } from "./features/patrimonio/PatrimonioPage";
import { PessoasPage } from "./features/pessoas/PessoasPage";
import { TarefasPage } from "./features/tarefas/TarefasPage";
import { CadastrosPage } from "./features/cadastros/CadastrosPage";
import { InvestimentosPage } from "./features/investimentos/InvestimentosPage";
import { AnaliseFinanceiraPage } from "./features/analise/AnaliseFinanceiraPage";
import { ImoveisPage } from "./features/imoveis/ImoveisPage";
import { ImovelDetalhePage } from "./features/imoveis/ImovelDetalhePage";
import { ContatosPage } from "./features/contatos/ContatosPage";
import { RelatoriosPage } from "./features/relatorios/RelatoriosPage";
import { ImpostoRendaPage } from "./features/impostoderenda/ImpostoRendaPage";
import { EducacaoPage } from "./features/educacao/EducacaoPage";
import { SenhasPage } from "./features/senhas/SenhasPage";
import { AssistentePage } from "./features/assistente/AssistentePage";
import { ConfiguracoesPage } from "./features/configuracoes/ConfiguracoesPage";
import { ProjecaoPage } from "./features/projecao/ProjecaoPage";
import { materializarAutomaticas } from "./core/recorrencia/recorrenciaRepository";
import { podarEstadosAntigos } from "./core/alertas/alertasRepository";
import { TreinosPage } from "./features/treinos/TreinosPage";
import { AlimentacaoPage } from "./features/alimentacao/AlimentacaoPage";
import { VacinasPage } from "./features/saude/VacinasPage";
import { AnaliseVeiculoPage } from "./features/veiculos/AnaliseVeiculoPage";
import { semearExercicios } from "./features/treinos/treinosRepository";
import { semearAlimentos } from "./features/alimentacao/alimentacaoRepository";

const CHAVE_DESBLOQUEADO = "nexo:unlocked";

export default function App() {
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [desbloqueado, setDesbloqueado] = useState(
    () => !temPinConfigurado() || sessionStorage.getItem(CHAVE_DESBLOQUEADO) === "1",
  );

  useEffect(() => {
    initDatabase()
      .then(async () => {
        try {
          // Só as recorrências marcadas como automáticas são lançadas sem
          // perguntar. As demais viram a lista de pendentes que a tela de
          // Recorrências mostra pra confirmação — o app nunca grava um
          // lançamento financeiro sozinho sem o usuário ter pedido isso.
          await materializarAutomaticas();

          // Catálogos de Bem-estar: só semeiam se estiverem vazios, então
          // rodar toda abertura é barato e cobre quem já tinha o app antes.
          semearExercicios();
          semearAlimentos();

          // Sem PIN configurado não existe o gancho do destravamento, então
          // a sincronia de abertura entra aqui.
          if (!sessionStorage.getItem(CHAVE_DESBLOQUEADO)) void sincronizarSilenciosamente();
          await podarLog();

          await podarEstadosAntigos();
        } catch {
          // Manutenção de abertura falhando não pode impedir o app de abrir.
        }
        setPronto(true);
      })
      .catch((e) => setErro(String(e)));
  }, []);

  if (!desbloqueado) {
    return (
      <LockScreen
        onUnlock={() => {
          sessionStorage.setItem(CHAVE_DESBLOQUEADO, "1");
          setDesbloqueado(true);
          // Puxa o que os outros aparelhos escreveram, sem travar a
          // entrada: a tela abre na hora e a sincronia acontece atrás.
          // Se a rede estiver fora ou a sessão do Google tiver expirado,
          // não acontece nada e ninguém é interrompido — a sincronia é
          // conveniência, não pedágio.
          void sincronizarSilenciosamente();
        }}
      />
    );
  }

  if (erro) {
    return <p style={{ padding: 16, color: "red", fontFamily: "system-ui" }}>Erro ao iniciar o banco: {erro}</p>;
  }

  if (!pronto) {
    return <p style={{ padding: 16, fontFamily: "system-ui" }}>Carregando o Nexo...</p>;
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/financeiro" element={<FinanceiroPage />} />
          <Route path="/projecao" element={<ProjecaoPage />} />
          <Route path="/analise" element={<AnaliseFinanceiraPage />} />
          <Route path="/veiculos" element={<VeiculosPage />} />
          <Route path="/veiculos/:id" element={<VeiculoDetalhePage />} />
          <Route path="/veiculos/:id/analise" element={<AnaliseVeiculoPage />} />
          <Route path="/imoveis" element={<ImoveisPage />} />
          <Route path="/imoveis/:id" element={<ImovelDetalhePage />} />
          <Route path="/contatos" element={<ContatosPage />} />
          <Route path="/relatorios" element={<RelatoriosPage />} />
          <Route path="/imposto-de-renda" element={<ImpostoRendaPage />} />
          <Route path="/educacao" element={<EducacaoPage />} />
          <Route path="/senhas" element={<SenhasPage />} />
          <Route path="/documentos" element={<DocumentosPage />} />
          <Route path="/saude" element={<SaudePage />} />
          <Route path="/vacinas" element={<VacinasPage />} />
          <Route path="/treinos" element={<TreinosPage />} />
          <Route path="/alimentacao" element={<AlimentacaoPage />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/patrimonio" element={<PatrimonioPage />} />
          <Route path="/familia" element={<PessoasPage />} />
          <Route path="/tarefas" element={<TarefasPage />} />
          <Route path="/investimentos" element={<InvestimentosPage />} />
          <Route path="/assistente" element={<AssistentePage />} />
          <Route path="/cadastros" element={<CadastrosPage />} />
          <Route path="/configuracoes" element={<ConfiguracoesPage />} />
        </Route>
      </Routes>
      <ConfirmHost />
    </HashRouter>
  );
}
