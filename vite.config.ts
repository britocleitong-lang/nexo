import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// O GitHub Pages serve o site em /nome-do-repositorio/, não na raiz. Sem
// avisar o Vite disso, todos os caminhos de script, CSS e ícone apontam
// para a raiz do domínio e o app abre em branco.
//
// A variável BASE resolve: `BASE=/nexo/ npm run build` gera os caminhos
// certos para o GitHub Pages, e `npm run build` sem ela continua gerando
// para a raiz — que é o caso do servidor local e de Netlify/Cloudflare.
//
// O manifest do PWA precisa da mesma correção: start_url e scope fora do
// lugar fazem o navegador recusar a instalação como aplicativo.
const BASE = process.env.BASE || "/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Nexo — Sistema Operacional Pessoal",
        short_name: "Nexo",
        description: "Central pessoal para finanças, veículos, documentos, saúde e mais.",
        start_url: BASE,
        scope: BASE,
        display: "standalone",
        orientation: "any",
        lang: "pt-BR",
        background_color: "#f6f6f4",
        // Cor da barra de título da janela quando instalado no Windows.
        theme_color: "#10554e",
        categories: ["finance", "productivity", "utilities"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          // "maskable" evita que o Windows corte a letra ao aplicar a máscara
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        // Aparecem ao clicar com o botão direito no ícone da barra de tarefas
        shortcuts: [
          { name: "Financeiro", short_name: "Financeiro", url: `${BASE}#/financeiro`, icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
          { name: "Planilha de lançamentos", short_name: "Planilha", url: `${BASE}#/financeiro`, icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
          { name: "Assistente", short_name: "Assistente", url: `${BASE}#/assistente`, icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
          { name: "Documentos", short_name: "Documentos", url: `${BASE}#/documentos`, icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,wasm}"],
      },
    }),
  ],
});
