// admin-src/components/ui.jsx — small shared primitives so the modules
// don't each reinvent the same card/input/button/upload/i18n styling.
import { useState, useRef } from 'react';
import { Loader2, Upload, Trash2, Plus } from 'lucide-react';
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
          ? <img src={url} alt="" className={`w-12 h-12 object-contain shrink-0 ${shapeClass}`} style={{ background: '#0b1220' }} />
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
      {/* What was just uploaded, whole. Cropping the preview meant an
          operator could not see that their photo was going to be cropped. */}
      {url && (
        <div
          className={`w-full h-32 flex items-center justify-center overflow-hidden ${shape === 'circle' ? 'rounded-full' : 'rounded-lg'}`}
          style={{ background: '#0b1220' }}
        >
          <img src={url} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}

// ── Colour ────────────────────────────────────────────────────────────────

/// The eight the design started with. They stay first and can never be
/// removed, so a module authored before anyone added a custom colour still
/// finds its swatch where it always was.
export const PRESET_COLORS = [
  '#58CC02', '#1CB0F6', '#FF9600', '#CE82FF',
  '#FF4B4B', '#2B70C9', '#EAB308', '#EC4899',
];

const CUSTOM_KEY = 'jashmen.admin.customColors';
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function readCustom() {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(c => HEX_RE.test(c)) : [];
  } catch {
    return [];
  }
}

function writeCustom(list) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); } catch { /* private window */ }
}

/**
 * Swatches plus a real colour picker.
 *
 * The module form used to offer eight fixed colours and nothing else, so a
 * partner's brand colour was simply unavailable. Picking one now adds it to
 * the row and keeps it there — the next module gets it as a swatch instead of
 * making the operator find the same hex again.
 *
 * The custom list lives in this browser (localStorage), not on the server:
 * it is a convenience for whoever is authoring, and the colour that matters
 * is already saved on the record itself.
 */
export function ColorPicker({ value, onChange }) {
  const [custom, setCustom] = useState(readCustom);
  const nativeRef = useRef(null);

  // A colour already saved on the record but absent from both lists — an
  // older build's choice, or another operator's. Shown so the selected
  // swatch is always visible somewhere.
  const orphan = HEX_RE.test(value || '') &&
    !PRESET_COLORS.includes(value) && !custom.includes(value) ? [value] : [];

  // The write happens here, not inside the state updater. StrictMode invokes
  // an updater twice and throws the first result away, so a side effect
  // living in there runs at the wrong times — or, with an early return, not
  // at all.
  const remember = (hex) => {
    if (!HEX_RE.test(hex) || PRESET_COLORS.includes(hex) || custom.includes(hex)) return;
    // Newest first, capped — a palette nobody can scan is not a palette.
    const next = [hex, ...custom].slice(0, 16);
    writeCustom(next);
    setCustom(next);
  };

  const forget = (hex, e) => {
    e.stopPropagation();
    const next = custom.filter(c => c !== hex);
    writeCustom(next);
    setCustom(next);
  };

  const swatch = (c, removable) => (
    <div key={c} className="relative group">
      <button
        type="button"
        onClick={() => onChange(c)}
        title={c}
        aria-label={c}
        className="w-8 h-8 rounded-full block"
        style={{ background: c, boxShadow: value === c ? `0 0 0 2px #0b1220, 0 0 0 4px ${c}` : 'none' }}
      />
      {removable && (
        <button
          type="button"
          onClick={e => forget(c, e)}
          title="Тизмеден алып салуу"
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full items-center justify-center hidden group-hover:flex"
          style={{ background: '#0b1220', border: '1px solid #334155', color: '#94a3b8', fontSize: 10, lineHeight: 1 }}
        >
          ×
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap items-center">
        {PRESET_COLORS.map(c => swatch(c, false))}
        {custom.map(c => swatch(c, true))}
        {orphan.map(c => swatch(c, false))}

        {/* The picker itself. A hidden native input does the work — every
            browser already has a good colour wheel, and a hand-rolled one
            would be worse in every way that matters. */}
        <button
          type="button"
          onClick={() => nativeRef.current?.click()}
          title="Башка түс тандоо"
          aria-label="Башка түс тандоо"
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          style={{ border: '1.5px dashed #475569' }}
        >
          <Plus size={14} />
        </button>
        <input
          ref={nativeRef}
          type="color"
          value={HEX_RE.test(value || '') ? value : '#1CB0F6'}
          onChange={e => { onChange(e.target.value); remember(e.target.value); }}
          className="sr-only"
          tabIndex={-1}
        />
      </div>

      {/* Typed, for a brand colour that arrives as a hex rather than as a
          thing to eyeball. */}
      <div className="flex items-center gap-2">
        <TextInput
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          onBlur={e => remember(e.target.value)}
          placeholder="#1CB0F6"
          className="w-32 font-mono text-xs"
        />
        <span className="text-[11px] text-slate-600">
          Тандаган түсүң тизмеге кошулат
        </span>
      </div>
    </div>
  );
}
