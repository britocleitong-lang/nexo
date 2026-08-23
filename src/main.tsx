import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { aplicarTema, obterTemaSalvo } from "./utils/theme";

// Aplica o tema salvo antes do primeiro paint, pra não piscar o tema errado
aplicarTema(obterTemaSalvo());

// Pede ao navegador pra marcar o armazenamento deste site como "persistente"
// — uma camada a mais contra o iOS apagar dados de sites sem uso há 7 dias
// (apps instalados na Tela de Início já ficam isentos dessa regra, mas não
// custa pedir também).
if ("storage" in navigator && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
