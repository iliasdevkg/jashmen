// admin-src/components/IconPicker.jsx — the shared glyph control, used
// anywhere the app draws an icon it lets an admin choose: lessons, modules,
// leagues, achievements, shop items.
//
// Two mutually exclusive sources, one field group: pick from the built-in
// set (shared/lessonIcons.js — stored as a slug, drawn as a real vector on
// every client) or upload an image (the original behaviour, kept for a
// partner's own artwork).
//
// Mutually exclusive on purpose: the backend gives `icon` precedence over
// `iconUrl`, so allowing both to be set at once would show an editor state
// the app never renders. Choosing one clears the other.
import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { LESSON_ICONS, LESSON_ICON_GROUPS } from '../../shared/lessonIcons.js';
import { lessonIconFor } from '../../shared/lessonIconComponents.jsx';
import { ImageUpload } from './ui.jsx';

const TABS = [
  { key: 'set',    label: 'Набордон' },
  { key: 'upload', label: 'Өз сүрөтүм' },
];

export default function IconPicker({
  token,
  icon,
  iconUrl,
  onChange,
  label = 'Иконка (милдеттүү эмес)',
  uploadVariant = 'block',
  uploadShape = 'square',
  emptyIcon,
  // Modules opt out: there the uploaded artwork is a separate, larger thing
  // (the framed tile above the path) that lives in its own field, so the two
  // are not alternatives and must not clear each other.
  allowUpload = true,
}) {
  // An entity that already has an uploaded image opens on the upload tab, so
  // editing it doesn't look like the image was lost.
  const [tab, setTab] = useState(() => (allowUpload && !icon && iconUrl ? 'upload' : 'set'));
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const results = useMemo(
    () => (q
      ? LESSON_ICONS.filter(i =>
          i.label.toLowerCase().includes(q) ||
          i.slug.includes(q) ||
          i.group.toLowerCase().includes(q))
      : LESSON_ICONS),
    [q],
  );

  // A flat wall of 138 glyphs is unusable; the headings are what make the set
  // browsable when nobody has typed anything. A search result is already a
  // narrow list, so it stays flat — splitting five matches across four
  // headings would be noise.
  const sections = useMemo(
    () => (q
      ? [{ group: null, items: results }]
      : LESSON_ICON_GROUPS
          .map(group => ({ group, items: LESSON_ICONS.filter(i => i.group === group) }))
          .filter(s => s.items.length > 0)),
    [q, results],
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-400">{label}</span>
        {(icon || (allowUpload && iconUrl)) && (
          <button
            type="button"
            onClick={() => onChange(allowUpload ? { icon: null, iconUrl: null } : { icon: null, iconUrl })}
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X size={11} /> Тазалоо
          </button>
        )}
      </div>

      {/* Segmented control — one row, the active half filled. Pointless with
          only one source, so it's dropped entirely in that case. */}
      {allowUpload && (
      <div className="flex gap-1 p-1 rounded-xl w-max" style={{ background: '#0b1220', border: '1px solid #1e293b' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            style={tab === t.key
              ? { background: '#1CB0F6', color: 'white' }
              : { background: 'transparent', color: '#64748b' }}
          >
            {t.label}
          </button>
        ))}
      </div>
      )}

      {!allowUpload || tab === 'set' ? (
        <div className="flex flex-col gap-2.5">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" color="#475569" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Иконка издөө... (${LESSON_ICONS.length})`}
              className="w-full pl-8 pr-3 py-2 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]"
              style={{ background: '#0b1220', border: '1.5px solid #334155' }}
            />
          </div>

          {results.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">«{query}» боюнча эч нерсе табылган жок</p>
          ) : (
            <div
              className="flex flex-col gap-3 p-2 rounded-xl max-h-[320px] overflow-y-auto"
              style={{ background: '#0b1220', border: '1px solid #1e293b' }}
            >
              {sections.map(({ group, items }) => (
                <div key={group || 'results'} className="flex flex-col gap-1.5">
                  {group && (
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 px-0.5 sticky top-0 py-1"
                       style={{ background: '#0b1220' }}>
                      {group}
                    </p>
                  )}
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))' }}>
                    {items.map(({ slug, label }) => {
                      const Glyph = lessonIconFor(slug);
                      const active = icon === slug;
                      return (
                        <button
                          key={slug}
                          type="button"
                          title={`${label} · ${slug}`}
                          aria-label={label}
                          aria-pressed={active}
                          // Picking from the set drops the uploaded image — see the
                          // mutual-exclusion note at the top of this file.
                          onClick={() => onChange({ icon: active ? null : slug, iconUrl: allowUpload ? null : iconUrl })}
                          className="aspect-square rounded-lg flex items-center justify-center transition-colors"
                          style={active
                            ? { background: 'rgba(28,176,246,0.16)', border: '1.5px solid #1CB0F6', color: '#1CB0F6' }
                            : { background: '#12141c', border: '1.5px solid #1e293b', color: '#94a3b8' }}
                        >
                          <Glyph size={19} strokeWidth={2.2} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-slate-500">
            {icon
              ? `Тандалды: ${LESSON_ICONS.find(i => i.slug === icon)?.label ?? icon}`
              : 'Эч нерсе тандалган жок — колдонмодо демейки иконка чыгат'}
          </p>
        </div>
      ) : (
        <ImageUpload
          token={token}
          url={iconUrl}
          // Uploading clears a set icon for the same reason picking clears the
          // upload: the app can only ever draw one of them.
          onChange={url => onChange({ icon: null, iconUrl: url })}
          variant={uploadVariant}
          shape={uploadShape}
          emptyIcon={emptyIcon}
        />
      )}
    </div>
  );
}
