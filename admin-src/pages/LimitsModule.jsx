// admin-src/pages/LimitsModule.jsx — Module В: "Daily Cap Protection".
// Two numbers: how many free lessons a student gets per day, and how many
// partner-sponsored prizes the whole app can hand out per day before the
// "Экономика" из манифеста ("выдает ровно 5 чашек кофе в день") kicks in
// and blocks redemption until midnight.
import { useState, useEffect } from 'react';
import { Sliders, Gift, Zap } from 'lucide-react';
import * as api from '../api.js';
import { Card, Field, TextInput, Button, ErrorNote } from '../components/ui.jsx';

export default function LimitsModule({ token, onAuthError }) {
  const [limits, setLimits] = useState(null);
  const [dailyFreeLessons, setDailyFreeLessons] = useState(3);
  const [dailyPrizeCap, setDailyPrizeCap] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.fetchLimits(token)
      .then(l => {
        setLimits(l);
        setDailyFreeLessons(l.dailyFreeLessons);
        setDailyPrizeCap(l.dailyPrizeCap);
      })
      .catch(e => { if (e.status === 401) onAuthError(); else setError(e.message); })
      .finally(() => setLoading(false));
  }, [token, onAuthError]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.saveLimits(token, { dailyFreeLessons, dailyPrizeCap });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-400">Жүктөлүүдө...</p>;

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <h2 className="text-lg font-extrabold text-white mb-1">Күндүк лимиттер</h2>
        <p className="text-xs text-slate-500">Зумерлер призды бир сааттын ичинде тазалап кетпеши үчүн.</p>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Zap size={16} color="#1CB0F6" />
          <span className="text-sm font-bold text-white">Күнүнө акысыз сабак</span>
        </div>
        <Field label="Лимит">
          <TextInput type="number" min={1} value={dailyFreeLessons} onChange={e => setDailyFreeLessons(e.target.value)} className="w-32" />
        </Field>
        <p className="text-xs text-slate-500">Ушул сандан ашык сабак өткөндөн кийин студент "Жаңы энергия эртеге чыгат" экранын көрөт (же монета менен толтура алат).</p>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Gift size={16} color="#FFD700" />
          <span className="text-sm font-bold text-white">Күнүнө сыйлык лимити</span>
        </div>
        <Field label="Лимит (бардык колдонуучулар үчүн жалпы)">
          <TextInput type="number" min={1} value={dailyPrizeCap} onChange={e => setDailyPrizeCap(e.target.value)} className="w-32" />
        </Field>
        {limits && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: '#0b1220' }}>
            <Sliders size={14} color="#94a3b8" />
            <span className="text-xs text-slate-300">
              Бүгүн берилди: <span className="font-extrabold text-white">{limits.redeemedToday}</span> / {dailyPrizeCap}
            </span>
          </div>
        )}
        <p className="text-xs text-slate-500">Лимитке жеткенде "Обменять" баскычы бардык колдонуучулар үчүн 00:00гө чейин бөгөттөлөт.</p>
      </Card>

      <ErrorNote>{error}</ErrorNote>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} loading={saving}>Сактоо</Button>
        {saved && <span className="text-xs font-semibold" style={{ color: '#58CC02' }}>✓ Сакталды</span>}
      </div>
    </div>
  );
}
