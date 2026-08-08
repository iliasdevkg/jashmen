// admin-src/pages/LeaguesModule.jsx — leagues are pure data (name, emoji,
// color, XP threshold), so admin gets unlimited add/edit/delete straight
// away. Sorted by minXp so the ladder always reads top-to-bottom correctly.
import { useState } from 'react';
import { Plus, Trash2, Trophy } from 'lucide-react';
import * as api from '../api.js';
import { Card, Field, TextInput, Button, EmptyState, ErrorNote } from '../components/ui.jsx';

function LeagueForm({ token, league, onDone, onCancel }) {
  const [name, setName] = useState(league?.name || '');
  const [emoji, setEmoji] = useState(league?.emoji || '🏅');
  const [color, setColor] = useState(league?.color || '#1CB0F6');
  const [minXp, setMinXp] = useState(league?.minXp ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return setError('Лиганын аты керек');
    setSaving(true);
    setError('');
    try {
      const body = { name: name.trim(), emoji, color, minXp };
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
      <div className="grid grid-cols-[1fr_80px] gap-3">
        <Field label="Лиганын аты">
          <TextInput value={name} onChange={e => setName(e.target.value)} placeholder="Мис. Платина" />
        </Field>
        <Field label="Эмодзи">
          <TextInput value={emoji} onChange={e => setEmoji(e.target.value)} className="text-center text-lg" />
        </Field>
      </div>
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
    if (!confirm(`"${league.name}" лигасын өчүрөсүзбү?`)) return;
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
              <span className="text-2xl">{l.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{l.name}</p>
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
