import { queryAll, runAndPersist } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import { hoje, somarDias, diferencaDias, labelMesCurto } from "../../core/datas";

// =====================================================================
// Treinos
// ---------------------------------------------------------------------
// O modelo segue o que Strong e Hevy consolidaram, porque funciona e
// porque quem treina já conhece: ROTINA (a ficha) → SESSÃO (o treino de
// hoje) → SÉRIE (a linha: 80 kg × 8).
//
// A série como unidade separada é a decisão que sustenta tudo. Guardar
// "supino 4×8 com 80 kg" num campo de texto seria mais simples de
// escrever e inútil depois: não daria pra calcular volume, achar recorde,
// nem ver progressão. Uma linha por série é mais tabela e muito mais
// resposta.
//
// O que este módulo NÃO faz, de propósito: não monta treino pra você.
// Programação depende de objetivo, histórico de lesão e disponibilidade —
// coisa de profissional, não de motor de regras. O app registra, mede e
// mostra a evolução; quem prescreve é você ou seu treinador.
// =====================================================================

export interface Exercicio {
  id: string;
  nome: string;
  grupo_muscular: string;
  equipamento: string | null;
  tipo: "carga" | "tempo" | "distancia" | "peso_corporal";
  unilateral: number;
  instrucoes: string | null;
  personalizado: number;
  criado_em: string;
  atualizado_em: string;
}

export interface Rotina {
  id: string;
  nome: string;
  descricao: string | null;
  pessoa_id: string | null;
  ordem: number;
  arquivada: number;
  criado_em: string;
  atualizado_em: string;
}

export interface RotinaExercicio {
  id: string;
  rotina_id: string;
  exercicio_id: string;
  ordem: number;
  series_alvo: number | null;
  reps_alvo: string | null;
  descanso_segundos: number | null;
  observacoes: string | null;
}

export interface SessaoTreino {
  id: string;
  rotina_id: string | null;
  pessoa_id: string | null;
  nome: string;
  data: string;
  inicio: string | null;
  fim: string | null;
  duracao_minutos: number | null;
  percepcao_esforco: number | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface SerieTreino {
  id: string;
  sessao_id: string;
  exercicio_id: string;
  ordem: number;
  serie_numero: number;
  tipo: "aquecimento" | "normal" | "drop" | "falha";
  peso: number | null;
  repeticoes: number | null;
  duracao_segundos: number | null;
  distancia_metros: number | null;
  rir: number | null;
  concluida: number;
  observacoes: string | null;
}

export const GRUPOS_MUSCULARES = [
  "Peito", "Costas", "Ombros", "Bíceps", "Tríceps", "Antebraço",
  "Quadríceps", "Posterior", "Glúteo", "Panturrilha", "Abdômen", "Cardio", "Corpo inteiro",
];

export const TIPOS_SERIE: Array<{ valor: SerieTreino["tipo"]; label: string; sigla: string }> = [
  { valor: "aquecimento", label: "Aquecimento", sigla: "A" },
  { valor: "normal", label: "Normal", sigla: "" },
  { valor: "drop", label: "Drop set", sigla: "D" },
  { valor: "falha", label: "Até a falha", sigla: "F" },
];

/**
 * Catálogo inicial. Enxuto de propósito: 60 movimentos cobrem quase todo
 * treino de academia. Uma biblioteca de 900 exercícios impressiona na
 * comparação de features e atrapalha na hora de achar "supino".
 */
const EXERCICIOS_PADRAO: Array<[string, string, string, Exercicio["tipo"]]> = [
  ["Supino reto com barra", "Peito", "Barra", "carga"],
  ["Supino inclinado com halteres", "Peito", "Halteres", "carga"],
  ["Supino declinado", "Peito", "Barra", "carga"],
  ["Crucifixo", "Peito", "Halteres", "carga"],
  ["Crossover", "Peito", "Polia", "carga"],
  ["Peck deck", "Peito", "Máquina", "carga"],
  ["Flexão de braço", "Peito", "Peso corporal", "peso_corporal"],
  ["Puxada frontal", "Costas", "Polia", "carga"],
  ["Puxada atrás", "Costas", "Polia", "carga"],
  ["Remada curvada", "Costas", "Barra", "carga"],
  ["Remada unilateral", "Costas", "Halteres", "carga"],
  ["Remada baixa", "Costas", "Polia", "carga"],
  ["Barra fixa", "Costas", "Peso corporal", "peso_corporal"],
  ["Levantamento terra", "Costas", "Barra", "carga"],
  ["Pullover", "Costas", "Halteres", "carga"],
  ["Desenvolvimento militar", "Ombros", "Barra", "carga"],
  ["Desenvolvimento com halteres", "Ombros", "Halteres", "carga"],
  ["Elevação lateral", "Ombros", "Halteres", "carga"],
  ["Elevação frontal", "Ombros", "Halteres", "carga"],
  ["Crucifixo inverso", "Ombros", "Halteres", "carga"],
  ["Encolhimento", "Ombros", "Halteres", "carga"],
  ["Rosca direta", "Bíceps", "Barra", "carga"],
  ["Rosca alternada", "Bíceps", "Halteres", "carga"],
  ["Rosca martelo", "Bíceps", "Halteres", "carga"],
  ["Rosca scott", "Bíceps", "Barra", "carga"],
  ["Rosca concentrada", "Bíceps", "Halteres", "carga"],
  ["Tríceps testa", "Tríceps", "Barra", "carga"],
  ["Tríceps pulley", "Tríceps", "Polia", "carga"],
  ["Tríceps corda", "Tríceps", "Polia", "carga"],
  ["Tríceps francês", "Tríceps", "Halteres", "carga"],
  ["Mergulho em paralelas", "Tríceps", "Peso corporal", "peso_corporal"],
  ["Agachamento livre", "Quadríceps", "Barra", "carga"],
  ["Agachamento frontal", "Quadríceps", "Barra", "carga"],
  ["Leg press", "Quadríceps", "Máquina", "carga"],
  ["Cadeira extensora", "Quadríceps", "Máquina", "carga"],
  ["Hack machine", "Quadríceps", "Máquina", "carga"],
  ["Afundo", "Quadríceps", "Halteres", "carga"],
  ["Búlgaro", "Quadríceps", "Halteres", "carga"],
  ["Mesa flexora", "Posterior", "Máquina", "carga"],
  ["Cadeira flexora", "Posterior", "Máquina", "carga"],
  ["Stiff", "Posterior", "Barra", "carga"],
  ["Levantamento terra romeno", "Posterior", "Barra", "carga"],
  ["Elevação pélvica", "Glúteo", "Barra", "carga"],
  ["Cadeira abdutora", "Glúteo", "Máquina", "carga"],
  ["Coice na polia", "Glúteo", "Polia", "carga"],
  ["Panturrilha em pé", "Panturrilha", "Máquina", "carga"],
  ["Panturrilha sentado", "Panturrilha", "Máquina", "carga"],
  ["Abdominal supra", "Abdômen", "Peso corporal", "peso_corporal"],
  ["Abdominal infra", "Abdômen", "Peso corporal", "peso_corporal"],
  ["Prancha", "Abdômen", "Peso corporal", "tempo"],
  ["Prancha lateral", "Abdômen", "Peso corporal", "tempo"],
  ["Abdominal na polia", "Abdômen", "Polia", "carga"],
  ["Rosca punho", "Antebraço", "Barra", "carga"],
  ["Esteira", "Cardio", "Máquina", "distancia"],
  ["Bicicleta ergométrica", "Cardio", "Máquina", "tempo"],
  ["Elíptico", "Cardio", "Máquina", "tempo"],
  ["Corrida ao ar livre", "Cardio", "Nenhum", "distancia"],
  ["Caminhada", "Cardio", "Nenhum", "distancia"],
  ["Pular corda", "Cardio", "Corda", "tempo"],
  ["Burpee", "Corpo inteiro", "Peso corporal", "peso_corporal"],
];

export function semearExercicios(): void {
  const total = queryAll<{ t: number }>("SELECT COUNT(*) as t FROM exercicios")[0]?.t ?? 0;
  if (total > 0) return;
  const agora = new Date().toISOString();
  for (const [nome, grupo, equipamento, tipo] of EXERCICIOS_PADRAO) {
    runAndPersist(
      `INSERT INTO exercicios (id, nome, grupo_muscular, equipamento, tipo, unilateral, personalizado, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      [crypto.randomUUID(), nome, grupo, equipamento, tipo, agora, agora],
    );
  }
}

// --- Exercícios ------------------------------------------------------------

export function listarExercicios(grupo?: string): Exercicio[] {
  return grupo
    ? queryAll<Exercicio>("SELECT * FROM exercicios WHERE grupo_muscular = ? ORDER BY nome COLLATE NOCASE", [grupo])
    : queryAll<Exercicio>("SELECT * FROM exercicios ORDER BY grupo_muscular, nome COLLATE NOCASE");
}

export function buscarExercicio(id: string): Exercicio | null {
  return queryAll<Exercicio>("SELECT * FROM exercicios WHERE id = ?", [id])[0] ?? null;
}

export async function criarExercicio(dados: {
  nome: string; grupo_muscular: string; equipamento?: string | null;
  tipo?: Exercicio["tipo"]; instrucoes?: string | null;
}): Promise<string> {
  return inserir("exercicios", { tipo: "carga", unilateral: 0, personalizado: 1, ...dados });
}

export async function excluirExercicio(id: string): Promise<void> {
  await excluir("exercicios", id);
}

// --- Rotinas ---------------------------------------------------------------

export function listarRotinas(incluirArquivadas = false): Rotina[] {
  const sql = incluirArquivadas
    ? "SELECT * FROM rotinas ORDER BY arquivada, ordem, nome"
    : "SELECT * FROM rotinas WHERE arquivada = 0 ORDER BY ordem, nome";
  return queryAll<Rotina>(sql);
}

export function exerciciosDaRotina(rotinaId: string): Array<RotinaExercicio & { exercicio: Exercicio }> {
  const itens = queryAll<RotinaExercicio>(
    "SELECT * FROM rotina_exercicios WHERE rotina_id = ? ORDER BY ordem", [rotinaId]);
  return itens
    .map((i) => ({ ...i, exercicio: buscarExercicio(i.exercicio_id)! }))
    .filter((i) => i.exercicio);
}

export async function criarRotina(dados: { nome: string; descricao?: string | null; pessoa_id?: string | null }): Promise<string> {
  const ordem = listarRotinas(true).length;
  return inserir("rotinas", { ...dados, ordem, arquivada: 0 });
}

export async function atualizarRotina(id: string, dados: Partial<Rotina>): Promise<void> {
  await atualizar("rotinas", id, dados);
}

export async function excluirRotina(id: string): Promise<void> {
  await excluir("rotinas", id);
}

export async function adicionarExercicioNaRotina(
  rotinaId: string, exercicioId: string,
  dados: { series_alvo?: number | null; reps_alvo?: string | null; descanso_segundos?: number | null } = {},
): Promise<string> {
  const ordem = queryAll<{ t: number }>(
    "SELECT COUNT(*) as t FROM rotina_exercicios WHERE rotina_id = ?", [rotinaId])[0]?.t ?? 0;
  return inserir("rotina_exercicios", {
    rotina_id: rotinaId, exercicio_id: exercicioId, ordem,
    series_alvo: dados.series_alvo ?? 3,
    reps_alvo: dados.reps_alvo ?? "8-12",
    descanso_segundos: dados.descanso_segundos ?? 90,
  });
}

export async function removerExercicioDaRotina(id: string): Promise<void> {
  await excluir("rotina_exercicios", id);
}

// --- Sessões ---------------------------------------------------------------

export function listarSessoes(limite = 60): SessaoTreino[] {
  return queryAll<SessaoTreino>("SELECT * FROM sessoes_treino ORDER BY data DESC, criado_em DESC LIMIT ?", [limite]);
}

export function buscarSessao(id: string): SessaoTreino | null {
  return queryAll<SessaoTreino>("SELECT * FROM sessoes_treino WHERE id = ?", [id])[0] ?? null;
}

export function seriesDaSessao(sessaoId: string): Array<SerieTreino & { exercicio_nome: string; exercicio_tipo: string }> {
  return queryAll<SerieTreino & { exercicio_nome: string; exercicio_tipo: string }>(
    `SELECT s.*, e.nome as exercicio_nome, e.tipo as exercicio_tipo
     FROM series_treino s JOIN exercicios e ON e.id = s.exercicio_id
     WHERE s.sessao_id = ? ORDER BY s.ordem, s.serie_numero`,
    [sessaoId],
  );
}

/**
 * Inicia uma sessão. Vindo de uma rotina, já pré-cria as séries com o peso
 * da última vez que aquele exercício foi feito — é o detalhe que faz o
 * registro durar segundos em vez de minutos, e o que Strong e Hevy acertaram.
 */
export async function iniciarSessao(dados: {
  rotina_id?: string | null; pessoa_id?: string | null; nome: string; data?: string;
}): Promise<string> {
  const agora = new Date();
  const sessaoId = await inserir("sessoes_treino", {
    rotina_id: dados.rotina_id ?? null,
    pessoa_id: dados.pessoa_id ?? null,
    nome: dados.nome,
    data: dados.data ?? hoje(),
    inicio: agora.toISOString(),
  });

  if (dados.rotina_id) {
    const itens = exerciciosDaRotina(dados.rotina_id);
    let ordem = 0;
    for (const item of itens) {
      const ultima = ultimoDesempenho(item.exercicio_id);
      const nSeries = item.series_alvo ?? 3;
      for (let i = 1; i <= nSeries; i++) {
        await inserir("series_treino", {
          sessao_id: sessaoId,
          exercicio_id: item.exercicio_id,
          ordem: ordem++,
          serie_numero: i,
          tipo: "normal",
          peso: ultima?.peso ?? null,
          repeticoes: ultima?.repeticoes ?? null,
          // Nasce como não concluída: a marcação é o gesto que registra o
          // que de fato foi feito, distinguindo plano de execução.
          concluida: 0,
        });
      }
    }
  }
  return sessaoId;
}

export async function registrarSerie(dados: {
  sessao_id: string; exercicio_id: string; serie_numero?: number;
  tipo?: SerieTreino["tipo"]; peso?: number | null; repeticoes?: number | null;
  duracao_segundos?: number | null; distancia_metros?: number | null; rir?: number | null;
}): Promise<string> {
  const ordem = queryAll<{ t: number }>(
    "SELECT COUNT(*) as t FROM series_treino WHERE sessao_id = ?", [dados.sessao_id])[0]?.t ?? 0;
  return inserir("series_treino", { ordem, serie_numero: 1, tipo: "normal", concluida: 1, ...dados });
}

export async function atualizarSerie(id: string, dados: Partial<SerieTreino>): Promise<void> {
  await atualizar("series_treino", id, dados);
}

export async function excluirSerie(id: string): Promise<void> {
  await excluir("series_treino", id);
}

export async function encerrarSessao(id: string, percepcao?: number | null): Promise<void> {
  const sessao = buscarSessao(id);
  if (!sessao) return;
  const fim = new Date();
  const duracao = sessao.inicio
    ? Math.round((fim.getTime() - new Date(sessao.inicio).getTime()) / 60000) : null;
  // Séries que ficaram sem marcar não aconteceram — apagar evita que o
  // volume do mês conte um treino que foi só planejado.
  await runAndPersist("DELETE FROM series_treino WHERE sessao_id = ? AND concluida = 0", [id]);
  await atualizar("sessoes_treino", id, {
    fim: fim.toISOString(),
    duracao_minutos: duracao,
    percepcao_esforco: percepcao ?? null,
  });
}

export async function excluirSessao(id: string): Promise<void> {
  await excluir("sessoes_treino", id);
}

// --- Métricas --------------------------------------------------------------

/** Peso e reps da última vez que o exercício foi feito — pré-preenche a série. */
export function ultimoDesempenho(exercicioId: string): { peso: number | null; repeticoes: number | null; data: string } | null {
  const row = queryAll<{ peso: number | null; repeticoes: number | null; data: string }>(
    `SELECT s.peso, s.repeticoes, ses.data FROM series_treino s
     JOIN sessoes_treino ses ON ses.id = s.sessao_id
     WHERE s.exercicio_id = ? AND s.concluida = 1 AND s.tipo != 'aquecimento'
     ORDER BY ses.data DESC, s.serie_numero DESC LIMIT 1`,
    [exercicioId],
  )[0];
  return row ?? null;
}

/**
 * 1RM estimado pela fórmula de Epley: peso × (1 + reps/30).
 *
 * Vale dizer o que ela é: uma estimativa que fica boa até ~10 repetições e
 * perde precisão acima disso. Serve pra comparar progressão ao longo do
 * tempo, não pra decidir quanto colocar na barra numa tentativa máxima.
 */
export function estimar1RM(peso: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return peso;
  return peso * (1 + reps / 30);
}

export interface RecordeExercicio {
  exercicio_id: string;
  exercicio_nome: string;
  maiorPeso: number | null;
  maiorVolumeSessao: number | null;
  melhor1RM: number | null;
  dataMelhor: string | null;
  totalSeries: number;
}

export function recordes(): RecordeExercicio[] {
  const rows = queryAll<{
    exercicio_id: string; exercicio_nome: string; peso: number | null;
    repeticoes: number | null; data: string;
  }>(
    `SELECT s.exercicio_id, e.nome as exercicio_nome, s.peso, s.repeticoes, ses.data
     FROM series_treino s
     JOIN exercicios e ON e.id = s.exercicio_id
     JOIN sessoes_treino ses ON ses.id = s.sessao_id
     WHERE s.concluida = 1 AND s.tipo != 'aquecimento' AND s.peso IS NOT NULL`,
  );

  const mapa = new Map<string, RecordeExercicio>();
  for (const r of rows) {
    if (!mapa.has(r.exercicio_id)) {
      mapa.set(r.exercicio_id, {
        exercicio_id: r.exercicio_id, exercicio_nome: r.exercicio_nome,
        maiorPeso: null, maiorVolumeSessao: null, melhor1RM: null,
        dataMelhor: null, totalSeries: 0,
      });
    }
    const rec = mapa.get(r.exercicio_id)!;
    rec.totalSeries += 1;
    if (r.peso !== null && (rec.maiorPeso === null || r.peso > rec.maiorPeso)) rec.maiorPeso = r.peso;
    if (r.peso !== null && r.repeticoes) {
      const rm = estimar1RM(r.peso, r.repeticoes);
      if (rec.melhor1RM === null || rm > rec.melhor1RM) {
        rec.melhor1RM = rm;
        rec.dataMelhor = r.data;
      }
    }
  }
  return [...mapa.values()].sort((a, b) => b.totalSeries - a.totalSeries);
}

/** Progressão de um exercício ao longo do tempo (melhor série de cada sessão). */
export function progressaoExercicio(exercicioId: string): Array<{ data: string; peso: number; reps: number; rm: number; volume: number }> {
  const rows = queryAll<{ data: string; peso: number; repeticoes: number }>(
    `SELECT ses.data, s.peso, s.repeticoes FROM series_treino s
     JOIN sessoes_treino ses ON ses.id = s.sessao_id
     WHERE s.exercicio_id = ? AND s.concluida = 1 AND s.tipo != 'aquecimento'
       AND s.peso IS NOT NULL AND s.repeticoes IS NOT NULL
     ORDER BY ses.data ASC`,
    [exercicioId],
  );

  const porData = new Map<string, { peso: number; reps: number; rm: number; volume: number }>();
  for (const r of rows) {
    const rm = estimar1RM(r.peso, r.repeticoes);
    const atual = porData.get(r.data) ?? { peso: 0, reps: 0, rm: 0, volume: 0 };
    atual.volume += r.peso * r.repeticoes;
    if (rm > atual.rm) { atual.rm = rm; atual.peso = r.peso; atual.reps = r.repeticoes; }
    porData.set(r.data, atual);
  }
  return [...porData.entries()].map(([data, v]) => ({ data, ...v }));
}

export interface ResumoTreino {
  sessoesNoMes: number;
  sessoesNaSemana: number;
  volumeNoMes: number;
  duracaoMediaMinutos: number | null;
  ultimaSessao: string | null;
  diasDesdeUltima: number | null;
  sequenciaSemanas: number;
}

export function resumirTreinos(): ResumoTreino {
  const inicioMes = `${hoje().slice(0, 7)}-01`;
  const inicioSemana = somarDias(hoje(), -7);

  const sessoesNoMes = queryAll<{ t: number }>(
    "SELECT COUNT(*) as t FROM sessoes_treino WHERE data >= ?", [inicioMes])[0]?.t ?? 0;
  const sessoesNaSemana = queryAll<{ t: number }>(
    "SELECT COUNT(*) as t FROM sessoes_treino WHERE data >= ?", [inicioSemana])[0]?.t ?? 0;

  // Volume = carga × repetições somado. É a métrica que melhor resume
  // "quanto trabalho foi feito" quando se compara mês contra mês.
  const volume = queryAll<{ v: number }>(
    `SELECT COALESCE(SUM(s.peso * s.repeticoes), 0) as v FROM series_treino s
     JOIN sessoes_treino ses ON ses.id = s.sessao_id
     WHERE ses.data >= ? AND s.concluida = 1 AND s.tipo != 'aquecimento'`, [inicioMes])[0]?.v ?? 0;

  const duracao = queryAll<{ m: number | null }>(
    "SELECT AVG(duracao_minutos) as m FROM sessoes_treino WHERE duracao_minutos IS NOT NULL AND data >= ?",
    [inicioMes])[0]?.m ?? null;

  const ultima = queryAll<{ data: string }>(
    "SELECT data FROM sessoes_treino ORDER BY data DESC LIMIT 1")[0]?.data ?? null;

  return {
    sessoesNoMes, sessoesNaSemana, volumeNoMes: volume,
    duracaoMediaMinutos: duracao ? Math.round(duracao) : null,
    ultimaSessao: ultima,
    diasDesdeUltima: ultima ? diferencaDias(ultima, hoje()) : null,
    sequenciaSemanas: calcularSequenciaSemanas(),
  };
}

/** Semanas consecutivas com pelo menos um treino — a métrica de constância. */
function calcularSequenciaSemanas(): number {
  const datas = queryAll<{ data: string }>(
    "SELECT DISTINCT data FROM sessoes_treino ORDER BY data DESC LIMIT 400").map((r) => r.data);
  if (datas.length === 0) return 0;
  let sequencia = 0;
  for (let semana = 0; semana < 104; semana++) {
    const fim = somarDias(hoje(), -semana * 7);
    const inicio = somarDias(fim, -6);
    const treinou = datas.some((d) => d >= inicio && d <= fim);
    if (!treinou) {
      // A semana corrente ainda pode receber um treino, então não quebra
      // a sequência só por estar vazia numa terça-feira.
      if (semana === 0) continue;
      break;
    }
    sequencia += 1;
  }
  return sequencia;
}

/** Volume por grupo muscular no período — mostra desequilíbrio de treino. */
export function volumePorGrupo(dias = 30): Array<{ grupo: string; volume: number; series: number }> {
  const desde = somarDias(hoje(), -dias);
  return queryAll<{ grupo: string; volume: number; series: number }>(
    `SELECT e.grupo_muscular as grupo,
            COALESCE(SUM(s.peso * s.repeticoes), 0) as volume,
            COUNT(*) as series
     FROM series_treino s
     JOIN exercicios e ON e.id = s.exercicio_id
     JOIN sessoes_treino ses ON ses.id = s.sessao_id
     WHERE ses.data >= ? AND s.concluida = 1 AND s.tipo != 'aquecimento'
     GROUP BY e.grupo_muscular ORDER BY series DESC`,
    [desde],
  );
}

/** Evolução mensal do volume total. */
export function evolucaoVolume(meses = 6): Array<{ mes: string; volume: number; sessoes: number }> {
  const resultado: Array<{ mes: string; volume: number; sessoes: number }> = [];
  for (let i = meses - 1; i >= 0; i--) {
    const ref = new Date();
    ref.setMonth(ref.getMonth() - i, 1);
    const mes = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
    const volume = queryAll<{ v: number }>(
      `SELECT COALESCE(SUM(s.peso * s.repeticoes), 0) as v FROM series_treino s
       JOIN sessoes_treino ses ON ses.id = s.sessao_id
       WHERE substr(ses.data, 1, 7) = ? AND s.concluida = 1 AND s.tipo != 'aquecimento'`,
      [mes])[0]?.v ?? 0;
    const sessoes = queryAll<{ t: number }>(
      "SELECT COUNT(*) as t FROM sessoes_treino WHERE substr(data, 1, 7) = ?", [mes])[0]?.t ?? 0;
    resultado.push({ mes: labelMesCurto(`${mes}-01`), volume, sessoes });
  }
  return resultado;
}

// --- Medidas corporais -----------------------------------------------------

export interface MedidaCorporal {
  id: string;
  pessoa_id: string;
  data: string;
  peso_kg: number | null;
  altura_cm: number | null;
  percentual_gordura: number | null;
  cintura_cm: number | null;
  quadril_cm: number | null;
  peito_cm: number | null;
  braco_cm: number | null;
  coxa_cm: number | null;
  observacoes: string | null;
}

export function listarMedidas(pessoaId: string): MedidaCorporal[] {
  return queryAll<MedidaCorporal>(
    "SELECT * FROM medidas_corporais WHERE pessoa_id = ? ORDER BY data ASC", [pessoaId]);
}

export function ultimaMedida(pessoaId: string): MedidaCorporal | null {
  return queryAll<MedidaCorporal>(
    "SELECT * FROM medidas_corporais WHERE pessoa_id = ? ORDER BY data DESC LIMIT 1", [pessoaId])[0] ?? null;
}

export async function registrarMedida(dados: Partial<MedidaCorporal> & { pessoa_id: string; data: string }): Promise<string> {
  return inserir("medidas_corporais", dados);
}

export async function excluirMedida(id: string): Promise<void> {
  await excluir("medidas_corporais", id);
}
