// admin-src/components/StudentStats.jsx — the student side of the roster.
//
// Shared by two tabs on purpose. It answers "who is competing where", which
// is an account question in Колдонуучулар and a performance question in
// Аналитика; the same numbers serve both, and one copy means the two tabs
// can never quietly disagree.
import { Fragment, useState } from 'react';
import { Card, EmptyState } from './ui.jsx';
import { Users, ChevronRight } from 'lucide-react';

/// One campus's students, highest campus score first — the same order they
/// see on the board they are competing on. Numbered, because the question
/// this answers out loud is "Политех — 10 студент, кимдер?".
function Roster({ rows }) {
  if (rows.length === 0) {
    return <p className="text-[11px] text-slate-500">Бул университетте студент жок</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r, i) => (
        <div key={r.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg"
             style={{ background: '#12141c' }}>
          <span className="w-6 shrink-0 text-right text-[11px] font-bold text-slate-600 tabular-nums">
            {i + 1}
          </span>
          <span className="w-6 h-6 shrink-0 rounded-full grid place-items-center text-[13px]"
                style={{ background: '#0b1220' }}>
            {r.avatar || '🙂'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{r.name || '—'}</p>
            <p className="text-[10.5px] text-slate-500 truncate">{r.email}</p>
          </div>
          {r.online
            ? <span className="text-[10px] font-bold shrink-0" style={{ color: '#58CC02' }}>онлайн</span>
            : r.active
              ? <span className="text-[10px] font-semibold shrink-0 text-slate-500">активдүү</span>
              : null}
          <span className="text-[11px] shrink-0 text-slate-400 tabular-nums" title="Жапкан сабак">
            {r.lessonsCompleted} сабак
          </span>
          <span className="text-[11px] shrink-0 font-bold tabular-nums w-16 text-right"
                style={{ color: '#1CB0F6' }} title="Кампус XP">
            {r.xp.toLocaleString('ru-RU')}
          </span>
        </div>
      ))}
    </div>
  );
}

/// The student side of the roster.
///
/// The split at the top is the thing that was impossible to see before: every
/// account is in exactly one of three states — competing on a campus board,
/// watching one, or playing the general league alone — and those three add up
/// to the roster. The table underneath is one row per campus, because "how is
/// KSTU doing" is the question a university contest is actually run on.
export default function StudentStats({ data }) {
  // Which campus's roll is open, if any. One at a time: the panel is a
  // summary, and two expanded lists stop it being one.
  const [openUni, setOpenUni] = useState(null);

  if (!data) {
    return (
      <Card className="!p-4">
        <div className="h-4 w-52 rounded animate-pulse" style={{ background: '#1e293b' }} />
      </Card>
    );
  }

  const { students, viewers, generalOnly, studentXp, studentLessons,
          studentsActive, studentsOnline, byUniversity, activeSinceDate } = data;
  const total = students + viewers + generalOnly;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const SPLIT = [
    { label: 'Университет лигасы · студент', n: students,    color: '#1CB0F6',
      help: 'Кампустун тактасында жарышат — XP ошол жакка түшөт' },
    { label: 'Университет лигасы · көрүүчү', n: viewers,     color: '#A855F7',
      help: 'Кампусту тандаган, бирок XP жалпы лигага түшөт' },
    { label: 'Жалпы лига гана',              n: generalOnly, color: '#58CC02',
      help: 'Эч бир кампуска кошулган эмес' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* The three populations. Percentages of the whole roster, so the bars
          are comparable with each other rather than each to its own maximum. */}
      <Card className="!p-4 flex flex-col gap-3">
        <p className="text-sm font-bold text-white">Кайсы лигада ойношот</p>
        <div className="flex flex-col gap-2.5">
          {SPLIT.map(row => (
            <div key={row.label} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold text-slate-300">{row.label}</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: row.color }}>
                  {row.n} <span className="text-slate-600 font-medium">· {pct(row.n)}%</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#0b1220' }}>
                <div className="h-full rounded-full" style={{ width: `${pct(row.n)}%`, background: row.color }} />
              </div>
              <p className="text-[10.5px] text-slate-600">{row.help}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniCard label="Студент" value={students} tint="#1CB0F6" />
        <MiniCard label={`Активдүү (${activeSinceDate}тан бери)`} value={studentsActive} tint="#58CC02" />
        <MiniCard label="Азыр онлайн" value={studentsOnline} tint="#FFD700" />
        <MiniCard label="Кампус XP (жалпы)" value={studentXp} tint="#CE82FF" />
      </div>

      <div>
        <p className="text-sm font-bold text-white mb-2">Университеттер боюнча</p>
        <p className="text-[11px] text-slate-600 mb-2">
          Университеттин катарын басып, студенттеринин тизмесин ачыңыз.
        </p>
        {byUniversity.length === 0 ? (
          <EmptyState icon={Users} title="Азырынча кампуска кошулган жок"
                      desc="Окуучу университет лигасына киргенде ушул жерде пайда болот" />
        ) : (
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500" style={{ borderBottom: '1px solid #1e293b' }}>
                    <th className="px-4 py-3 font-semibold">Университет</th>
                    <th className="px-4 py-3 font-semibold">Студент</th>
                    <th className="px-4 py-3 font-semibold">Көрүүчү</th>
                    <th className="px-4 py-3 font-semibold">Активдүү</th>
                    <th className="px-4 py-3 font-semibold">Жапкан сабак</th>
                    <th className="px-4 py-3 font-semibold">Кампус XP</th>
                    <th className="px-4 py-3 font-semibold">Орточо</th>
                  </tr>
                </thead>
                <tbody>
                  {byUniversity.map((u, i) => (
                    <Fragment key={u.uniId}>
                    <tr
                      onClick={() => u.students > 0 && setOpenUni(openUni === u.uniId ? null : u.uniId)}
                      className={u.students > 0 ? 'cursor-pointer' : undefined}
                      style={{
                        ...(i ? { borderTop: '1px solid #1e293b' } : null),
                        ...(openUni === u.uniId ? { background: 'rgba(28,176,246,0.06)' } : null),
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {u.students > 0 && (
                            <ChevronRight
                              size={13}
                              className="shrink-0 text-slate-600 transition-transform"
                              style={openUni === u.uniId ? { transform: 'rotate(90deg)' } : undefined}
                            />
                          )}
                          {u.logoUrl
                            ? <img src={u.logoUrl} alt="" className="w-6 h-6 rounded-full object-contain shrink-0" style={{ background: '#0b1220' }} />
                            : <span className="w-6 h-6 rounded-full shrink-0" style={{ background: u.color || '#334155' }} />}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">
                              {u.listName || u.uniId}
                            </p>
                            {u.missing
                              ? <p className="text-[10.5px] text-amber-500/80">өчүрүлгөн университет</p>
                              : !u.hasContest && <p className="text-[10.5px] text-slate-600">конкурс жок</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold tabular-nums" style={{ color: '#1CB0F6' }}>{u.students}</td>
                      <td className="px-4 py-3 text-slate-400 tabular-nums">{u.viewers}</td>
                      <td className="px-4 py-3 text-slate-300 tabular-nums">
                        {u.active}
                        {u.online > 0 && <span className="ml-1.5 text-[10px] font-bold" style={{ color: '#58CC02' }}>+{u.online} онлайн</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-300 tabular-nums">{u.lessonsCompleted}</td>
                      <td className="px-4 py-3 text-slate-300 tabular-nums">{u.xp.toLocaleString('ru-RU')}</td>
                      <td className="px-4 py-3 text-slate-300 tabular-nums">{u.avgXp}</td>
                    </tr>
                    {openUni === u.uniId && (
                      <tr style={{ borderTop: '1px solid #1e293b' }}>
                        <td colSpan={7} className="px-4 py-3" style={{ background: '#0b1220' }}>
                          <Roster rows={u.roster || []} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <p className="text-[11px] text-slate-600">
        «Кампус XP» — университет лигасында чогултулган упай. Ал студент кампуска
        кошулганда же чыкканда нөлдөнөт, ошондуктан жалпы XPден айырмаланат.
      </p>
    </div>
  );
}

function MiniCard({ label, value, tint }) {
  return (
    <Card className="!p-3 flex flex-col gap-1">
      <p className="text-xl font-extrabold tabular-nums" style={{ color: tint }}>
        {Number(value || 0).toLocaleString('ru-RU')}
      </p>
      <p className="text-[11px] text-slate-500 leading-snug">{label}</p>
    </Card>
  );
}

