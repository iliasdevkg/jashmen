// admin-src/pages/RetentionModule.jsx — "come back" push campaigns. Each
// rule is a day-threshold + message: "N days inactive → send this push".
// Mirrors AchievementsModule's rule-CRUD pattern exactly, deliberately
// simpler (one number, not five rule types) since "days since they left"
// is the only lever a re-engagement campaign needs — see
// admin-api/push.js#sendRetentionReminders for how a rule actually fires.
import { useState, useEffect } from 'react';
import { Plus, Trash2, BellRing, Send, Check, X } from 'lucide-react';
import * as api from '../api.js';
import { Card, Field, TextInput, Button, EmptyState, ErrorNote, TrilingualInput, previewText } from '../components/ui.jsx';

function kyOf(v) {
  return (typeof v === 'string' ? v : v?.ky || '').trim();
}

function RuleForm({ token, rule, onDone, onCancel }) {
  const [daysInactive, setDaysInactive] = useState(rule?.daysInactive ?? 3);
  const [title, setTitle] = useState(rule?.title || { ky: 'JashMen', ru: '', en: '' });
  const [body, setBody] = useState(rule?.body || { ky: '', ru: '', en: '' });
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!kyOf(body)) return setError('Билдирүүнүн тексти керек');
    setSaving(true);
    setError('');
    try {
      const payload = { daysInactive, title, body, enabled };
      if (rule) await api.updateRetentionRule(token, rule.id, payload);
      else await api.createRetentionRule(token, payload);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <Field label="Канча күн кирбесе">
        <TextInput type="number" min={1} value={daysInactive} onChange={e => setDaysInactive(e.target.value)} className="w-32" />
      </Field>
      <TrilingualInput label="Билдирүүнүн аталышы" value={title} onChange={setTitle} kyRequired />
      <TrilingualInput label="Билдирүүнүн тексти" value={body} onChange={setBody} kyRequired multiline />
      <button
        type="button"
        onClick={() => setEnabled(v => !v)}
        className="flex items-center gap-2 self-start text-xs font-semibold px-3 py-2 rounded-lg"
        style={enabled
          ? { background: '#58CC0220', border: '1.5px solid #58CC02', color: '#58CC02' }
          : { background: '#0f172a', border: '1.5px solid #334155', color: '#64748b' }}
      >
        {enabled ? <Check size={13} /> : <X size={13} />}
        {enabled ? 'Күйгүзүлгөн' : 'Өчүрүлгөн'}
      </button>
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2">
        <Button onClick={handleSave} loading={saving}>Сактоо</Button>
        <Button variant="ghost" onClick={onCancel}>Жокко чыгаруу</Button>
      </div>
    </Card>
  );
}

export default function RetentionModule({ token, content, reload }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [pushEnabled, setPushEnabled] = useState(true);

  useEffect(() => {
    api.fetchPushStatus(token).then(s => setPushEnabled(s.enabled)).catch(() => {});
  }, [token]);

  const rules = content.retentionRules || [];

  const handleDelete = async (rule) => {
    if (!confirm(`"${previewText(rule.title)}" эрежесин өчүрөсүзбү?`)) return;
    await api.deleteRetentionRule(token, rule.id);
    reload();
  };

  const handleToggle = async (rule) => {
    await api.updateRetentionRule(token, rule.id, { enabled: !rule.enabled });
    reload();
  };

  const handleSendNow = async () => {
    setSending(true);
    setResult(null);
    try {
      const r = await api.sendRetentionRemindersNow(token);
      setResult(r);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-white mb-1">Кармап калуу (Retention)</h2>
          <p className="text-xs text-slate-500">
            Колдонуучу N күн кирбей калса, автоматтык push жиберилет. Код өзгөртпөй чексиз эреже кошо аласыз.
          </p>
        </div>
        <Button variant="ghost" onClick={() => { setEditing('new'); setShowForm(true); }}>
          <Plus size={14} /> Жаңы эреже
        </Button>
      </div>

      {!pushEnabled && (
        <div className="rounded-xl px-4 py-3 text-xs" style={{ background: '#2d1515', border: '1.5px solid #7f1d1d', color: '#fca5a5' }}>
          Push notifications VAPID ачкычтары коюлган эмес — эрежелерди түзсөң да, чыныгы билдирүү жиберилбейт.
          admin-api/.env'де VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY орнотуу керек.
        </div>
      )}

      {showForm && (
        <RuleForm
          token={token}
          rule={editing === 'new' ? null : editing}
          onDone={() => { setShowForm(false); reload(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {rules.length === 0 ? (
        <EmptyState icon={BellRing} title="Азырынча эреже жок" desc="Биринчи эрежени кошуп, колдонуучуларды кайра тартып ал" />
      ) : (
        <div className="flex flex-col gap-2">
          {[...rules].sort((a, b) => a.daysInactive - b.daysInactive).map(rule => (
            <div key={rule.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#12141c', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => handleToggle(rule)}
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={rule.enabled
                  ? { background: '#58CC0220', border: '1.5px solid #58CC02', color: '#58CC02' }
                  : { background: '#0f172a', border: '1.5px solid #334155', color: '#475569' }}
                title={rule.enabled ? 'Өчүрүү' : 'Күйгүзүү'}
              >
                {rule.enabled ? <Check size={14} /> : <X size={14} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{rule.daysInactive} күн кирбесе → {previewText(rule.title)}</p>
                <p className="text-[11px] text-slate-500 truncate">{previewText(rule.body)}</p>
              </div>
              <button onClick={() => { setEditing(rule); setShowForm(true); }} className="text-xs font-semibold shrink-0" style={{ color: '#1CB0F6' }}>Түзөтүү</button>
              <button onClick={() => handleDelete(rule)} className="p-1 shrink-0" style={{ color: '#f87171' }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 flex flex-col gap-2" style={{ borderTop: '1px solid #1e293b' }}>
        <Button variant="ghost" className="self-start" onClick={handleSendNow} loading={sending}>
          <Send size={14} /> Азыр текшерип жибер
        </Button>
        {result && (
          result.error
            ? <ErrorNote>{result.error}</ErrorNote>
            : <p className="text-xs text-slate-500">
                {result.candidateUsers} колдонуучу дал келди · {result.sent} билдирүү жиберилди
                {result.removedDead > 0 && ` · ${result.removedDead} жараксыз жазылуу өчүрүлдү`}
              </p>
        )}
      </div>
    </div>
  );
}
