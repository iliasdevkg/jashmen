// admin-src/components/PromoCodePool.jsx — a prize's promo codes, as stock.
//
// One code per unit. Five coffees means five codes here, and the shop stops
// selling when the fifth one is gone — the list IS the inventory, so there
// is no second quantity field that could disagree with it.
//
// The numbering runs 1..N top to bottom over the codes that are still
// UNSOLD. A code that gets bought leaves the list and everything under it
// moves up a place, which is what makes "how many are left" readable at a
// glance instead of something to work out from two numbers.
import { useState, useRef, useEffect, useId } from 'react';
import { Plus, X, ClipboardPaste, PackageX } from 'lucide-react';
import { Field, TextInput, Button } from './ui.jsx';

/// Same shape the server stores them in (contentStore.js#normalizePromoCode)
/// so what the operator sees on this screen is what a learner is handed.
const clean = (s) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 40);

/// Splits a pasted block — one code per line is how partners send them,
/// but commas and semicolons come up often enough to be worth accepting.
const split = (text) => text.split(/[\r\n,;]+/).map(clean).filter(Boolean);

export default function PromoCodePool({ codes, used = 0, onChange }) {
  const [draft, setDraft] = useState('');
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [note, setNote] = useState('');
  const bulkRef = useRef(null);
  // TextInput is a plain function component (ui.jsx), so on React 18 it
  // cannot take a ref — the id is how the field gets focused back after an
  // add, which is what makes typing a run of codes feel like a list.
  const inputId = useId();
  const focusDraft = () => document.getElementById(inputId)?.focus();

  useEffect(() => { if (bulk) bulkRef.current?.focus(); }, [bulk]);

  const left = codes.length;
  const untouched = left === 0 && used === 0;

  function add(list) {
    const fresh = list.filter(c => !codes.includes(c));
    const dupes = list.length - fresh.length;
    if (fresh.length) onChange([...codes, ...fresh]);
    setNote(
      dupes > 0
        ? `${fresh.length} код кошулду, ${dupes} кайталанганы өткөрүлдү`
        : fresh.length ? `${fresh.length} код кошулду` : 'Бул код мурунтан бар',
    );
  }

  function addOne() {
    const code = clean(draft);
    if (!code) return;
    add([code]);
    setDraft('');
    focusDraft();
  }

  function addBulk() {
    const list = split(bulkText);
    if (!list.length) return setNote('Код табылган жок');
    add(list);
    setBulkText('');
    setBulk(false);
  }

  return (
    <Field label="Промокоддор — сыйлыктын запасы">
      {/* The headline number, because it is the one an operator opens this
          screen to check. Red when the shop has stopped selling. */}
      <div
        className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl mb-2.5"
        style={
          untouched
            ? { background: '#12141c', border: '1px solid #1e293b' }
            : left === 0
              ? { background: 'rgba(239,68,68,0.10)', border: '1.5px solid rgba(239,68,68,0.45)' }
              : { background: 'rgba(88,204,2,0.10)', border: '1.5px solid rgba(88,204,2,0.35)' }
        }
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {left === 0 && !untouched && <PackageX size={17} className="shrink-0" style={{ color: '#ef4444' }} />}
          <div className="min-w-0">
            <p
              className="font-extrabold text-[15px] leading-tight"
              style={{ color: untouched ? '#94a3b8' : left === 0 ? '#ef4444' : '#58CC02' }}
            >
              {untouched ? 'Код кошулган эмес' : left === 0 ? 'Бүттү — толтуруңуз' : `${left} код калды`}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {untouched
                ? 'Чексиз сатылат. Код кошсоңуз, ошол сан запаска айланат.'
                : `Сатылганы: ${used}`}
            </p>
          </div>
        </div>
        {left > 0 && (
          <span className="font-mono text-2xl font-bold shrink-0" style={{ color: '#58CC02' }}>{left}</span>
        )}
      </div>

      {codes.length > 0 && (
        <div
          className="rounded-xl overflow-hidden mb-2.5 max-h-72 overflow-y-auto"
          style={{ background: '#0f172a', border: '1px solid #1e293b' }}
        >
          {codes.map((code, i) => (
            <div
              key={code}
              className="flex items-center gap-3 px-3 py-2"
              style={i ? { borderTop: '1px solid #161f31' } : undefined}
            >
              <span className="font-mono text-[11px] text-slate-600 w-7 shrink-0 text-right tabular-nums">
                {i + 1}
              </span>
              <span className="font-mono text-[13px] font-bold text-white flex-1 truncate">{code}</span>
              <button
                type="button"
                onClick={() => onChange(codes.filter(c => c !== code))}
                title="Бул кодду өчүрүү"
                className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {bulk ? (
        <div className="flex flex-col gap-2">
          <textarea
            ref={bulkRef}
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            rows={6}
            placeholder={'Ар бир сапка бир код:\nMBANK-0001\nMBANK-0002\nMBANK-0003'}
            className="w-full px-3 py-2 rounded-lg text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none resize-y"
            style={{ background: '#12141c', border: '1px solid rgba(255,255,255,0.08)' }}
          />
          <div className="flex items-center gap-2">
            <Button onClick={addBulk}>{split(bulkText).length || 0} кодду кошуу</Button>
            <Button variant="ghost" onClick={() => { setBulk(false); setBulkText(''); }}>Жокко чыгаруу</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <TextInput
            id={inputId}
            value={draft}
            onChange={e => setDraft(clean(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOne(); } }}
            placeholder="MBANK-0001"
            maxLength={40}
            className="w-56 font-mono"
          />
          <Button variant="ghost" onClick={addOne}>
            <Plus size={14} /> Кошуу
          </Button>
          <button
            type="button"
            onClick={() => setBulk(true)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-sky-400 transition-colors"
          >
            <ClipboardPaste size={12} /> Топтоп чаптоо
          </button>
        </div>
      )}

      {note && <p className="text-[11px] text-slate-500 mt-1.5">{note}</p>}

      <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
        Сатылган код тизмеден чыгып кетет — калгандары өйдө жылат. Тизме
        бошогондо сыйлык дүкөндө «Бүттү» болуп, сатылбай калат.
      </p>
    </Field>
  );
}
