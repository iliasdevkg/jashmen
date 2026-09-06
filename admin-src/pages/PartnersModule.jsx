// admin-src/pages/PartnersModule.jsx — Module Б: B2B partner manager.
// Add/remove sponsor banks & shops, and each partner's redeemable prize
// catalog (photo, description, price in coins). Deleting a partner cascades
// — its prizes vanish from the marketplace immediately (contentStore.js
// enforces this server-side too, this is just the confirm copy matching it).
import { useState } from 'react';
import { Plus, Trash2, Building2, Gift, X } from 'lucide-react';
import * as api from '../api.js';
import { Card, Field, TextInput, Button, EmptyState, ErrorNote, TrilingualInput, ImageUpload, previewText } from '../components/ui.jsx';
import RedemptionsPanel from '../components/RedemptionsPanel.jsx';
import PromoCodePool from '../components/PromoCodePool.jsx';
import PrizeAnalytics from '../components/PrizeAnalytics.jsx';

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
  const [promoCodes, setPromoCodes] = useState(() => prize?.promoCodes || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!kyOf(title)) return setError('Сыйлыктын аты керек');
    setSaving(true);
    setError('');
    try {
      // Sent even when empty — that is how removing every code clears the
      // pool (contentStore.js#updatePrize). `codesUsed` is deliberately not
      // sent: it is the server's tally of what was actually sold.
      const body = {
        partnerId, title, description, photoUrl: photoUrl || null, priceCoins, promoCodes,
      };
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
      <PromoCodePool
        codes={promoCodes}
        used={prize?.codesUsed || 0}
        onChange={setPromoCodes}
      />
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2">
        <Button onClick={handleSave} loading={saving}>Сактоо</Button>
        <Button variant="ghost" onClick={onCancel}>Жокко чыгаруу</Button>
      </div>
    </Card>
  );
}

/// How much of this prize is left to sell, in the catalogue grid. A prize
/// with no codes at all is not "sold out" — it never had a stock to run
/// down, so it says nothing rather than claiming a number it does not have.
function StockBadge({ prize }) {
  const codes = prize.promoCodes || [];
  const used = prize.codesUsed || 0;
  if (codes.length === 0 && used === 0) return null;

  const out = codes.length === 0;
  return (
    <p
      className="text-[11px] font-bold px-1.5 py-0.5 rounded self-start"
      style={out
        ? { background: 'rgba(239,68,68,0.12)', color: '#ef4444' }
        : { background: 'rgba(88,204,2,0.12)', color: '#58CC02' }}
    >
      {out ? 'Бүттү' : `${codes.length} код калды`}
      {used > 0 && <span className="font-normal opacity-70"> · {used} сатылды</span>}
    </p>
  );
}

// Two halves of the same job: the catalogue an operator publishes, and the
// coupons learners actually redeemed from it.
const SECTIONS = [
  { id: 'catalogue',   label: 'Каталог' },
  { id: 'redemptions', label: 'Сыйлык алгандар' },
  { id: 'analytics',   label: 'Аналитика' },
];

export default function PartnersModule({ token, content, reload, onAuthError }) {
  const [section, setSection] = useState('catalogue');
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
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
        {SECTIONS.map(sec => (
          <button
            key={sec.id}
            onClick={() => setSection(sec.id)}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            style={section === sec.id
              ? { background: '#1CB0F6', color: '#fff' }
              : { background: 'transparent', color: '#64748b' }}
          >
            {sec.label}
          </button>
        ))}
      </div>

      {section === 'analytics' ? (
        <PrizeAnalytics token={token} onAuthError={onAuthError} />
      ) : section === 'redemptions' ? (
        <RedemptionsPanel token={token} onAuthError={onAuthError} />
      ) : (
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
              ? <img src={p.logoUrl} alt="" className="w-6 h-6 rounded-full object-contain shrink-0" style={{ background: '#0b1220' }} />
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
                {partner.logoUrl && <img src={partner.logoUrl} alt="" className="w-10 h-10 rounded-full object-contain" style={{ background: '#0b1220' }} />}
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
                        {/* The whole photo, not a crop — this is the catalogue
                            the operator checks their own artwork in. */}
                        {prize.photoUrl && (
                          <div className="w-full h-24 flex items-center justify-center" style={{ background: '#0b1220' }}>
                            <img src={prize.photoUrl} alt="" className="max-w-full max-h-full object-contain" />
                          </div>
                        )}
                        <div className="p-3 flex flex-col gap-2">
                          <p className="text-sm font-semibold text-white">{previewText(prize.title)}</p>
                          <p className="text-xs font-bold" style={{ color: '#1CB0F6' }}>🪙 {prize.priceCoins}</p>
                          <StockBadge prize={prize} />
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
      )}
    </div>
  );
}
