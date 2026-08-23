import { useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Check, X } from "lucide-react";
import "./ui.css";

// --- Botões -----------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  icon,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; icon?: ReactNode }) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...rest}>
      {icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  );
}

// --- Cards --------------------------------------------------------------

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn" | "danger" | "success";
  icon?: ReactNode;
}) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <div className="stat-value tabular">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

// --- Página / cabeçalho --------------------------------------------------

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

// --- Badge / status --------------------------------------------------------

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warn" | "danger" | "success" | "muted" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

// --- Estado vazio --------------------------------------------------------

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      {description && <p className="empty-desc">{description}</p>}
      {action}
    </div>
  );
}

// --- Campos de formulário --------------------------------------------------

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input" rows={3} {...props} />;
}

export function FieldLabel(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="field-label" {...props} />;
}

// --- Select com opção de criar um novo item embutida ------------------------
// Usado nos campos de classificação (categorias, tipos) pra evitar que o
// usuário precise sair do formulário pra cadastrar uma opção nova.

export interface OpcaoSelect {
  id: string;
  label: string;
}

export function SelectCriavel({
  value,
  onChange,
  opcoes,
  onCriarOpcao,
  placeholder = "Selecione",
}: {
  value: string;
  onChange: (id: string) => void;
  opcoes: OpcaoSelect[];
  onCriarOpcao: (nome: string) => Promise<string>;
  placeholder?: string;
}) {
  const [criando, setCriando] = useState(false);
  const [novoValor, setNovoValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function confirmarNovo() {
    const nome = novoValor.trim();
    if (!nome || salvando) return;
    setSalvando(true);
    try {
      const novoId = await onCriarOpcao(nome);
      onChange(novoId);
      setNovoValor("");
      setCriando(false);
    } finally {
      setSalvando(false);
    }
  }

  if (criando) {
    return (
      <div className="select-criavel-inline">
        <Input
          autoFocus
          value={novoValor}
          onChange={(e) => setNovoValor(e.target.value)}
          placeholder="Nome da nova opção"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmarNovo();
            }
            if (e.key === "Escape") setCriando(false);
          }}
        />
        <button type="button" className="icon-btn" onClick={confirmarNovo} aria-label="Confirmar" disabled={salvando}>
          <Check size={15} />
        </button>
        <button type="button" className="icon-btn" onClick={() => setCriando(false)} aria-label="Cancelar">
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <Select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__nova__") {
          setCriando(true);
          return;
        }
        onChange(e.target.value);
      }}
    >
      <option value="">{placeholder}</option>
      {opcoes.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
      <option value="__nova__">+ Adicionar nova opção...</option>
    </Select>
  );
}

export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2>{title}</h2>
          <button className="drawer-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}
