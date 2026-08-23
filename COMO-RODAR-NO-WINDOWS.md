# Rodando o Nexo no Windows sem janela preta

## Preparo (uma vez só)

1. Instale o **Node.js** (nodejs.org, versão LTS) — é o que executa o servidor.
2. Abra a pasta do projeto no terminal e rode:
   ```
   npm install
   npm run build
   ```
   Isso gera a pasta `dist/`, que é o app pronto.

Depois disso você não precisa mais do terminal.

## Rodando

- **`iniciar-oculto.vbs`** — sobe o servidor sem nenhuma janela. Dê dois cliques.
- **`abrir-nexo.vbs`** — sobe o servidor e já abre o navegador.
- **`parar.vbs`** — encerra o servidor.

O endereço é **http://localhost:4173**.

## Iniciar junto com o Windows

Modo mais simples, sem instalar nada:

1. Tecle **Win + R**, digite `shell:startup` e Enter
2. Abre a pasta de Inicializar do Windows
3. Copie um **atalho** do `iniciar-oculto.vbs` para dentro dela

Pronto — toda vez que você entrar no Windows, o servidor sobe sozinho e
invisível.

## Alternativa: Agendador de Tarefas (mais controle)

Use esta opção se quiser que rode mesmo antes de fazer login, ou reinicie
sozinho se cair.

1. Menu Iniciar → **Agendador de Tarefas** → **Criar Tarefa** (não "tarefa básica")
2. Aba **Geral**: nome "Nexo"; marque **Executar estando o usuário conectado ou não**
   e **Executar com privilégios mais altos**
3. Aba **Disparadores** → Novo → **Ao fazer logon**
4. Aba **Ações** → Novo → Programa: `wscript.exe`
   Argumentos: `"C:\caminho\completo\ate\nexo\iniciar-oculto.vbs"`
5. Aba **Configurações**: marque **Se a tarefa falhar, reiniciar a cada** 1 minuto

## Alternativa: serviço real do Windows (NSSM)

Só vale a pena se você quiser que apareça em `services.msc` e sobreviva sem
nenhum usuário logado.

1. Baixe o **NSSM** em nssm.cc e extraia
2. No terminal **como administrador**, dentro da pasta do nssm:
   ```
   nssm install Nexo
   ```
3. Na janela que abrir:
   - **Path**: `C:\Program Files\nodejs\node.exe`
   - **Startup directory**: a pasta do projeto
   - **Arguments**: `servidor.cjs`
4. **Install service**. Depois: `nssm start Nexo`

Para remover: `nssm remove Nexo confirm`

## Por que localhost funciona sem HTTPS

O navegador trata `localhost` como contexto seguro. Por isso o service
worker, o armazenamento persistente e o funcionamento offline continuam
valendo, mesmo sem certificado.

## Detalhe técnico do servidor

O `servidor.cjs` entrega o arquivo `.wasm` do SQLite com o tipo
`application/wasm`. Sem isso o navegador recusa carregar o banco e o app
abre em branco — é o erro mais comum ao servir esse tipo de aplicação com
um servidor genérico.
