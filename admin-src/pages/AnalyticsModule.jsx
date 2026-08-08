// admin-src/pages/AnalyticsModule.jsx — "Продвинутая Аналитика": a
// completion funnel per lesson, and a wrong-answer heatmap per question —
// the two numbers the manifest says are the actual sales pitch to banks
// ("74% студентов не знают, как отличить фейковый сайт вашего банка").
import { useState, useEffect } from 'react';
import { TrendingDown, Flame, BarChart3 } from 'lucide-react';
import * as api from '../api.js';
import { Card, EmptyState } from '../components/ui.jsx';

function lessonTitle(content, lessonId) {
  for (const m of content.modules) {
    const l = m.lessons.find(l => l.id === lessonId);
    if (l) return { title: l.title, module: m.title };
  }
  return { title: lessonId || '—', module: null };
}

export default function AnalyticsModule({ token, content, onAuthError }) {
  const [funnel, setFunnel] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.fetchFunnel(token), api.fetchHeatmap(token)])
      .then(([f, h]) => { setFunnel(f); setHeatmap(h); })
      .catch(e => { if (e.status === 401) onAuthError(); else setError(e.message); });
  }, [token, onAuthError]);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!funnel || !heatmap) return <p className="text-sm text-slate-400">Жүктөлүүдө...</p>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-extrabold text-white mb-1">Аналитика</h2>
        <p className="text-xs text-slate-500">Колдонуучулар сабактарды баштаганда/аяктаганда жана суроолорго жооп бергенде автоматтык жаңыланат.</p>
      </div>

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
  );
}
