import { queryAll, runAndPersist } from "../../database/db";
import { inserir, atualizar, excluir } from "../../database/crud";
import { hoje, somarDias } from "../../core/datas";

// =====================================================================
// Alimentação
// ---------------------------------------------------------------------
// Base de alimentos semeada a partir da TACO (Tabela Brasileira de
// Composição de Alimentos, NEPA/UNICAMP) — a referência daqui. Isso
// importa mais do que parece: em base internacional, "queijo" é cheddar
// e "pão" é pão de forma branco americano. Os valores da TACO são de
// amostras coletadas no Brasil, então bate com o que se come.
//
// Duas decisões que definem a usabilidade:
//
// 1. Tudo é guardado POR 100 G, que é como a TACO e os rótulos brasileiros
//    publicam. A conversão acontece na exibição, nunca no cadastro — assim
//    não há erro acumulado de arredondamento no banco.
//
// 2. MEDIDA CASEIRA é cidadã de primeira classe. Ninguém pesa 43 g de
//    arroz; a pessoa põe "duas colheres de sopa". Um app que só aceita
//    gramas é abandonado na segunda semana. Cada alimento carrega suas
//    medidas, e o registro guarda as duas coisas: a medida que a pessoa
//    escolheu e as gramas correspondentes.
//
// Sobre metas: o app calcula uma estimativa de gasto energético e permite
// definir alvos, mas trata isso como referência, não como regra. Ele não
// sugere déficit agressivo, não classifica comida como "boa" ou "ruim" e
// não emite alerta por ter passado do alvo. Registrar o que se come é
// útil; transformar isso em cobrança diária costuma sair pela culatra.
// Quem define meta de verdade é nutricionista, e a tela diz isso.
// =====================================================================

export interface Alimento {
  id: string;
  nome: string;
  grupo: string | null;
  fonte: "taco" | "proprio" | "rotulo";
  kcal: number | null;
  proteina_g: number | null;
  carboidrato_g: number | null;
  gordura_g: number | null;
  fibra_g: number | null;
  sodio_mg: number | null;
  porcao_padrao_g: number | null;
  porcao_padrao_nome: string | null;
  favorito: number;
  criado_em: string;
  atualizado_em: string;
}

export interface MedidaCaseira {
  id: string;
  alimento_id: string;
  nome: string;
  gramas: number;
}

export interface Refeicao {
  id: string;
  pessoa_id: string | null;
  data: string;
  tipo: TipoRefeicao;
  hora: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface RefeicaoItem {
  id: string;
  refeicao_id: string;
  alimento_id: string | null;
  nome_livre: string | null;
  quantidade_g: number;
  medida_nome: string | null;
  medida_quantidade: number | null;
}

export type TipoRefeicao = "cafe" | "lanche_manha" | "almoco" | "lanche_tarde" | "jantar" | "ceia" | "outro";

export const TIPOS_REFEICAO: Array<{ valor: TipoRefeicao; label: string; horaSugerida: string }> = [
  { valor: "cafe", label: "Café da manhã", horaSugerida: "07:00" },
  { valor: "lanche_manha", label: "Lanche da manhã", horaSugerida: "10:00" },
  { valor: "almoco", label: "Almoço", horaSugerida: "12:00" },
  { valor: "lanche_tarde", label: "Lanche da tarde", horaSugerida: "15:30" },
  { valor: "jantar", label: "Jantar", horaSugerida: "19:30" },
  { valor: "ceia", label: "Ceia", horaSugerida: "22:00" },
  { valor: "outro", label: "Outro", horaSugerida: "" },
];

export function labelRefeicao(tipo: string): string {
  return TIPOS_REFEICAO.find((t) => t.valor === tipo)?.label ?? "Refeição";
}

/**
 * Recorte da TACO com os alimentos mais presentes na mesa brasileira.
 * Formato: nome, grupo, kcal, proteína, carbo, gordura, fibra (por 100 g),
 * e as medidas caseiras usuais.
 */
const ALIMENTOS_TACO: Array<{
  nome: string; grupo: string; kcal: number; p: number; c: number; g: number; f: number;
  medidas?: Array<[string, number]>;
}> = [
  // Cereais e massas
  { nome: "Arroz branco cozido", grupo: "Cereais", kcal: 128, p: 2.5, c: 28.1, g: 0.2, f: 1.6, medidas: [["colher de sopa", 25], ["escumadeira", 80], ["prato raso", 150]] },
  { nome: "Arroz integral cozido", grupo: "Cereais", kcal: 124, p: 2.6, c: 25.8, g: 1.0, f: 2.7, medidas: [["colher de sopa", 25], ["escumadeira", 80]] },
  { nome: "Feijão carioca cozido", grupo: "Leguminosas", kcal: 76, p: 4.8, c: 13.6, g: 0.5, f: 8.5, medidas: [["concha média", 80], ["colher de sopa", 30]] },
  { nome: "Feijão preto cozido", grupo: "Leguminosas", kcal: 77, p: 4.5, c: 14.0, g: 0.5, f: 8.4, medidas: [["concha média", 80], ["colher de sopa", 30]] },
  { nome: "Macarrão cozido", grupo: "Cereais", kcal: 111, p: 3.5, c: 22.0, g: 1.3, f: 1.6, medidas: [["pegador", 90], ["prato raso", 180]] },
  { nome: "Pão francês", grupo: "Panificados", kcal: 300, p: 8.0, c: 58.6, g: 3.1, f: 2.3, medidas: [["unidade", 50]] },
  { nome: "Pão de forma integral", grupo: "Panificados", kcal: 253, p: 9.4, c: 49.9, g: 3.0, f: 6.9, medidas: [["fatia", 25]] },
  { nome: "Tapioca (goma hidratada)", grupo: "Cereais", kcal: 240, p: 0.0, c: 59.5, g: 0.0, f: 0.6, medidas: [["unidade média", 60]] },
  { nome: "Aveia em flocos", grupo: "Cereais", kcal: 394, p: 13.9, c: 66.6, g: 8.5, f: 9.1, medidas: [["colher de sopa", 15]] },
  { nome: "Farinha de mandioca", grupo: "Cereais", kcal: 361, p: 1.2, c: 87.9, g: 0.3, f: 6.4, medidas: [["colher de sopa", 12]] },
  { nome: "Cuscuz de milho cozido", grupo: "Cereais", kcal: 113, p: 2.2, c: 25.3, g: 0.5, f: 1.5, medidas: [["fatia", 80]] },
  { nome: "Batata inglesa cozida", grupo: "Tubérculos", kcal: 52, p: 1.2, c: 11.9, g: 0.0, f: 1.3, medidas: [["unidade média", 100], ["colher de sopa", 30]] },
  { nome: "Batata doce cozida", grupo: "Tubérculos", kcal: 77, p: 0.6, c: 18.4, g: 0.1, f: 2.2, medidas: [["unidade média", 100]] },
  { nome: "Mandioca cozida", grupo: "Tubérculos", kcal: 125, p: 0.6, c: 30.1, g: 0.3, f: 1.6, medidas: [["pedaço médio", 80]] },

  // Carnes e ovos
  { nome: "Peito de frango grelhado", grupo: "Carnes", kcal: 159, p: 32.0, c: 0.0, g: 2.5, f: 0.0, medidas: [["filé médio", 100], ["colher de sopa desfiado", 25]] },
  { nome: "Coxa de frango assada", grupo: "Carnes", kcal: 215, p: 27.5, c: 0.0, g: 11.0, f: 0.0, medidas: [["unidade", 80]] },
  { nome: "Patinho bovino grelhado", grupo: "Carnes", kcal: 219, p: 35.9, c: 0.0, g: 7.3, f: 0.0, medidas: [["bife médio", 100]] },
  { nome: "Alcatra grelhada", grupo: "Carnes", kcal: 241, p: 31.9, c: 0.0, g: 11.7, f: 0.0, medidas: [["bife médio", 100]] },
  { nome: "Carne moída refogada", grupo: "Carnes", kcal: 212, p: 26.7, c: 0.0, g: 11.0, f: 0.0, medidas: [["colher de sopa", 25]] },
  { nome: "Lombo suíno assado", grupo: "Carnes", kcal: 210, p: 35.7, c: 0.0, g: 6.4, f: 0.0, medidas: [["fatia", 60]] },
  { nome: "Tilápia grelhada", grupo: "Pescados", kcal: 128, p: 26.2, c: 0.0, g: 1.7, f: 0.0, medidas: [["filé médio", 120]] },
  { nome: "Salmão grelhado", grupo: "Pescados", kcal: 243, p: 25.4, c: 0.0, g: 15.4, f: 0.0, medidas: [["posta", 120]] },
  { nome: "Sardinha em conserva", grupo: "Pescados", kcal: 285, p: 24.6, c: 0.0, g: 20.6, f: 0.0, medidas: [["lata drenada", 84]] },
  { nome: "Atum em conserva", grupo: "Pescados", kcal: 166, p: 25.5, c: 0.0, g: 6.6, f: 0.0, medidas: [["lata drenada", 120]] },
  { nome: "Ovo de galinha cozido", grupo: "Ovos", kcal: 146, p: 13.3, c: 0.6, g: 9.5, f: 0.0, medidas: [["unidade", 50]] },
  { nome: "Ovo frito", grupo: "Ovos", kcal: 240, p: 15.6, c: 1.2, g: 18.6, f: 0.0, medidas: [["unidade", 50]] },

  // Laticínios
  { nome: "Leite integral", grupo: "Laticínios", kcal: 61, p: 2.9, c: 4.3, g: 3.2, f: 0.0, medidas: [["copo", 200], ["xícara", 240]] },
  { nome: "Leite desnatado", grupo: "Laticínios", kcal: 35, p: 3.2, c: 4.9, g: 0.2, f: 0.0, medidas: [["copo", 200]] },
  { nome: "Iogurte natural integral", grupo: "Laticínios", kcal: 51, p: 4.1, c: 1.9, g: 3.0, f: 0.0, medidas: [["pote", 170], ["copo", 200]] },
  { nome: "Queijo minas frescal", grupo: "Laticínios", kcal: 264, p: 17.4, c: 3.2, g: 20.2, f: 0.0, medidas: [["fatia", 30]] },
  { nome: "Queijo mussarela", grupo: "Laticínios", kcal: 330, p: 22.6, c: 3.0, g: 25.2, f: 0.0, medidas: [["fatia", 20]] },
  { nome: "Requeijão cremoso", grupo: "Laticínios", kcal: 257, p: 9.6, c: 3.0, g: 23.0, f: 0.0, medidas: [["colher de sopa", 20]] },
  { nome: "Whey protein (concentrado)", grupo: "Suplementos", kcal: 400, p: 80.0, c: 8.0, g: 5.0, f: 0.0, medidas: [["scoop", 30]] },

  // Frutas
  { nome: "Banana prata", grupo: "Frutas", kcal: 98, p: 1.3, c: 26.0, g: 0.1, f: 2.0, medidas: [["unidade média", 70]] },
  { nome: "Maçã com casca", grupo: "Frutas", kcal: 56, p: 0.3, c: 15.2, g: 0.0, f: 1.3, medidas: [["unidade média", 130]] },
  { nome: "Mamão papaia", grupo: "Frutas", kcal: 40, p: 0.5, c: 10.4, g: 0.1, f: 1.0, medidas: [["fatia", 100], ["metade", 150]] },
  { nome: "Laranja pera", grupo: "Frutas", kcal: 37, p: 1.0, c: 8.9, g: 0.1, f: 0.8, medidas: [["unidade média", 130]] },
  { nome: "Melancia", grupo: "Frutas", kcal: 33, p: 0.9, c: 8.1, g: 0.0, f: 0.1, medidas: [["fatia", 200]] },
  { nome: "Abacate", grupo: "Frutas", kcal: 96, p: 1.2, c: 6.0, g: 8.4, f: 6.3, medidas: [["colher de sopa", 25]] },
  { nome: "Manga palmer", grupo: "Frutas", kcal: 72, p: 0.4, c: 19.4, g: 0.2, f: 1.6, medidas: [["unidade média", 200]] },
  { nome: "Uva itália", grupo: "Frutas", kcal: 53, p: 0.7, c: 13.6, g: 0.2, f: 0.9, medidas: [["cacho pequeno", 100]] },
  { nome: "Morango", grupo: "Frutas", kcal: 30, p: 0.9, c: 6.8, g: 0.3, f: 1.7, medidas: [["unidade", 12]] },

  // Verduras e legumes
  { nome: "Alface crespa", grupo: "Verduras", kcal: 11, p: 1.3, c: 1.7, g: 0.2, f: 1.8, medidas: [["folha", 10], ["prato", 60]] },
  { nome: "Tomate cru", grupo: "Legumes", kcal: 15, p: 1.1, c: 3.1, g: 0.2, f: 1.2, medidas: [["unidade média", 90], ["fatia", 20]] },
  { nome: "Cenoura crua", grupo: "Legumes", kcal: 34, p: 1.3, c: 7.7, g: 0.2, f: 3.2, medidas: [["unidade média", 80], ["colher de sopa ralada", 20]] },
  { nome: "Brócolis cozido", grupo: "Verduras", kcal: 25, p: 2.1, c: 4.4, g: 0.5, f: 3.4, medidas: [["colher de sopa", 25]] },
  { nome: "Couve refogada", grupo: "Verduras", kcal: 90, p: 1.7, c: 8.7, g: 5.5, f: 5.7, medidas: [["colher de sopa", 20]] },
  { nome: "Abobrinha cozida", grupo: "Legumes", kcal: 19, p: 1.1, c: 3.0, g: 0.2, f: 2.1, medidas: [["colher de sopa", 30]] },
  { nome: "Beterraba cozida", grupo: "Legumes", kcal: 32, p: 1.3, c: 7.2, g: 0.1, f: 1.9, medidas: [["colher de sopa ralada", 25]] },
  { nome: "Chuchu cozido", grupo: "Legumes", kcal: 19, p: 0.4, c: 4.8, g: 0.1, f: 1.0, medidas: [["colher de sopa", 30]] },

  // Óleos, oleaginosas e outros
  { nome: "Azeite de oliva", grupo: "Óleos", kcal: 884, p: 0.0, c: 0.0, g: 100.0, f: 0.0, medidas: [["colher de sopa", 8], ["fio", 4]] },
  { nome: "Óleo de soja", grupo: "Óleos", kcal: 884, p: 0.0, c: 0.0, g: 100.0, f: 0.0, medidas: [["colher de sopa", 8]] },
  { nome: "Manteiga com sal", grupo: "Óleos", kcal: 726, p: 0.4, c: 0.1, g: 82.4, f: 0.0, medidas: [["ponta de faca", 5], ["colher de chá", 5]] },
  { nome: "Castanha do Pará", grupo: "Oleaginosas", kcal: 643, p: 14.5, c: 15.1, g: 63.5, f: 7.9, medidas: [["unidade", 5]] },
  { nome: "Amendoim torrado", grupo: "Oleaginosas", kcal: 544, p: 27.4, c: 20.3, g: 43.9, f: 8.0, medidas: [["punhado", 30]] },
  { nome: "Pasta de amendoim", grupo: "Oleaginosas", kcal: 585, p: 25.0, c: 20.0, g: 50.0, f: 6.0, medidas: [["colher de sopa", 15]] },
  { nome: "Açúcar refinado", grupo: "Açúcares", kcal: 387, p: 0.0, c: 99.9, g: 0.0, f: 0.0, medidas: [["colher de chá", 5], ["colher de sopa", 12]] },
  { nome: "Café coado sem açúcar", grupo: "Bebidas", kcal: 2, p: 0.1, c: 0.3, g: 0.0, f: 0.0, medidas: [["xícara", 50], ["copo", 200]] },
  { nome: "Suco de laranja natural", grupo: "Bebidas", kcal: 37, p: 0.7, c: 8.7, g: 0.1, f: 0.2, medidas: [["copo", 200]] },
  { nome: "Refrigerante tipo cola", grupo: "Bebidas", kcal: 34, p: 0.0, c: 8.7, g: 0.0, f: 0.0, medidas: [["lata", 350], ["copo", 200]] },
  { nome: "Chocolate ao leite", grupo: "Doces", kcal: 540, p: 7.2, c: 59.6, g: 30.3, f: 2.0, medidas: [["quadradinho", 6], ["barra pequena", 25]] },
];

export function semearAlimentos(): void {
  const total = queryAll<{ t: number }>("SELECT COUNT(*) as t FROM alimentos")[0]?.t ?? 0;
  if (total > 0) return;
  const agora = new Date().toISOString();

  for (const a of ALIMENTOS_TACO) {
    const id = crypto.randomUUID();
    const primeira = a.medidas?.[0];
    runAndPersist(
      `INSERT INTO alimentos (id, nome, grupo, fonte, kcal, proteina_g, carboidrato_g, gordura_g,
         fibra_g, porcao_padrao_g, porcao_padrao_nome, favorito, criado_em, atualizado_em)
       VALUES (?, ?, ?, 'taco', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [id, a.nome, a.grupo, a.kcal, a.p, a.c, a.g, a.f,
       primeira?.[1] ?? 100, primeira?.[0] ?? "100 g", agora, agora],
    );
    for (const [nome, gramas] of a.medidas ?? []) {
      runAndPersist(
        "INSERT INTO medidas_caseiras (id, alimento_id, nome, gramas, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)",
        [crypto.randomUUID(), id, nome, gramas, agora, agora],
      );
    }
  }
}

// --- Alimentos -------------------------------------------------------------

export function buscarAlimentos(termo: string, limite = 30): Alimento[] {
  if (!termo.trim()) {
    return queryAll<Alimento>(
      "SELECT * FROM alimentos ORDER BY favorito DESC, nome COLLATE NOCASE LIMIT ?", [limite]);
  }
  // LIKE com acento resolvido por COLLATE NOCASE do SQLite não cobre
  // acentuação. O filtro fino acontece em JS, sobre um conjunto amplo.
  const todos = queryAll<Alimento>("SELECT * FROM alimentos");
  const alvo = normalizar(termo);
  return todos
    .filter((a) => normalizar(a.nome).includes(alvo))
    .sort((a, b) => {
      const ai = normalizar(a.nome).indexOf(alvo);
      const bi = normalizar(b.nome).indexOf(alvo);
      if (ai !== bi) return ai - bi;
      return a.nome.localeCompare(b.nome);
    })
    .slice(0, limite);
}

function normalizar(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function buscarAlimento(id: string): Alimento | null {
  return queryAll<Alimento>("SELECT * FROM alimentos WHERE id = ?", [id])[0] ?? null;
}

export function medidasDoAlimento(alimentoId: string): MedidaCaseira[] {
  return queryAll<MedidaCaseira>(
    "SELECT * FROM medidas_caseiras WHERE alimento_id = ? ORDER BY gramas", [alimentoId]);
}

export async function criarAlimento(dados: Partial<Alimento> & { nome: string }): Promise<string> {
  return inserir("alimentos", { fonte: "proprio", favorito: 0, ...dados });
}

export async function alternarFavorito(id: string): Promise<void> {
  const a = buscarAlimento(id);
  if (!a) return;
  await atualizar("alimentos", id, { favorito: a.favorito ? 0 : 1 });
}

export async function excluirAlimento(id: string): Promise<void> {
  await excluir("alimentos", id);
}

// --- Refeições -------------------------------------------------------------

export interface ItemComNutrientes extends RefeicaoItem {
  nome: string;
  kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  fibra: number;
}

/** Nutrientes de um item = valor por 100 g × (quantidade / 100). */
export function calcularItem(item: RefeicaoItem, alimento: Alimento | null): ItemComNutrientes {
  const fator = item.quantidade_g / 100;
  return {
    ...item,
    nome: alimento?.nome ?? item.nome_livre ?? "Item",
    kcal: (alimento?.kcal ?? 0) * fator,
    proteina: (alimento?.proteina_g ?? 0) * fator,
    carboidrato: (alimento?.carboidrato_g ?? 0) * fator,
    gordura: (alimento?.gordura_g ?? 0) * fator,
    fibra: (alimento?.fibra_g ?? 0) * fator,
  };
}

export function refeicoesDoDia(data = hoje(), pessoaId?: string | null): Array<Refeicao & { itens: ItemComNutrientes[] }> {
  const refeicoes = pessoaId
    ? queryAll<Refeicao>("SELECT * FROM refeicoes WHERE data = ? AND pessoa_id = ? ORDER BY hora, criado_em", [data, pessoaId])
    : queryAll<Refeicao>("SELECT * FROM refeicoes WHERE data = ? ORDER BY hora, criado_em", [data]);

  return refeicoes.map((r) => {
    const itens = queryAll<RefeicaoItem>(
      "SELECT * FROM refeicao_itens WHERE refeicao_id = ? ORDER BY criado_em", [r.id]);
    return {
      ...r,
      itens: itens.map((i) => calcularItem(i, i.alimento_id ? buscarAlimento(i.alimento_id) : null)),
    };
  });
}

export async function criarRefeicao(dados: {
  data: string; tipo: TipoRefeicao; hora?: string | null; pessoa_id?: string | null;
}): Promise<string> {
  return inserir("refeicoes", dados);
}

export async function excluirRefeicao(id: string): Promise<void> {
  await excluir("refeicoes", id);
}

export async function adicionarItem(dados: {
  refeicao_id: string; alimento_id?: string | null; nome_livre?: string | null;
  quantidade_g: number; medida_nome?: string | null; medida_quantidade?: number | null;
}): Promise<string> {
  return inserir("refeicao_itens", dados);
}

export async function excluirItem(id: string): Promise<void> {
  await excluir("refeicao_itens", id);
}

export interface TotaisDia {
  kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  fibra: number;
  agua_ml: number;
  refeicoes: number;
}

export function totaisDoDia(data = hoje(), pessoaId?: string | null): TotaisDia {
  const refeicoes = refeicoesDoDia(data, pessoaId);
  const totais: TotaisDia = { kcal: 0, proteina: 0, carboidrato: 0, gordura: 0, fibra: 0, agua_ml: 0, refeicoes: refeicoes.length };
  for (const r of refeicoes) {
    for (const i of r.itens) {
      totais.kcal += i.kcal;
      totais.proteina += i.proteina;
      totais.carboidrato += i.carboidrato;
      totais.gordura += i.gordura;
      totais.fibra += i.fibra;
    }
  }
  totais.agua_ml = aguaDoDia(data, pessoaId);
  return totais;
}

/** Média dos últimos dias em que houve registro — ignora dias em branco. */
export function mediaDiaria(dias = 7, pessoaId?: string | null): TotaisDia {
  const acumulado: TotaisDia = { kcal: 0, proteina: 0, carboidrato: 0, gordura: 0, fibra: 0, agua_ml: 0, refeicoes: 0 };
  let diasComRegistro = 0;
  for (let i = 0; i < dias; i++) {
    const data = somarDias(hoje(), -i);
    const t = totaisDoDia(data, pessoaId);
    if (t.refeicoes === 0) continue;
    diasComRegistro += 1;
    acumulado.kcal += t.kcal;
    acumulado.proteina += t.proteina;
    acumulado.carboidrato += t.carboidrato;
    acumulado.gordura += t.gordura;
    acumulado.fibra += t.fibra;
    acumulado.agua_ml += t.agua_ml;
  }
  if (diasComRegistro === 0) return acumulado;
  return {
    kcal: acumulado.kcal / diasComRegistro,
    proteina: acumulado.proteina / diasComRegistro,
    carboidrato: acumulado.carboidrato / diasComRegistro,
    gordura: acumulado.gordura / diasComRegistro,
    fibra: acumulado.fibra / diasComRegistro,
    agua_ml: acumulado.agua_ml / diasComRegistro,
    refeicoes: diasComRegistro,
  };
}

export function evolucaoKcal(dias = 14, pessoaId?: string | null): Array<{ data: string; kcal: number; proteina: number }> {
  const resultado: Array<{ data: string; kcal: number; proteina: number }> = [];
  for (let i = dias - 1; i >= 0; i--) {
    const data = somarDias(hoje(), -i);
    const t = totaisDoDia(data, pessoaId);
    resultado.push({ data, kcal: t.kcal, proteina: t.proteina });
  }
  return resultado;
}

// --- Água ------------------------------------------------------------------

export function aguaDoDia(data = hoje(), pessoaId?: string | null): number {
  const rows = pessoaId
    ? queryAll<{ t: number }>("SELECT COALESCE(SUM(ml), 0) as t FROM registros_agua WHERE data = ? AND pessoa_id = ?", [data, pessoaId])
    : queryAll<{ t: number }>("SELECT COALESCE(SUM(ml), 0) as t FROM registros_agua WHERE data = ?", [data]);
  return rows[0]?.t ?? 0;
}

export async function registrarAgua(ml: number, pessoaId?: string | null, data = hoje()): Promise<string> {
  return inserir("registros_agua", { ml, pessoa_id: pessoaId ?? null, data });
}

export async function desfazerUltimaAgua(data = hoje()): Promise<void> {
  const ultimo = queryAll<{ id: string }>(
    "SELECT id FROM registros_agua WHERE data = ? ORDER BY criado_em DESC LIMIT 1", [data])[0];
  if (ultimo) await excluir("registros_agua", ultimo.id);
}

// --- Referências de necessidade energética ---------------------------------

export type NivelAtividade = "sedentario" | "leve" | "moderado" | "intenso" | "muito_intenso";

export const NIVEIS_ATIVIDADE: Array<{ valor: NivelAtividade; label: string; fator: number; descricao: string }> = [
  { valor: "sedentario", label: "Sedentário", fator: 1.2, descricao: "Trabalho sentado, pouco ou nenhum exercício" },
  { valor: "leve", label: "Levemente ativo", fator: 1.375, descricao: "Exercício leve 1 a 3 dias por semana" },
  { valor: "moderado", label: "Moderadamente ativo", fator: 1.55, descricao: "Exercício moderado 3 a 5 dias por semana" },
  { valor: "intenso", label: "Muito ativo", fator: 1.725, descricao: "Exercício intenso 6 a 7 dias por semana" },
  { valor: "muito_intenso", label: "Extremamente ativo", fator: 1.9, descricao: "Trabalho físico pesado ou treino duplo" },
];

/**
 * Taxa metabólica basal pela equação de Mifflin-St Jeor, que é a de menor
 * erro médio nas revisões que compararam as fórmulas disponíveis.
 *
 * É uma ESTIMATIVA POPULACIONAL. O erro individual passa de 10% com
 * facilidade — composição corporal, genética e histórico mudam o número.
 * Serve como ponto de partida para conversar com um profissional, não
 * como alvo a ser perseguido.
 */
export function calcularTMB(peso: number, altura: number, idade: number, sexo: "M" | "F"): number {
  const base = 10 * peso + 6.25 * altura - 5 * idade;
  return sexo === "M" ? base + 5 : base - 161;
}

export function calcularGastoDiario(tmb: number, nivel: NivelAtividade): number {
  const fator = NIVEIS_ATIVIDADE.find((n) => n.valor === nivel)?.fator ?? 1.2;
  return tmb * fator;
}

export const AVISO_ESTIMATIVA =
  "Estimativa populacional (Mifflin-St Jeor). O erro individual passa de 10% com facilidade. "
  + "Serve como ponto de partida para conversar com um nutricionista — não como alvo a perseguir. "
  + "Quem define meta alimentar com segurança é um profissional que conhece seu histórico.";
