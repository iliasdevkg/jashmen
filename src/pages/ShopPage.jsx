import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Gift } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import { useI18n } from '../i18n.jsx';
import * as api from '../api.js';
import ShopItemIcon from '../components/icons/ShopIcons.jsx';

function ItemCard({ item, onBuy, buying, owned, canAfford, bright }) {
  const { t } = useI18n();
  const isEnergyRefill = item.id === 'energy_refill';
  const cardBg   = bright ? '#ffffff' : '#1e293b';
  const cardBord = bright ? '#e2e8f0' : '#334155';
  const textPri  = bright ? '#0f172a' : 'white';
  const textMut  = bright ? '#64748b' : '#94a3b8';

  return (
    <motion.div
      layout
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: cardBg, border: `1.5px solid ${cardBord}` }}
    >
      <ShopItemIcon item={item} size={48} />
      <div className="flex-1">
        <p className="font-bold text-sm" style={{ color: textPri }}>{item.title}</p>
        {item.desc && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: textMut }}>{item.desc}</p>}
      </div>
      <div>
        {owned && !isEnergyRefill ? (
          <div
            className="flex items-center gap-1.5 py-2.5 px-3 rounded-xl"
            style={{ background: bright ? '#f0fdf4' : '#16301d', border: '1.5px solid #58CC02' }}
          >
            <Check size={14} color="#58CC02" />
            <span className="text-xs font-bold" style={{ color: bright ? '#15803d' : '#58CC02' }}>{t('shop.owned')}</span>
          </div>
        ) : (
          <motion.button
            whileTap={canAfford ? { scale: 0.95 } : {}}
            onClick={canAfford && !buying ? onBuy : undefined}
            disabled={buying || !canAfford}
            className="flex items-center gap-1.5 py-2.5 px-3 rounded-xl w-full justify-center font-bold text-sm transition-all"
            style={{
              background: canAfford ? '#1CB0F620' : (bright ? '#f1f5f9' : '#1e293b'),
              border: `1.5px solid ${canAfford ? '#1CB0F6' : (bright ? '#cbd5e1' : '#475569')}`,
              color: canAfford ? '#1CB0F6' : (bright ? '#94a3b8' : '#475569'),
            }}
          >
            {buying ? t('common.loading') : <><span>🪙</span><span>{item.price}</span></>}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

function PrizeCard({ prize, partner, onRedeem, redeeming, canAfford, bright }) {
  const { t } = useI18n();
  const cardBg   = bright ? '#ffffff' : '#1e293b';
  const cardBord = bright ? '#e2e8f0' : '#334155';
  const textPri  = bright ? '#0f172a' : 'white';
  const textMut  = bright ? '#64748b' : '#94a3b8';

  return (
    <motion.div
      layout
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: cardBg, border: `1.5px solid ${cardBord}` }}
    >
      {prize.photoUrl ? (
        <img src={prize.photoUrl} alt={prize.title} className="w-full h-24 object-cover" />
      ) : (
        <div className="w-full h-24 flex items-center justify-center" style={{ background: bright ? '#f1f5f9' : '#0b1220' }}>
          <Gift size={28} color={textMut} />
        </div>
      )}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex-1">
          {partner && (
            <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: '#1CB0F6' }}>
              {partner.name}
            </p>
          )}
          <p className="font-bold text-sm" style={{ color: textPri }}>{prize.title}</p>
          {prize.description && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: textMut }}>{prize.description}</p>}
        </div>
        <motion.button
          whileTap={canAfford ? { scale: 0.95 } : {}}
          onClick={canAfford && !redeeming ? onRedeem : undefined}
          disabled={redeeming || !canAfford}
          className="flex items-center gap-1.5 py-2.5 px-3 rounded-xl w-full justify-center font-bold text-sm transition-all"
          style={{
            background: canAfford ? '#58CC0220' : (bright ? '#f1f5f9' : '#1e293b'),
            border: `1.5px solid ${canAfford ? '#58CC02' : (bright ? '#cbd5e1' : '#475569')}`,
            color: canAfford ? '#58CC02' : (bright ? '#94a3b8' : '#475569'),
          }}
        >
          {redeeming ? t('common.loading') : <><span>🪙</span><span>{prize.priceCoins}</span></>}
        </motion.button>
      </div>
    </motion.div>
  );
}

function RedeemedCodeModal({ redemption, onClose, bright }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const cardBg = bright ? '#ffffff' : '#1e293b';
  const textPri = bright ? '#0f172a' : 'white';
  const textMut = bright ? '#64748b' : '#94a3b8';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(redemption.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (_) {}
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl p-6 text-center"
        style={{ background: cardBg }}
      >
        <span className="text-5xl mb-3 block">🎉</span>
        <p className="font-extrabold text-lg mb-1" style={{ color: textPri }}>{redemption.title}</p>
        <p className="text-xs mb-4" style={{ color: textMut }}>{t('shop.redeemInstructions')}</p>
        <button
          onClick={copy}
          className="w-full rounded-2xl py-4 mb-4 flex items-center justify-center gap-2 font-mono font-extrabold text-lg tracking-wider"
          style={{ background: bright ? '#f1f5f9' : '#0b1220', color: '#1CB0F6' }}
        >
          {redemption.code}
          {copied ? <Check size={16} color="#58CC02" /> : <Copy size={15} />}
        </button>
        <button onClick={onClose} className="w-full py-3 rounded-2xl font-bold text-white text-sm" style={{ background: '#58CC02' }}>
          {t('common.gotIt')}
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function ShopPage() {
  const content = useContent();
  const { token, state, updateUser } = useAuth();
  const { bright } = useBrightMode();
  const { t } = useI18n();
  const [buying, setBuying] = useState(null);
  const [redeeming, setRedeeming] = useState(null);
  const [toast, setToast] = useState(null);
  const [redeemedCode, setRedeemedCode] = useState(null);

  const items     = content?.shop_items || [];
  const prizes    = content?.prizes || [];
  const partners  = content?.partners || [];
  const coins     = state?.coins     || 0;
  const ownedShop = state?.ownedShop || [];

  const textPri  = bright ? '#0f172a' : 'white';
  const textMut  = bright ? '#64748b' : '#94a3b8';
  const cardBg   = bright ? '#ffffff' : '#1e293b';
  const cardBord = bright ? '#e2e8f0' : '#334155';

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const handleBuy = async (item) => {
    if (coins < item.price || buying) return;
    setBuying(item.id);
    try {
      const kind = item.id === 'energy_refill' ? 'energy' : 'item';
      const u = await api.buyItem(token, item.id, item.price, kind);
      updateUser(u);
      showToast(`✅ ${t('shop.buySuccess', { title: item.title })}`);
    } catch (e) {
      showToast(e.message || t('common.error'), false);
    } finally {
      setBuying(null);
    }
  };

  const handleRedeem = async (prize) => {
    if (coins < prize.priceCoins || redeeming) return;
    setRedeeming(prize.id);
    try {
      const { user: u, code } = await api.redeemPrize(token, prize.id);
      updateUser(u);
      setRedeemedCode({ code, title: prize.title });
    } catch (e) {
      showToast(e.message || t('common.error'), false);
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <div className="py-4 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-extrabold text-xl" style={{ color: textPri }}>{t('shop.title')}</h2>
          <p className="text-xs mt-0.5" style={{ color: textMut }}>{t('shop.subtitle')}</p>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{ background: cardBg, border: `1.5px solid ${cardBord}` }}
        >
          <span className="text-base">🪙</span>
          <span className="font-bold text-sm" style={{ color: textPri }}>{coins}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <span className="text-4xl">🛍️</span>
          <p className="text-sm" style={{ color: textMut }}>{t('shop.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              onBuy={() => handleBuy(item)}
              buying={buying === item.id}
              owned={ownedShop.includes(item.id)}
              canAfford={coins >= item.price}
              bright={bright}
            />
          ))}
        </div>
      )}

      {prizes.length > 0 && (
        <div className="mt-8">
          <h3 className="font-bold text-base mb-3" style={{ color: textPri }}>{t('shop.partnerPrizes')}</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {prizes.map(prize => (
              <PrizeCard
                key={prize.id}
                prize={prize}
                partner={partners.find(p => p.id === prize.partnerId)}
                onRedeem={() => handleRedeem(prize)}
                redeeming={redeeming === prize.id}
                canAfford={coins >= prize.priceCoins}
                bright={bright}
              />
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-sm font-semibold z-50 whitespace-nowrap"
            style={{
              background: toast.ok ? (bright ? '#f0fdf4' : '#16301d') : (bright ? '#fef2f2' : '#2d1515'),
              border: `1.5px solid ${toast.ok ? '#58CC02' : '#FF4B4B'}`,
              color: toast.ok ? (bright ? '#15803d' : '#58CC02') : (bright ? '#dc2626' : '#FF4B4B'),
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {redeemedCode && (
          <RedeemedCodeModal redemption={redeemedCode} onClose={() => setRedeemedCode(null)} bright={bright} />
        )}
      </AnimatePresence>
    </div>
  );
}
