// admin-src/pages/LeaguesModule.jsx — leagues are pure data (name, icon,
// color, XP threshold), so admin gets unlimited add/edit/delete straight
// away. Sorted by minXp so the ladder always reads top-to-bottom correctly.
//
// Task 10: an uploaded icon is OPTIONAL — the built-in leagues (student,
// savings, investor, …) keep their bespoke hand-drawn gem badges on web,
// and mobile already renders league.iconUrl when present. This is purely
// for leagues the admin adds beyond the built-in set, or to override one.
import { useState } from 'react';
import { Plus, Trash2, Trophy } from 'lucide-react';
import * as api from '../api.js';
import { Card, Field, TextInput, Button, EmptyState, ErrorNote, TrilingualInput, ImageUpload, previewText } from '../components/ui.jsx';
import IconPicker from '../components/IconPicker.jsx';

function kyOf(v) {
  return (typeof v === 'string' ? v : v?.ky || '').trim();
}

function LeagueForm({ token, league, onDone, onCancel }) {
  const [name, setName] = useState(league?.name || { ky: '', ru: '', en: '' });
  const [iconUrl, setIconUrl] = useState(league?.iconUrl || '');
  // Built-in glyph slug — the alternative to an uploaded badge, never both.
  const [icon, setIcon] = useState(league?.icon || null);
  const [color, setColor] = useState(league?.color || '#1CB0F6');
  const [minXp, setMinXp] = useState(league?.minXp ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!kyOf(name)) return setError('Лиганын аты керек');
    setSaving(true);
    setError('');
    try {
      const body = { name, iconUrl: iconUrl || null, icon, color, minXp };
      if (league) await api.updateLeague(token, league.id, body);
      else await api.createLeague(token, body);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <TrilingualInput label="Лиганын аты" value={name} onChange={setName} kyRequired />
      <IconPicker
        label="Өзгөчө иконка (милдеттүү эмес — коюлбаса даяр гем-белги колдонулат)"
        token={token}
        icon={icon}
        iconUrl={iconUrl}
        onChange={next => { setIcon(next.icon); setIconUrl(next.iconUrl); }}
        emptyIcon={Trophy}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Керектүү XP (минимум)">
          <TextInput type="number" min={0} value={minXp} onChange={e => setMinXp(e.target.value)} />
        </Field>
        <Field label="Түс">
          <div className="flex items-center gap-2">
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer" style={{ background: 'transparent', border: 'none' }} />
            <TextInput value={color} onChange={e => setColor(e.target.value)} className="flex-1" />
          </div>
        </Field>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2">
        <Button onClick={handleSave} loading={saving}>Сактоо</Button>
        <Button variant="ghost" onClick={onCancel}>Жокко чыгаруу</Button>
      </div>
    </Card>
  );
}

export default function LeaguesModule({ token, content, reload }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // 'new' | league | null
  const leagues = [...content.leagues].sort((a, b) => a.minXp - b.minXp);

  const handleDelete = async (league) => {
    if (!confirm(`"${previewText(league.name)}" лигасын өчүрөсүзбү?`)) return;
    await api.deleteLeague(token, league.id);
    reload();
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-white mb-1">Лигалар</h2>
          <p className="text-xs text-slate-500">XP боюнча тепкич — чектелбеген сан кошсоңуз болот.</p>
        </div>
        <Button variant="ghost" onClick={() => { setEditing('new'); setShowForm(true); }}>
          <Plus size={14} /> Жаңы лига
        </Button>
      </div>

      {showForm && (
        <LeagueForm
          token={token}
          league={editing === 'new' ? null : editing}
          onDone={() => { setShowForm(false); reload(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {leagues.length === 0 ? (
        <EmptyState icon={Trophy} title="Азырынча лига жок" />
      ) : (
        <div className="flex flex-col gap-2">
          {leagues.map(l => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#12141c', border: `1.5px solid ${l.color}40` }}>
              {l.iconUrl
                ? <img src={l.iconUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                : <Trophy size={20} color={l.color} className="shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{previewText(l.name)}</p>
                <p className="text-[11px]" style={{ color: l.color }}>{l.minXp}+ XP</p>
              </div>
              <button onClick={() => { setEditing(l); setShowForm(true); }} className="text-xs font-semibold" style={{ color: '#1CB0F6' }}>Түзөтүү</button>
              <button onClick={() => handleDelete(l)} className="p-1" style={{ color: '#f87171' }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
