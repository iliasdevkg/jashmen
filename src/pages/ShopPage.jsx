import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Gift, Building2, ChevronLeft, Coins, PartyPopper, CheckCircle2, XCircle, ShoppingBag, PackageX } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import { useI18n, localizedText } from '../i18n.jsx';
import * as api from '../api.js';
import ZoomableImage from '../components/ZoomableImage.jsx';
import ShopItemIcon from '../components/icons/ShopIcons.jsx';

function ItemCard({ item, onBuy, buying, owned, canAfford, bright, locale }) {
  const { t } = useI18n();
  const title = localizedText(item.title, locale);
  const desc = localizedText(item.desc, locale);
  // "energy_refill" is the one repeatable effect (consumable, not a
  // permanent unlock) — see contentStore.js#SHOP_EFFECTS / routes.js#/u/me/buy.
  const isRepeatable = item.effect === 'energy_refill';
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
        <p className="font-bold text-sm" style={{ color: textPri }}>{title}</p>
        {desc && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: textMut }}>{desc}</p>}
      </div>
      <div>
        {owned && !isRepeatable ? (
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
            {buying ? t('common.loading') : <><Coins size={16} /><span>{item.price}</span></>}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

function PrizeCard({ prize, onRedeem, redeeming, canAfford, bright, locale }) {
  const { t } = useI18n();
  // The server counts the stock and says so (routes.js#/public/content); the
  // codes themselves never reach the client.
  // Two states, and no third: it is either on sale or it is gone. A running
  // count ("4 left") was a nudge nobody asked for — it rushes the learner
  // and tells anyone who looks how much stock a partner has left.
  const soldOut = !!prize.soldOut;
  const buyable = canAfford && !soldOut;
  const title = localizedText(prize.title, locale);
  const description = localizedText(prize.description, locale);
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
        // `contain`, not `cover`: a prize photo is the thing being sold, and
        // cropping it hid the half of the product the learner is choosing by.
        // The letterboxing sits on the card's own surface so the gap reads as
        // framing rather than as a hole.
        <div
          className="w-full h-24 flex items-center justify-center"
          style={{ background: bright ? '#f1f5f9' : '#0b1220', opacity: soldOut ? 0.45 : 1 }}
        >
          <ZoomableImage
            src={prize.photoUrl}
            alt={title}
            caption={description || title}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      ) : (
        <div className="w-full h-24 flex items-center justify-center" style={{ background: bright ? '#f1f5f9' : '#0b1220' }}>
          <Gift size={28} color={textMut} />
        </div>
      )}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex-1">
          <p className="font-bold text-sm" style={{ color: textPri }}>{title}</p>
          {description && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: textMut }}>{description}</p>}
        </div>
        <motion.button
          whileTap={buyable ? { scale: 0.95 } : {}}
          onClick={buyable && !redeeming ? onRedeem : undefined}
          disabled={redeeming || !buyable}
          // Sold out reads differently from can't-afford: one is a wait for
          // the partner, the other a wait for the learner's own coins, and
          // showing a price nobody can spend would be the wrong prompt.
          className="flex items-center gap-1.5 py-2.5 px-3 rounded-xl w-full justify-center font-bold text-sm transition-all"
          style={{
            background: soldOut ? (bright ? '#fef2f2' : '#2a1416')
              : canAfford ? '#58CC0220' : (bright ? '#f1f5f9' : '#1e293b'),
            border: `1.5px solid ${soldOut ? (bright ? '#fecaca' : '#7f1d1d')
              : canAfford ? '#58CC02' : (bright ? '#cbd5e1' : '#475569')}`,
            color: soldOut ? (bright ? '#b91c1c' : '#f87171')
              : canAfford ? '#58CC02' : (bright ? '#94a3b8' : '#475569'),
          }}
        >
          {redeeming ? t('common.loading')
            : soldOut ? <><PackageX size={15} /><span>{t('shop.soldOut')}</span></>
            : <><Coins size={16} /><span>{prize.priceCoins}</span></>}
        </motion.button>
      </div>
    </motion.div>
  );
}

// Task 11 — the shop's entry point into a partner's catalog: logo, name,
// and how many redeemable prizes they currently have. Tapping one drills
// into that partner's PrizeCard grid (see the `activePartnerId` branch in
// ShopPage below) instead of every partner's prizes being dumped into one
// flat, unsorted grid.
function PartnerCard({ partner, prizeCount, onClick, bright, locale }) {
  const { t } = useI18n();
  const name = localizedText(partner.name, locale);
  const cardBg   = bright ? '#ffffff' : '#1e293b';
  const cardBord = bright ? '#e2e8f0' : '#334155';
  const textPri  = bright ? '#0f172a' : 'white';
  const textMut  = bright ? '#64748b' : '#94a3b8';

  return (
    <motion.button
      layout
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="rounded-2xl p-4 flex flex-col items-center gap-2 text-center"
      style={{ background: cardBg, border: `1.5px solid ${cardBord}` }}
    >
      {partner.logoUrl
        ? <img src={partner.logoUrl} alt="" className="w-12 h-12 rounded-full object-contain" style={{ background: bright ? '#f1f5f9' : '#0b1220' }} />
        : (
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: bright ? '#f1f5f9' : '#0b1220' }}>
            <Building2 size={22} color={textMut} />
          </div>
        )}
      <p className="font-bold text-sm leading-snug" style={{ color: textPri }}>{name}</p>
      <p className="text-[11px] font-semibold" style={{ color: '#1CB0F6' }}>{t('shop.prizeCount', { n: prizeCount })}</p>
    </motion.button>
  );
}

function RedeemedCodeModal({ redemption, onClose, bright }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const cardBg = bright ? '#ffffff' : '#1e293b';
  const textPri = bright ? '#0f172a' : 'white';
  const textMut = bright ? '#64748b' : '#94a3b8';

  // The partner's own code when the prize carries one — that is the string
  // the learner types at the partner's till. Ours stays visible underneath
  // for support, but it is not the one to copy.
  const shown = redemption.promoCode || redemption.code;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shown);
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
        <PartyPopper size={44} color="#58CC02" className="mx-auto mb-3" />
        <p className="font-extrabold text-lg mb-1" style={{ color: textPri }}>{redemption.title}</p>
        <p className="text-xs mb-4" style={{ color: textMut }}>{t('shop.redeemInstructions')}</p>
        <button
          onClick={copy}
          className="w-full rounded-2xl py-4 mb-4 flex items-center justify-center gap-2 font-mono font-extrabold text-lg tracking-wider"
          style={{ background: bright ? '#f1f5f9' : '#0b1220', color: '#1CB0F6' }}
        >
          {shown}
          {copied ? <Check size={16} color="#58CC02" /> : <Copy size={15} />}
        </button>
        <p className="text-[11px] mb-4 -mt-2" style={{ color: textMut }}>
          {t('shop.showAtTill')}
        </p>
        <button onClick={onClose} className="w-full py-3 rounded-2xl font-bold text-white text-sm" style={{ background: '#58CC02' }}>
          {t('common.gotIt')}
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function ShopPage() {
  const content = useContent();
  const { token, state, updateUser, refreshContent } = useAuth();
  const { bright } = useBrightMode();
  const { t, locale } = useI18n();
  const [buying, setBuying] = useState(null);
  const [redeeming, setRedeeming] = useState(null);
  const [toast, setToast] = useState(null);
  const [redeemedCode, setRedeemedCode] = useState(null);
  // Task 11 — null = the shop's main view (items + partner list); a
  // partner's id = drilled into that partner's prize catalog.
  const [activePartnerId, setActivePartnerId] = useState(null);

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
      const kind = item.effect === 'energy_refill' ? 'energy' : 'item';
      const u = await api.buyItem(token, item.id, item.price, kind);
      updateUser(u);
      showToast(t('shop.buySuccess', { title: localizedText(item.title, locale) }));
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
      const { user: u, code, promoCode } = await api.redeemPrize(token, prize.id);
      updateUser(u);
      setRedeemedCode({ code, promoCode, title: localizedText(prize.title, locale) });
      // The sale took a code out of the pool, so the "3 left" on the card
      // behind this dialog is already wrong — and so is everyone else's.
      // Refetched rather than decremented locally, because the server is the
      // one that knows what is left after other people's purchases too.
      refreshContent(true);
    } catch (e) {
      showToast(e.message || t('common.error'), false);
    } finally {
      setRedeeming(null);
    }
  };

  const activePartner = activePartnerId ? partners.find(p => p.id === activePartnerId) : null;
  const activePartnerPrizes = activePartnerId ? prizes.filter(p => p.partnerId === activePartnerId) : [];

  const CoinPill = (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
      style={{ background: cardBg, border: `1.5px solid ${cardBord}` }}
    >
      <Coins size={16} color="#FFD700" fill="#FFD700" />
      <span className="font-bold text-sm" style={{ color: textPri }}>{coins}</span>
    </div>
  );

  return (
    <div className="py-4 px-4">
      {activePartner ? (
        // ── Partner detail: back + header + this partner's prize grid ──
        <>
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setActivePartnerId(null)}
              className="flex items-center gap-1.5 font-semibold text-sm"
              style={{ color: bright ? '#334155' : '#cbd5e1' }}
            >
              <ChevronLeft size={18} /> {t('common.back')}
            </button>
            {CoinPill}
          </div>

          <div className="flex items-center gap-3 mb-6">
            {activePartner.logoUrl
              ? <ZoomableImage
                  src={activePartner.logoUrl}
                  alt={localizedText(activePartner.name, locale)}
                  className="w-12 h-12 rounded-full object-contain"
                  style={{ background: bright ? '#f1f5f9' : '#0b1220' }}
                />
              : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: cardBg, border: `1.5px solid ${cardBord}` }}>
                  <Building2 size={22} color={textMut} />
                </div>
              )}
            <h2 className="font-extrabold text-xl" style={{ color: textPri }}>{localizedText(activePartner.name, locale)}</h2>
          </div>

          {activePartnerPrizes.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <Gift size={36} color={textMut} />
              <p className="text-sm" style={{ color: textMut }}>{t('shop.noPrizesForPartner')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {activePartnerPrizes.map(prize => (
                <PrizeCard
                  key={prize.id}
                  prize={prize}
                  onRedeem={() => handleRedeem(prize)}
                  redeeming={redeeming === prize.id}
                  canAfford={coins >= prize.priceCoins}
                  bright={bright}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        // ── Main shop: coin items, then the partner list ──
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-extrabold text-xl" style={{ color: textPri }}>{t('shop.title')}</h2>
              <p className="text-xs mt-0.5" style={{ color: textMut }}>{t('shop.subtitle')}</p>
            </div>
            {CoinPill}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <ShoppingBag size={36} color={textMut} />
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
                  locale={locale}
                />
              ))}
            </div>
          )}

          {partners.length > 0 && (
            <div className="mt-8">
              <h3 className="font-bold text-base mb-3" style={{ color: textPri }}>{t('shop.partnersTitle')}</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {partners.map(partner => (
                  <PartnerCard
                    key={partner.id}
                    partner={partner}
                    prizeCount={prizes.filter(p => p.partnerId === partner.id).length}
                    onClick={() => setActivePartnerId(partner.id)}
                    bright={bright}
                    locale={locale}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-sm font-semibold z-50 whitespace-nowrap flex items-center gap-2"
            style={{
              background: toast.ok ? (bright ? '#f0fdf4' : '#16301d') : (bright ? '#fef2f2' : '#2d1515'),
              border: `1.5px solid ${toast.ok ? '#58CC02' : '#FF4B4B'}`,
              color: toast.ok ? (bright ? '#15803d' : '#58CC02') : (bright ? '#dc2626' : '#FF4B4B'),
            }}
          >
            {toast.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
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
