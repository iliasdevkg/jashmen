// admin-src/pages/LimitsModule.jsx — Module В: "Daily Cap Protection", now
// expanded (Task 12) to cover EVERY previously-hardcoded gameplay/economy
// constant, not just the two daily caps. Every number here used to live as
// a magic constant in routes.js/energy.js; now it's a single source of
// truth in contentStore.js#getLimits(), so the whole game economy — energy,
// XP formula, coin payouts — is tunable from the admin panel with zero code
// changes and zero deploys.
import { useState, useEffect } from 'react';
import { Sliders, Zap, Star, Coins } from 'lucide-react';
import * as api from '../api.js';
import { Card, Field, TextInput, Button, ErrorNote } from '../components/ui.jsx';

// Each field: key in the limits object, label, help text, min bound, and
// which section it belongs under. `pct` fields are stored as whole-number
// percents (e.g. 125 = ×1.25) so the input is a plain integer, not a decimal.
const SECTIONS = [
  {
    title: 'Күнүнө энергия', icon: Zap, color: '#1CB0F6',
    fields: [
      { key: 'energyRefillHours', label: 'Энергия канча сааттан кийин толот', min: 1, suffix: 'саат', help: 'Энергия ушул сааттар өткөн сайын толот: 24 = күнүнө бир жолу (UTC түн ортосунда), 8 = күнүнө үч жолу. Төмөнкү сандар ушул мезгилдин ичинде эсептелет.' },
      { key: 'dailyFreeLessons', label: 'Бир мезгилде акысыз сабак саны', min: 1, help: 'Ушул сандан ашык сабак өткөндөн кийин студент "Жаңы энергия чыгат" экранын көрөт.' },
      { key: 'maxBonusEnergyPerDay', label: 'Монетага сатылып алынуучу кошумча энергиянын чеги', min: 0, help: '"Дүкөн" бөлүмүндөгү энергия толтуруучу товар бир мезгилде канча жолу сатылып алынышы мүмкүн.' },
      { key: 'supportEnergyAmount', label: 'Көрүүчү студентке бере турган энергия', min: 1, help: 'Университет лигасында "зритель" болуп кирген адам студентке бир мезгилде бир жолу ушунча энергия бере алат. Энергия көрүүчүнүн өз запасынан алынат.' },
      { key: 'streakRepairEnergy', label: 'Үзүлгөн серияны кайтаруунун баасы (энергия)', min: 0, max: 10, help: 'Күн өткөрүп жиберип серияны жоготкон студент ошол эле күнү ушунча энергия сарптап аны кайтарып ала алат. Эртеси мүмкүн эмес. 0 койсоңуз — кайтаруу таптакыр өчүрүлөт, жоготкон сериясы 0 бойдон калат.' },
    ],
  },
  {
    title: 'XP формуласы', icon: Star, color: '#FFD700',
    fields: [
      { key: 'xpPerQuestion', label: 'Суроо башына XP', min: 0, help: 'Сабактагы суроолордун санына көбөйтүлүп, негизги XPти берет.' },
      { key: 'xpMistakePenalty', label: 'Ар бир каталык үчүн XP кемиши', min: 0, help: 'Негизги XPтен ар бир каталык боюнча ушунча XP кемийт.' },
      { key: 'xpMinFloorPct', label: 'Минималдуу XP чеги (%)', min: 0, suffix: '%', help: 'Канча көп ката кетирсе да, негизги XPтин ушул пайызынан кем берилбейт.' },
      { key: 'xpPerfectBonusPct', label: 'Ката жок сабак үчүн бонус (%)', min: 0, suffix: '%', help: 'Бир да ката кетирилбесе, негизги XPтин ушул пайызы кошумча берилет.' },
      { key: 'xpBoostMultiplierPct', label: '"XP күчөткүч" эффектинин көбөйтүүчүсү (%)', min: 100, suffix: '%', help: '125% = 1.25x. Дүкөндөн xp_boost эффектүү товар сатып алган колдонуучуга колдонулат.' },
      { key: 'xpPerReview', label: 'Кайталоо сабагы үчүн XP', min: 0, help: 'Аяктаган сабакты кайра өткөндө берилет. Суроонун санына көз каранды эмес жана энергия сарптабайт. 0 койсоңуз, кайталоо эч нерсе бербейт.' },
    ],
  },
  {
    title: 'Монета сыйлыгы', icon: Coins, color: '#58CC02',
    fields: [
      { key: 'coinsPerfectLesson', label: 'Ката жок сабак үчүн монета', min: 0 },
      { key: 'coinsNormalLesson', label: 'Кадимки сабак үчүн монета', min: 0 },
    ],
  },
];

// The "Күндүк сыйлык лимити" section used to sit here — one house-wide
// ceiling on how many prizes could be claimed a day. It predates promo-code
// stock: back then nothing limited how many coupons a prize could issue, so
// a daily cap was the only brake. Every prize now carries its own finite
// pool of codes (Өнөктөштөр → Каталог), which is a real inventory, and the
// ceiling only stopped people claiming prizes that were genuinely in stock.

const ALL_KEYS = SECTIONS.flatMap(s => s.fields.map(f => f.key));

export default function LimitsModule({ token, onAuthError }) {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.fetchLimits(token)
      .then(l => setValues(Object.fromEntries(ALL_KEYS.map(k => [k, l[k]]))))
      .catch(e => { if (e.status === 401) onAuthError(); else setError(e.message); })
      .finally(() => setLoading(false));
  }, [token, onAuthError]);

  const setField = (key, v) => setValues(prev => ({ ...prev, [key]: v }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const saved = await api.saveLimits(token, values);
      setLimits(saved);
      setValues(Object.fromEntries(ALL_KEYS.map(k => [k, saved[k]])));
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
        <h2 className="text-lg font-extrabold text-white mb-1">Лимиттер жана экономика</h2>
        <p className="text-xs text-slate-500">Оюндун бардык сандары — энергия, XP формуласы, монета — бул жерден башкарылат. Код өзгөртүлбөйт, деплой керек эмес.</p>
      </div>

      {SECTIONS.map(section => (
        <Card key={section.title} className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <section.icon size={16} color={section.color} />
            <span className="text-sm font-bold text-white">{section.title}</span>
          </div>
          {section.fields.map(f => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <Field label={f.label}>
                <div className="flex items-center gap-2">
                  <TextInput
                    type="number"
                    min={f.min}
                    max={f.max}
                    value={values[f.key] ?? ''}
                    onChange={e => setField(f.key, e.target.value)}
                    className="w-32"
                  />
                  {f.suffix && <span className="text-xs text-slate-500">{f.suffix}</span>}
                </div>
              </Field>
              {f.help && <p className="text-xs text-slate-500">{f.help}</p>}
            </div>
          ))}
        </Card>
      ))}

      <ErrorNote>{error}</ErrorNote>

      <div className="flex items-center gap-3 sticky bottom-4">
        <Button onClick={handleSave} loading={saving}>Сактоо</Button>
        {saved && <span className="text-xs font-semibold" style={{ color: '#58CC02' }}>✓ Сакталды</span>}
      </div>
    </div>
  );
}
