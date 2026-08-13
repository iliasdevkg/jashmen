// admin-src/pages/AchievementsModule.jsx — an achievement is a badge plus a
// *rule*, not a hardcoded id — admin can add unlimited new ones from these
// five measurable conditions without any code change (see
// admin-api/contentStore.js#evaluateAchievementRule, mirrored in
// src/utils.js so the app can preview "newly earned" instantly client-side).
//
// Task 10: the badge is an uploaded icon (iconUrl) — web/mobile both fall
// back to a vector trophy glyph when nothing is uploaded, same convention
// as lesson/module/league art.
import { useState } from 'react';
import { Plus, Trash2, Award } from 'lucide-react';
import * as api from '../api.js';
import { Card, Field, TextInput, Select, Button, EmptyState, ErrorNote, TrilingualInput, ImageUpload, previewText } from '../components/ui.jsx';

const RULE_TYPES = [
  { value: 'lessons_completed',     label: 'Аяктаган сабак саны', needsValue: true,  unit: 'сабак' },
  { value: 'streak_days',           label: 'Стрик (күн)',          needsValue: true,  unit: 'күн' },
  { value: 'xp_total',              label: 'Жалпы XP',             needsValue: true,  unit: 'XP' },
  { value: 'perfect_lesson',        label: 'Ката кетирбей сабак аяктоо', needsValue: false },
  { value: 'all_lessons_completed', label: 'Бардык сабактарды аяктоо',   needsValue: false },
];

function kyOf(v) {
  return (typeof v === 'string' ? v : v?.ky || '').trim();
}

function ruleLabel(rule) {
  const def = RULE_TYPES.find(r => r.value === rule?.type);
  if (!def) return '—';
  return def.needsValue ? `${def.label}: ${rule.value}+ ${def.unit}` : def.label;
}

function AchievementForm({ token, achievement, onDone, onCancel }) {
  const [iconUrl, setIconUrl] = useState(achievement?.iconUrl || '');
  const [title, setTitle] = useState(achievement?.title || { ky: '', ru: '', en: '' });
  const [desc, setDesc] = useState(achievement?.desc || { ky: '', ru: '', en: '' });
  const [xp, setXp] = useState(achievement?.xp ?? 20);
  const [ruleType, setRuleType] = useState(achievement?.rule?.type || 'lessons_completed');
  const [ruleValue, setRuleValue] = useState(achievement?.rule?.value ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const ruleDef = RULE_TYPES.find(r => r.value === ruleType);

  const handleSave = async () => {
    if (!kyOf(title)) return setError('Жетишкендиктин аты керек');
    setSaving(true);
    setError('');
    try {
      const rule = ruleDef.needsValue ? { type: ruleType, value: ruleValue } : { type: ruleType };
      const body = { iconUrl: iconUrl || null, title, desc, xp, rule };
      if (achievement) await api.updateAchievement(token, achievement.id, body);
      else await api.createAchievement(token, body);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <TrilingualInput label="Аталышы" value={title} onChange={setTitle} kyRequired />
      <TrilingualInput label="Сүрөттөмө" value={desc} onChange={setDesc} multiline />
      <Field label="Значка (милдеттүү эмес)">
        <ImageUpload token={token} url={iconUrl} onChange={setIconUrl} variant="inline" emptyIcon={Award} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Шарт (эреже)">
          <Select value={ruleType} onChange={e => setRuleType(e.target.value)}>
            {RULE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>
        {ruleDef?.needsValue ? (
          <Field label={`Сан (${ruleDef.unit})`}>
            <TextInput type="number" min={1} value={ruleValue} onChange={e => setRuleValue(e.target.value)} />
          </Field>
        ) : (
          <Field label="XP сыйлыгы">
            <TextInput type="number" min={0} value={xp} onChange={e => setXp(e.target.value)} />
          </Field>
        )}
      </div>
      {ruleDef?.needsValue && (
        <Field label="XP сыйлыгы">
          <TextInput type="number" min={0} value={xp} onChange={e => setXp(e.target.value)} className="w-32" />
        </Field>
      )}
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2">
        <Button onClick={handleSave} loading={saving}>Сактоо</Button>
        <Button variant="ghost" onClick={onCancel}>Жокко чыгаруу</Button>
      </div>
    </Card>
  );
}

export default function AchievementsModule({ token, content, reload }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const handleDelete = async (ach) => {
    if (!confirm(`"${previewText(ach.title)}" жетишкендигин өчүрөсүзбү?`)) return;
    await api.deleteAchievement(token, ach.id);
    reload();
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-white mb-1">Жетишкендиктер</h2>
          <p className="text-xs text-slate-500">Ар бир значка — иконка + шарт (эреже). Код өзгөртпөй чексиз кошо аласыз.</p>
        </div>
        <Button variant="ghost" onClick={() => { setEditing('new'); setShowForm(true); }}>
          <Plus size={14} /> Жаңы значка
        </Button>
      </div>

      {showForm && (
        <AchievementForm
          token={token}
          achievement={editing === 'new' ? null : editing}
          onDone={() => { setShowForm(false); reload(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {content.achievements.length === 0 ? (
        <EmptyState icon={Award} title="Азырынча значка жок" />
      ) : (
        <div className="flex flex-col gap-2">
          {content.achievements.map(ach => (
            <div key={ach.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#12141c', border: '1px solid rgba(255,255,255,0.08)' }}>
              {ach.iconUrl
                ? <img src={ach.iconUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                : <Award size={20} color="#FFD700" className="shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{previewText(ach.title)}</p>
                <p className="text-[11px] text-slate-500 truncate">{ruleLabel(ach.rule)} · +{ach.xp} XP</p>
              </div>
              <button onClick={() => { setEditing(ach); setShowForm(true); }} className="text-xs font-semibold" style={{ color: '#1CB0F6' }}>Түзөтүү</button>
              <button onClick={() => handleDelete(ach)} className="p-1" style={{ color: '#f87171' }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
