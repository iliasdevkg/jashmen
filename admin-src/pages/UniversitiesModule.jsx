// admin-src/pages/UniversitiesModule.jsx — Module Г: the university league.
//
// Everything the contest card renders used to be authored twice, in
// src/data/universities.js and mobile/lib/src/data/universities.dart, so a
// changed prize pool meant shipping both clients. It is server content now:
// an organiser's numbers, dates and rules are an edit here, and both apps
// pick them up from /public/content on their next launch.
//
// A campus and its contest are edited as one form on purpose — "КГТУ" on
// its own is just a name in a picker; what an admin actually comes here to
// change is the contest attached to it.
import { useState } from 'react';
import { Plus, Trash2, GraduationCap, Trophy, CalendarDays } from 'lucide-react';
import * as api from '../api.js';
import {
  Card, Field, TextInput, Button, EmptyState, ErrorNote,
  TrilingualInput, ImageUpload, ColorPicker, previewText,
} from '../components/ui.jsx';

const BLANK_TRI = { ky: '', ru: '', en: '' };

// The card's own default tint, mirrored from contentStore#sanitizeUniversityCore
// so a new campus previews the same colour it will be saved with.
const DEFAULT_COLOR = '#1D4ED8';

const BLANK_CONTEST = {
  organizerPhone: '',
  address: { ...BLANK_TRI },
  sponsorName: '',
  sponsorLogoUrl: '',
  prizePool: 0,
  firstPrize: 0,
  secondPrize: 0,
  thirdPrize: 0,
  giftsTopN: 10,
  startsAt: '',
  endsAt: '',
  rules: { ...BLANK_TRI },
};

function kyOf(v) {
  return (typeof v === 'string' ? v : v?.ky || '').trim();
}

/** Money and rank fields — kept as strings while typing so a field can be
 *  cleared without it snapping back to 0 under the cursor. */
function NumberField({ label, value, onChange, suffix }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <TextInput
          type="number"
          min="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1"
        />
        {suffix && <span className="text-xs text-slate-500 shrink-0">{suffix}</span>}
      </div>
    </Field>
  );
}

function ContestFields({ token, contest, onChange }) {
  const set = (patch) => onChange({ ...contest, ...patch });

  return (
    <div className="flex flex-col gap-3">
      <Field label="Уюштуруучунун телефону">
        <TextInput
          placeholder="+996700123123"
          value={contest.organizerPhone}
          onChange={e => set({ organizerPhone: e.target.value })}
        />
      </Field>

      <TrilingualInput
        label="Дареги"
        value={contest.address}
        onChange={address => set({ address })}
        kyRequired
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Спонсордун аты">
          <TextInput
            placeholder="mbank"
            value={contest.sponsorName}
            onChange={e => set({ sponsorName: e.target.value })}
          />
        </Field>
        <Field label="Спонсордун логотиби">
          <ImageUpload
            token={token}
            url={contest.sponsorLogoUrl}
            onChange={sponsorLogoUrl => set({ sponsorLogoUrl: sponsorLogoUrl || '' })}
            variant="inline"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Байге фонду" suffix="сом" value={contest.prizePool} onChange={prizePool => set({ prizePool })} />
        <NumberField label="Белек — ТОП N" value={contest.giftsTopN} onChange={giftsTopN => set({ giftsTopN })} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <NumberField label="1-орун" suffix="сом" value={contest.firstPrize} onChange={firstPrize => set({ firstPrize })} />
        <NumberField label="2-орун" suffix="сом" value={contest.secondPrize} onChange={secondPrize => set({ secondPrize })} />
        <NumberField label="3-орун" suffix="сом" value={contest.thirdPrize} onChange={thirdPrize => set({ thirdPrize })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Башталышы">
          <TextInput type="date" value={contest.startsAt} onChange={e => set({ startsAt: e.target.value })} />
        </Field>
        <Field label="Бүтүшү">
          <TextInput type="date" value={contest.endsAt} onChange={e => set({ endsAt: e.target.value })} />
        </Field>
      </div>

      <TrilingualInput
        label="Эрежелер (карточкада көрүнөт)"
        value={contest.rules}
        onChange={rules => set({ rules })}
        kyRequired
        multiline
      />
    </div>
  );
}

function UniversityForm({ token, university, onDone, onCancel }) {
  const [listName, setListName] = useState(university?.listName || '');
  const [name, setName] = useState(university?.name || { ...BLANK_TRI });
  const [shortName, setShortName] = useState(university?.shortName || { ...BLANK_TRI });
  const [color, setColor] = useState(university?.color || DEFAULT_COLOR);
  const [logoUrl, setLogoUrl] = useState(university?.logoUrl || '');
  // Every campus gets the full contest form, filled or not. It used to sit
  // behind an "is there a contest?" switch, which meant every university
  // except the one that already had one opened to a blank panel with no way
  // to see what could be entered.
  const [contest, setContest] = useState({ ...BLANK_CONTEST, ...(university?.contest || {}) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // "Has this contest been filled in at all?" — any one of the fields the
  // card actually needs counts, so a half-finished contest is caught by the
  // validation below instead of being silently dropped.
  const contestTouched = Boolean(
    contest.organizerPhone.trim()
    || kyOf(contest.address)
    || kyOf(contest.rules)
    || contest.startsAt
    || contest.endsAt
    || contest.prizePool > 0
    || contest.firstPrize > 0,
  );

  const clearContest = () => {
    if (!confirm('Конкурстун бардык маалыматы тазалансынбы?\n\nСакталгандан кийин колдонуучуларга «конкурс жок» деген экран көрүнөт.')) return;
    setContest({ ...BLANK_CONTEST });
  };

  const handleSave = async () => {
    if (!listName.trim()) return setError('Тизмедеги аты керек');
    if (!kyOf(name)) return setError('Университеттин толук аты керек (кыргызча)');
    if (!kyOf(shortName)) return setError('Кыска аты керек (кыргызча)');
    // A contest exists when its fields are filled. Leaving them all empty is
    // how a campus says "no contest running" — no separate switch to forget
    // to flip.
    if (contestTouched) {
      if (!contest.organizerPhone.trim()) return setError('Уюштуруучунун телефону керек');
      if (!kyOf(contest.address)) return setError('Дареги керек (кыргызча)');
      if (!kyOf(contest.rules)) return setError('Эрежелер керек (кыргызча)');
      if (!contest.startsAt || !contest.endsAt) return setError('Башталыш жана бүтүш датасын коюңуз');
    }

    setSaving(true);
    setError('');
    try {
      const body = {
        listName: listName.trim(),
        name,
        shortName,
        color,
        logoUrl: logoUrl || null,
        contest: contestTouched
          ? { ...contest, sponsorLogoUrl: contest.sponsorLogoUrl || null }
          : null,
      };
      if (university) await api.updateUniversity(token, university.id, body);
      else await api.createUniversity(token, body);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <Field label="Тизмеде көрүнөт (тандоо терезесинде)">
        <TextInput
          placeholder="ПОЛИТЕХ"
          value={listName}
          onChange={e => setListName(e.target.value)}
        />
      </Field>

      <TrilingualInput label="Толук аты (карточкада)" value={name} onChange={setName} kyRequired />
      <TrilingualInput label="Кыска аты (рейтингдин аталышында)" value={shortName} onChange={setShortName} kyRequired />

      <Field label="Гербы / логотиби">
        <ImageUpload token={token} url={logoUrl} onChange={u => setLogoUrl(u || '')} variant="inline" shape="circle" />
      </Field>
      <Field label="Түсү">
        <ColorPicker value={color} onChange={setColor} />
      </Field>

      <div
        className="flex items-center justify-between rounded-xl px-3 py-2.5 mt-1"
        style={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Trophy size={15} color={contestTouched ? '#EAB308' : '#475569'} />
          Конкурс
          <span className="text-xs font-normal text-slate-500">
            {contestTouched ? 'жүрүп жатат' : 'толтурулган эмес'}
          </span>
        </span>
        {contestTouched && (
          <button
            type="button"
            onClick={clearContest}
            className="text-xs font-semibold text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg"
          >
            Тазалоо
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500 leading-relaxed -mt-1">
        Талаалар бош калса, колдонуучуларга «Бул университетте азырынча
        конкурс жок» деген экран көрүнөт. Рейтинг өзү (студенттер, XP)
        конкурска көз каранды эмес — ал ар дайым сервердеги чыныгы
        маалыматтан курулат.
      </p>

      <ContestFields token={token} contest={contest} onChange={setContest} />

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex gap-2">
        <Button onClick={handleSave} loading={saving}>Сактоо</Button>
        <Button variant="ghost" onClick={onCancel}>Жокко чыгаруу</Button>
      </div>
    </Card>
  );
}

export default function UniversitiesModule({ token, content, reload }) {
  const universities = content.universities || [];
  const [selectedId, setSelectedId] = useState(universities[0]?.id || null);
  const [creating, setCreating] = useState(false);

  const selected = universities.find(u => u.id === selectedId) || null;

  const handleDelete = async (university) => {
    const label = university.listName || previewText(university.name);
    if (!confirm(`«${label}» өчүрүлсүнбү?\n\nБул университетти тандаган колдонуучулардан кайра сурала турган болот.`)) return;
    await api.deleteUniversity(token, university.id);
    if (selectedId === university.id) setSelectedId(null);
    reload();
  };

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-5 items-start">
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-white">Университеттер</h3>
          <Button variant="ghost" onClick={() => { setCreating(true); setSelectedId(null); }}>
            <Plus size={14} /> Кошуу
          </Button>
        </div>

        {universities.length === 0 && !creating && (
          <EmptyState icon={GraduationCap} title="Азырынча университет жок" />
        )}

        {universities.map(u => (
          <div
            key={u.id}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-colors"
            style={{
              background: selectedId === u.id ? 'rgba(28,176,246,0.12)' : 'transparent',
              border: `1px solid ${selectedId === u.id ? 'rgba(28,176,246,0.4)' : 'transparent'}`,
            }}
            onClick={() => { setSelectedId(u.id); setCreating(false); }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: u.color || DEFAULT_COLOR }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{u.listName}</p>
              <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                {u.contest
                  ? <><Trophy size={10} color="#EAB308" /> конкурс жүрүүдө</>
                  : <><CalendarDays size={10} /> конкурс жок</>}
              </p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); handleDelete(u); }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 shrink-0"
              aria-label="Өчүрүү"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </Card>

      {creating ? (
        <UniversityForm
          token={token}
          onDone={() => { setCreating(false); reload(); }}
          onCancel={() => setCreating(false)}
        />
      ) : selected ? (
        <UniversityForm
          key={selected.id}
          token={token}
          university={selected}
          onDone={reload}
          onCancel={() => setSelectedId(null)}
        />
      ) : (
        <Card>
          <EmptyState
            icon={GraduationCap}
            title="Университетти тандаңыз"
            desc="Же жаңысын кошуңуз — конкурстун бардык тексти жана суммалары ушул жерден өзгөрөт."
          />
        </Card>
      )}
    </div>
  );
}
