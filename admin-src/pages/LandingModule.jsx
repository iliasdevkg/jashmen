// admin-src/pages/LandingModule.jsx — the public marketing page's copy.
//
// jashmenstudio.com used to open straight onto the sign-in wall, so the only
// thing a visitor (or a search engine) could learn about JashMen was what fit
// in index.html's <head>. The landing page fixed that, and every word on it
// is edited here rather than in the frontend bundle: marketing copy changes
// far more often than code ships.
//
// Two panes, same shape as the university manager: sections on the left,
// the selected section's fields on the right. Saving PUTs only the section
// on screen — the backend merges it over the rest
// (contentStore.js#sanitizeLanding), so an in-progress edit somewhere else
// can never be clobbered by this one.
import { useState, useEffect, useCallback } from 'react';
import {
  Rocket, BarChart3, BookOpen, ListOrdered, GraduationCap, Gamepad2,
  Smartphone, HelpCircle, Link2, Plus, Trash2, ArrowUp, ArrowDown,
  Eye, EyeOff, ExternalLink, Check, Megaphone, MessageSquareQuote, User, Building2,
} from 'lucide-react';
import * as api from '../api.js';
import {
  Card, Field, TextInput, Select, Button, ErrorNote, TrilingualInput, ImageUpload, previewText,
} from '../components/ui.jsx';
import IconPicker from '../components/IconPicker.jsx';

// Mirrors contentStore.js#LANDING_SECTIONS field for field. The backend
// silently drops anything not listed there, so a field added here without
// its counterpart would look like it saved and then vanish on reload.
const SECTIONS = [
  {
    key: 'hero', label: 'Башкы экран', icon: Rocket,
    hint: 'Келген адам биринчи көргөн нерсе. Ураан кыска жана так болсун.',
    fields: [
      { key: 'eyebrow', label: 'Үстүңкү кичине жазуу' },
      { key: 'title', label: 'Негизги ураан', multiline: true },
      { key: 'subtitle', label: 'Түшүндүрмө', multiline: true },
      { key: 'primaryCta', label: 'Негизги баскычтын жазуусу' },
      { key: 'secondaryCta', label: 'Экинчи баскычтын жазуусу' },
      { key: 'badgeLabel', label: 'Жашыл ромбдогу жазуу' },
    ],
    selects: [
      {
        key: 'badgeStat',
        label: 'Жашыл ромбдо кайсы сан турат',
        // The number itself is never typed in — it is read from the live
        // database, so it cannot go stale the way "200+ өнөктөш" would.
        help: 'Сан сервердин чыныгы маалыматынан алынат, кол менен жазылбайт.',
        options: [
          { value: 'universities', label: 'Университеттердин саны' },
          { value: 'learners', label: 'Окуучулардын саны' },
          { value: 'lessons', label: 'Сабактардын саны' },
          { value: 'xp', label: 'Жалпы чогултулган XP' },
          { value: 'none', label: 'Ромб көрсөтүлбөсүн' },
        ],
      },
    ],
  },
  {
    key: 'ribbon', label: 'Чуркаган лента', icon: Megaphone,
    hint: 'Геройдун астындагы сары тилке. Кыска сөз тиркештери — үч сөздөн ашса окулбай калат.',
    fields: [],
    list: {
      key: 'items', label: 'Тиркештер', addLabel: 'Тиркеш кошуу', max: 10,
      fields: [{ key: 'text', label: 'Текст' }],
    },
  },
  {
    key: 'stats', label: 'Сандар', icon: BarChart3,
    hint: 'Сандардын өзү сервердин чыныгы маалыматынан алынат — бул жерде алардын аталыштары гана.',
    fields: [
      { key: 'title', label: 'Бөлүмдүн аталышы' },
      { key: 'subtitle', label: 'Түшүндүрмө', multiline: true },
      { key: 'learnersLabel', label: 'Окуучулардын саны — аталышы' },
      { key: 'lessonsLabel', label: 'Сабактардын саны — аталышы' },
      { key: 'universitiesLabel', label: 'Университеттердин саны — аталышы' },
      { key: 'xpLabel', label: 'Жалпы XP — аталышы' },
    ],
  },
  {
    key: 'features', label: 'Эмне үйрөнөт', icon: BookOpen,
    hint: 'Долбоордун негизги пайдасы. 3–6 карточка эң жакшы иштейт.',
    fields: [
      { key: 'title', label: 'Бөлүмдүн аталышы' },
      { key: 'subtitle', label: 'Түшүндүрмө', multiline: true },
    ],
    list: {
      key: 'items', label: 'Карточкалар', addLabel: 'Карточка кошуу', max: 12, icon: true,
      fields: [
        { key: 'title', label: 'Аталышы' },
        { key: 'text', label: 'Тексти', multiline: true },
      ],
    },
  },
  {
    key: 'steps', label: 'Кантип иштейт', icon: ListOrdered,
    hint: 'Номерленген кадамдар. Үчөө идеалдуу.',
    fields: [
      { key: 'title', label: 'Бөлүмдүн аталышы' },
      { key: 'subtitle', label: 'Түшүндүрмө', multiline: true },
    ],
    list: {
      key: 'items', label: 'Кадамдар', addLabel: 'Кадам кошуу', max: 8, icon: true,
      fields: [
        { key: 'title', label: 'Аталышы' },
        { key: 'text', label: 'Тексти', multiline: true },
      ],
    },
  },
  {
    key: 'uni', label: 'Университет лигасы', icon: GraduationCap,
    hint: 'Университеттердин өзү «Университеттер» табынан алынат — бул жерде айланасындагы текст гана.',
    fields: [
      { key: 'title', label: 'Бөлүмдүн аталышы' },
      { key: 'subtitle', label: 'Түшүндүрмө', multiline: true },
      { key: 'cta', label: 'Баскычтын жазуусу' },
      { key: 'prizeLabel', label: '«Байге фонду» аталышы' },
    ],
  },
  {
    key: 'partners', label: 'Өнөктөш логотиптери', icon: Building2,
    hint: 'Логотиптер «Өнөктөштөр» табындагы чыныгы тизмеден алынат — логотиби жүктөлгөндөр гана чыгат. Бул жерде үстүндөгү жазуу гана.',
    fields: [
      { key: 'title', label: 'Үстүндөгү жазуу' },
    ],
  },
  {
    key: 'gamification', label: 'Геймификация', icon: Gamepad2,
    hint: 'XP, серия, монета, дүкөн — окуучуну кармап турган нерселер.',
    fields: [
      { key: 'title', label: 'Бөлүмдүн аталышы' },
      { key: 'subtitle', label: 'Түшүндүрмө', multiline: true },
    ],
    list: {
      key: 'items', label: 'Карточкалар', addLabel: 'Карточка кошуу', max: 12, icon: true,
      fields: [
        { key: 'title', label: 'Аталышы' },
        { key: 'text', label: 'Тексти', multiline: true },
      ],
    },
  },
  {
    key: 'testimonials', label: 'Пикирлер', icon: MessageSquareQuote,
    hint: 'Демейки тексттер — ойлоп табылган. Чыныгы пикирлерге алмаштырыңыз: жасалма отзыв — бул беттеги жалгыз ишенимди буза турган нерсе.',
    fields: [
      { key: 'title', label: 'Бөлүмдүн аталышы' },
      { key: 'subtitle', label: 'Түшүндүрмө', multiline: true },
    ],
    list: {
      key: 'items', label: 'Пикирлер', addLabel: 'Пикир кошуу', max: 12,
      titleKey: 'name',
      // A person's name is the same in all three languages, and their photo
      // is an upload rather than an icon slug — both sit outside the
      // trilingual fields below.
      plains: [{ key: 'name', label: 'Аты', placeholder: 'Айпери' }],
      images: [{ key: 'avatarUrl', label: 'Сүрөтү (милдеттүү эмес)' }],
      fields: [
        { key: 'role', label: 'Кайсы университет, курс' },
        { key: 'text', label: 'Пикирдин тексти', multiline: true },
      ],
    },
  },
  {
    key: 'download', label: 'Колдонмону жүктөө', icon: Smartphone,
    hint: 'APK шилтемесин койсоңуз — жүктөө баскычы чыгат. Бош калса баскыч көрүнбөйт.',
    fields: [
      { key: 'title', label: 'Бөлүмдүн аталышы' },
      { key: 'subtitle', label: 'Түшүндүрмө', multiline: true },
      { key: 'apkLabel', label: 'Жүктөө баскычынын жазуусу' },
      { key: 'webCta', label: 'Браузерде ачуу баскычы' },
      { key: 'note', label: 'Кичине эскертүү' },
    ],
    links: [
      { key: 'apkUrl', label: 'APK шилтемеси', placeholder: 'https://... же /downloads/jashmen.apk' },
    ],
  },
  {
    key: 'faq', label: 'Суроо-жооп', icon: HelpCircle,
    hint: 'Адамдар кайра-кайра берген суроолор. Ар бир жооп 1–3 сүйлөм.',
    fields: [
      { key: 'title', label: 'Бөлүмдүн аталышы' },
      { key: 'subtitle', label: 'Түшүндүрмө (бош калса көрүнбөйт)', multiline: true },
    ],
    list: {
      key: 'items', label: 'Суроолор', addLabel: 'Суроо кошуу', max: 20,
      fields: [
        { key: 'q', label: 'Суроо' },
        { key: 'a', label: 'Жооп', multiline: true },
      ],
    },
  },
  {
    key: 'footer', label: 'Ылдыйкы бөлүк', icon: Link2,
    hint: 'Байланыш маалыматы жана автордук укук.',
    fields: [
      { key: 'tagline', label: 'Кыска сүрөттөмө' },
      { key: 'rights', label: 'Автордук укук' },
    ],
    links: [
      { key: 'instagram', label: 'Instagram шилтемеси', placeholder: 'https://www.instagram.com/...' },
    ],
    plains: [
      { key: 'email', label: 'Байланыш почтасы', placeholder: 'jashmenstudio@gmail.com' },
    ],
  },
];

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

export default function LandingModule({ token, onAuthError }) {
  const [landing, setLanding] = useState(null);
  const [active, setActive] = useState(SECTIONS[0].key);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const spec = SECTIONS.find(s => s.key === active);

  useEffect(() => {
    api.fetchLanding(token)
      .then(setLanding)
      .catch(e => { if (e.status === 401) onAuthError(); else setError(e.message); })
      .finally(() => setLoading(false));
  }, [token, onAuthError]);

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
      const next = await api.saveLanding(token, { [active]: draft });
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
          <h2 className="text-lg font-black text-white">Landing бет</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            jashmenstudio.com дарегине кирген ар бир адам көргөн бет. Үч тилде тең толтуруңуз.
          </p>
        </div>
        <a
          href={SITE_URL}
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
          {SECTIONS.map(({ key, label, icon: Icon }) => {
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
                          emptyIcon={User}
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
