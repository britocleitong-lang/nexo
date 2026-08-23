// Schema do banco de dados do Nexo — fonte de verdade do modelo de dados.

export const SCHEMA_VERSION = 15;

export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS _meta (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );

  -- Família -----------------------------------------------------------
  CREATE TABLE IF NOT EXISTS pessoas (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    parentesco TEXT,
    data_nascimento TEXT,
    principal INTEGER NOT NULL DEFAULT 0,
    foto TEXT,
    email TEXT,
    telefone TEXT,
    profissao TEXT,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Documentos ----------------------------------------------------------
  CREATE TABLE IF NOT EXISTS documentos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    data_emissao TEXT,
    data_validade TEXT,
    numero TEXT,
    orgao_emissor TEXT,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Veículos ----------------------------------------------------------
  CREATE TABLE IF NOT EXISTS veiculos (
    id TEXT PRIMARY KEY,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    marca TEXT NOT NULL,
    modelo TEXT NOT NULL,
    ano TEXT,
    placa TEXT,
    renavam TEXT,
    km_atual REAL,
    data_compra TEXT,
    valor_compra REAL,
    valor_atual REAL,
    combustivel TEXT,
    cor TEXT,
    foto_url TEXT,
    fipe_marca_codigo TEXT,
    fipe_modelo_codigo TEXT,
    fipe_ano_codigo TEXT,
    fipe_atualizado_em TEXT,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Abastecimentos — log dedicado de combustível (alimenta o cálculo de
  -- consumo médio, ao estilo Drivvo/Fuelly) ----------------------------------
  CREATE TABLE IF NOT EXISTS abastecimentos (
    id TEXT PRIMARY KEY,
    veiculo_id TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    km REAL NOT NULL,
    litros REAL NOT NULL,
    valor_total REAL NOT NULL,
    posto TEXT,
    tanque_cheio INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_abastecimentos_veiculo ON abastecimentos(veiculo_id, data);

  CREATE TABLE IF NOT EXISTS manutencoes (
    id TEXT PRIMARY KEY,
    veiculo_id TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    data TEXT NOT NULL,
    km REAL,
    valor REAL,
    oficina TEXT,
    observacoes TEXT,
    proxima_data TEXT,
    proximo_km REAL,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Modificações/customizações do veículo (separado de manutenção comum) ----
  CREATE TABLE IF NOT EXISTS modificacoes (
    id TEXT PRIMARY KEY,
    veiculo_id TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    data TEXT NOT NULL,
    valor REAL,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Histórico de leituras de quilometragem — alimenta o gráfico de evolução --
  CREATE TABLE IF NOT EXISTS km_registros (
    id TEXT PRIMARY KEY,
    veiculo_id TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    km REAL NOT NULL,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_km_registros_veiculo ON km_registros(veiculo_id, data);

  -- Financeiro ----------------------------------------------------------
  CREATE TABLE IF NOT EXISTS contas (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,          -- corrente | poupanca | dinheiro | investimento | outra
    saldo_inicial REAL NOT NULL DEFAULT 0,
    instituicao TEXT,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cartoes (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    limite REAL,
    dia_fechamento INTEGER,
    dia_vencimento INTEGER,
    instituicao TEXT,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categorias (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL           -- receita | despesa
  );

  CREATE TABLE IF NOT EXISTS transacoes (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,          -- receita | despesa
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    data TEXT NOT NULL,
    categoria_id TEXT REFERENCES categorias(id) ON DELETE SET NULL,
    conta_id TEXT REFERENCES contas(id) ON DELETE SET NULL,
    cartao_id TEXT REFERENCES cartoes(id) ON DELETE SET NULL,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    veiculo_id TEXT REFERENCES veiculos(id) ON DELETE SET NULL,
    investimento_id TEXT REFERENCES investimentos(id) ON DELETE SET NULL,
    natureza TEXT,                -- fixo | variavel | investimento (metodologia de classificação)
    recorrente INTEGER NOT NULL DEFAULT 0,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Saúde ----------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS registros_saude (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,           -- consulta | exame | vacina | medicamento | procedimento
    nome TEXT NOT NULL,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    data TEXT NOT NULL,
    profissional TEXT,
    local TEXT,
    resultado TEXT,
    valor_numerico REAL,
    unidade TEXT,
    dose TEXT,
    frequencia TEXT,
    proxima_data TEXT,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Agenda ----------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS eventos (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    tipo TEXT NOT NULL,
    data_hora TEXT NOT NULL,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    veiculo_id TEXT REFERENCES veiculos(id) ON DELETE SET NULL,
    observacoes TEXT,
    concluido INTEGER NOT NULL DEFAULT 0,
    recorrencia TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Tarefas ----------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tarefas (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    prioridade TEXT NOT NULL DEFAULT 'media', -- baixa | media | alta
    prazo TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',  -- pendente | andamento | concluida
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    recorrencia TEXT,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Subtarefas (checklist dentro de uma tarefa) -----------------------------
  CREATE TABLE IF NOT EXISTS subtarefas (
    id TEXT PRIMARY KEY,
    tarefa_id TEXT NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    concluida INTEGER NOT NULL DEFAULT 0,
    ordem INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_subtarefas_tarefa ON subtarefas(tarefa_id);

  -- Patrimônio ----------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS bens (
    id TEXT PRIMARY KEY,
    descricao TEXT NOT NULL,
    categoria TEXT NOT NULL,      -- livre — ver opcoes_personalizadas (grupo bem_categoria)
    valor_aquisicao REAL,
    valor_atual REAL,
    data_aquisicao TEXT,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Listas personalizáveis (categorias de documento, tipos de evento, categorias
  -- de bem) — o usuário pode adicionar novas opções direto no formulário --------
  CREATE TABLE IF NOT EXISTS opcoes_personalizadas (
    id TEXT PRIMARY KEY,
    grupo TEXT NOT NULL,
    valor TEXT NOT NULL,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_opcoes_grupo ON opcoes_personalizadas(grupo);

  -- Patrimônio líquido = ativos (bens) - passivos (dívidas) ------------------
  CREATE TABLE IF NOT EXISTS dividas (
    id TEXT PRIMARY KEY,
    descricao TEXT NOT NULL,
    tipo TEXT NOT NULL,          -- emprestimo | financiamento | cartao | outro
    valor_total REAL NOT NULL,
    valor_pago REAL NOT NULL DEFAULT 0,
    parcelas_totais INTEGER,
    parcelas_pagas INTEGER DEFAULT 0,
    taxa_juros REAL,
    data_inicio TEXT,
    data_vencimento_final TEXT,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Snapshot diário do patrimônio, gerado sozinho quando a tela é aberta,
  -- pra construir o gráfico de evolução ao longo do tempo -------------------
  CREATE TABLE IF NOT EXISTS patrimonio_historico (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL UNIQUE,
    valor_ativos REAL NOT NULL,
    valor_passivos REAL NOT NULL,
    valor_liquido REAL NOT NULL,
    criado_em TEXT NOT NULL
  );

  -- Orçamento mensal por categoria (recorrente — mesmo limite todo mês) -----
  CREATE TABLE IF NOT EXISTS orcamentos (
    id TEXT PRIMARY KEY,
    categoria_id TEXT NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    valor_limite REAL NOT NULL,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Investimentos (incluindo reserva de emergência), com histórico de
  -- aportes/resgates/rendimentos ao longo do tempo -------------------------
  CREATE TABLE IF NOT EXISTS investimentos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,        -- reserva_emergencia | renda_fixa | renda_variavel | fundo | previdencia | outro
    valor_atual REAL NOT NULL DEFAULT 0,
    meta_valor REAL,
    instituicao TEXT,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS movimentos_investimento (
    id TEXT PRIMARY KEY,
    investimento_id TEXT NOT NULL REFERENCES investimentos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,        -- aporte | resgate | rendimento
    valor REAL NOT NULL,
    data TEXT NOT NULL,
    conta_id TEXT REFERENCES contas(id) ON DELETE SET NULL,
    transacao_id TEXT REFERENCES transacoes(id) ON DELETE SET NULL,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_movimentos_investimento ON movimentos_investimento(investimento_id, data);

  -- Imóveis (mesma lógica de veículos: manutenção vinculada ao Financeiro) ---
  CREATE TABLE IF NOT EXISTS imoveis (
    id TEXT PRIMARY KEY,
    apelido TEXT NOT NULL,
    tipo TEXT NOT NULL,          -- casa | apartamento | terreno | outro
    endereco TEXT,
    area_m2 REAL,
    valor_atual REAL,
    valor_compra REAL,
    data_compra TEXT,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS manutencoes_imovel (
    id TEXT PRIMARY KEY,
    imovel_id TEXT NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    data TEXT NOT NULL,
    valor REAL,
    prestador TEXT,
    observacoes TEXT,
    proxima_data TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_manutencoes_imovel ON manutencoes_imovel(imovel_id);

  -- Contatos (rede de profissionais — médico, mecânico, contador...) ---------
  CREATE TABLE IF NOT EXISTS contatos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL,     -- medico | mecanico | contador | seguro | advogado | outro
    especialidade TEXT,
    empresa TEXT,
    telefone TEXT,
    email TEXT,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Cofre de senhas. O campo senha_cifrada guarda AES-GCM (iv.conteudo),
  -- nunca texto puro — ver src/utils/cofre.ts. -----------------------------
  CREATE TABLE IF NOT EXISTS senhas (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    usuario TEXT,
    senha_cifrada TEXT NOT NULL,
    url TEXT,
    categoria TEXT,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Anexos — tabela genérica usada por vários módulos (documentos, saúde,
  -- manutenções, modificações, bens, transações, tarefas, agenda). Os
  -- arquivos ficam guardados como BLOB dentro do próprio banco, então já
  -- entram automaticamente no backup/restauração existente — não precisa
  -- de nenhum mecanismo novo de armazenamento de arquivo. ------------------
  CREATE TABLE IF NOT EXISTS anexos (
    id TEXT PRIMARY KEY,
    entidade_tipo TEXT NOT NULL,
    entidade_id TEXT NOT NULL,
    nome_arquivo TEXT NOT NULL,
    tipo_mime TEXT,
    tamanho INTEGER,
    dados BLOB NOT NULL,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_anexos_entidade ON anexos(entidade_tipo, entidade_id);

  -- =====================================================================
  -- v12 — automação: recorrência, parcelamento, alertas, metas, regras
  -- =====================================================================

  -- Motor de recorrência. Cada linha é um MOLDE, não um lançamento. O
  -- gerador (core/recorrencia) compara proxima_ocorrencia com hoje e
  -- materializa as transações que faltam, avançando o molde. Isso mantém a
  -- tabela transacoes como fonte única de verdade do que aconteceu de fato,
  -- e o molde como fonte de verdade do que vai acontecer.
  CREATE TABLE IF NOT EXISTS recorrencias (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,               -- receita | despesa
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    frequencia TEXT NOT NULL,         -- diaria | semanal | quinzenal | mensal | bimestral | trimestral | semestral | anual
    dia_referencia INTEGER,           -- dia do mês (1-31) para frequências mensais+
    data_inicio TEXT NOT NULL,
    data_fim TEXT,                    -- null = sem fim
    proxima_ocorrencia TEXT NOT NULL, -- ISO date do próximo lançamento a materializar
    categoria_id TEXT REFERENCES categorias(id) ON DELETE SET NULL,
    conta_id TEXT REFERENCES contas(id) ON DELETE SET NULL,
    cartao_id TEXT REFERENCES cartoes(id) ON DELETE SET NULL,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    veiculo_id TEXT REFERENCES veiculos(id) ON DELETE SET NULL,
    natureza TEXT,
    lancar_automatico INTEGER NOT NULL DEFAULT 0, -- 0 = pede confirmação, 1 = lança sozinho
    ativa INTEGER NOT NULL DEFAULT 1,
    ultima_geracao TEXT,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_recorrencias_proxima ON recorrencias(ativa, proxima_ocorrencia);

  -- Compra parcelada: um registro "pai" e N transações filhas já projetadas
  -- nos meses futuros (marcadas como pago=0 até a fatura virar).
  CREATE TABLE IF NOT EXISTS parcelamentos (
    id TEXT PRIMARY KEY,
    descricao TEXT NOT NULL,
    valor_total REAL NOT NULL,
    parcelas_totais INTEGER NOT NULL,
    data_primeira TEXT NOT NULL,
    categoria_id TEXT REFERENCES categorias(id) ON DELETE SET NULL,
    cartao_id TEXT REFERENCES cartoes(id) ON DELETE SET NULL,
    conta_id TEXT REFERENCES contas(id) ON DELETE SET NULL,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    veiculo_id TEXT REFERENCES veiculos(id) ON DELETE SET NULL,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Metas financeiras (juntar X até uma data), opcionalmente amarradas a um
  -- investimento existente — aí o progresso é lido do saldo real, não digitado.
  CREATE TABLE IF NOT EXISTS metas (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    valor_alvo REAL NOT NULL,
    valor_inicial REAL NOT NULL DEFAULT 0,
    data_alvo TEXT,
    investimento_id TEXT REFERENCES investimentos(id) ON DELETE SET NULL,
    conta_id TEXT REFERENCES contas(id) ON DELETE SET NULL,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    concluida INTEGER NOT NULL DEFAULT 0,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Regras de categorização automática. Aplicadas na importação de extrato
  -- e disponíveis como sugestão no formulário manual.
  CREATE TABLE IF NOT EXISTS regras_categorizacao (
    id TEXT PRIMARY KEY,
    padrao TEXT NOT NULL,             -- texto a procurar na descrição
    modo TEXT NOT NULL DEFAULT 'contem', -- contem | comeca | igual | regex
    categoria_id TEXT REFERENCES categorias(id) ON DELETE CASCADE,
    natureza TEXT,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    veiculo_id TEXT REFERENCES veiculos(id) ON DELETE SET NULL,
    prioridade INTEGER NOT NULL DEFAULT 0,
    vezes_aplicada INTEGER NOT NULL DEFAULT 0,
    ativa INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Estado dos alertas: quando o usuário dispensa ou adia um alerta, o
  -- motor respeita. A chave é determinística (origem+id+ano-mês) pra que o
  -- mesmo alerta recorrente volte no ciclo seguinte.
  CREATE TABLE IF NOT EXISTS alertas_estado (
    chave TEXT PRIMARY KEY,
    estado TEXT NOT NULL,             -- dispensado | adiado
    adiado_ate TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  -- Trilha de auditoria leve das tabelas financeiras. Guarda o "antes"
  -- serializado, o suficiente pra responder "quem mudou isso e quando".
  CREATE TABLE IF NOT EXISTS auditoria (
    id TEXT PRIMARY KEY,
    tabela TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    acao TEXT NOT NULL,               -- criar | atualizar | excluir
    resumo TEXT,
    dados_antes TEXT,
    dados_depois TEXT,
    perfil TEXT,
    criado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_auditoria_registro ON auditoria(tabela, registro_id);
  CREATE INDEX IF NOT EXISTS idx_auditoria_data ON auditoria(criado_em);

  -- Doses de vacina aplicadas, conferidas contra o esquema padrão do PNI
  -- (o esquema em si é constante no código, não no banco).
  CREATE TABLE IF NOT EXISTS vacinas_aplicadas (
    id TEXT PRIMARY KEY,
    pessoa_id TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
    vacina_chave TEXT NOT NULL,
    dose_chave TEXT NOT NULL,
    data TEXT NOT NULL,
    lote TEXT,
    local TEXT,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_vacinas_pessoa ON vacinas_aplicadas(pessoa_id, vacina_chave);

  -- =====================================================================
  -- v13 — Bem-estar: treinos e alimentação
  -- =====================================================================

  -- Catálogo de exercícios. Vem semeado com os movimentos mais comuns, mas
  -- é editável: o exercício que o professor da academia inventou também
  -- precisa caber aqui.
  CREATE TABLE IF NOT EXISTS exercicios (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    grupo_muscular TEXT NOT NULL,
    equipamento TEXT,
    tipo TEXT NOT NULL DEFAULT 'carga',  -- carga | tempo | distancia | peso_corporal
    unilateral INTEGER NOT NULL DEFAULT 0,
    instrucoes TEXT,
    personalizado INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_exercicios_grupo ON exercicios(grupo_muscular);

  -- Rotina = a ficha de treino ("Treino A — peito e tríceps").
  CREATE TABLE IF NOT EXISTS rotinas (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    ordem INTEGER NOT NULL DEFAULT 0,
    arquivada INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rotina_exercicios (
    id TEXT PRIMARY KEY,
    rotina_id TEXT NOT NULL REFERENCES rotinas(id) ON DELETE CASCADE,
    exercicio_id TEXT NOT NULL REFERENCES exercicios(id) ON DELETE CASCADE,
    ordem INTEGER NOT NULL DEFAULT 0,
    series_alvo INTEGER,
    reps_alvo TEXT,
    descanso_segundos INTEGER,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_rotina_exercicios ON rotina_exercicios(rotina_id, ordem);

  -- Sessão = um treino que de fato aconteceu, num dia.
  CREATE TABLE IF NOT EXISTS sessoes_treino (
    id TEXT PRIMARY KEY,
    rotina_id TEXT REFERENCES rotinas(id) ON DELETE SET NULL,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    data TEXT NOT NULL,
    inicio TEXT,
    fim TEXT,
    duracao_minutos INTEGER,
    percepcao_esforco INTEGER,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessoes_data ON sessoes_treino(data);

  -- Série = uma linha do treino: 4ª série de supino, 80 kg, 8 reps.
  -- É a unidade que sustenta todo o resto (volume, recorde, progressão).
  CREATE TABLE IF NOT EXISTS series_treino (
    id TEXT PRIMARY KEY,
    sessao_id TEXT NOT NULL REFERENCES sessoes_treino(id) ON DELETE CASCADE,
    exercicio_id TEXT NOT NULL REFERENCES exercicios(id) ON DELETE CASCADE,
    ordem INTEGER NOT NULL DEFAULT 0,
    serie_numero INTEGER NOT NULL DEFAULT 1,
    tipo TEXT NOT NULL DEFAULT 'normal',  -- aquecimento | normal | drop | falha
    peso REAL,
    repeticoes INTEGER,
    duracao_segundos INTEGER,
    distancia_metros REAL,
    rir INTEGER,
    concluida INTEGER NOT NULL DEFAULT 1,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_series_sessao ON series_treino(sessao_id, ordem);
  CREATE INDEX IF NOT EXISTS idx_series_exercicio ON series_treino(exercicio_id);

  -- Medidas corporais — cruzam com Saúde, mas ficam aqui porque a
  -- frequência de registro e o uso (evolução de treino) são outros.
  CREATE TABLE IF NOT EXISTS medidas_corporais (
    id TEXT PRIMARY KEY,
    pessoa_id TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    peso_kg REAL,
    altura_cm REAL,
    percentual_gordura REAL,
    cintura_cm REAL,
    quadril_cm REAL,
    peito_cm REAL,
    braco_cm REAL,
    coxa_cm REAL,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_medidas_pessoa ON medidas_corporais(pessoa_id, data);

  -- --- Alimentação -------------------------------------------------------

  -- Base de alimentos. Semeada com um recorte da TACO (NEPA/UNICAMP), a
  -- referência brasileira — os valores batem com a comida daqui, ao
  -- contrário de bases internacionais onde "queijo" é cheddar americano.
  CREATE TABLE IF NOT EXISTS alimentos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    grupo TEXT,
    fonte TEXT NOT NULL DEFAULT 'taco',   -- taco | proprio | rotulo
    -- Todos os valores são POR 100 G, que é como a TACO e os rótulos
    -- brasileiros publicam. Converter na hora de exibir, nunca no cadastro.
    kcal REAL,
    proteina_g REAL,
    carboidrato_g REAL,
    gordura_g REAL,
    fibra_g REAL,
    sodio_mg REAL,
    porcao_padrao_g REAL,
    porcao_padrao_nome TEXT,
    favorito INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_alimentos_nome ON alimentos(nome);

  -- Medidas caseiras ("colher de sopa", "fatia") — o que separa um app
  -- usável de uma planilha. Ninguém pesa 43 g de arroz.
  CREATE TABLE IF NOT EXISTS medidas_caseiras (
    id TEXT PRIMARY KEY,
    alimento_id TEXT NOT NULL REFERENCES alimentos(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    gramas REAL NOT NULL,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_medidas_alimento ON medidas_caseiras(alimento_id);

  CREATE TABLE IF NOT EXISTS refeicoes (
    id TEXT PRIMARY KEY,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    data TEXT NOT NULL,
    tipo TEXT NOT NULL,        -- cafe | lanche_manha | almoco | lanche_tarde | jantar | ceia | outro
    hora TEXT,
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_refeicoes_data ON refeicoes(data, pessoa_id);

  CREATE TABLE IF NOT EXISTS refeicao_itens (
    id TEXT PRIMARY KEY,
    refeicao_id TEXT NOT NULL REFERENCES refeicoes(id) ON DELETE CASCADE,
    alimento_id TEXT REFERENCES alimentos(id) ON DELETE SET NULL,
    nome_livre TEXT,
    quantidade_g REAL NOT NULL,
    medida_nome TEXT,
    medida_quantidade REAL,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_refeicao_itens ON refeicao_itens(refeicao_id);

  -- Registro de água — o hábito mais fácil de acompanhar e o que mais
  -- gente esquece.
  CREATE TABLE IF NOT EXISTS registros_agua (
    id TEXT PRIMARY KEY,
    pessoa_id TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
    data TEXT NOT NULL,
    ml INTEGER NOT NULL,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_agua_data ON registros_agua(data, pessoa_id);

  -- =====================================================================
  -- v14 — versionamento de documentos
  -- =====================================================================

  -- Um documento não é um arquivo: é uma IDENTIDADE que atravessa o tempo.
  -- A CNH renovada continua sendo "a CNH do Cleiton" — mudou o número, a
  -- validade e a imagem, mas a coisa é a mesma. Antes, renovar significava
  -- sobrescrever: o documento anterior desaparecia, e com ele a resposta
  -- para "qual era o número antigo?" e "desde quando eu tenho isso?".
  --
  -- Agora a tabela documentos guarda a identidade e documento_versoes guarda cada
  -- emissão. A versão vigente é a marcada com vigente = 1 — só uma por
  -- documento, garantido pelo índice único parcial abaixo.
  CREATE TABLE IF NOT EXISTS documento_versoes (
    id TEXT PRIMARY KEY,
    documento_id TEXT NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    versao INTEGER NOT NULL DEFAULT 1,
    numero TEXT,
    orgao_emissor TEXT,
    data_emissao TEXT,
    data_validade TEXT,
    observacoes TEXT,
    motivo TEXT,                       -- primeira | renovacao | segunda_via | correcao
    vigente INTEGER NOT NULL DEFAULT 1,
    substituida_em TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_doc_versoes ON documento_versoes(documento_id, versao DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_versao_vigente
    ON documento_versoes(documento_id) WHERE vigente = 1;

  -- Anexo passa a poder apontar para uma VERSÃO específica, não só para o
  -- documento. É o que permite guardar o PDF da CNH antiga junto da nova.
  CREATE TABLE IF NOT EXISTS versao_anexos (
    id TEXT PRIMARY KEY,
    versao_id TEXT NOT NULL REFERENCES documento_versoes(id) ON DELETE CASCADE,
    anexo_id TEXT NOT NULL REFERENCES anexos(id) ON DELETE CASCADE,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_versao_anexos ON versao_anexos(versao_id);

  -- =====================================================================
  -- v15 — sincronização entre aparelhos
  -- =====================================================================

  -- Log de operações. Toda escrita que passa pela camada de CRUD deixa uma linha
  -- aqui: qual tabela, qual registro, o que foi feito e o estado depois.
  --
  -- Por que log de operações e não sincronizar o arquivo .db inteiro:
  -- mandar o banco todo é simples de escrever e destrutivo de usar. Se o
  -- celular e o computador foram usados no mesmo dia, quem sincronizar por
  -- último apaga o dia inteiro do outro. Com o log, cada REGISTRO viaja
  -- sozinho — lançar uma despesa no celular e cadastrar um documento no
  -- computador não conflita, porque são linhas diferentes.
  --
  -- O relógio é híbrido: timestamp em milissegundos e um contador local que
  -- desempata operações no mesmo milissegundo. A coluna de origem identifica o
  -- aparelho e serve de desempate final, para que os dois lados cheguem
  -- sempre ao mesmo resultado sem precisar conversar.
  CREATE TABLE IF NOT EXISTS sync_oplog (
    id TEXT PRIMARY KEY,
    tabela TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    operacao TEXT NOT NULL,           -- inserir | atualizar | excluir
    dados TEXT,                       -- JSON do estado após a operação
    relogio INTEGER NOT NULL,         -- ms desde a época
    contador INTEGER NOT NULL DEFAULT 0,
    origem TEXT NOT NULL,             -- id do aparelho
    enviado INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_oplog_envio ON sync_oplog(enviado, relogio);
  CREATE INDEX IF NOT EXISTS idx_oplog_registro ON sync_oplog(tabela, registro_id, relogio DESC);

  -- Operações que já chegaram de fora, para não aplicar a mesma duas vezes
  -- quando um arquivo é baixado de novo.
  CREATE TABLE IF NOT EXISTS sync_aplicadas (
    op_id TEXT PRIMARY KEY,
    aplicada_em TEXT NOT NULL
  );

  -- Estado da sincronização: chave/valor simples.
  CREATE TABLE IF NOT EXISTS sync_estado (
    chave TEXT PRIMARY KEY,
    valor TEXT,
    atualizado_em TEXT NOT NULL
  );

  -- Índices para as consultas mais comuns do dashboard e relatórios ---------
  CREATE INDEX IF NOT EXISTS idx_transacoes_data ON transacoes(data);
  CREATE INDEX IF NOT EXISTS idx_documentos_validade ON documentos(data_validade);
  CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculo ON manutencoes(veiculo_id);
  CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos(data_hora);
  CREATE INDEX IF NOT EXISTS idx_tarefas_status ON tarefas(status);
`;

export const GRUPO_DOCUMENTO_CATEGORIA = "documento_categoria";
export const GRUPO_EVENTO_TIPO = "evento_tipo";
export const GRUPO_BEM_CATEGORIA = "bem_categoria";

export const OPCOES_PADRAO: Record<string, string[]> = {
  [GRUPO_DOCUMENTO_CATEGORIA]: [
    "Pessoal", "Veículo", "Imóvel", "Financeiro", "Acadêmico", "Contrato", "Seguro", "Certificado", "Outro",
  ],
  [GRUPO_EVENTO_TIPO]: ["Compromisso", "Consulta", "Manutenção", "Pagamento", "Reunião", "Outro"],
  [GRUPO_BEM_CATEGORIA]: ["Imóvel", "Veículo", "Investimento", "Equipamento", "Outro"],
};

export const CATEGORIAS_PADRAO: Array<{ nome: string; tipo: "receita" | "despesa" }> = [
  { nome: "Salário", tipo: "receita" },
  { nome: "Renda extra", tipo: "receita" },
  { nome: "Aluguel recebido", tipo: "receita" },
  { nome: "Outros", tipo: "receita" },
  { nome: "Alimentação", tipo: "despesa" },
  { nome: "Transporte", tipo: "despesa" },
  { nome: "Combustível", tipo: "despesa" },
  { nome: "Manutenção", tipo: "despesa" },
  { nome: "Moradia", tipo: "despesa" },
  { nome: "Saúde", tipo: "despesa" },
  { nome: "Lazer", tipo: "despesa" },
  { nome: "Compras", tipo: "despesa" },
  { nome: "Assinaturas", tipo: "despesa" },
  { nome: "Educação", tipo: "despesa" },
  { nome: "Impostos", tipo: "despesa" },
  { nome: "Outros", tipo: "despesa" },
];
