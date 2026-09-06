// admin-src/components/PrizeAnalytics.jsx — how the marketplace is doing.
//
// The coupon list next door answers "who got which code". This answers the
// question an operator actually opens the panel with: is the prize
// programme moving, and which prize is about to run out of codes.
//
// Buckets are real calendar ones (the server does the bucketing) because
// that is what a partner reconciles against — a "week" that starts on a
// rolling day would never line up with an invoice.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Gift, Search, Ticket, PackageX, Infinity as InfinityIcon } from 'lucide-react';
import * as api from '../api.js';
import { Card, Button, EmptyState, ErrorNote, previewText } from './ui.jsx';

const BUCKETS = [
  { id: 'day',   label: 'Күн' },
  { id: 'week',  label: 'Апта' },
  { id: 'month', label: 'Ай' },
  { id: 'year',  label: 'Жыл' },
];

const MONTHS_KY = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return iso(d);
};

/// Quick ranges, so the common questions are one click rather than two date
/// pickers. `null` means "everything the server has".
const PRESETS = [
  { id: '7',   label: 'Акыркы 7 күн',  from: () => daysAgo(6),  bucket: 'day' },
  { id: '30',  label: 'Акыркы 30 күн', from: () => daysAgo(29), bucket: 'day' },
  { id: '365', label: 'Бир жыл',       from: () => daysAgo(364), bucket: 'month' },
  { id: 'all', label: 'Баары',         from: () => null,        bucket: 'month' },
];

/// A bucket key as a human reads it. Day and week keys are dates; month is
/// "YYYY-MM"; year is the bare year.
function bucketLabel(key, bucket) {
  if (bucket === 'year') return key;
  if (bucket === 'month') return `${MONTHS_KY[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  const [, m, d] = key.split('-');
  const label = `${Number(d)}.${m}`;
  return bucket === 'week' ? `${label} апт.` : label;
}

/// The bar chart. Hand-drawn rather than pulled from a chart library: it is
/// one series of counts, and the whole thing is thirty lines.
function Chart({ series, bucket }) {
  const max = Math.max(1, ...series.map(s => s.count));
  // A long range makes for a very wide chart; it scrolls in its own box so
  // the panel around it never does.
  const barWidth = series.length > 40 ? 14 : series.length > 20 ? 22 : 34;

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1.5 h-40 min-w-full" style={{ width: 'max-content' }}>
        {series.map(({ key, count }) => (
          <div
            key={key}
            className="flex flex-col items-center gap-1.5 shrink-0"
            style={{ width: barWidth }}
            title={`${bucketLabel(key, bucket)}: ${count}`}
          >
            <span
              className="text-[10px] font-bold tabular-nums"
              style={{ color: count ? '#e2e8f0' : 'transparent' }}
            >
              {count}
            </span>
            <div
              className="w-full rounded-t transition-[height] duration-300"
              style={{
                height: `${Math.max(count ? 4 : 2, (count / max) * 112)}px`,
                background: count
                  ? 'linear-gradient(180deg,#38bdf8,#1CB0F6)'
                  : '#1e293b',
              }}
            />
            <span
              className="text-[9.5px] text-slate-600 whitespace-nowrap"
              style={{ writingMode: series.length > 20 ? 'vertical-rl' : undefined }}
            >
              {bucketLabel(key, bucket)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tile({ label, value, sub, color = '#e2e8f0' }) {
  return (
    <div className="flex-1 min-w-[9rem] px-3.5 py-3 rounded-xl" style={{ background: '#12141c', border: '1px solid #1e293b' }}>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="font-extrabold text-xl tabular-nums mt-0.5" style={{ color }}>{value}</p>
      {sub && <p className="text-[11px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function PrizeAnalytics({ token, onAuthError }) {
  const [preset, setPreset] = useState('30');
  const [bucket, setBucket] = useState('day');
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(iso(new Date()));
  const [custom, setCustom] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    api.fetchPrizeAnalytics(token, { from: from || undefined, to, bucket })
      .then(r => { setData(r); setError(''); })
      .catch(e => { if (e.status === 401) onAuthError(); else setError(e.message); });
  }, [token, onAuthError, from, to, bucket]);

  useEffect(() => { load(); }, [load]);

  function applyPreset(p) {
    setPreset(p.id);
    setCustom(false);
    setFrom(p.from() || '');
    setTo(iso(new Date()));
    setBucket(p.bucket);
  }

  const rows = useMemo(() => {
    const list = data?.byPrize || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(r =>
      previewText(r.title).toLowerCase().includes(q) ||
      previewText(r.partner?.name).toLowerCase().includes(q));
  }, [data, search]);

  // Codes still on the shelf across every prize — the number that says
  // whether anyone needs to chase a partner this week.
  const codesLeft = useMemo(
    () => (data?.byPrize || []).reduce((a, r) => a + (r.left ?? 0), 0),
    [data],
  );
  const emptyPrizes = useMemo(
    () => (data?.byPrize || []).filter(r => r.soldOut).length,
    [data],
  );

  if (!data) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="h-4 w-40 rounded animate-pulse" style={{ background: '#1e293b' }} />
        <div className="h-40 rounded animate-pulse" style={{ background: '#161f31' }} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Range ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className="px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
              style={!custom && preset === p.id
                ? { background: '#1CB0F6', color: '#fff' }
                : { background: 'transparent', color: '#64748b' }}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setCustom(true)}
            className="px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
            style={custom
              ? { background: '#1CB0F6', color: '#fff' }
              : { background: 'transparent', color: '#64748b' }}
          >
            Өз мезгилим
          </button>
        </div>

        <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
          {BUCKETS.map(b => (
            <button
              key={b.id}
              onClick={() => setBucket(b.id)}
              className="px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
              style={bucket === b.id
                ? { background: '#334155', color: '#fff' }
                : { background: 'transparent', color: '#64748b' }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {custom && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-500">Башталышы</span>
            <input
              type="date"
              value={from}
              max={to}
              min={data.earliest}
              onChange={e => setFrom(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
              style={{ background: '#12141c', border: '1px solid rgba(255,255,255,0.08)', colorScheme: 'dark' }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-500">Аягы</span>
            <input
              type="date"
              value={to}
              min={from}
              max={iso(new Date())}
              onChange={e => setTo(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
              style={{ background: '#12141c', border: '1px solid rgba(255,255,255,0.08)', colorScheme: 'dark' }}
            />
          </label>
          <p className="text-[11px] text-slate-600 pb-2.5">
            Эң эски купон: {data.earliest}
          </p>
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>

      {/* ── Summary ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2.5">
        <Tile label="Сатылган сыйлык" value={data.total} sub={`${data.from} — ${data.to}`} color="#1CB0F6" />
        <Tile
          label="Аткарылганы"
          value={data.fulfilled}
          sub={data.total ? `${Math.round((data.fulfilled / data.total) * 100)}%` : '—'}
          color="#58CC02"
        />
        <Tile label="Жыйналган монета" value={data.coins.toLocaleString('ru-RU')} sub="бүгүнкү баа боюнча" color="#FFD700" />
        <Tile
          label="Калган код"
          value={codesLeft}
          sub={emptyPrizes > 0 ? `${emptyPrizes} сыйлык бүттү` : 'баары запаста'}
          color={emptyPrizes > 0 ? '#ef4444' : '#e2e8f0'}
        />
      </div>

      {/* ── Chart ─────────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-3">
        <p className="text-xs font-bold text-slate-400">
          {BUCKETS.find(b => b.id === bucket)?.label} боюнча сатылган сыйлыктар
        </p>
        {data.series.length === 0 || data.total === 0 ? (
          <EmptyState
            icon={Ticket}
            title="Бул мезгилде сыйлык алынган жок"
            desc="Башка мезгилди тандап көрүңүз"
          />
        ) : (
          <Chart series={data.series} bucket={bucket} />
        )}
      </Card>

      {/* ── Per prize ─────────────────────────────────────────────────── */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Сыйлык же өнөктөш боюнча издөө..."
          className="w-full pl-9 pr-3 py-2 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none"
          style={{ background: '#12141c', border: '1px solid rgba(255,255,255,0.08)' }}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Gift} title="Табылган жок" desc="Издөөгө дал келген сыйлык жок" />
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500" style={{ borderBottom: '1px solid #1e293b' }}>
                  <th className="px-4 py-3 font-semibold">Сыйлык</th>
                  <th className="px-4 py-3 font-semibold text-right">Сатылды</th>
                  <th className="px-4 py-3 font-semibold text-right">Аткарылды</th>
                  <th className="px-4 py-3 font-semibold text-right">Калган код</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.prizeId} style={i ? { borderTop: '1px solid #1e293b' } : undefined}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {r.photoUrl
                          ? <img src={r.photoUrl} alt="" className="w-8 h-8 rounded-md object-contain shrink-0" style={{ background: '#0b1220' }} />
                          : <Gift size={15} className="text-slate-600 shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">
                            {r.deleted ? 'өчүрүлгөн сыйлык' : previewText(r.title)}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {r.partner ? previewText(r.partner.name) : 'өнөктөшсүз'} · 🪙 {r.priceCoins}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-white">{r.sold}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#58CC02' }}>{r.fulfilled}</td>
                    <td className="px-4 py-3 text-right">
                      {r.unlimited ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500" title="Код кошулган эмес — чексиз сатылат">
                          <InfinityIcon size={13} /> чексиз
                        </span>
                      ) : r.soldOut ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: '#ef4444' }}>
                          <PackageX size={13} /> бүттү
                        </span>
                      ) : (
                        <span className="font-bold tabular-nums" style={{ color: '#58CC02' }}>{r.left}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-600">
          {rows.length === (data.byPrize || []).length
            ? `${rows.length} сыйлык`
            : `${rows.length} / ${(data.byPrize || []).length} сыйлык`}
        </p>
        <Button variant="ghost" onClick={load}>Жаңылоо</Button>
      </div>
    </div>
  );
}
