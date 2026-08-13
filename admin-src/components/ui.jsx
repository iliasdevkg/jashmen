// admin-src/components/ui.jsx — small shared primitives so the modules
// don't each reinvent the same card/input/button/upload/i18n styling.
import { useState } from 'react';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import * as api from '../api.js';

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

// ── Trilingual content (Task 13) ────────────────────────────────────────
//
// Every admin-authored piece of content — module/lesson titles, quiz text,
// partner/prize copy, league/achievement copy, shop item copy, retention
// push copy — is entered in up to three languages: ky (required, the app's
// default/fallback), ru and en (both optional — the learner apps fall back
// to ky when a translation is missing). One shared control so every
// module's form looks and behaves identically; a bare string is legacy
// content from before this existed and is upgraded the moment it's edited.
const LANGS = [
  ['ky', '🇰🇬', 'Кыргызча'],
  ['ru', '🇷🇺', 'Орусча'],
  ['en', '🇺🇸', 'Англисче'],
];

export function TrilingualInput({ label, value, onChange, kyRequired, multiline }) {
  const v = { ky: '', ru: '', en: '', ...(typeof value === 'string' ? { ky: value } : value || {}) };
  const Comp = multiline ? TextArea : TextInput;
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-semibold text-slate-400">{label}</span>}
      {LANGS.map(([key, flag, name]) => (
        <div key={key} className="flex items-start gap-2">
          <span className="text-base pt-2.5 shrink-0" title={name}>{flag}</span>
          <Comp
            placeholder={key === 'ky' ? `${name}${kyRequired ? ' (милдеттүү)' : ''}` : `${name} (милдеттүү эмес)`}
            value={v[key]}
            onChange={e => onChange({ ...v, [key]: e.target.value })}
            className="flex-1"
            {...(multiline ? { rows: 2 } : {})}
          />
        </div>
      ))}
    </div>
  );
}

// Renders a trilingual (or legacy plain-string) value as one line for admin
// lists, dropdown options, and confirm() dialogs — Kyrgyz first (the one
// guaranteed-filled language), falling back ru → en, same order the
// learner apps read content in.
export function previewText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value.ky || value.ru || value.en || '';
}

// ── Image upload (icon/logo/photo) ──────────────────────────────────────
//
// Every module needs the same "optional image, uploaded via
// POST /admin/api/admin/media/upload" control, just laid out two ways:
// `variant="block"` — a wide dropzone-style button with a big preview below
// and a remove (✕) button, used for lesson/quiz/module/league/achievement/
// shop-item art. `variant="inline"` — a small preview beside a compact
// upload button, used for partner logos / prize photos.
export function ImageUpload({ token, url, onChange, variant = 'block', shape = 'square', emptyIcon: EmptyIcon }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url: u } = await api.uploadMedia(token, file);
      onChange(u);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  if (variant === 'inline') {
    const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl';
    return (
      <div className="flex items-center gap-3">
        {url
          ? <img src={url} alt="" className={`w-12 h-12 object-cover shrink-0 ${shapeClass}`} />
          : (
            <div className={`w-12 h-12 flex items-center justify-center shrink-0 ${shapeClass}`} style={{ background: '#0b1220', border: '1.5px dashed #334155' }}>
              {EmptyIcon && <EmptyIcon size={18} color="#475569" />}
            </div>
          )}
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer" style={{ background: '#0b1220', border: '1.5px solid #334155', color: '#94a3b8' }}>
          <Upload size={13} />
          {uploading ? 'Жүктөлүүдө...' : url ? 'Алмаштыруу' : 'Жүктөө'}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        <label className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm cursor-pointer" style={{ background: '#0f172a', border: '1.5px dashed #334155', color: '#94a3b8' }}>
          <Upload size={14} />
          {uploading ? 'Жүктөлүүдө...' : url ? 'Сүрөт алмаштыруу' : 'Сүрөт кошуу (милдеттүү эмес)'}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </label>
        {url && (
          <button type="button" onClick={() => onChange('')} className="p-2.5 rounded-xl shrink-0" style={{ background: '#0f172a', border: '1.5px solid #334155', color: '#f87171' }} title="Сүрөттү алып салуу">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {url && <img src={url} alt="" className={`w-full max-h-32 object-cover ${shape === 'circle' ? 'rounded-full' : 'rounded-lg'}`} />}
    </div>
  );
}
