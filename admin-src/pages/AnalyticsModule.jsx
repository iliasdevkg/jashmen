// admin-src/pages/AnalyticsModule.jsx — "Продвинутая Аналитика": a
// completion funnel per lesson, and a wrong-answer heatmap per question —
// the two numbers the manifest says are the actual sales pitch to banks
// ("74% студентов не знают, как отличить фейковый сайт вашего банка") —
// plus a headline "Жалпы статистика" panel (total users, total XP, etc.),
// the same kind of overall numbers the old may.caim.dev admin showed.
import { useState, useEffect, useCallback } from 'react';
import { TrendingDown, Flame, BarChart3, Users, Star, Coins, BookCheck, Activity, Trash2 } from 'lucide-react';
import * as api from '../api.js';
import { Card, Button, EmptyState, previewText } from '../components/ui.jsx';
import StudentStats from '../components/StudentStats.jsx';

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
  // The lesson is gone but its events remain — a deleted draft, or seed
  // content replaced long ago. Say so, rather than printing a raw id the
  // operator has no way to recognise.
  return { title: lessonId || '—', module: null, missing: true };
}

const SECTIONS = [
  { id: 'questions', label: 'Суроолор боюнча' },
  { id: 'overview', label: 'Жалпы статистика' },
  { id: 'students', label: 'Студенттер' },
];

export default function AnalyticsModule({ token, content, onAuthError }) {
  const [section, setSection] = useState('questions');
  const [funnel, setFunnel] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [overview, setOverview] = useState(null);
  const [stale, setStale] = useState(null);
  const [students, setStudents] = useState(null);
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([
      api.fetchFunnel(token), api.fetchHeatmap(token),
      api.fetchOverview(token), api.fetchStaleAnalytics(token),
      api.fetchStudentStats(token),
    ])
      .then(([f, h, o, st, sd]) => { setFunnel(f); setHeatmap(h); setOverview(o); setStale(st); setStudents(sd); })
      .catch(e => { if (e.status === 401) onAuthError(); else setError(e.message); });
  }, [token, onAuthError]);

  useEffect(() => { load(); }, [load]);

  const purge = async (scope) => {
    const ask = scope === 'all'
      ? 'Бүт аналитиканы өчүрөсүзбү? Воронка да, катачылык картасы да нөлдөн башталат. Артка кайтарылгыс.'
      : `Өчүрүлгөн ${stale?.staleCount ?? 0} сабактын жазуулары тазалансынбы? Азыркы сабактардын статистикасы тийбейт.`;
    if (!confirm(ask)) return;
    setPurging(true);
    try {
      const r = await api.purgeAnalytics(token, scope);
      setError('');
      load();
      alert(`${r.removed} жазуу өчүрүлдү, ${r.remaining} калды.`);
    } catch (e) {
      if (e.status === 401) onAuthError(); else setError(e.message);
    } finally {
      setPurging(false);
    }
  };

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!funnel || !heatmap || !overview) return <p className="text-sm text-slate-400">Жүктөлүүдө...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-extrabold text-white mb-1">Аналитика</h2>
        <p className="text-xs text-slate-500">
          Колдонуучулар сабактарды баштаганда/аяктаганда жана суроолорго жооп бергенде автоматтык жаңыланат.
          Пайыз айырмаланган окуучулар боюнча эсептелет, ошондуктан 100%дан ашпайт.
        </p>
      </div>

      {/* Housekeeping. The funnel carries rows for lessons that were deleted
          long ago — seed content, throwaway drafts — and their raw ids are
          noise the operator cannot act on. */}
      <div className="flex flex-wrap items-center gap-2">
        {stale?.staleCount > 0 && (
          <Button variant="ghost" onClick={() => purge('stale')} loading={purging}>
            <Trash2 size={13} /> Өчүрүлгөн {stale.staleCount} сабактын жазууларын тазалоо
          </Button>
        )}
        <Button variant="ghost" onClick={() => purge('all')} loading={purging}>
          <Trash2 size={13} /> Бүт аналитиканы нөлдөө
        </Button>
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

      {section === 'students' ? (
        <StudentStats data={students} />
      ) : section === 'overview' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard icon={Users} tint="#1CB0F6" label="Жалпы колдонуучу" value={overview.totalUsers} />
          <StatCard icon={Activity} tint="#8B5CF6" label="Акыркы 7 күндө активдүү" value={overview.activeLast7Days} />
          <StatCard icon={Star} tint="#FFD700" label="Жалпы XP" value={overview.totalXp} />
          <StatCard icon={Coins} tint="#D4A72C" label="Жалпы монета (акчи)" value={overview.totalCoins} />
          <StatCard icon={BookCheck} tint="#58CC02" label="Аяктаган сабактар" value={overview.totalLessonsCompleted} />
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
                      const { title, module, missing } = lessonTitle(content, row.lessonId);
                      // Computed server-side now (events.js#funnel), over
                      // distinct learners rather than raw events — counting
                      // events produced completion rates above 100%.
                      const pct = row.completionPct;
                      return (
                        <tr key={row.lessonId} style={{ borderBottom: i < funnel.length - 1 ? '1px solid #1e293b' : 'none' }}>
                          <td className="px-4 py-3">
                            <p className={`font-semibold ${missing ? 'text-slate-500 font-mono text-xs' : 'text-white'}`}>{title}</p>
                            {module && <p className="text-[11px] text-slate-500">{module}</p>}
                            {missing && <p className="text-[11px] text-amber-500/80">өчүрүлгөн сабак</p>}
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
