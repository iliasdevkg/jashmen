// admin-src/components/SectionsEditor.jsx — the editor both marketing pages
// are written in.
//
// A page is a list of sections; a section is a handful of trilingual fields,
// optionally a url or two, optionally one repeatable list. That shape is
// declared once per page as a table (see BusinessModule.jsx) and this
// component renders it: a sidebar of sections on the left, the selected
// section's fields on the right. Saving PUTs only the section being edited,
// so two people editing different sections cannot clobber each other.
//
// It was extracted from the landing editor when the business site got its
// own copy in the store — the field kinds are identical, and a second copy
// of this form would have drifted from the first within a month.
import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, ExternalLink, Check,
  Film, Upload, ImageIcon, Link as LinkIcon,
} from 'lucide-react';

import * as api from '../api.js';
import {
  Card, Field, TextInput, Select, Button, ErrorNote, TrilingualInput, ImageUpload, previewText,
} from './ui.jsx';
import IconPicker from './IconPicker.jsx';


const SITE_URL = 'https://jashmenstudio.com/';

// A new row starts with an id the backend will accept as-is, so the React
// key stays stable from the moment it appears until long after it's saved.
function blankItem(spec, existing) {
  const taken = new Set(existing.map(i => i.id));
  let n = existing.length + 1;
  while (taken.has(`item-${n}`)) n += 1;
  const item = { id: `item-${n}` };
  if (spec.icon) item.icon = null;
  for (const f of spec.plains || []) item[f.key] = '';
  for (const f of spec.images || []) item[f.key] = '';
  for (const f of spec.fields || []) item[f.key] = { ky: '', ru: '', en: '' };
  return item;
}

function move(list, from, to) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}

// The B2B page's hero video. One control, two ways in, because both are what
// people actually have: a file (the panel's uploader already accepts
// mp4/webm/mov up to 25MB — admin-api/uploads.js) and a YouTube or Vimeo
// link, which is what a marketing team is far more likely to own.
//
// An empty field is a supported state, not a missing one: the site then
// renders the hero with no play button at all rather than a control that
// opens nothing. That is what the "Бош калса" line under the field says, and
// it is why there is a clear button.
function VideoField({ token, label, url, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const hosted = /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
  const isFile = url && !hosted;

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { url: u } = await api.uploadMedia(token, file);
      onChange(u);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      // Let the same file be picked again after a failure.
      e.target.value = '';
    }
  }

  return (
    <Field label={label}>
      {url && (
        <div
          className="rounded-xl overflow-hidden mb-2.5"
          style={{ background: '#0b1220', border: '1px solid #1e293b' }}
        >
          {isFile ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={url} controls className="w-full max-h-56 bg-black" />
          ) : (
            <div className="flex items-center gap-2.5 px-3.5 py-3">
              <LinkIcon size={15} className="shrink-0" style={{ color: '#1CB0F6' }} />
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[12.5px] text-slate-300 truncate hover:text-white transition-colors"
              >
                {url}
              </a>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm cursor-pointer"
          style={{ background: '#0f172a', border: '1.5px dashed #334155', color: '#94a3b8' }}
        >
          <Upload size={14} />
          {uploading ? 'Жүктөлүүдө...' : url ? 'Файл алмаштыруу' : 'Видео файл жүктөө'}
          <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={upload} />
        </label>
        {url && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-2.5 rounded-xl shrink-0"
            style={{ background: '#0f172a', border: '1.5px solid #334155', color: '#f87171' }}
            title="Видеону алып салуу"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="mt-2.5">
        <TextInput
          value={url}
          onChange={e => onChange(e.target.value)}
          placeholder="же YouTube / Vimeo шилтемеси: https://youtu.be/..."
        />
      </div>

      {error && <p className="text-[11.5px] text-red-400 mt-1.5">{error}</p>}
      <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
        Бош калса — башкы бетте ойнотуу баскычы такыр чыкпайт. Файл 25 МБ чейин.
      </p>
    </Field>
  );
}


// The editor itself, driven entirely by a section table. Two pages run
// through it — the student landing (SECTIONS above) and the business site
// (BUSINESS_SECTIONS in BusinessModule.jsx) — because the field kinds are
// identical and a second copy of 300 lines of form would drift from this
// one within a month.
export function SectionsEditor({
  token, onAuthError, sections, fetchAll, saveOne, title, hint, siteUrl,
}) {
  const [landing, setLanding] = useState(null);
  const [active, setActive] = useState(sections[0].key);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const spec = sections.find(s => s.key === active);

  useEffect(() => {
    fetchAll(token)
      .then(setLanding)
      .catch(e => { if (e.status === 401) onAuthError(); else setError(e.message); })
      .finally(() => setLoading(false));
  }, [token, onAuthError, fetchAll]);

  // The draft is per-section: switching tabs re-seeds it from the server
  // copy, so a half-typed sentence never leaks into a section it wasn't
  // written for.
  useEffect(() => {
    if (landing) setDraft(structuredClone(landing[active] || {}));
    setSaved(false);
    setError('');
  }, [landing, active]);

  const setField = useCallback((key, value) => {
    setDraft(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const setItem = useCallback((listKey, index, patch) => {
    setDraft(prev => ({
      ...prev,
      [listKey]: prev[listKey].map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
    setSaved(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const next = await saveOne(token, { [active]: draft });
      setLanding(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      if (err.status === 401) onAuthError(); else setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-400">Жүктөлүүдө...</p>;
  if (!landing || !draft) return <ErrorNote>{error || 'Маалымат жүктөлгөн жок'}</ErrorNote>;

  const list = spec.list;
  const rows = list ? (draft[list.key] || []) : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
        </div>
        <a
          href={siteUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 transition-colors hover:text-white"
          style={{ border: '1.5px solid #334155' }}
        >
          <ExternalLink size={13} /> Сайтты ачуу
        </a>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Sections */}
        <div className="w-full lg:w-60 shrink-0 flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
          {sections.map(({ key, label, icon: Icon }) => {
            const on = landing[key]?.enabled !== false;
            return (
              <button
                key={key}
                onClick={() => setActive(key)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-bold shrink-0 transition-colors text-left"
                style={{
                  background: active === key ? 'rgba(28,176,246,0.14)' : 'transparent',
                  color: active === key ? '#1CB0F6' : '#94a3b8',
                  border: `1.5px solid ${active === key ? 'rgba(28,176,246,0.35)' : 'transparent'}`,
                }}
              >
                <Icon size={15} className="shrink-0" />
                <span className="flex-1 whitespace-nowrap lg:whitespace-normal">{label}</span>
                {!on && <EyeOff size={13} className="shrink-0 opacity-70" />}
              </button>
            );
          })}
        </div>

        {/* Editor */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <Card>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h3 className="text-base font-black text-white">{spec.label}</h3>
                <p className="text-xs text-slate-500 mt-1">{spec.hint}</p>
              </div>
              <button
                onClick={() => setField('enabled', draft.enabled === false)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-colors"
                style={{
                  background: draft.enabled === false ? 'transparent' : 'rgba(88,204,2,0.14)',
                  color: draft.enabled === false ? '#94a3b8' : '#58CC02',
                  border: `1.5px solid ${draft.enabled === false ? '#334155' : 'rgba(88,204,2,0.35)'}`,
                }}
                title="Бөлүмдү сайтта көрсөтүү / жашыруу"
              >
                {draft.enabled === false ? <EyeOff size={13} /> : <Eye size={13} />}
                {draft.enabled === false ? 'Жашырылган' : 'Көрүнөт'}
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {(spec.fields || []).map(f => (
                <TrilingualInput
                  key={f.key}
                  label={f.label}
                  value={draft[f.key]}
                  onChange={v => setField(f.key, v)}
                  multiline={f.multiline}
                />
              ))}
              {(spec.selects || []).map(f => (
                <Field key={f.key} label={f.label}>
                  <Select
                    value={draft[f.key] || f.options[0].value}
                    onChange={e => setField(f.key, e.target.value)}
                  >
                    {f.options.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                  {f.help && <span className="text-[11px] text-slate-500 mt-1">{f.help}</span>}
                </Field>
              ))}

              {(spec.links || []).map(f => (
                <Field key={f.key} label={f.label}>
                  <TextInput
                    value={draft[f.key] || ''}
                    onChange={e => setField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                </Field>
              ))}
              {(spec.plains || []).map(f => (
                <Field key={f.key} label={f.label}>
                  <TextInput
                    value={draft[f.key] || ''}
                    onChange={e => setField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                </Field>
              ))}
              {spec.video && (
                <VideoField
                  token={token}
                  label={spec.video.label}
                  url={draft[spec.video.key] || ''}
                  onChange={v => setField(spec.video.key, v)}
                />
              )}
              {(spec.images || []).map(f => (
                <Field key={f.key} label={f.label}>
                  <ImageUpload
                    token={token}
                    url={draft[f.key] || ''}
                    onChange={v => setField(f.key, v)}
                    emptyIcon={Film}
                  />
                </Field>
              ))}
            </div>
          </Card>

          {list && (
            <Card>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h4 className="text-sm font-black text-white">
                  {list.label}
                  <span className="text-slate-500 font-bold ml-2">{rows.length}/{list.max}</span>
                </h4>
                <Button
                  variant="ghost"
                  disabled={rows.length >= list.max}
                  onClick={() => setField(list.key, [...rows, blankItem(list, rows)])}
                >
                  <Plus size={14} /> {list.addLabel}
                </Button>
              </div>

              <div className="flex flex-col gap-3">
                {rows.length === 0 && (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    Азырынча бош. «{list.addLabel}» баскычын басыңыз.
                  </p>
                )}

                {rows.map((row, i) => (
                  <div
                    key={row.id}
                    className="rounded-xl p-4 flex flex-col gap-3.5"
                    style={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-slate-500 tracking-wide">
                        {i + 1}. {(list.titleKey ? row[list.titleKey] : previewText(row[list.fields[0].key])) || 'Аталышы жок'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setField(list.key, move(rows, i, i - 1))}
                          disabled={i === 0}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-white disabled:opacity-30 transition-colors"
                          title="Жогору"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          onClick={() => setField(list.key, move(rows, i, i + 1))}
                          disabled={i === rows.length - 1}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-white disabled:opacity-30 transition-colors"
                          title="Ылдый"
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          onClick={() => setField(list.key, rows.filter((_, j) => j !== i))}
                          className="p-1.5 rounded-lg text-red-400/70 hover:text-red-400 transition-colors"
                          title="Өчүрүү"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {list.icon && (
                      <IconPicker
                        token={token}
                        icon={row.icon}
                        iconUrl={null}
                        allowUpload={false}
                        label="Иконка"
                        onChange={({ icon }) => setItem(list.key, i, { icon })}
                      />
                    )}

                    {(list.plains || []).map(f => (
                      <Field key={f.key} label={f.label}>
                        <TextInput
                          value={row[f.key] || ''}
                          onChange={e => setItem(list.key, i, { [f.key]: e.target.value })}
                          placeholder={f.placeholder}
                        />
                      </Field>
                    ))}

                    {(list.images || []).map(f => (
                      <div key={f.key} className="flex flex-col gap-2">
                        <span className="text-xs font-semibold text-slate-400">{f.label}</span>
                        <ImageUpload
                          token={token}
                          url={row[f.key] || ''}
                          variant="inline"
                          shape="circle"
                          emptyIcon={ImageIcon}
                          onChange={url => setItem(list.key, i, { [f.key]: url })}
                        />
                      </div>
                    ))}

                    {(list.fields || []).map(f => (
                      <TrilingualInput
                        key={f.key}
                        label={f.label}
                        value={row[f.key]}
                        onChange={v => setItem(list.key, i, { [f.key]: v })}
                        multiline={f.multiline}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <ErrorNote>{error}</ErrorNote>

          <div className="flex items-center gap-3 sticky bottom-0 py-3" style={{ background: '#080a10' }}>
            <Button variant="success" onClick={handleSave} loading={saving}>
              {saved ? <><Check size={14} /> Сакталды</> : 'Сактоо'}
            </Button>
            <span className="text-[11px] text-slate-500">
              Ушул бөлүм гана сакталат — калган бөлүмдөргө таасир этпейт.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
