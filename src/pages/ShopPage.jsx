import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import * as api from '../api.js';

function ItemCard({ item, onBuy, buying, owned, canAfford, bright }) {
  const isHeart  = item.id === 'hearts';
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
      <div className="text-3xl">{item.emoji || '🎁'}</div>
      <div className="flex-1">
        <p className="font-bold text-sm" style={{ color: textPri }}>{item.title}</p>
        {item.desc && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: textMut }}>{item.desc}</p>}
      </div>
      <div>
        {owned && !isHeart ? (
          <div
            className="flex items-center gap-1.5 py-2.5 px-3 rounded-xl"
            style={{ background: bright ? '#f0fdf4' : '#16301d', border: '1.5px solid #58CC02' }}
          >
            <Check size={14} color="#58CC02" />
            <span className="text-xs font-bold" style={{ color: bright ? '#15803d' : '#58CC02' }}>Сатып алынды</span>
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
            {buying ? '...' : <><span>💎</span><span>{item.price}</span></>}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export default function ShopPage() {
  const content = useContent();
  const { token, state, updateUser } = useAuth();
  const { bright } = useBrightMode();
  const [buying, setBuying] = useState(null);
  const [toast, setToast] = useState(null);

  const items    = content?.shop_items || [];
  const gems     = state?.gems     || 0;
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
    if (gems < item.price || buying) return;
    setBuying(item.id);
    try {
      const kind = item.id === 'hearts' ? 'hearts' : 'item';
      const u = await api.buyItem(token, item.id, item.price, kind);
      updateUser(u);
      showToast(`✅ ${item.title} сатып алынды!`);
    } catch (e) {
      showToast(e.message || 'Ката болду', false);
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="py-4 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-extrabold text-xl" style={{ color: textPri }}>Дүкөн</h2>
          <p className="text-xs mt-0.5" style={{ color: textMut }}>Гемдериңизди сарп кылыңыз</p>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{ background: cardBg, border: `1.5px solid ${cardBord}` }}
        >
          <span className="text-base">💎</span>
          <span className="font-bold text-sm" style={{ color: textPri }}>{gems}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <span className="text-4xl">🛍️</span>
          <p className="text-sm" style={{ color: textMut }}>Дүкөн бош</p>
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
              canAfford={gems >= item.price}
              bright={bright}
            />
          ))}
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
    </div>
  );
}
