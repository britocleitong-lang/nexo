import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { queryAll } from "../database/db";

interface Resultado {
  id: string;
  titulo: string;
  categoria: string;
  rota: string;
}

function buscar(termo: string): Resultado[] {
  if (termo.trim().length < 2) return [];
  const like = `%${termo}%`;

  const pessoas = queryAll<{ id: string; nome: string }>(
    "SELECT id, nome FROM pessoas WHERE nome LIKE ? COLLATE NOCASE LIMIT 5",
    [like],
  ).map((p) => ({ id: p.id, titulo: p.nome, categoria: "Pessoa", rota: "/familia" }));

  const documentos = queryAll<{ id: string; nome: string }>(
    "SELECT id, nome FROM documentos WHERE nome LIKE ? COLLATE NOCASE LIMIT 5",
    [like],
  ).map((d) => ({ id: d.id, titulo: d.nome, categoria: "Documento", rota: "/documentos" }));

  const veiculos = queryAll<{ id: string; marca: string; modelo: string }>(
    "SELECT id, marca, modelo FROM veiculos WHERE (marca || ' ' || modelo) LIKE ? COLLATE NOCASE LIMIT 5",
    [like],
  ).map((v) => ({ id: v.id, titulo: `${v.marca} ${v.modelo}`, categoria: "Veículo", rota: "/veiculos" }));

  const tarefas = queryAll<{ id: string; titulo: string }>(
    "SELECT id, titulo FROM tarefas WHERE titulo LIKE ? COLLATE NOCASE LIMIT 5",
    [like],
  ).map((t) => ({ id: t.id, titulo: t.titulo, categoria: "Tarefa", rota: "/tarefas" }));

  const eventos = queryAll<{ id: string; titulo: string }>(
    "SELECT id, titulo FROM eventos WHERE titulo LIKE ? COLLATE NOCASE LIMIT 5",
    [like],
  ).map((e) => ({ id: e.id, titulo: e.titulo, categoria: "Agenda", rota: "/agenda" }));

  return [...pessoas, ...documentos, ...veiculos, ...tarefas, ...eventos];
}

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [termo, setTermo] = useState("");
  const navigate = useNavigate();
  const resultados = useMemo(() => buscar(termo), [termo]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="search-input"
          placeholder="Buscar pessoas, documentos, veículos, tarefas..."
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        <div className="search-results">
          {termo.trim().length >= 2 && resultados.length === 0 && (
            <p className="search-empty">Nada encontrado para "{termo}".</p>
          )}
          {resultados.map((r) => (
            <button
              key={`${r.categoria}-${r.id}`}
              className="search-result-item"
              onClick={() => {
                navigate(r.rota);
                onClose();
              }}
            >
              <span className="search-result-titulo">{r.titulo}</span>
              <span className="search-result-categoria">{r.categoria}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
