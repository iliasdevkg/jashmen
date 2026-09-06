// admin-src/pages/LeadsModule.jsx — the inbox for the public forms.
//
// Three queues behind one tab, and the split is the point: a bank writing
// from the business site must never be buried under a week of "the lesson
// won't open", and neither of those two must be buried under newsletter
// sign-ups, which arrive far more often and need no reply at all. The tab
// strip carries an unanswered count on each side, so the number a person
// opens this screen to check is visible before they choose a queue.
//
// "Answered" is a mark this panel keeps, not a state the sender ever sees.
// Nobody gets an automatic reply — the point of the mark is that whoever
// opens this next knows which rows still owe someone an email.
import { useState, useEffect, useCallback } from 'react';
import {
  Inbox, Building2, MessageSquare, Check, Trash2, Mail, Phone,
  Globe, RefreshCw, ExternalLink, AtSign,
} from 'lucide-react';
import * as api from '../api.js';
import { Card, Button, EmptyState, ErrorNote } from '../components/ui.jsx';

// Mirrors admin-api/leads.js. A value the server ever adds and this map does
// not know falls back to the raw slug rather than rendering blank.
const INTEREST = {
  league: 'Кампустагы сезон',
  module: 'Окуу модулу',
  rewards: 'Дүкөндөгү сыйлыктар',
  integration: 'Интеграция / башка',
  other: 'Башка',
};

const TOPIC = {
  bug: 'Катачылык',
  suggestion: 'Сунуш',
  content: 'Мазмун',
  reward: 'Сыйлык',
  account: 'Аккаунт',
  other: 'Башка',
};

/// Absolute, because "3 күн мурун" on a lead that has been sitting for a
/// week is exactly the wrong emphasis — the date is what tells someone this
/// one is late.
function when(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function Tab({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
      style={active
        ? { background: 'rgba(28,176,246,0.15)', color: '#1CB0F6' }
        : { color: '#94a3b8' }}
    >
      <Icon size={16} strokeWidth={active ? 2.5 : 2} />
      {label}
      {count > 0 && (
        <span
          className="min-w-[20px] h-5 px-1.5 rounded-full grid place-items-center text-[11px] font-bold tabular-nums"
          style={{ background: '#ef4444', color: '#fff' }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function Row({ lead, onToggle, onDelete, busy }) {
  const [confirming, setConfirming] = useState(false);
  const handled = !!lead.handledAt;
  const partner = lead.kind === 'partner';
  const subscriber = lead.kind === 'subscribe';

  // A subscriber's headline IS their address — there is nothing else on the
  // row, and repeating the email underneath would be the same string twice.
  const heading = partner
    ? lead.organization
    : subscriber
      ? lead.email
      : (TOPIC[lead.topic] || lead.topic);
  const badge = partner
    ? (INTEREST[lead.interest] || lead.interest)
    : subscriber
      ? (lead.source || 'Рассылка')
      : 'Колдонуучу';

  return (
    <article
      className="rounded-2xl p-4 sm:p-5"
      style={{
        background: '#12141c',
        border: handled ? '1px solid #1e293b' : '1.5px solid rgba(28,176,246,0.35)',
        opacity: handled ? 0.62 : 1,
      }}
    >
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-extrabold text-white text-[15px] truncate">{heading}</h3>
            <span
              className="px-2 py-0.5 rounded-md text-[10.5px] font-bold uppercase tracking-wide"
              style={partner
                ? { background: 'rgba(255,197,61,0.15)', color: '#FFC53D' }
                : { background: 'rgba(148,163,184,0.15)', color: '#94a3b8' }}
            >
              {badge}
            </span>
          </div>

          {partner && lead.contact && (
            <p className="text-[13px] text-slate-400 mt-1">{lead.contact}</p>
          )}

          <p className="text-[11.5px] text-slate-600 mt-1 tabular-nums">{when(lead.ts)}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onToggle(lead)}
            disabled={busy}
            title={handled ? 'Жооп берилген белгисин алып салуу' : 'Жооп берилди деп белгилөө'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50"
            style={handled
              ? { background: 'rgba(88,204,2,0.14)', color: '#58CC02' }
              : { background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}
          >
            <Check size={14} strokeWidth={3} />
            {handled ? 'Жооп берилди' : 'Белгилөө'}
          </button>

          {confirming ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onDelete(lead)}
                disabled={busy}
                className="px-3 py-2 rounded-lg text-[12px] font-bold disabled:opacity-50"
                style={{ background: '#ef4444', color: '#fff' }}
              >
                Өчүрүү
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-2.5 py-2 rounded-lg text-[12px] font-semibold text-slate-500"
              >
                Жок
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              title="Бул кайрылууну өчүрүү"
              className="p-2 rounded-lg text-slate-600 hover:text-red-400 transition-colors"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* The reply-to details, as links: an enquiry answered in one click is
          an enquiry that gets answered. */}
      <div className="flex flex-wrap items-center gap-2 mt-3.5" hidden={subscriber}>
        <a
          href={`mailto:${lead.email}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors hover:text-white"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}
        >
          <Mail size={13} /> {lead.email}
        </a>
        {lead.phone && (
          <a
            href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors hover:text-white"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}
          >
            <Phone size={13} /> {lead.phone}
          </a>
        )}
        {lead.website && (
          <a
            href={/^https?:\/\//.test(lead.website) ? lead.website : `https://${lead.website}`}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors hover:text-white"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}
          >
            <Globe size={13} /> {lead.website} <ExternalLink size={11} />
          </a>
        )}
      </div>

      {lead.message && (
        <p
          className="mt-3.5 text-[13.5px] text-slate-300 leading-relaxed whitespace-pre-wrap rounded-xl px-4 py-3"
          style={{ background: '#0f172a' }}
        >
          {lead.message}
        </p>
      )}
    </article>
  );
}

export default function LeadsModule({ token, onAuthError }) {
  const [kind, setKind] = useState('partner');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.fetchLeads(token)
      .then(res => { setData(res); setError(''); })
      .catch(e => {
        if (e.status === 401) { onAuthError?.(); return; }
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [token, onAuthError]);

  useEffect(() => { load(); }, [load]);

  // Optimistic, then reconciled with what the server returns: the mark is a
  // one-field write that either lands or doesn't, and making the operator
  // wait for a round trip to see a checkmark move makes the list feel stuck.
  async function toggle(lead) {
    setBusyId(lead.id);
    const next = !lead.handledAt;
    setData(d => ({
      ...d,
      leads: d.leads.map(l => (l.id === lead.id ? { ...l, handledAt: next ? Date.now() : null } : l)),
      unhandled: { ...d.unhandled, [lead.kind]: Math.max(0, d.unhandled[lead.kind] + (next ? -1 : 1)) },
    }));
    try {
      await api.setLeadHandled(token, lead.id, next);
    } catch (e) {
      if (e.status === 401) return onAuthError?.();
      setError(e.message);
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(lead) {
    setBusyId(lead.id);
    try {
      await api.deleteLead(token, lead.id);
      load();
    } catch (e) {
      if (e.status === 401) return onAuthError?.();
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  const rows = (data?.leads || []).filter(l => l.kind === kind);
  const unhandled = data?.unhandled || { partner: 0, feedback: 0, subscribe: 0 };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Кайрылуулар</h1>
          <p className="text-sm text-slate-500 mt-1">
            Сайттагы формалардан келген каттар — өнөктөштөр, колдонуучулардын
            пикирлери жана рассылкага жазылгандар.
          </p>
        </div>
        <Button variant="ghost" onClick={load} loading={loading}>
          <RefreshCw size={14} /> Жаңылоо
        </Button>
      </header>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex items-center gap-1.5 flex-wrap">
        <Tab
          active={kind === 'partner'}
          onClick={() => setKind('partner')}
          icon={Building2}
          label="Өнөктөштөр"
          count={unhandled.partner}
        />
        <Tab
          active={kind === 'feedback'}
          onClick={() => setKind('feedback')}
          icon={MessageSquare}
          label="Колдонуучулар"
          count={unhandled.feedback}
        />
        <Tab
          active={kind === 'subscribe'}
          onClick={() => setKind('subscribe')}
          icon={AtSign}
          label="Жазылгандар"
          count={unhandled.subscribe}
        />
      </div>

      {loading && !data ? (
        <Card className="py-16 text-center text-sm text-slate-500">Жүктөлүүдө...</Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={{
            partner: 'Азырынча кайрылуу жок',
            feedback: 'Азырынча пикир жок',
            subscribe: 'Азырынча жазылган жок',
          }[kind]}
          desc={{
            partner: 'Башкы беттеги «Стать партнёром» формасы толтурулганда кат ушул жерге түшөт.',
            feedback: 'Колдонуучулардын пикирлери ушул жерге түшөт.',
            subscribe: 'Башкы беттин ылдый жагындагы жазылуу формасы ушул жерге түшөт.',
          }[kind]}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map(lead => (
            <Row
              key={lead.id}
              lead={lead}
              busy={busyId === lead.id}
              onToggle={toggle}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
