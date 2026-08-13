// admin-src/pages/PartnersModule.jsx — Module Б: B2B partner manager.
// Add/remove sponsor banks & shops, and each partner's redeemable prize
// catalog (photo, description, price in coins). Deleting a partner cascades
// — its prizes vanish from the marketplace immediately (contentStore.js
// enforces this server-side too, this is just the confirm copy matching it).
import { useState } from 'react';
import { Plus, Trash2, Building2, Gift } from 'lucide-react';
import * as api from '../api.js';
import { Card, Field, TextInput, Button, EmptyState, ErrorNote, TrilingualInput, ImageUpload, previewText } from '../components/ui.jsx';

function kyOf(v) {
  return (typeof v === 'string' ? v : v?.ky || '').trim();
}

function PartnerForm({ token, partner, onDone, onCancel }) {
  const [name, setName] = useState(partner?.name || { ky: '', ru: '', en: '' });
  const [logoUrl, setLogoUrl] = useState(partner?.logoUrl || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!kyOf(name)) return setError('Партнёрдун аты керек');
    setSaving(true);
    setError('');
    try {
      const body = { name, logoUrl: logoUrl || null };
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
      <TrilingualInput label="Партнёрдун аты" value={name} onChange={setName} kyRequired />
      <Field label="Логотип">
        <ImageUpload token={token} url={logoUrl} onChange={setLogoUrl} variant="inline" shape="circle" emptyIcon={Building2} />
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
  const [title, setTitle] = useState(prize?.title || { ky: '', ru: '', en: '' });
  const [description, setDescription] = useState(prize?.description || { ky: '', ru: '', en: '' });
  const [photoUrl, setPhotoUrl] = useState(prize?.photoUrl || '');
  const [priceCoins, setPriceCoins] = useState(prize?.priceCoins ?? 100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!kyOf(title)) return setError('Сыйлыктын аты керек');
    setSaving(true);
    setError('');
    try {
      const body = { partnerId, title, description, photoUrl: photoUrl || null, priceCoins };
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
      <TrilingualInput label="Сыйлыктын аты" value={title} onChange={setTitle} kyRequired />
      <TrilingualInput label="Сүрөттөмө" value={description} onChange={setDescription} multiline />
      <Field label="Сүрөт">
        <ImageUpload token={token} url={photoUrl} onChange={setPhotoUrl} variant="block" />
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
    if (!confirm(`"${previewText(p.name)}" партнёрун өчүрөсүзбү?${warn}`)) return;
    await api.deletePartner(token, p.id);
    if (selectedId === p.id) setSelectedId(null);
    reload();
  };

  const handleDeletePrize = async (prize) => {
    if (!confirm(`"${previewText(prize.title)}" сыйлыгын өчүрөсүзбү?`)) return;
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
            <span className="flex-1 min-w-0 text-sm font-semibold text-white truncate">{previewText(p.name)}</span>
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
                <h2 className="text-lg font-extrabold text-white">{previewText(partner.name)}</h2>
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
                          <p className="text-sm font-semibold text-white">{previewText(prize.title)}</p>
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
