export interface Pessoa {
  id: string;
  nome: string;
  parentesco: string | null;
  data_nascimento: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}
