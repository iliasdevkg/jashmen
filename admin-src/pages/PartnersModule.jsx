// admin-src/pages/PartnersModule.jsx — Module Б: B2B partner manager.
// Add/remove sponsor banks & shops, and each partner's redeemable prize
// catalog (photo, description, price in coins). Deleting a partner cascades
// — its prizes vanish from the marketplace immediately (contentStore.js
// enforces this server-side too, this is just the confirm copy matching it).
import { useState } from 'react';
import { Plus, Trash2, Upload, Building2, Gift } from 'lucide-react';
import * as api from '../api.js';
import { Card, Field, TextInput, TextArea, Button, EmptyState, ErrorNote } from '../components/ui.jsx';

function LogoUpload({ token, url, onChange }) {
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url: u } = await api.uploadMedia(token, file);
      onChange(u);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="flex items-center gap-3">
      {url
        ? <img src={url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
        : <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: '#0b1220', border: '1.5px dashed #334155' }}><Building2 size={18} color="#475569" /></div>
      }
      <label className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer" style={{ background: '#0b1220', border: '1.5px solid #334155', color: '#94a3b8' }}>
        <Upload size={13} />
        {uploading ? 'Жүктөлүүдө...' : 'Лого жүктөө'}
        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      </label>
    </div>
  );
}

function PartnerForm({ token, partner, onDone, onCancel }) {
  const [name, setName] = useState(partner?.name || '');
  const [logoUrl, setLogoUrl] = useState(partner?.logoUrl || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return setError('Партнёрдун аты керек');
    setSaving(true);
    setError('');
    try {
      const body = { name: name.trim(), logoUrl: logoUrl || null };
      if (partner) await api.updatePartner(token, partner.id, body);
      else await api.createPartner(token, body);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <Field label="Партнёрдун аты">
        <TextInput value={name} onChange={e => setName(e.target.value)} placeholder="Мис. MBANK" />
      </Field>
      <Field label="Логотип">
        <LogoUpload token={token} url={logoUrl} onChange={setLogoUrl} />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2">
        <Button onClick={handleSave} loading={saving}>Сактоо</Button>
        <Button variant="ghost" onClick={onCancel}>Жокко чыгаруу</Button>
      </div>
    </Card>
  );
}

function PrizeForm({ token, partnerId, prize, onDone, onCancel }) {
  const [title, setTitle] = useState(prize?.title || '');
  const [description, setDescription] = useState(prize?.description || '');
  const [photoUrl, setPhotoUrl] = useState(prize?.photoUrl || '');
  const [priceCoins, setPriceCoins] = useState(prize?.priceCoins ?? 100);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.uploadMedia(token, file);
      setPhotoUrl(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return setError('Сыйлыктын аты керек');
    setSaving(true);
    setError('');
    try {
      const body = { partnerId, title: title.trim(), description, photoUrl: photoUrl || null, priceCoins };
      if (prize) await api.updatePrize(token, prize.id, body);
      else await api.createPrize(token, body);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <Field label="Сыйлыктын аты">
        <TextInput value={title} onChange={e => setTitle(e.target.value)} placeholder="Мис. Кофе" />
      </Field>
      <Field label="Сүрөттөмө">
        <TextArea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Кыска сүрөттөмө" />
      </Field>
      <Field label="Сүрөт">
        <div className="flex items-center gap-3">
          {photoUrl && <img src={photoUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />}
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer" style={{ background: '#0b1220', border: '1.5px solid #334155', color: '#94a3b8' }}>
            <Upload size={13} />
            {uploading ? 'Жүктөлүүдө...' : 'Сүрөт жүктөө'}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      </Field>
      <Field label="Баасы (монета)">
        <TextInput type="number" min={0} value={priceCoins} onChange={e => setPriceCoins(e.target.value)} className="w-32" />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2">
        <Button onClick={handleSave} loading={saving}>Сактоо</Button>
        <Button variant="ghost" onClick={onCancel}>Жокко чыгаруу</Button>
      </div>
    </Card>
  );
}

export default function PartnersModule({ token, content, reload }) {
  const [selectedId, setSelectedId] = useState(content.partners[0]?.id || null);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [editingPrize, setEditingPrize] = useState(null); // 'new' | prize | null

  const partner = content.partners.find(p => p.id === selectedId);
  const prizes = content.prizes.filter(p => p.partnerId === selectedId);

  const handleDeletePartner = async (p) => {
    const count = content.prizes.filter(pr => pr.partnerId === p.id).length;
    const warn = count > 0 ? ` Анын ${count} сыйлыгы да маркетплейстен дароо жоголот.` : '';
    if (!confirm(`"${p.name}" партнёрун өчүрөсүзбү?${warn}`)) return;
    await api.deletePartner(token, p.id);
    if (selectedId === p.id) setSelectedId(null);
    reload();
  };

  const handleDeletePrize = async (prize) => {
    if (!confirm(`"${prize.title}" сыйлыгын өчүрөсүзбү?`)) return;
    await api.deletePrize(token, prize.id);
    reload();
  };

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-6">
      <div className="flex flex-col gap-2">
        {content.partners.map(p => (
          <button
            key={p.id}
            onClick={() => { setSelectedId(p.id); setEditingPrize(null); setShowPartnerForm(false); }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left"
            style={selectedId === p.id
              ? { background: 'rgba(28,176,246,0.12)', border: '1.5px solid #1CB0F6' }
              : { background: '#12141c', border: '1.5px solid transparent' }}
          >
            {p.logoUrl
              ? <img src={p.logoUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
              : <Building2 size={16} color="#475569" className="shrink-0" />}
            <span className="flex-1 min-w-0 text-sm font-semibold text-white truncate">{p.name}</span>
            <span className="text-[10px] text-slate-500 shrink-0">{content.prizes.filter(pr => pr.partnerId === p.id).length}</span>
          </button>
        ))}
        <Button variant="ghost" onClick={() => { setShowPartnerForm(true); setEditingPartner(null); }}>
          <Plus size={14} /> Жаңы партнёр
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {showPartnerForm && (
          <PartnerForm
            token={token}
            partner={editingPartner}
            onDone={() => { setShowPartnerForm(false); reload(); }}
            onCancel={() => setShowPartnerForm(false)}
          />
        )}

        {!partner ? (
          <EmptyState icon={Building2} title="Партнёр тандаңыз" desc="Же жаңы банк/дүкөн кошуңуз" />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {partner.logoUrl && <img src={partner.logoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />}
                <h2 className="text-lg font-extrabold text-white">{partner.name}</h2>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setEditingPartner(partner); setShowPartnerForm(true); }}>Түзөтүү</Button>
                <Button variant="danger" onClick={() => handleDeletePartner(partner)}><Trash2 size={13} /> Өчүрүү</Button>
              </div>
            </div>

            {editingPrize ? (
              <PrizeForm
                token={token}
                partnerId={partner.id}
                prize={editingPrize === 'new' ? null : editingPrize}
                onDone={() => { setEditingPrize(null); reload(); }}
                onCancel={() => setEditingPrize(null)}
              />
            ) : (
              <>
                <h3 className="text-sm font-bold text-slate-300 -mb-2">Сыйлыктар каталогу</h3>
                {prizes.length === 0 ? (
                  <EmptyState icon={Gift} title="Азырынча сыйлык жок" />
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {prizes.map(prize => (
                      <div key={prize.id} className="rounded-xl overflow-hidden flex flex-col" style={{ background: '#12141c', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {prize.photoUrl && <img src={prize.photoUrl} alt="" className="w-full h-24 object-cover" />}
                        <div className="p-3 flex flex-col gap-2">
                          <p className="text-sm font-semibold text-white">{prize.title}</p>
                          <p className="text-xs font-bold" style={{ color: '#1CB0F6' }}>🪙 {prize.priceCoins}</p>
                          <div className="flex gap-2 mt-1">
                            <button onClick={() => setEditingPrize(prize)} className="text-xs font-semibold" style={{ color: '#1CB0F6' }}>Түзөтүү</button>
                            <button onClick={() => handleDeletePrize(prize)} className="text-xs font-semibold" style={{ color: '#f87171' }}>Өчүрүү</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="ghost" className="self-start" onClick={() => setEditingPrize('new')}>
                  <Plus size={14} /> Жаңы сыйлык
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
