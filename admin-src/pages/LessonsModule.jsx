// admin-src/pages/LessonsModule.jsx — Module A: "Конструктор Уроков и
// Тестов". Modules on the left, the selected module's lessons + an editor
// on the right. A lesson is an ordered list of cards — Введение (theory),
// Медиа-Инфо (media), Интерактивный Квиз (quiz) — exactly the three types
// the manifest calls for.
import { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown, BookOpen, Check } from 'lucide-react';
import * as api from '../api.js';
import { Card, Field, TextInput, Select, Button, EmptyState, ErrorNote, TrilingualInput, ImageUpload, previewText } from '../components/ui.jsx';

const COLORS = ['#58CC02', '#1CB0F6', '#FF9600', '#CE82FF', '#FF4B4B', '#2B70C9', '#EAB308', '#EC4899'];

// Card text is trilingual ({ky, ru, en}) per Task 13 — ky required, ru/en
// optional (the app falls back to ky if a translation is blank). A plain
// string is legacy content from before this existed; TrilingualInput
// upgrades it to {ky, ru, en} the moment it's edited.
function emptyCard(type) {
  if (type === 'theory') return { type: 'theory', title: { ky: '', ru: '', en: '' }, body: { ky: '', ru: '', en: '' }, imageUrl: '' };
  if (type === 'media')  return { type: 'media', mediaType: 'image', url: '', caption: { ky: '', ru: '', en: '' } };
  return { type: 'quiz', q: { ky: '', ru: '', en: '' }, opts: [{ ky: '', ru: '', en: '' }, { ky: '', ru: '', en: '' }, { ky: '', ru: '', en: '' }], a: 0, explanation: { ky: '', ru: '', en: '' }, imageUrl: '' };
}

function bilingualValue(v) {
  if (v == null) return { ky: '', ru: '', en: '' };
  if (typeof v === 'string') return { ky: v, ru: '', en: '' };
  return { ky: v.ky || '', ru: v.ru || '', en: v.en || '' };
}

function kyOf(v) {
  return (typeof v === 'string' ? v : v?.ky || '').trim();
}

function CardEditorRow({ card, index, total, onChange, onRemove, onMove, token }) {
  const [uploading, setUploading] = useState(false);

  const patch = (p) => onChange({ ...card, ...p });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.uploadMedia(token, file);
      patch({ url });
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const typeLabel = { theory: 'Киришүү', media: 'Медиа-Инфо', quiz: 'Квиз' }[card.type];

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0b1220', border: '1px solid #1e293b' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical size={14} color="#475569" />
          <span className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#1CB0F6' }}>
            {index + 1}. {typeLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="p-1 rounded disabled:opacity-30" style={{ color: '#94a3b8' }}>
            <ChevronUp size={14} />
          </button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} className="p-1 rounded disabled:opacity-30" style={{ color: '#94a3b8' }}>
            <ChevronDown size={14} />
          </button>
          <button type="button" onClick={onRemove} className="p-1 rounded" style={{ color: '#f87171' }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {card.type === 'theory' && (
        <>
          <TrilingualInput label="Аталышы (милдеттүү эмес)" value={card.title} onChange={v => patch({ title: v })} />
          <TrilingualInput label="Текст" value={card.body} onChange={v => patch({ body: v })} kyRequired multiline />
          <ImageUpload token={token} url={card.imageUrl} onChange={url => patch({ imageUrl: url })} variant="block" />
        </>
      )}

      {card.type === 'media' && (
        <>
          <div className="flex gap-2">
            <Select value={card.mediaType} onChange={e => patch({ mediaType: e.target.value })} className="w-32">
              <option value="image">Фото</option>
              <option value="video">Видео</option>
            </Select>
            <label className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm cursor-pointer" style={{ background: '#0f172a', border: '1.5px dashed #334155', color: '#94a3b8' }}>
              {uploading ? 'Жүктөлүүдө...' : card.url ? 'Файл алмаштыруу' : 'Файл жүктөө'}
              <input type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
            </label>
          </div>
          {card.url && (
            card.mediaType === 'video'
              ? <video src={card.url} className="w-full rounded-lg max-h-40" controls />
              : <img src={card.url} alt="" className="w-full rounded-lg max-h-40 object-cover" />
          )}
          <TrilingualInput label="Кыска түшүндүрмө (1-2 сап)" value={card.caption} onChange={v => patch({ caption: v })} />
        </>
      )}

      {card.type === 'quiz' && (
        <>
          <TrilingualInput label="Суроонун тексти" value={card.q} onChange={v => patch({ q: v })} kyRequired />
          <ImageUpload token={token} url={card.imageUrl} onChange={url => patch({ imageUrl: url })} variant="block" />
          {card.opts.map((opt, i) => {
            const ov = bilingualValue(opt);
            const setOpt = (patchV) => {
              const opts = [...card.opts];
              opts[i] = { ...ov, ...patchV };
              patch({ opts });
            };
            return (
              <div key={i} className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => patch({ a: i })}
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-2"
                  style={card.a === i ? { background: '#58CC0230', border: '1.5px solid #58CC02' } : { background: '#0f172a', border: '1.5px solid #334155' }}
                  title="Туура жооп кылып белгилөө"
                >
                  {card.a === i && <Check size={13} color="#58CC02" />}
                </button>
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm shrink-0" title="Кыргызча">🇰🇬</span>
                    <TextInput
                      placeholder={`Вариант ${String.fromCharCode(65 + i)} (кыргызча)`}
                      value={ov.ky}
                      onChange={e => setOpt({ ky: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm shrink-0" title="Орусча">🇷🇺</span>
                    <TextInput
                      placeholder="орусча (милдеттүү эмес)"
                      value={ov.ru}
                      onChange={e => setOpt({ ru: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm shrink-0" title="Англисче">🇺🇸</span>
                    <TextInput
                      placeholder="англисче (милдеттүү эмес)"
                      value={ov.en}
                      onChange={e => setOpt({ en: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                {card.opts.length > 2 && (
                  <button type="button" onClick={() => {
                    const opts = card.opts.filter((_, oi) => oi !== i);
                    patch({ opts, a: card.a >= opts.length ? 0 : card.a });
                  }} className="p-1 mt-2" style={{ color: '#475569' }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
          {card.opts.length < 5 && (
            <button type="button" onClick={() => patch({ opts: [...card.opts, { ky: '', ru: '', en: '' }] })} className="text-xs font-semibold self-start" style={{ color: '#1CB0F6' }}>
              + Вариант кошуу
            </button>
          )}
          {/* Optional per-question explanation, revealed to the learner right
              after they commit to an answer — LessonPage.jsx / lesson_screen.dart
              show it under the correct/wrong banner. "Why this is the right
              answer / why yours was wrong." */}
          <div className="pt-1 mt-1" style={{ borderTop: '1px dashed #1e293b' }}>
            <TrilingualInput label="Түшүндүрмө (жооптон кийин чыгат, милдеттүү эмес)" value={card.explanation} onChange={v => patch({ explanation: v })} multiline />
          </div>
        </>
      )}
    </div>
  );
}

function LessonEditor({ token, moduleId, lesson, onDone, onCancel }) {
  const [title, setTitle] = useState(lesson?.title || { ky: '', ru: '', en: '' });
  const [iconUrl, setIconUrl] = useState(lesson?.iconUrl || null);
  const [cards, setCards] = useState(lesson?.cards?.length ? lesson.cards : lesson?.questions?.map(q => ({ type: 'quiz', ...q })) || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addCard = (type) => setCards(c => [...c, emptyCard(type)]);
  const updateCard = (i, next) => setCards(c => c.map((card, idx) => idx === i ? next : card));
  const removeCard = (i) => setCards(c => c.filter((_, idx) => idx !== i));
  const moveCard = (i, dir) => setCards(c => {
    const next = [...c];
    const target = i + dir;
    if (target < 0 || target >= next.length) return c;
    [next[i], next[target]] = [next[target], next[i]];
    return next;
  });

  const handleSave = async () => {
    setError('');
    if (!kyOf(title)) return setError('Сабактын аталышы керек');
    if (cards.length === 0) return setError('Жок дегенде бир карта кошуңуз');
    for (const c of cards) {
      if (c.type === 'theory' && !kyOf(c.body)) return setError('Киришүү картасында кыргызча текст жок');
      if (c.type === 'quiz' && (!kyOf(c.q) || c.opts.some(o => !kyOf(o)))) return setError('Квиз картасында кыргызча талаа бош');
    }
    setSaving(true);
    try {
      if (lesson) await api.updateLesson(token, lesson.id, { title, cards, iconUrl });
      else await api.createLesson(token, moduleId, { title, cards, iconUrl });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <TrilingualInput label="Сабактын аталышы" value={title} onChange={setTitle} kyRequired />

      <Field label="Сабактын иконкасы (милдеттүү эмес)">
        <ImageUpload token={token} url={iconUrl} onChange={setIconUrl} variant="block" />
      </Field>

      <div className="flex flex-col gap-3">
        {cards.map((card, i) => (
          <CardEditorRow
            key={i}
            card={card}
            index={i}
            total={cards.length}
            token={token}
            onChange={next => updateCard(i, next)}
            onRemove={() => removeCard(i)}
            onMove={dir => moveCard(i, dir)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => addCard('theory')}><Plus size={14} /> Киришүү</Button>
        <Button variant="ghost" onClick={() => addCard('media')}><Plus size={14} /> Медиа</Button>
        <Button variant="ghost" onClick={() => addCard('quiz')}><Plus size={14} /> Квиз</Button>
      </div>

      <ErrorNote>{error}</ErrorNote>

      <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #1e293b' }}>
        <Button onClick={handleSave} loading={saving}>Сактоо</Button>
        <Button variant="ghost" onClick={onCancel}>Жокко чыгаруу</Button>
      </div>
    </Card>
  );
}

function ModuleForm({ token, partners, mod, onDone, onCancel }) {
  const [title, setTitle] = useState(mod?.title || { ky: '', ru: '', en: '' });
  const [color, setColor] = useState(mod?.color || COLORS[0]);
  const [partnerId, setPartnerId] = useState(mod?.partnerId || '');
  const [iconUrl, setIconUrl] = useState(mod?.iconUrl || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!kyOf(title)) return setError('Модулдун аталышы керек');
    setSaving(true);
    setError('');
    try {
      const body = { title, color, partnerId: partnerId || null, iconUrl: iconUrl || null };
      if (mod) await api.updateModule(token, mod.id, body);
      else await api.createModule(token, body);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <TrilingualInput label="Модулдун аталышы" value={title} onChange={setTitle} kyRequired />
      <Field label="Түс">
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full"
              style={{ background: c, boxShadow: color === c ? `0 0 0 2px #0b1220, 0 0 0 4px ${c}` : 'none' }}
            />
          ))}
        </div>
      </Field>
      <Field label="Спонсор-банк (милдеттүү эмес)">
        <Select value={partnerId} onChange={e => setPartnerId(e.target.value)}>
          <option value="">— Жок —</option>
          {partners.map(p => <option key={p.id} value={p.id}>{previewText(p.name)}</option>)}
        </Select>
      </Field>
      {/* No longer a mini-badge: this artwork is now the large framed tile
          shown directly above the module on the Learn path, so the label has
          to say what the admin will actually see. */}
      <Field label="Модулдун сүрөтү (сабак жолунда чоң көрүнөт)">
        <ImageUpload token={token} url={iconUrl} onChange={setIconUrl} variant="block" />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2">
        <Button onClick={handleSave} loading={saving}>Сактоо</Button>
        <Button variant="ghost" onClick={onCancel}>Жокко чыгаруу</Button>
      </div>
    </Card>
  );
}

export default function LessonsModule({ token, content, reload }) {
  const [selectedId, setSelectedId] = useState(content.modules[0]?.id || null);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null); // 'new' | lesson object | null

  const selectedModule = content.modules.find(m => m.id === selectedId);

  const handleDeleteModule = async (mod) => {
    if (!confirm(`"${previewText(mod.title)}" модулун бардык сабактары менен өчүрөсүзбү?`)) return;
    await api.deleteModule(token, mod.id);
    if (selectedId === mod.id) setSelectedId(null);
    reload();
  };

  const handleDeleteLesson = async (lesson) => {
    if (!confirm(`"${previewText(lesson.title)}" сабагын өчүрөсүзбү?`)) return;
    await api.deleteLesson(token, lesson.id);
    reload();
  };

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-6">
      {/* Module list */}
      <div className="flex flex-col gap-2">
        {content.modules.map(mod => (
          <button
            key={mod.id}
            onClick={() => { setSelectedId(mod.id); setEditingLesson(null); setShowModuleForm(false); }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left"
            style={selectedId === mod.id
              ? { background: 'rgba(28,176,246,0.12)', border: '1.5px solid #1CB0F6' }
              : { background: '#12141c', border: '1.5px solid transparent' }}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: mod.color }} />
            <span className="flex-1 min-w-0 text-sm font-semibold text-white truncate">{previewText(mod.title)}</span>
            <span className="text-[10px] text-slate-500 shrink-0">{mod.lessons.length}</span>
          </button>
        ))}
        <Button variant="ghost" onClick={() => { setShowModuleForm(true); setEditingModule(null); }}>
          <Plus size={14} /> Жаңы модуль
        </Button>
      </div>

      {/* Selected module detail */}
      <div className="flex flex-col gap-4">
        {showModuleForm && (
          <ModuleForm
            token={token}
            partners={content.partners}
            mod={editingModule}
            onDone={() => { setShowModuleForm(false); reload(); }}
            onCancel={() => setShowModuleForm(false)}
          />
        )}

        {!selectedModule ? (
          <EmptyState icon={BookOpen} title="Модуль тандаңыз" desc="Же жаңы модуль түзүңүз" />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-white">{previewText(selectedModule.title)}</h2>
                <p className="text-xs text-slate-500">{selectedModule.lessons.length} сабак</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setEditingModule(selectedModule); setShowModuleForm(true); }}>Түзөтүү</Button>
                <Button variant="danger" onClick={() => handleDeleteModule(selectedModule)}><Trash2 size={13} /> Өчүрүү</Button>
              </div>
            </div>

            {editingLesson ? (
              <LessonEditor
                token={token}
                moduleId={selectedModule.id}
                lesson={editingLesson === 'new' ? null : editingLesson}
                onDone={() => { setEditingLesson(null); reload(); }}
                onCancel={() => setEditingLesson(null)}
              />
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {selectedModule.lessons.map(lesson => (
                    <div key={lesson.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#12141c', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div
                        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
                        style={{ background: '#0b1220', border: '1px solid #1e293b' }}
                      >
                        {lesson.iconUrl
                          ? <img src={lesson.iconUrl} alt="" className="w-full h-full object-contain" />
                          : <BookOpen size={14} color="#475569" />}
                      </div>
                      <span className="flex-1 min-w-0 text-sm font-semibold text-white truncate">{previewText(lesson.title)}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">{(lesson.cards?.length ?? lesson.questions.length)} карта</span>
                      <button onClick={() => setEditingLesson(lesson)} className="text-xs font-semibold" style={{ color: '#1CB0F6' }}>Түзөтүү</button>
                      <button onClick={() => handleDeleteLesson(lesson)} className="p-1" style={{ color: '#f87171' }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" className="self-start" onClick={() => setEditingLesson('new')}>
                  <Plus size={14} /> Жаңы сабак
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
