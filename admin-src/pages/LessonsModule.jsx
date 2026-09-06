// admin-src/pages/LessonsModule.jsx — Module A: "Конструктор Уроков и
// Тестов". Modules on the left, the selected module's lessons + an editor
// on the right. A lesson is an ordered list of cards — Киришүү (theory),
// Медиа-Инфо (media), Квиз (quiz), Жуп табуу (match) and Сүйлөм толуктоо
// (build). The last two are graded exactly like a quiz by the server
// (contentStore.js#GRADED_CARD_TYPES), so they are authored right here,
// next to the quiz editor.
import { useState, useRef, useMemo } from 'react';
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown, BookOpen, Check, Link2, WholeWord } from 'lucide-react';
import * as api from '../api.js';
import { Card, Field, TextInput, Select, Button, EmptyState, ErrorNote, TrilingualInput, ImageUpload, ColorPicker, PRESET_COLORS, previewText } from '../components/ui.jsx';
import IconPicker from '../components/IconPicker.jsx';
import { lessonIconFor } from '../../shared/lessonIconComponents.jsx';


// Card text is trilingual ({ky, ru, en}) per Task 13 — ky required, ru/en
// optional (the app falls back to ky if a translation is blank). A plain
// string is legacy content from before this existed; TrilingualInput
// upgrades it to {ky, ru, en} the moment it's edited.
function emptyCard(type) {
  if (type === 'theory') return { type: 'theory', title: { ky: '', ru: '', en: '' }, body: { ky: '', ru: '', en: '' }, imageUrl: '' };
  if (type === 'media')  return { type: 'media', mediaType: 'image', url: '', caption: { ky: '', ru: '', en: '' } };
  if (type === 'match')  return { type: 'match', title: { ky: '', ru: '', en: '' }, pairs: [emptyPair(), emptyPair()] };
  if (type === 'build')  return { type: 'build', q: { ky: '', ru: '', en: '' }, sentence: { ky: '', ru: '', en: '' }, distractors: { ky: '', ru: '', en: '' } };
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

// A `match` card is meaningless with a single pair and unreadable past six, so
// the editor never lets the author leave that range — the same range the
// learner apps and the server are written against.
const MIN_PAIRS = 2;
const MAX_PAIRS = 6;

const emptyPair = () => ({ left: { ky: '', ru: '', en: '' }, right: { ky: '', ru: '', en: '' } });

// Content authored by an older build can arrive with a short or oversized pair
// list; the editor always draws a legal one, so what the author sees is what
// they are allowed to save.
function padPairs(pairs) {
  // Short lists are padded up to the minimum so the editor always shows a
  // legal card. Long ones are NOT trimmed: slicing here fed the trimmed
  // array straight back through patch() on the next keystroke, so a card
  // imported with seven pairs silently lost the seventh the moment its
  // author touched any row. Over-long lists are surfaced by handleSave
  // instead, where the author can see and fix them.
  const list = Array.isArray(pairs) ? [...pairs] : [];
  while (list.length < MIN_PAIRS) list.push(emptyPair());
  return list;
}

// Word tiles for the `build` preview — the same whitespace split the learner
// apps use to turn a sentence and its distractors into tappable blocks.
function wordsOf(v) {
  return kyOf(v).split(/\s+/).filter(Boolean);
}

function CardEditorRow({
  card, index, total, onChange, onRemove, onMove, token,
  onDragStart, onDragEnter, onDragEnd, isDragging, dropSide,
}) {
  // `draggable` is armed by the grip and disarmed the moment the drag ends.
  // Setting it permanently on the row would make every text input inside
  // undraggable-but-unselectable: the browser starts dragging the card
  // instead of selecting the words being edited.
  const [armed, setArmed] = useState(false);
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

  const typeLabel = { theory: 'Киришүү', media: 'Медиа-Инфо', quiz: 'Квиз', match: 'Жуп табуу', build: 'Сүйлөм толуктоо' }[card.type];

  // Read only by the match editor. Padded here rather than at save time so the
  // 2..6 rule is something the author sees instead of an error they run into.
  const pairs = card.type === 'match' ? padPairs(card.pairs) : [];
  const setPairs = (next) => patch({ pairs: next });

  // The Kyrgyz tiles a build card will actually put in front of the learner.
  const buildWords = card.type === 'build'
    ? { sentence: wordsOf(card.sentence), distractors: wordsOf(card.distractors) }
    : { sentence: [], distractors: [] };

  return (
    <div
      draggable={armed}
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(index); }}
      onDragEnter={() => onDragEnter(index)}
      onDragOver={e => e.preventDefault()}   // without this the drop never fires
      onDrop={e => { e.preventDefault(); onDragEnd(); }}
      onDragEnd={() => { setArmed(false); onDragEnd(); }}
      className="rounded-xl p-4 flex flex-col gap-3 transition-opacity"
      style={{
        background: '#0b1220',
        border: '1px solid #1e293b',
        opacity: isDragging ? 0.35 : 1,
        // The line shows which side of this card the drop lands on, so the
        // author sees the result before letting go.
        boxShadow: dropSide === 'before' ? 'inset 0 3px 0 #1CB0F6'
                 : dropSide === 'after'  ? 'inset 0 -3px 0 #1CB0F6'
                 : 'none',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            onPointerDown={() => setArmed(true)}
            onPointerUp={() => setArmed(false)}
            title="Кармап сүйрөп ордун алмаштыр"
            className="cursor-grab active:cursor-grabbing p-1 -m-1 rounded"
            style={{ touchAction: 'none' }}
          >
            <GripVertical size={14} color="#64748b" />
          </span>
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

      {/* "Tap the pairs": two columns of blocks the learner links up. The left
          column keeps the order authored here, the right one is shuffled by the
          apps — so a row here is a pair, never a position on screen. */}
      {card.type === 'match' && (
        <>
          <TrilingualInput label="Тапшырманын тексти (милдеттүү эмес)" value={card.title} onChange={v => patch({ title: v })} />
          {pairs.map((pair, i) => {
            const left = bilingualValue(pair?.left);
            const right = bilingualValue(pair?.right);
            const setPair = (p) => setPairs(pairs.map((row, ri) => ri === i ? { left, right, ...p } : row));
            return (
              <div key={i} className="flex items-start gap-2 rounded-xl p-3" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-7 text-[11px] font-extrabold"
                  style={{ background: '#0b1220', border: '1.5px solid #334155', color: '#94a3b8' }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0 grid sm:grid-cols-2 gap-3">
                  <TrilingualInput label="Сол блок" value={left} onChange={v => setPair({ left: v })} kyRequired />
                  <TrilingualInput label="Оң блок (анын жубу)" value={right} onChange={v => setPair({ right: v })} kyRequired />
                </div>
                {pairs.length > MIN_PAIRS && (
                  <button type="button" onClick={() => setPairs(pairs.filter((_, ri) => ri !== i))} className="p-1 mt-7" style={{ color: '#475569' }} title="Жупту өчүрүү">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
          {pairs.length < MAX_PAIRS && (
            <button type="button" onClick={() => setPairs([...pairs, emptyPair()])} className="text-xs font-semibold self-start" style={{ color: '#1CB0F6' }}>
              + Жуп кошуу
            </button>
          )}
          <p className="text-[11px] text-slate-500 px-1">
            Оң тилке үйрөнүүчүгө аралаштырылып чыгат — жооп ачылып калбайт. {MIN_PAIRS}–{MAX_PAIRS} жуп.
          </p>
        </>
      )}

      {/* Word bank: the learner taps tiles in order to rebuild the sentence.
          The tiles are the sentence's own words plus the distractors, so the
          preview below is exactly what will land on their screen. */}
      {card.type === 'build' && (
        <>
          <TrilingualInput label="Көрсөтмө (милдеттүү эмес)" value={card.q} onChange={v => patch({ q: v })} />
          <TrilingualInput label="Туура сүйлөм" value={card.sentence} onChange={v => patch({ sentence: v })} kyRequired />
          <TrilingualInput label="Адаштыргыч сөздөр (боштук менен)" value={card.distractors} onChange={v => patch({ distractors: v })} />
          {(buildWords.sentence.length > 0 || buildWords.distractors.length > 0) && (
            <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
              <span className="text-xs font-semibold text-slate-400">Кыргызча блоктор (үйрөнүүчүгө аралаш чыгат)</span>
              <div className="flex flex-wrap gap-1.5">
                {buildWords.sentence.map((w, i) => (
                  <span key={`s${i}`} className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(88,204,2,0.12)', border: '1.5px solid #58CC02', color: '#58CC02' }}>{w}</span>
                ))}
                {buildWords.distractors.map((w, i) => (
                  <span key={`d${i}`} className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: '#0b1220', border: '1.5px dashed #334155', color: '#94a3b8' }}>{w}</span>
                ))}
              </div>
              <span className="text-[11px] text-slate-500">
                Жашыл — сүйлөмдүн сөздөрү ({buildWords.sentence.length}), боз — адаштыргычтар ({buildWords.distractors.length}).
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// The lesson list mirrors what the app will actually draw: a set icon wins
// over an uploaded image, and neither means the default book glyph.
function LessonRowGlyph({ lesson }) {
  const Glyph = lessonIconFor(lesson.icon);
  if (Glyph) return <Glyph size={15} color="#1CB0F6" strokeWidth={2.2} />;
  if (lesson.iconUrl) return <img src={lesson.iconUrl} alt="" className="w-full h-full object-contain" />;
  return <BookOpen size={14} color="#475569" />;
}

function LessonEditor({ token, moduleId, lesson, onDone, onCancel }) {
  const [title, setTitle] = useState(lesson?.title || { ky: '', ru: '', en: '' });
  const [iconUrl, setIconUrl] = useState(lesson?.iconUrl || null);
  // Built-in glyph slug (shared/lessonIcons.js). Mutually exclusive with
  // iconUrl — LessonIconPicker clears one when the other is set.
  const [icon, setIcon] = useState(lesson?.icon || null);
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

  // Drag-to-reorder. The arrows stay: they are the reliable path on a
  // trackpad and the only one a keyboard can take, and a long deck is
  // faster to fix with one drag than with nine clicks.
  // The indices live in refs, and the state exists only to redraw the
  // highlight. A drag fires dragstart → dragenter → drop, and those can land
  // in one React batch: reading the drop's target out of state would read the
  // value from before the drag began, and the reorder would silently no-op.
  const dragFromRef = useRef(null);
  const dragOverRef = useRef(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const beginDrag = (i) => { dragFromRef.current = i; setDragFrom(i); };
  const hoverDrag = (i) => { dragOverRef.current = i; setDragOver(i); };

  // Applied on drop rather than live: reordering under the cursor makes the
  // list crawl away from the pointer as the indices shift.
  const finishDrag = () => {
    const from = dragFromRef.current;
    const to = dragOverRef.current;
    if (from != null && to != null && from !== to) {
      setCards(c => {
        const next = [...c];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    }
    dragFromRef.current = null;
    dragOverRef.current = null;
    setDragFrom(null);
    setDragOver(null);
  };

  const handleSave = async () => {
    setError('');
    if (!kyOf(title)) return setError('Сабактын аталышы керек');
    if (cards.length === 0) return setError('Жок дегенде бир карта кошуңуз');
    for (const c of cards) {
      if (c.type === 'theory' && !kyOf(c.body)) return setError('Киришүү картасында кыргызча текст жок');
      if (c.type === 'quiz' && (!kyOf(c.q) || c.opts.some(o => !kyOf(o)))) return setError('Квиз картасында кыргызча талаа бош');
      if (c.type === 'match') {
        // padPairs is what the author sees, so it is what gets checked —
        // validating the raw stored list rejected a card whose editor was
        // showing two perfectly legal rows.
        const list = padPairs(c.pairs);
        if (list.length < MIN_PAIRS || list.length > MAX_PAIRS) return setError(`Жуп табуу картасында ${MIN_PAIRS}–${MAX_PAIRS} жуп болушу керек`);
        if (list.some(p => !kyOf(p?.left) || !kyOf(p?.right))) return setError('Жуп табуу картасында кыргызча талаа бош');
        // Two identical blocks in the shuffled right column cannot both be
        // right, so a learner tapping the one that means the correct thing
        // is still marked wrong half the time.
        const rights = list.map(p => kyOf(p.right).toLowerCase());
        if (new Set(rights).size !== rights.length) return setError('Оң тилкедеги сөздөр кайталанбашы керек');
        const lefts = list.map(p => kyOf(p.left).toLowerCase());
        if (new Set(lefts).size !== lefts.length) return setError('Сол тилкедеги сөздөр кайталанбашы керек');
      }
      if (c.type === 'build' && !kyOf(c.sentence)) return setError('Сүйлөм толуктоо картасында кыргызча сүйлөм жок');
    }
    setSaving(true);
    try {
      if (lesson) await api.updateLesson(token, lesson.id, { title, cards, iconUrl, icon });
      else await api.createLesson(token, moduleId, { title, cards, iconUrl, icon });
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

      <IconPicker
        label="Сабактын иконкасы (милдеттүү эмес)"
        token={token}
        icon={icon}
        iconUrl={iconUrl}
        onChange={next => { setIcon(next.icon); setIconUrl(next.iconUrl); }}
      />

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
            onDragStart={beginDrag}
            onDragEnter={hoverDrag}
            onDragEnd={finishDrag}
            isDragging={dragFrom === i}
            dropSide={
              dragFrom == null || dragOver !== i || dragFrom === i
                ? null
                : dragFrom < i ? 'after' : 'before'
            }
            onMove={dir => moveCard(i, dir)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => addCard('theory')}><Plus size={14} /> Киришүү</Button>
        <Button variant="ghost" onClick={() => addCard('media')}><Plus size={14} /> Медиа</Button>
        <Button variant="ghost" onClick={() => addCard('quiz')}><Plus size={14} /> Квиз</Button>
        <Button variant="ghost" onClick={() => addCard('match')}><Link2 size={14} /> Жуп табуу</Button>
        <Button variant="ghost" onClick={() => addCard('build')}><WholeWord size={14} /> Сүйлөм толуктоо</Button>
      </div>

      <ErrorNote>{error}</ErrorNote>

      <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #1e293b' }}>
        <Button onClick={handleSave} loading={saving}>Сактоо</Button>
        <Button variant="ghost" onClick={onCancel}>Жокко чыгаруу</Button>
      </div>
    </Card>
  );
}

// Which edge of the lesson path a module's artwork stands on. Two options,
// so a segmented control with a drawing on each side rather than a select:
// the whole choice is about where a picture sits, and a dropdown reading
// "Солдо / Оңдо" makes the operator hold the layout in their head.
function ArtSidePicker({ value, onChange }) {
  const sides = [
    { key: 'left', label: 'Сол жакта' },
    { key: 'right', label: 'Оң жакта' },
  ];
  return (
    <Field label="Сүрөт жолдун кайсы жагында турат">
      <div className="grid grid-cols-2 gap-2">
        {sides.map(side => {
          const on = value === side.key;
          const art = (
            <span
              className="w-6 h-6 rounded-md shrink-0"
              style={{ background: on ? '#1CB0F6' : '#334155' }}
            />
          );
          const road = (
            <span
              className="w-[3px] h-7 rounded-full shrink-0"
              style={{ background: on ? 'rgba(28,176,246,0.45)' : '#1e293b' }}
            />
          );
          return (
            <button
              key={side.key}
              type="button"
              onClick={() => onChange(side.key)}
              aria-pressed={on}
              className="flex flex-col items-center gap-2 rounded-xl py-3 transition-colors"
              style={{
                background: on ? 'rgba(28,176,246,0.10)' : '#0f172a',
                border: on ? '1.5px solid rgba(28,176,246,0.5)' : '1.5px solid #1e293b',
              }}
            >
              {/* A tiny picture of the layout: the tile beside the road. */}
              <span className="flex items-center gap-2.5 h-7">
                {side.key === 'left' ? <>{art}{road}</> : <>{road}{art}</>}
              </span>
              <span
                className="text-[12px] font-bold"
                style={{ color: on ? '#1CB0F6' : '#94a3b8' }}
              >
                {side.label}
              </span>
            </button>
          );
        })}
      </div>
    </Field>
  );
}

function ModuleForm({ token, partners, mod, onDone, onCancel }) {
  const [title, setTitle] = useState(mod?.title || { ky: '', ru: '', en: '' });
  const [color, setColor] = useState(mod?.color || PRESET_COLORS[0]);
  const [partnerId, setPartnerId] = useState(mod?.partnerId || '');
  const [iconUrl, setIconUrl] = useState(mod?.iconUrl || '');
  // Which edge of the lesson path the artwork stands on.
  const [artSide, setArtSide] = useState(mod?.artSide === 'right' ? 'right' : 'left');
  // The small title badge. Independent of the artwork above — a module can
  // legitimately have both, or neither.
  const [icon, setIcon] = useState(mod?.icon || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!kyOf(title)) return setError('Модулдун аталышы керек');
    setSaving(true);
    setError('');
    try {
      const body = { title, color, partnerId: partnerId || null, iconUrl: iconUrl || null, icon, artSide };
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
        <ColorPicker value={color} onChange={setColor} />
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
      {/* Only meaningful once there is artwork to place, so it appears with
          it rather than sitting there greyed out. */}
      {iconUrl && <ArtSidePicker value={artSide} onChange={setArtSide} />}
      {/* Separate from the artwork above, not an alternative to it: this is
          the small badge next to the module title, which the app draws when
          there is no large artwork to show instead. */}
      <IconPicker
        label="Модулдун белгиси (аталыштын жанындагы кичине иконка)"
        icon={icon}
        iconUrl={iconUrl}
        onChange={next => setIcon(next.icon)}
        allowUpload={false}
      />
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

  // ── Dragging lessons into order ────────────────────────────────────────
  //
  // The order IS the curriculum: the learner walks the path top to bottom
  // and each lesson unlocks the next, so this is an editorial act rather
  // than a display preference — which is why it is saved to the server
  // immediately rather than sitting behind a Save button.
  //
  // Refs alongside the state for the same reason CardEditorRow uses them:
  // dragstart → dragenter → drop can land in one React batch, and reading
  // the drop target out of state would read the value from before the drag
  // began, so the reorder would silently no-op.
  const dragFromRef = useRef(null);
  const dragOverRef = useRef(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [armedLesson, setArmedLesson] = useState(null);
  const [orderError, setOrderError] = useState('');

  // Modules reorder the same way lessons do, on their own refs so a drag in
  // one list can never be read by the other.
  const modFromRef = useRef(null);
  const modOverRef = useRef(null);
  const [modFrom, setModFrom] = useState(null);
  const [modOver, setModOver] = useState(null);
  const [armedModule, setArmedModule] = useState(null);
  const [pendingModules, setPendingModules] = useState(null); // ids

  // The new order is shown the instant the author lets go, then saved. Until
  // `reload()` brings the server's copy back, this is what the list renders
  // from — without it the rows would snap back to the old order for as long
  // as the round trip takes.
  const [pendingOrder, setPendingOrder] = useState(null); // { moduleId, ids }

  const lessons = useMemo(() => {
    const base = selectedModule?.lessons ?? [];
    if (!pendingOrder || pendingOrder.moduleId !== selectedModule?.id) return base;
    const byId = new Map(base.map(l => [l.id, l]));
    const out = [];
    for (const id of pendingOrder.ids) {
      const lesson = byId.get(id);
      if (lesson && !out.includes(lesson)) out.push(lesson);
    }
    // A lesson added or renamed elsewhere while this was pending still
    // belongs on screen; it lands at the end rather than disappearing.
    for (const lesson of base) if (!out.includes(lesson)) out.push(lesson);
    return out;
  }, [selectedModule, pendingOrder]);

  const modules = useMemo(() => {
    const base = content.modules ?? [];
    if (!pendingModules) return base;
    const byId = new Map(base.map(m => [m.id, m]));
    const out = [];
    for (const id of pendingModules) {
      const mod = byId.get(id);
      if (mod && !out.includes(mod)) out.push(mod);
    }
    for (const mod of base) if (!out.includes(mod)) out.push(mod);
    return out;
  }, [content.modules, pendingModules]);

  const beginModuleDrag = (i) => { modFromRef.current = i; setModFrom(i); };
  const hoverModuleDrag = (i) => { modOverRef.current = i; setModOver(i); };

  const finishModuleDrag = async () => {
    const from = modFromRef.current;
    const to = modOverRef.current;
    modFromRef.current = null;
    modOverRef.current = null;
    setModFrom(null);
    setModOver(null);
    setArmedModule(null);
    if (from == null || to == null || from === to) return;

    const next = [...modules];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const ids = next.map(m => m.id);
    setPendingModules(ids);
    setOrderError('');

    try {
      await api.reorderModules(token, ids);
      reload();
    } catch (err) {
      setPendingModules(null);
      setOrderError(err.message);
    }
  };

  const beginLessonDrag = (i) => { dragFromRef.current = i; setDragFrom(i); };
  const hoverLessonDrag = (i) => { dragOverRef.current = i; setDragOver(i); };

  // Applied on drop rather than live: reordering under the cursor makes the
  // list crawl away from the pointer as the indices shift.
  const finishLessonDrag = async () => {
    const from = dragFromRef.current;
    const to = dragOverRef.current;
    dragFromRef.current = null;
    dragOverRef.current = null;
    setDragFrom(null);
    setDragOver(null);
    setArmedLesson(null);
    if (from == null || to == null || from === to || !selectedModule) return;

    const next = [...lessons];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const ids = next.map(l => l.id);
    setPendingOrder({ moduleId: selectedModule.id, ids });
    setOrderError('');

    try {
      await api.reorderLessons(token, selectedModule.id, ids);
      reload();
    } catch (err) {
      // Put the list back where it was — pretending the move stuck would
      // leave the panel disagreeing with what the learners actually see.
      setPendingOrder(null);
      setOrderError(err.message);
    }
  };

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
        {modules.map((mod, i) => (
          <div
            key={mod.id}
            draggable={armedModule === mod.id}
            onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; beginModuleDrag(i); }}
            onDragEnter={() => hoverModuleDrag(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); finishModuleDrag(); }}
            onDragEnd={finishModuleDrag}
            onClick={() => { setSelectedId(mod.id); setEditingLesson(null); setShowModuleForm(false); }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left cursor-pointer transition-opacity"
            style={{
              ...(selectedId === mod.id
                ? { background: 'rgba(28,176,246,0.12)', border: '1.5px solid #1CB0F6' }
                : { background: '#12141c', border: '1.5px solid transparent' }),
              opacity: modFrom === i ? 0.35 : 1,
              ...(modOver === i && modFrom !== null && modFrom !== i
                ? modFrom > i
                  ? { boxShadow: 'inset 0 2px 0 0 #1CB0F6' }
                  : { boxShadow: 'inset 0 -2px 0 0 #1CB0F6' }
                : null),
            }}
          >
            {/* The grip arms the drag and swallows the click, so grabbing a
                module to move it never also selects it. */}
            <span
              onPointerDown={() => setArmedModule(mod.id)}
              onPointerUp={() => setArmedModule(null)}
              onClick={e => e.stopPropagation()}
              title="Кармап сүйрөп ордун алмаштыр"
              className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 -m-0.5 rounded"
              style={{ touchAction: 'none' }}
            >
              <GripVertical size={13} color="#64748b" />
            </span>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: mod.color }} />
            <span className="flex-1 min-w-0 text-sm font-semibold text-white truncate">{previewText(mod.title)}</span>
            <span className="text-[10px] text-slate-500 shrink-0">{mod.lessons.length}</span>
          </div>
        ))}
        <ErrorNote>{orderError}</ErrorNote>
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
                <ErrorNote>{orderError}</ErrorNote>
                <div className="flex flex-col gap-2">
                  {lessons.map((lesson, i) => (
                    <div
                      key={lesson.id}
                      draggable={armedLesson === lesson.id}
                      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; beginLessonDrag(i); }}
                      onDragEnter={() => hoverLessonDrag(i)}
                      onDragOver={e => e.preventDefault()}   // without this the drop never fires
                      onDrop={e => { e.preventDefault(); finishLessonDrag(); }}
                      onDragEnd={finishLessonDrag}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-opacity"
                      style={{
                        background: '#12141c',
                        border: '1px solid rgba(255,255,255,0.08)',
                        opacity: dragFrom === i ? 0.35 : 1,
                        // Which side of this row the drop lands on, so the
                        // author sees the result before letting go.
                        ...(dragOver === i && dragFrom !== null && dragFrom !== i
                          ? dragFrom > i
                            ? { boxShadow: 'inset 0 2px 0 0 #1CB0F6' }
                            : { boxShadow: 'inset 0 -2px 0 0 #1CB0F6' }
                          : null),
                      }}
                    >
                      {/* `draggable` is armed by the grip and disarmed the
                          moment the drag ends: an always-draggable row makes
                          the title unselectable and starts a drag whenever
                          anyone tries to read it. */}
                      <span
                        onPointerDown={() => setArmedLesson(lesson.id)}
                        onPointerUp={() => setArmedLesson(null)}
                        title="Кармап сүйрөп ордун алмаштыр"
                        className="shrink-0 cursor-grab active:cursor-grabbing p-1 -m-1 rounded"
                        style={{ touchAction: 'none' }}
                      >
                        <GripVertical size={14} color="#64748b" />
                      </span>
                      <span className="text-[11px] font-bold text-slate-600 w-4 shrink-0 tabular-nums">{i + 1}</span>
                      <div
                        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
                        style={{ background: '#0b1220', border: '1px solid #1e293b' }}
                      >
                        <LessonRowGlyph lesson={lesson} />
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
