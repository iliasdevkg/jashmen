// admin-src/components/ui.jsx — small shared primitives so the four
// modules don't each reinvent the same card/input/button styling.
import { Loader2 } from 'lucide-react';

export function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{ background: '#12141c', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {children}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-400">{label}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  background: '#0b1220',
  border: '1.5px solid #334155',
  color: 'white',
};

export function TextInput(props) {
  return (
    <input
      {...props}
      className={`px-3 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1CB0F6] ${props.className || ''}`}
      style={{ ...inputStyle, ...(props.style || {}) }}
    />
  );
}

export function TextArea(props) {
  return (
    <textarea
      {...props}
      className={`px-3 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1CB0F6] resize-y ${props.className || ''}`}
      style={{ ...inputStyle, ...(props.style || {}) }}
    />
  );
}

export function Select(props) {
  return (
    <select
      {...props}
      className={`px-3 py-2.5 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#1CB0F6] ${props.className || ''}`}
      style={{ ...inputStyle, ...(props.style || {}) }}
    />
  );
}

export function Button({ children, variant = 'primary', loading, className = '', ...rest }) {
  const variants = {
    primary: { background: '#1CB0F6', color: 'white' },
    success: { background: '#58CC02', color: 'white' },
    danger:  { background: 'transparent', color: '#f87171', border: '1.5px solid rgba(248,113,113,0.35)' },
    ghost:   { background: 'transparent', color: '#94a3b8', border: '1.5px solid #334155' },
  };
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-opacity ${className}`}
      style={variants[variant]}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function EmptyState({ icon: Icon, title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
      {Icon && <Icon size={32} color="#475569" />}
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      {desc && <p className="text-xs text-slate-500 max-w-xs">{desc}</p>}
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return <p className="text-xs text-red-400 px-1">{children}</p>;
}
