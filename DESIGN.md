# Nexo — decisões de design

## A ideia: cor como endereço

O app tem 15 áreas. O problema real de orientação não é "isso é urgente?",
é "onde eu estou?". Então a cor trabalha como **endereço**: cada grupo do
menu tem um matiz próprio (`--hue-financeiro`, `--hue-analise`,
`--hue-bens`, `--hue-pessoal`) que aparece no ícone e no item ativo. Você
reconhece a seção pela cor antes de ler o título.

Como a cor virou endereço, o **alerta se distingue pela forma**: pastilha
preenchida com um ponto na frente (`.badge-danger`, `.badge-warn`), não
por matiz solto.

Matiz principal: verde-pinho fechado (`--brand-700: #10554e`). Fugimos do
azul genérico de painel e do verde-dinheiro óbvio.

## Superfícies

Claras e empilhadas: fundo levemente quente (`--n-50`), cartões brancos com
canto generoso (18px) e sombra suave. O app é usado em sessões curtas e
frequentes — a leitura precisa ser confortável, não austera.

Abas são pílulas sobre trilho recuado, não sublinhados.

## Tipografia

**Inter** em toda a interface, com algarismos tabulares nos números.

Testei Plus Jakarta Sans pela forma mais acolhedora, mas aquele build tinha
métricas de espaço defeituosas — palavras grudavam ("Saldogeral",
"Precisade você"). Nem `text-rendering` nem `font-kerning: none` resolveram.
A personalidade aqui vem da cor e das camadas, não do tipo. **Se for trocar
a fonte, confira o espaçamento entre palavras numa captura antes de fechar.**

## Modo planilha (Financeiro → Planilha)

Grade editável que segue as convenções que a mão já conhece do Excel:
setas navegam · digitar edita substituindo · Enter confirma e desce · Tab
confirma e avança · F2/duplo clique edita mantendo o valor · Esc cancela ·
Delete limpa · colar TSV preenche várias linhas.

Cada linha é uma transação real: sair da célula grava direto no banco.
Digitar uma categoria que não existe cria a categoria na hora.

## Piso de qualidade

- Foco visível pelo teclado
- Responsivo até 640px
- `prefers-reduced-motion` respeitado
- Ação destrutiva passa por `confirmar()` — nada é apagado num clique só
- Estado vazio é convite para agir, e nunca contradiz o que está logo abaixo

## Cofre de senhas

As senhas são cifradas com **AES-GCM 256**, com chave derivada da
senha-mestra via PBKDF2 (SHA-256, 250 mil iterações). A senha-mestra não é
gravada: guardamos só um verificador cifrado. A chave derivada vive apenas
na memória da aba — recarregou, o cofre tranca.

Consequência assumida: **esquecer a senha-mestra significa perder o
conteúdo do cofre.** Não existe recuperação, porque qualquer porta de
recuperação seria também uma porta de entrada.

## Documentos

A tela abre pelas **pessoas**, não pelos documentos — é assim que a cabeça
organiza ("os documentos da Ana"). Dentro de cada pessoa há um checklist
com os documentos comuns no Brasil (`tiposDocumento.ts`), mostrando o que
ainda falta; clicar num item já abre o cadastro com o nome preenchido.

## Modo planilha

Além da edição por teclado, a grade tem ordenação por coluna (clique no
título), filtro por coluna (ícone de funil) e seleção em bloco
(Shift+setas, Shift+clique, Ctrl+A) com barra de status mostrando
contagem, soma, média, mínimo e máximo — como a do Excel.

## Perfil no topo da barra

O topo mostra quem usa o app, não o nome do produto. A foto é reduzida a
256px e guardada como data URL no próprio banco — assim vai junto no
backup, sem depender de arquivo externo.

## Documentos: pendentes como sugestão, não como registro

As ~30 linhas apagadas são a lista de referência brasileira
(`tiposDocumento.ts`) renderizada como sugestão — elas **não existem no
banco**. Criar 30 registros vazios por pessoa poluiria backup, busca e
relatórios. Clicar numa pendente abre o cadastro já preenchido.

A faixa à esquerda de cada linha diz o estado: cheia (verde) quando há
arquivo anexado, âmbar quando falta o arquivo, cinza quando é só sugestão.

## Assistente: reconhecimento tolerante a erro

`reconhecimento.ts` usa Fuse.js sobre uma lista de formas de dizer cada
intenção, com o texto normalizado (sem acento, minúsculo, sem pontuação).
Isso entra como **rede de segurança**: as regras exatas rodam primeiro, e
só o que não casou passa pela busca aproximada. Assim "qnt gastei" e
"quanto e meu patrimonio" funcionam sem afrouxar o que já era preciso.

## Modo professor (27 lições)

Lições curtas em `licoes.ts`. O que as diferencia de texto genérico é o
bloco **"No seu caso"**: cada lição roda uma função sobre os dados reais e
diz onde a pessoa está em relação ao conceito.

Limite assumido e escrito na tela: são princípios de organização
financeira, **não recomendação de investimento** — nenhuma lição diz onde
aplicar dinheiro.

## Assistente: como ele entende as perguntas

Quatro camadas, nesta ordem:

1. **`conversa.ts`** — cumprimento, cortesia, data/hora, contas simples.
2. **`consultas.ts`** — consultas compostas. Em vez de perguntas fixas, a
   resposta é montada a partir do contexto extraído: assunto + operação +
   período + entidade. É o que permite "quanto a Ana gastou com saúde nos
   últimos 3 meses" sem alguém ter previsto essa frase.
3. **Regras exatas** do motor antigo (documentos, anexos, casos pontuais).
4. **`reconhecimento.ts`** — busca aproximada (Fuse.js) como rede de
   segurança para o que foi escrito errado.

`vocabulario.ts` é o dicionário: ~250 termos mapeados para os 15 assuntos
do app, mais a extração de período, pessoa, veículo, imóvel, categoria,
conta, investimento e natureza.

**Fora do assunto:** se a frase não tem nenhuma âncora no sistema
(`temAncoraNoSistema`), ele diz que aquilo está fora do que ele enxerga —
em vez de sugerir que a pessoa reformule uma pergunta que nunca teria
resposta.

Armadilhas já corrigidas, para não voltarem:
- `compare` não casava com o radical `comparar` — usar `compar\w*`.
- "fazer" no vocabulário de tarefas capturava "me ensina a fazer bolo".
- "gastei com aluguel" casava com a categoria de **receita** "Aluguel
  recebido"; agora o tipo de categoria segue o verbo da frase.
- "saldo da conta X" caía no filtro de gastos daquela conta.
- "me fala sobre o Civic" respondia gasto em vez de resumo da entidade.


## Voz: onde a naturalidade realmente estava

Cheguei a integrar a ElevenLabs e removi. O ganho não compensava depender de
conta, chave e cota externas num app que se propõe local.

O que descobri testando: o motor de voz do Windows já é razoável — quem soava
robótico era **o texto**. Num app financeiro, "R$ 1.234,56" vira "erre cifrão
um ponto dois três quatro vírgula cinco seis", e "16/08/2026" vira uma
sequência de dígitos.

`utils/falar.ts` reescreve o texto como uma pessoa leria antes de falar:

| Escrito | Falado |
|---|---|
| R$ 1.234,56 | mil duzentos e trinta e quatro reais e cinquenta e seis centavos |
| R$ 1.000.000,00 | um milhão **de** reais |
| 16/08/2026 | dezesseis de agosto de 2026 |
| 65% | sessenta e cinco por cento |
| 41.250 km | quarenta e um mil duzentos e cinquenta quilômetros |
| CNH, IPVA | soletrados letra a letra |

Além disso, fala **frase por frase com 160 ms de pausa** entre elas — é o que
dá cadência em vez de rajada — e prefere automaticamente vozes neurais
("Natural"/"Online"/"Neural") quando existem.

Velocidade padrão 0.95 (levemente abaixo de 1 soa menos apressado), com
controles de velocidade e tom nas Configurações.

## Marca

O "N" é desenhado como um grafo: duas hastes ligadas por uma aresta, com um
nó em cada ponta. É a tese do produto — as áreas da vida conectadas entre
si, não em gavetas separadas.

Regras dos ícones (`/tmp` não; gerador em `public/icons`):
- Cantos **transparentes** (RGBA). Em RGB eles ficam brancos e aparece um
  halo claro em volta do ícone numa barra de tarefas escura.
- O ícone `maskable` é full-bleed, sem cantos arredondados e com margem
  segura maior — o Windows aplica a própria máscara e cortaria as bordas.
- Abaixo de 128px os nós são omitidos: detalhe pequeno demais vira borrão.

O mesmo desenho existe em SVG (`components/LogoNexo.tsx`) para a barra
lateral e a tela de bloqueio.

## Ocultar valores (o olho)

Botão ao lado da busca, na barra lateral. Toda sessão nova começa com os
valores mascarados (`R$ ••••••`) — quem abre o app do lado de alguém não
expõe saldo ou patrimônio sem querer.

**Ponto único de interceptação**: `formatarMoeda()` em `utils/format.ts`
mascara sozinha, então as ~13 telas que já chamavam essa função ganharam a
máscara automaticamente, sem precisar editar uma por uma.

**Armadilha evitada**: a planilha usa uma formatação própria pro número da
célula (sem "R$"), que também precisa mascarar na exibição — mas ela é a
MESMA função usada para preencher o valor quando você entra em modo de
edição (F2/duplo clique). Se eu tivesse mascarado ali, editar uma célula
oculta gravaria o texto "R$ ••••••" no banco em vez do número real. A
correção: `formatarNumero` continua pura, e a máscara entra só no ponto
de renderização da célula fechada, nunca na inicialização da edição.
Testei especificamente esse caminho antes de fechar.

Persiste em `sessionStorage` (não `localStorage`) — some sozinho ao
fechar a aba/janela, o que já implementa "nova sessão = oculto" sem
precisar de lógica extra.

Alternar o olho força a página atual a remontar (`key` no `<Outlet />`),
porque `formatarMoeda` não é um hook — sem o remonte, uma tela já aberta
no momento do clique ficaria com o texto antigo até você navegar pra
outro lugar.
