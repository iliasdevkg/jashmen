// admin-src/pages/AnalyticsModule.jsx — "Продвинутая Аналитика": a
// completion funnel per lesson, and a wrong-answer heatmap per question —
// the two numbers the manifest says are the actual sales pitch to banks
// ("74% студентов не знают, как отличить фейковый сайт вашего банка") —
// plus a headline "Жалпы статистика" panel (total users, total XP, etc.),
// the same kind of overall numbers the old may.caim.dev admin showed.
import { useState, useEffect, useMemo } from 'react';
import { TrendingDown, Flame, BarChart3, Users, Star, Coins, BookCheck, Activity, Search, Trash2, Plus, Pencil } from 'lucide-react';
import * as api from '../api.js';
import { Card, Field, TextInput, Button, ErrorNote, EmptyState, previewText } from '../components/ui.jsx';

// Same deterministic name → color hash as the learner apps' shared
// Avatar component (src/components/Avatar.jsx) — admin-src builds
// separately from src/ (see vite.admin.config.js), so it's a small
// re-implementation rather than a cross-app import, but the palette and
// hash are identical on purpose: the same person's initial renders the
// same color here as it does on the leaderboard.
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

function lessonTitle(content, lessonId) {
  for (const m of content.modules) {
    const l = m.lessons.find(l => l.id === lessonId);
    // Module/lesson titles may still be a bare string (legacy content) or
    // the trilingual { ky, ru, en } shape — previewText() normalizes both,
    // same as every other admin page. Rendering the raw value here is what
    // used to crash this whole page the moment a title was edited via
    // TrilingualInput.
    if (l) return { title: previewText(l.title), module: previewText(m.title) };
  }
  return { title: lessonId || '—', module: null };
}

const SECTIONS = [
  { id: 'questions', label: 'Суроолор боюнча' },
  { id: 'overview', label: 'Жалпы статистика' },
  { id: 'users', label: 'Колдонуучулар' },
];

export default function AnalyticsModule({ token, content, onAuthError }) {
  const [section, setSection] = useState('questions');
  const [funnel, setFunnel] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // 'new' | user | null
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.fetchFunnel(token), api.fetchHeatmap(token), api.fetchOverview(token), api.fetchUsers(token)])
      .then(([f, h, o, u]) => { setFunnel(f); setHeatmap(h); setOverview(o); setUsers(u); })
      .catch(e => { if (e.status === 401) onAuthError(); else setError(e.message); });
  }, [token, onAuthError]);

  const reloadUsers = () => api.fetchUsers(token).then(setUsers).catch(() => {});

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, search]);

  async function handleDeleteUser(u) {
    if (!confirm(`"${u.name}" (${u.email}) колдонуучусун толугу менен өчүрөсүзбү? Бул артка кайтарылгыс.`)) return;
    try {
      await api.deleteUser(token, u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
    } catch (e) {
      if (e.status === 401) onAuthError();
      else alert(e.message);
    }
  }

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!funnel || !heatmap || !overview || !users) return <p className="text-sm text-slate-400">Жүктөлүүдө...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-extrabold text-white mb-1">Аналитика</h2>
        <p className="text-xs text-slate-500">Колдонуучулар сабактарды баштаганда/аяктаганда жана суроолорго жооп бергенде автоматтык жаңыланат.</p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            style={section === s.id
              ? { background: '#1CB0F6', color: '#fff' }
              : { background: 'transparent', color: '#64748b' }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'overview' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard icon={Users} tint="#1CB0F6" label="Жалпы колдонуучу" value={overview.totalUsers} />
          <StatCard icon={Activity} tint="#8B5CF6" label="Акыркы 7 күндө активдүү" value={overview.activeLast7Days} />
          <StatCard icon={Star} tint="#FFD700" label="Жалпы XP" value={overview.totalXp} />
          <StatCard icon={Coins} tint="#D4A72C" label="Жалпы монета (акчи)" value={overview.totalCoins} />
          <StatCard icon={BookCheck} tint="#58CC02" label="Аяктаган сабактар" value={overview.totalLessonsCompleted} />
        </div>
      ) : section === 'users' ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Аты же email боюнча издөө..."
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none"
                style={{ background: '#12141c', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>
            <Button variant="ghost" onClick={() => { setEditingUser('new'); setShowUserForm(true); }}>
              <Plus size={14} /> Жаңы колдонуучу
            </Button>
          </div>

          {showUserForm && (
            <UserForm
              token={token}
              user={editingUser === 'new' ? null : editingUser}
              onDone={() => { setShowUserForm(false); setEditingUser(null); reloadUsers(); }}
              onCancel={() => { setShowUserForm(false); setEditingUser(null); }}
            />
          )}

          {filteredUsers.length === 0 ? (
            <EmptyState icon={Users} title="Табылган жок" desc="Издөөгө дал келген колдонуучу жок" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredUsers.map(u => (
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
                        onClick={() => { setEditingUser(u); setShowUserForm(true); }}
                        title="Түзөтүү"
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ color: '#1CB0F6', background: 'rgba(28,176,246,0.1)' }}
                      >
                        <Pencil size={13} /> Түзөтүү
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u)}
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
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown size={16} color="#1CB0F6" />
              <h3 className="text-sm font-bold text-white">Воронка (сабак боюнча)</h3>
            </div>
            {funnel.length === 0 ? (
              <EmptyState icon={BarChart3} title="Азырынча маалымат жок" desc="Биринчи колдонуучу сабак баштаганда пайда болот" />
            ) : (
              <Card className="!p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500" style={{ borderBottom: '1px solid #1e293b' }}>
                      <th className="px-4 py-3 font-semibold">Сабак</th>
                      <th className="px-4 py-3 font-semibold">Баштаган</th>
                      <th className="px-4 py-3 font-semibold">Аяктаган</th>
                      <th className="px-4 py-3 font-semibold">Аяктоо %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnel.map((row, i) => {
                      const { title, module } = lessonTitle(content, row.lessonId);
                      // started can be 0 while completed > 0 for lessons finished
                      // before this build (no lesson_start event exists yet) —
                      // that's a missing-data gap, not a real 0% completion rate.
                      const pct = row.started > 0 ? Math.round((row.completed / row.started) * 100) : null;
                      return (
                        <tr key={row.lessonId} style={{ borderBottom: i < funnel.length - 1 ? '1px solid #1e293b' : 'none' }}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-white">{title}</p>
                            {module && <p className="text-[11px] text-slate-500">{module}</p>}
                          </td>
                          <td className="px-4 py-3 text-slate-300">{row.started}</td>
                          <td className="px-4 py-3 text-slate-300">{row.completed}</td>
                          <td className="px-4 py-3">
                            {pct == null
                              ? <span className="text-slate-600">—</span>
                              : <span className="font-bold" style={{ color: pct >= 70 ? '#58CC02' : pct >= 40 ? '#FFD700' : '#f87171' }}>{pct}%</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Flame size={16} color="#f87171" />
              <h3 className="text-sm font-bold text-white">Катачылык картасы (эң көп жаңылышкан суроолор)</h3>
            </div>
            {heatmap.length === 0 ? (
              <EmptyState icon={BarChart3} title="Азырынча маалымат жок" desc="Колдонуучулар квиз суроолоруна жооп бергенде пайда болот" />
            ) : (
              <Card className="!p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500" style={{ borderBottom: '1px solid #1e293b' }}>
                      <th className="px-4 py-3 font-semibold">Сабак</th>
                      <th className="px-4 py-3 font-semibold">Суроо №</th>
                      <th className="px-4 py-3 font-semibold">Жооп берген</th>
                      <th className="px-4 py-3 font-semibold">Жаңылыш %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.slice(0, 25).map((row, i) => {
                      const { title } = lessonTitle(content, row.lessonId);
                      const hot = row.wrongPct >= 50;
                      return (
                        <tr key={`${row.lessonId}-${row.questionIndex}`} style={{ borderBottom: i < heatmap.length - 1 ? '1px solid #1e293b' : 'none', background: hot ? 'rgba(248,113,113,0.06)' : 'transparent' }}>
                          <td className="px-4 py-3 font-semibold text-white">{title}</td>
                          <td className="px-4 py-3 text-slate-300">№{row.questionIndex + 1}</td>
                          <td className="px-4 py-3 text-slate-300">{row.total}</td>
                          <td className="px-4 py-3">
                            <span className="font-bold" style={{ color: hot ? '#f87171' : row.wrongPct >= 25 ? '#FFD700' : '#58CC02' }}>{row.wrongPct}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
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

function StatCard({ icon: Icon, tint, label, value }) {
  return (
    <Card className="flex flex-col gap-2">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ background: `${tint}1a` }}
      >
        <Icon size={18} color={tint} />
      </div>
      <p className="text-2xl font-extrabold text-white">{value.toLocaleString('ru-RU')}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </Card>
  );
}
