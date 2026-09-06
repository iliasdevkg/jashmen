// admin-src/pages/UsersModule.jsx — the learner roster: search, sort,
// create, edit and delete.
//
// This used to be the third sub-tab of Аналитика, two clicks deep behind a
// panel about lesson funnels. It is account administration, not analytics,
// and it was also the one screen an operator needs during a support call —
// so it is its own tab now, and it fetches its own data instead of waiting
// on the three analytics endpoints (a single funnel failure used to take the
// whole roster down with it).
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, Star, Coins, BookCheck, Flame, Search, Trash2, Plus, Pencil, ArrowUpDown } from 'lucide-react';
import * as api from '../api.js';
import { Card, Field, TextInput, Button, ErrorNote, EmptyState } from '../components/ui.jsx';
import StudentStats from '../components/StudentStats.jsx';

// Same deterministic name → color hash as the learner apps' shared Avatar
// component (src/components/Avatar.jsx) — admin-src builds separately from
// src/ (see vite.admin.config.js), so it's a small re-implementation rather
// than a cross-app import, but the palette and hash are identical on
// purpose: the same person's initial renders the same color here as it does
// on the leaderboard.
// How often the online panel re-asks the server. One number, used both by
// the timer and by the line that tells the operator what it is doing —
// they used to be written out separately and could drift apart.
const REFRESH_MS = 10_000;

const AVATAR_COLORS = [
  '#F97316', '#8B5CF6', '#EAB308', '#06B6D4',
  '#10B981', '#EF4444', '#EC4899', '#3B82F6',
  '#A855F7', '#14B8A6', '#F59E0B', '#6366F1',
];
function colorForName(name = '') {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function isImageSrc(v) {
  return typeof v === 'string' && (/^https?:\/\//i.test(v) || (v.startsWith('/') && !v.startsWith('//')));
}
function UserAvatar({ name, photoUrl, size = 40 }) {
  if (isImageSrc(photoUrl)) {
    return <img src={photoUrl} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  const color = colorForName(name);
  return (
    <div
      className="rounded-full flex items-center justify-center font-extrabold shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42, color: 'white' }}
    >
      {(name || '').trim().slice(0, 1).toUpperCase() || '?'}
    </div>
  );
}

function daysAgo(dateStr) {
  if (!dateStr) return null;
  const then = new Date(`${dateStr}T00:00:00Z`).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  return Math.max(days, 0);
}

function relativeActivity(dateStr) {
  const days = daysAgo(dateStr);
  if (days == null) return 'белгисиз';
  if (days === 0) return 'бүгүн';
  if (days === 1) return 'кечээ';
  return `${days} күн мурун`;
}

function formatDate(ts) {
  if (!ts) return 'белгисиз';
  return new Date(ts).toLocaleDateString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// GET /users returns raw insertion order, which puts the oldest accounts
// first — the opposite of what an operator opening this tab is looking for.
const SORTS = [
  { id: 'newest',  label: 'Жаңылары',      compare: (a, b) => (b.createdAt || 0) - (a.createdAt || 0) },
  { id: 'active',  label: 'Акыркы активдүү', compare: (a, b) => String(b.lastActiveDate || '').localeCompare(String(a.lastActiveDate || '')) },
  { id: 'xp',      label: 'XP боюнча',      compare: (a, b) => (b.xp || 0) - (a.xp || 0) },
  { id: 'name',    label: 'Аты боюнча',     compare: (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru') },
];

const SECTIONS = [
  { id: 'users',    label: 'Колдонуучулар' },
  { id: 'students', label: 'Студенттер' },
];

export default function UsersModule({ token, onAuthError }) {
  const [section, setSection] = useState('users');
  const [students, setStudents] = useState(null);
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // 'new' | user | null
  const [error, setError] = useState('');
  const [online, setOnline] = useState(null);

  const load = useCallback(() => {
    api.fetchUsers(token)
      .then(u => { setUsers(u); setError(''); })
      .catch(e => { if (e.status === 401) onAuthError(); else setError(e.message); });
  }, [token, onAuthError]);

  useEffect(() => { load(); }, [load]);

  // Presence is a live number, so it refreshes on its own — a "who is online"
  // panel that only updates when the operator reloads the page is telling
  // them about the past. A failed poll is swallowed: it should leave the last
  // known list on screen, not replace the tab with an error.
  useEffect(() => {
    let alive = true;
    const tick = () => api.fetchOnlineUsers(token)
      .then(r => { if (alive) setOnline(r); })
      .catch(() => {});
    tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, [token]);

  // Fetched once, alongside the roster — the campus numbers move on the same
  // timescale as the accounts themselves, not on the presence timescale.
  useEffect(() => {
    api.fetchStudentStats(token)
      .then(setStudents)
      .catch(e => { if (e.status === 401) onAuthError(); });
  }, [token, onAuthError]);

  const visible = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    const matched = q
      ? users.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
      : users;
    const compare = SORTS.find(s => s.id === sort)?.compare;
    // A copy: `users` is the fetched array and re-sorting it in place would
    // make the next search render from a mutated base.
    return compare ? [...matched].sort(compare) : matched;
  }, [users, search, sort]);

  async function handleDelete(u) {
    if (!confirm(`"${u.name}" (${u.email}) колдонуучусун толугу менен өчүрөсүзбү? Бул артка кайтарылгыс.`)) return;
    try {
      await api.deleteUser(token, u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
    } catch (e) {
      if (e.status === 401) onAuthError();
      else setError(e.message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-extrabold text-white mb-1">Колдонуучулар</h2>
        <p className="text-xs text-slate-500">
          Каттоо эсептерин издөө, түзөтүү жана өчүрүү. Өчүрүү артка кайтарылбайт, бирок алган
          сыйлык коддору «Өнөктөштөр → Сыйлык алгандар» тизмесинде сакталып калат.
        </p>
      </div>

      {section === 'users' && (
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Аты же email боюнча издөө..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none"
            style={{ background: '#12141c', border: '1px solid rgba(255,255,255,0.08)' }}
          />
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
          <ArrowUpDown size={13} className="text-slate-500 shrink-0" />
          {SORTS.map(s => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              className="px-2.5 py-1 rounded-md text-xs font-bold transition-colors"
              style={sort === s.id
                ? { background: '#1CB0F6', color: '#fff' }
                : { background: 'transparent', color: '#64748b' }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => { setEditing('new'); setShowForm(true); }}>
          <Plus size={14} /> Жаңы колдонуучу
        </Button>
      </div>
      )}

      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
        {SECTIONS.map(sec => (
          <button
            key={sec.id}
            onClick={() => setSection(sec.id)}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            style={section === sec.id
              ? { background: '#1CB0F6', color: '#fff' }
              : { background: 'transparent', color: '#64748b' }}
          >
            {sec.label}
          </button>
        ))}
      </div>

      <ErrorNote>{error}</ErrorNote>

      <OnlinePanel data={online} />

      {section === 'students' && <StudentStats data={students} />}

      {section === 'users' && showForm && (
        <UserForm
          token={token}
          user={editing === 'new' ? null : editing}
          onDone={() => { setShowForm(false); setEditing(null); load(); }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {section !== 'users' ? null : users === null ? (
        // A skeleton rather than a bare word: the grid's shape appears
        // immediately, so the tab doesn't jump when the data lands.
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i} className="!p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full animate-pulse" style={{ background: '#1e293b' }} />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="h-3 rounded animate-pulse w-2/3" style={{ background: '#1e293b' }} />
                  <div className="h-2.5 rounded animate-pulse w-1/2" style={{ background: '#161f31' }} />
                </div>
              </div>
              <div className="h-6 rounded animate-pulse" style={{ background: '#161f31' }} />
            </Card>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'Табылган жок' : 'Азырынча каттоо эсеби жок'}
          desc={search ? 'Издөөгө дал келген колдонуучу жок' : 'Биринчи окуучу катталганда бул жерде пайда болот'}
        />
      ) : (
        <>
          <p className="text-xs text-slate-500 -mt-2">
            {search
              ? `${visible.length} / ${users.length} колдонуучу`
              : `Баары: ${users.length} колдонуучу`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visible.map(u => (
              <Card key={u.id} className="!p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <UserAvatar name={u.name} photoUrl={u.avatar} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white truncate">{u.name || '—'}</p>
                    <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                  </div>
                  {/* Always visible, not hover-only — icon-only + hidden-until-hover
                      made these impossible to discover on first look. */}
                  <div className="shrink-0 flex gap-1">
                    <button
                      onClick={() => { setEditing(u); setShowForm(true); }}
                      title="Түзөтүү"
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ color: '#1CB0F6', background: 'rgba(28,176,246,0.1)' }}
                    >
                      <Pencil size={13} /> Түзөтүү
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      title="Колдонуучуну өчүрүү"
                      className="p-1.5 rounded-lg"
                      style={{ color: '#f87171', background: 'rgba(248,113,113,0.1)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px]">
                  <MiniStat icon={Star} tint="#FFD700" value={u.xp} />
                  <MiniStat icon={Coins} tint="#D4A72C" value={u.coins} />
                  <MiniStat icon={BookCheck} tint="#58CC02" value={u.completedLessons} />
                  <MiniStat icon={Flame} tint="#f97316" value={u.streak} />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2" style={{ borderTop: '1px solid #1e293b' }}>
                  <span>Катталган: {formatDate(u.createdAt)}</span>
                  <span>Акыркы: {relativeActivity(u.lastActiveDate)}</span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/// "В сети" — who is using the app at this moment.
///
/// The count is the headline; the faces are there so an operator watching a
/// class or a campaign can see WHO, not just how many. Presence is held in
/// the server's memory, so a restart empties it — the panel says that rather
/// than letting a fresh deploy read as "nobody is using this".
function OnlinePanel({ data }) {
  if (!data) {
    return (
      <Card className="!p-4">
        <div className="h-4 w-40 rounded animate-pulse" style={{ background: '#1e293b' }} />
      </Card>
    );
  }

  const { users, count, windowSeconds, serverUptimeSeconds } = data;
  const justRestarted = serverUptimeSeconds < windowSeconds;

  return (
    <Card className="!p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="relative flex h-2.5 w-2.5">
          {count > 0 && (
            <span className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping"
                  style={{ background: '#58CC02' }} />
          )}
          <span className="relative inline-flex rounded-full h-2.5 w-2.5"
                style={{ background: count > 0 ? '#58CC02' : '#475569' }} />
        </span>
        <span className="text-sm font-bold text-white">Азыр онлайн: {count}</span>
        <span className="text-[11px] text-slate-500">
          акыркы {Math.round(windowSeconds / 60)} мүнөттө · {REFRESH_MS / 1000} сек сайын жаңырат
        </span>
      </div>

      {count === 0 ? (
        <p className="text-xs text-slate-500">
          {justRestarted
            ? 'Сервер жакында кайра иштеди — тизме нөлдөн чогулуп жатат.'
            : 'Учурда эч ким колдонмодо жок.'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {users.map(u => (
            <div
              key={u.id}
              title={`${u.name || u.email} · ${u.secondsAgo}s мурун${u.uniId ? ` · ${u.uniId}` : ''}`}
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full"
              style={{ background: '#12141c', border: '1px solid rgba(88,204,2,0.25)' }}
            >
              <UserAvatar name={u.name} photoUrl={u.avatar} size={22} />
              <span className="text-[11px] font-semibold text-white max-w-[120px] truncate">
                {u.name || u.email}
              </span>
              {/* A student on a campus is the interesting case for whoever is
                  running a university contest. */}
              {u.uniRole === 'student' && u.uniId && (
                <span className="text-[10px] font-bold uppercase" style={{ color: '#1CB0F6' }}>
                  {u.uniId}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// Create ('user' is null) or edit an existing one. Mirrors ShopModule.jsx's
// ItemForm shape — same inline-card-with-Save/Cancel convention every other
// admin module uses. `password` is optional on edit (blank = leave it
// alone); required on create.
function UserForm({ token, user, onDone, onCancel }) {
  const isNew = !user;
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(user?.avatar && user.avatar !== '🦅' ? user.avatar : '');
  const [xp, setXp] = useState(user?.xp ?? 0);
  const [coins, setCoins] = useState(user?.coins ?? 0);
  const [streak, setStreak] = useState(user?.streak ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) return setError('Аты жана email керек');
    if (isNew && (!password || password.length < 6)) {
      return setError('Сырсөз жок дегенде 6 белгиден турушу керек');
    }
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await api.createUser(token, { name, email, password, avatar: avatar || undefined });
      } else {
        const body = { name, email, xp, coins, streak };
        if (avatar) body.avatar = avatar;
        if (password) body.password = password;
        await api.updateUser(token, user.id, body);
      }
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3 max-w-md">
      <Field label="Аты">
        <TextInput value={name} onChange={e => setName(e.target.value)} placeholder="Айгерим Careno" />
      </Field>
      <Field label="Email">
        <TextInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" />
      </Field>
      <Field label={isNew ? 'Сырсөз' : 'Жаңы сырсөз (өзгөртпөсөңүз бош калтырыңыз)'}>
        <TextInput type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isNew ? '' : '••••••••'} />
      </Field>
      <Field label="Avatar (emoji, милдеттүү эмес)">
        <TextInput value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="🦅" maxLength={8} />
      </Field>
      {!isNew && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="XP">
            <TextInput type="number" min={0} value={xp} onChange={e => setXp(e.target.value)} />
          </Field>
          <Field label="Монета">
            <TextInput type="number" min={0} value={coins} onChange={e => setCoins(e.target.value)} />
          </Field>
          <Field label="Streak">
            <TextInput type="number" min={0} value={streak} onChange={e => setStreak(e.target.value)} />
          </Field>
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2">
        <Button onClick={handleSave} loading={saving}>Сактоо</Button>
        <Button variant="ghost" onClick={onCancel}>Жокко чыгаруу</Button>
      </div>
    </Card>
  );
}

function MiniStat({ icon: Icon, tint, value }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md font-bold text-white" style={{ background: `${tint}1a` }}>
      <Icon size={11} color={tint} />
      {(value ?? 0).toLocaleString('ru-RU')}
    </span>
  );
}
