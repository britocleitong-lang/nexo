/**
 * Servidor local do Nexo.
 *
 * Só Node puro — nada de npm install. Serve a pasta dist/ em
 * http://localhost:4173.
 *
 * Dois detalhes que quebram o app se forem ignorados:
 *  - o .wasm do SQLite precisa vir com Content-Type "application/wasm",
 *    senão o navegador recusa a compilação em streaming;
 *  - localhost conta como contexto seguro, então o service worker e o
 *    armazenamento persistente funcionam sem HTTPS.
 *
 * Uso:  node servidor.cjs
 * Para rodar sem janela, veja iniciar-oculto.vbs
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORTA = Number(process.env.PORTA || 4173);
const RAIZ = path.join(__dirname, "dist");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

if (!fs.existsSync(RAIZ)) {
  console.error(`Pasta "dist" não encontrada em ${RAIZ}.`);
  console.error('Rode "npm install" e depois "npm run build" antes de iniciar o servidor.');
  process.exit(1);
}

function enviar(res, status, corpo, tipo) {
  res.writeHead(status, {
    "Content-Type": tipo,
    // Sem cache no HTML, senão o navegador segura uma versão antiga do app
    "Cache-Control": tipo.startsWith("text/html") ? "no-cache" : "public, max-age=3600",
  });
  res.end(corpo);
}

const servidor = http.createServer((req, res) => {
  try {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    let alvo = path.join(RAIZ, url);

    // Impede sair da pasta dist com "../"
    if (!alvo.startsWith(RAIZ)) {
      return enviar(res, 403, "Acesso negado", "text/plain; charset=utf-8");
    }

    if (fs.existsSync(alvo) && fs.statSync(alvo).isDirectory()) {
      alvo = path.join(alvo, "index.html");
    }

    // Rota desconhecida cai no index.html (o app usa rotas com #, mas isso
    // garante que qualquer caminho funcione)
    if (!fs.existsSync(alvo)) {
      alvo = path.join(RAIZ, "index.html");
    }

    const ext = path.extname(alvo).toLowerCase();
    enviar(res, 200, fs.readFileSync(alvo), TIPOS[ext] || "application/octet-stream");
  } catch (erro) {
    enviar(res, 500, `Erro interno: ${erro.message}`, "text/plain; charset=utf-8");
  }
});

servidor.listen(PORTA, "127.0.0.1", () => {
  console.log(`Nexo rodando em http://localhost:${PORTA}`);
  console.log("Feche esta janela para parar. (Ctrl+C)");
});
