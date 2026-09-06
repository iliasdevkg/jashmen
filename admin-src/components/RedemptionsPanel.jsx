// admin-src/components/RedemptionsPanel.jsx — the operator side of the
// prize marketplace: every coupon a learner has redeemed, newest first.
//
// Until this existed a redemption lived only on the learner's own phone and
// in db.json, so nobody running the programme could tell a partner which
// codes were real, or which had already been honoured. The "Аткарылды" mark
// is the answer to the second half of that.
//
// Both joins are best-effort on purpose. A prize can be deleted from the
// catalogue and a learner account can be deleted, and in both cases the
// coupon may already be in somebody's hand — so the row still renders, with
// the missing side spelled out rather than blank.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Gift, Search, Check, Clock, Ticket } from 'lucide-react';
import * as api from '../api.js';
import { Card, Button, EmptyState, ErrorNote, previewText } from './ui.jsx';

function formatWhen(row) {
  if (!row.ts) return row.date || '—';
  const d = new Date(row.ts);
  const date = d.toLocaleDateString('ru-RU', { year: '2-digit', month: '2-digit', day: '2-digit' });
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

const FILTERS = [
  { id: 'all',     label: 'Баары' },
  { id: 'pending', label: 'Аткарыла элек' },
  { id: 'today',   label: 'Бүгүн' },
];

export default function RedemptionsPanel({ token, onAuthError }) {
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [partnerId, setPartnerId] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.fetchRedemptions(token)
      .then(r => { setRows(r.redemptions || []); setError(''); })
      .catch(e => { if (e.status === 401) onAuthError(); else setError(e.message); });
  }, [token, onAuthError]);

  useEffect(() => { load(); }, [load]);

  // The partner list comes from the rows themselves rather than from the
  // content blob, so a partner whose prizes were all deleted still appears
  // as long as one of their coupons is on this screen.
  const partners = useMemo(() => {
    const seen = new Map();
    for (const r of rows || []) {
      if (r.partner && !seen.has(r.partner.id)) seen.set(r.partner.id, r.partner);
    }
    return [...seen.values()];
  }, [rows]);

  const today = new Date().toISOString().slice(0, 10);

  const visible = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (filter === 'pending' && r.fulfilledAt) return false;
      if (filter === 'today' && r.date !== today) return false;
      if (partnerId && r.partner?.id !== partnerId) return false;
      if (!q) return true;
      return (
        r.code?.toLowerCase().includes(q) ||
        r.user?.name?.toLowerCase().includes(q) ||
        r.user?.email?.toLowerCase().includes(q) ||
        previewText(r.prize?.title).toLowerCase().includes(q)
      );
    });
  }, [rows, search, filter, partnerId, today]);

  const pending = useMemo(() => (rows || []).filter(r => !r.fulfilledAt).length, [rows]);

  async function toggle(row) {
    setBusyId(row.id);
    try {
      const saved = await api.setRedemptionFulfilled(token, row.id, !row.fulfilledAt);
      setRows(prev => prev.map(r => (r.id === row.id ? { ...r, fulfilledAt: saved.fulfilledAt } : r)));
    } catch (e) {
      if (e.status === 401) onAuthError();
      else setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (rows === null) {
    return (
      <Card className="!p-0 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="px-4 py-3.5 flex items-center gap-4" style={i ? { borderTop: '1px solid #1e293b' } : undefined}>
            <div className="h-3 rounded animate-pulse w-32" style={{ background: '#1e293b' }} />
            <div className="h-3 rounded animate-pulse flex-1" style={{ background: '#161f31' }} />
            <div className="h-3 rounded animate-pulse w-24" style={{ background: '#161f31' }} />
          </div>
        ))}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Код, окуучу же сыйлык боюнча..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none"
            style={{ background: '#12141c', border: '1px solid rgba(255,255,255,0.08)' }}
          />
        </div>

        <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
              style={filter === f.id
                ? { background: '#1CB0F6', color: '#fff' }
                : { background: 'transparent', color: '#64748b' }}
            >
              {f.label}
              {f.id === 'pending' && pending > 0 && ` (${pending})`}
            </button>
          ))}
        </div>

        {partners.length > 1 && (
          <select
            value={partnerId}
            onChange={e => setPartnerId(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
            style={{ background: '#12141c', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <option value="">Бардык өнөктөштөр</option>
            {partners.map(p => (
              <option key={p.id} value={p.id}>{previewText(p.name)}</option>
            ))}
          </select>
        )}
      </div>

      <ErrorNote>{error}</ErrorNote>

      {visible.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={rows.length === 0 ? 'Азырынча сыйлык алынган жок' : 'Табылган жок'}
          desc={rows.length === 0
            ? 'Окуучу монеталарга сыйлык алганда коду ушул жерде пайда болот'
            : 'Чыпкага дал келген жазуу жок'}
        />
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500" style={{ borderBottom: '1px solid #1e293b' }}>
                  <th className="px-4 py-3 font-semibold">Код</th>
                  <th className="px-4 py-3 font-semibold">Убакыт</th>
                  <th className="px-4 py-3 font-semibold">Окуучу</th>
                  <th className="px-4 py-3 font-semibold">Сыйлык</th>
                  <th className="px-4 py-3 font-semibold text-right">Аткарылды</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr key={r.id} style={i ? { borderTop: '1px solid #1e293b' } : undefined}>
                    <td className="px-4 py-3 align-middle">
                      <span className="font-mono text-xs font-bold text-white whitespace-nowrap">{r.code}</span>
                      {/* The partner's own code, as it read on the day this
                          coupon was issued — a later edit to the prize does
                          not rewrite what somebody was already handed. */}
                      {r.promoCode && (
                        <p className="font-mono text-[11px] font-bold mt-1 whitespace-nowrap" style={{ color: '#58CC02' }}>
                          {r.promoCode}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-xs text-slate-400 whitespace-nowrap">
                      {formatWhen(r)}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {r.user ? (
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{r.user.name || '—'}</p>
                          <p className="text-[11px] text-slate-500 truncate">{r.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-600 italic">өчүрүлгөн колдонуучу</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {r.prize ? (
                        <div className="flex items-center gap-2 min-w-0">
                          {r.prize.photoUrl
                            ? <img src={r.prize.photoUrl} alt="" className="w-7 h-7 rounded-md object-contain shrink-0" style={{ background: '#0b1220' }} />
                            : <Gift size={14} className="text-slate-600 shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{previewText(r.prize.title)}</p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {r.partner ? previewText(r.partner.name) : 'өнөктөшсүз'}
                              {' · '}
                              {/* The record never snapshotted what was paid, so this
                                  is the prize's price today, not the price then. */}
                              <span title="Сыйлыктын бүгүнкү баасы">🪙 {r.prize.priceCoins}</span>
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-600 italic">өчүрүлгөн сыйлык</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      <button
                        onClick={() => toggle(r)}
                        disabled={busyId === r.id}
                        title={r.fulfilledAt
                          ? `Аткарылды: ${new Date(r.fulfilledAt).toLocaleString('ru-RU')} — басып артка кайтарыңыз`
                          : 'Өнөктөшкө өткөрүлдү деп белгилөө'}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-opacity disabled:opacity-50 whitespace-nowrap"
                        style={r.fulfilledAt
                          ? { color: '#58CC02', background: 'rgba(88,204,2,0.12)' }
                          : { color: '#94a3b8', background: 'rgba(148,163,184,0.1)' }}
                      >
                        {r.fulfilledAt ? <Check size={13} /> : <Clock size={13} />}
                        {r.fulfilledAt ? 'Ооба' : 'Күтүүдө'}
                      </button>
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
          {visible.length === rows.length
            ? `Баары: ${rows.length} код`
            : `${visible.length} / ${rows.length} код`}
        </p>
        <Button variant="ghost" onClick={load}>Жаңылоо</Button>
      </div>
    </div>
  );
}
