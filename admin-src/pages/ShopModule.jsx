// admin-src/pages/ShopModule.jsx — Task 12: the coin-shop items (energy
// refills, streak shields, XP boosts, VIP badges…) used to be a fixed,
// hardcoded-by-id catalog with zero admin control. They're now unlimited
// and effect-driven, same pattern as achievements' rule engine: an item
// declares one of a few `effect`s and routes.js#/u/me/buy dispatches on
// THAT, not on which specific item id was bought — so the admin can add,
// rename, re-price, or retire items freely without touching code.
import { useState } from 'react';
import { Plus, Trash2, ShoppingBag, Zap, Shield, TrendingUp, Crown } from 'lucide-react';
import * as api from '../api.js';
import { Card, Field, TextInput, Select, Button, EmptyState, ErrorNote, TrilingualInput, ImageUpload, previewText } from '../components/ui.jsx';
import IconPicker from '../components/IconPicker.jsx';

const EFFECTS = [
  { value: 'energy_refill', label: 'Энергия толтуруу (кайра сатып алса болот)', icon: Zap },
  { value: 'streak_shield', label: 'Стрик коргоочу (бир жолу, түбөлүккө)', icon: Shield },
  { value: 'xp_boost',      label: 'XP күчөткүч (бир жолу, түбөлүккө)', icon: TrendingUp },
  { value: 'vip_badge',     label: 'VIP белги (бир жолу, түбөлүккө)', icon: Crown },
];

function kyOf(v) {
  return (typeof v === 'string' ? v : v?.ky || '').trim();
}

function effectIcon(effect) {
  return EFFECTS.find(e => e.value === effect)?.icon || ShoppingBag;
}

function ItemForm({ token, item, onDone, onCancel }) {
  const [title, setTitle] = useState(item?.title || { ky: '', ru: '', en: '' });
  const [desc, setDesc] = useState(item?.desc || { ky: '', ru: '', en: '' });
  const [price, setPrice] = useState(item?.price ?? 50);
  const [effect, setEffect] = useState(item?.effect || EFFECTS[0].value);
  const [iconUrl, setIconUrl] = useState(item?.iconUrl || '');
  // Built-in glyph slug — the alternative to an uploaded icon, never both.
  const [icon, setIcon] = useState(item?.icon || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!kyOf(title)) return setError('Товардын аталышы керек');
    setSaving(true);
    setError('');
    try {
      const body = { title, desc, price, effect, iconUrl: iconUrl || null, icon };
      if (item) await api.updateShopItem(token, item.id, body);
      else await api.createShopItem(token, body);
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
      <IconPicker
        label="Иконка (милдеттүү эмес)"
        token={token}
        icon={icon}
        iconUrl={iconUrl}
        onChange={next => { setIcon(next.icon); setIconUrl(next.iconUrl); }}
        uploadVariant="inline"
        emptyIcon={ShoppingBag}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Эффект">
          <Select value={effect} onChange={e => setEffect(e.target.value)}>
            {EFFECTS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </Select>
        </Field>
        <Field label="Баасы (монета)">
          <TextInput type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} />
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

export default function ShopModule({ token, content, reload }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // 'new' | item | null
  const items = content.shop_items || [];

  const handleDelete = async (item) => {
    if (!confirm(`"${previewText(item.title)}" товарын өчүрөсүзбү?`)) return;
    await api.deleteShopItem(token, item.id);
    reload();
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-white mb-1">Дүкөн</h2>
          <p className="text-xs text-slate-500">Монетага сатылуучу товарлар — код өзгөртпөй чексиз кошо/өчүрө аласыз.</p>
        </div>
        <Button variant="ghost" onClick={() => { setEditing('new'); setShowForm(true); }}>
          <Plus size={14} /> Жаңы товар
        </Button>
      </div>

      {showForm && (
        <ItemForm
          token={token}
          item={editing === 'new' ? null : editing}
          onDone={() => { setShowForm(false); reload(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {items.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Азырынча товар жок" />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(item => {
            const Icon = effectIcon(item.effect);
            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#12141c', border: '1px solid rgba(255,255,255,0.08)' }}>
                {item.iconUrl
                  ? <img src={item.iconUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  : <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#0b1220' }}><Icon size={16} color="#1CB0F6" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{previewText(item.title)}</p>
                  <p className="text-[11px] text-slate-500 truncate">{EFFECTS.find(e => e.value === item.effect)?.label || item.effect} · 🪙 {item.price}</p>
                </div>
                <button onClick={() => { setEditing(item); setShowForm(true); }} className="text-xs font-semibold" style={{ color: '#1CB0F6' }}>Түзөтүү</button>
                <button onClick={() => handleDelete(item)} className="p-1" style={{ color: '#f87171' }}><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
