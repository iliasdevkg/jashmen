import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flame, Star, BookOpen, Award, Camera, Pencil, Check, X, Loader2, Coins, Ticket, Copy } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import { useI18n, formatDays, localizedText } from '../i18n.jsx';
import {
  getCurrentLeague, STREAK, streakRepairOffer, computeLiveEnergy, energySettings,
} from '../utils.js';
import * as api from '../api.js';
import StreakCalendar from '../components/StreakCalendar.jsx';
import ZoomableImage from '../components/ZoomableImage.jsx';
import Avatar from '../components/Avatar.jsx';
import LeagueBadge from '../components/icons/LeagueBadges.jsx';
import { lessonIconFor } from '../../shared/lessonIconComponents.jsx';

function StatCard({ icon: Icon, label, value, color, bright }) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 rounded-2xl p-4 flex-1"
      style={{
        background: bright ? '#ffffff' : '#1e293b',
        border: `1.5px solid ${bright ? '#e2e8f0' : '#334155'}`,
      }}
    >
      <Icon size={22} color={color} />
      <span className="font-bold text-lg" style={{ color: bright ? '#0f172a' : 'white' }}>{value}</span>
      <span className="text-[11px] text-center leading-tight" style={{ color: bright ? '#64748b' : '#94a3b8' }}>{label}</span>
    </div>
  );
}

// Icon picked from the built-in set wins over an uploaded badge (the order
// the server stores them in), and the gold trophy is the last resort.
function AchievementGlyph({ ach }) {
  const Picked = lessonIconFor(ach.icon);
  if (Picked) return <Picked size={26} color="#FFD700" strokeWidth={2.3} />;
  if (ach.iconUrl) return <ZoomableImage src={ach.iconUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />;
  return <Award size={24} color="#FFD700" />;
}

function AchievementBadge({ ach, earned, bright, locale }) {
  return (
    <div
      className="flex flex-col items-center gap-2 p-3 rounded-2xl"
      style={{
        background: earned
          ? (bright ? '#ffffff' : '#1e293b')
          : (bright ? '#f1f5f9' : '#141e2e'),
        border: `1.5px solid ${earned ? (bright ? '#e2e8f0' : '#334155') : (bright ? '#e2e8f0' : '#1e293b')}`,
        opacity: earned ? 1 : 0.4,
      }}
    >
      <AchievementGlyph ach={ach} />
      <p className="text-[10px] font-bold text-center leading-tight" style={{ color: bright ? '#0f172a' : 'white' }}>{localizedText(ach.title, locale)}</p>
    </div>
  );
}

// One claimed coupon — the durable proof behind the shop's one-shot
// redeemed-code modal. Clicking anywhere copies the code; the row keeps
// standing even if the admin has since deleted the prize (title falls back
// to the bare code).
function CouponRow({ r, bright, locale, t }) {
  // Two codes, two jobs: `code` is JashMen's own, for reconciling with the
  // partner; `promoCode` is the partner's, and is the string the learner
  // actually hands over at the till. It used to be shown once, in the
  // redemption dialog, and then never again — which made the coupon history
  // useless for the one thing it exists for.
  const [copied, setCopied] = useState('');
  const title = localizedText(r.prize?.title, locale) || r.code;
  const partner = localizedText(r.partner?.name, locale);
  const date = r.date ? r.date.split('-').reverse().join('.') : '';
  const subtitle = [partner, date].filter(Boolean).join(' · ');
  const cardBg   = bright ? '#ffffff' : '#1e293b';
  const cardBord = bright ? '#e2e8f0' : '#334155';
  const textPri  = bright ? '#0f172a' : 'white';
  const textMut  = bright ? '#64748b' : '#94a3b8';

  const copy = async (value, which) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(''), 1800);
    } catch (_) { /* clipboard denied — the code is still on screen to read */ }
  };

  return (
    <motion.div
      layout
      className="w-full rounded-2xl p-3 text-left"
      style={{ background: cardBg, border: `1.5px solid ${cardBord}` }}
    >
      <div className="flex items-center gap-3">
        {r.partner?.logoUrl
          ? <ZoomableImage src={r.partner.logoUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
          : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: bright ? '#f1f5f9' : '#0b1220' }}>
              <Ticket size={18} color={textMut} />
            </div>
          )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate" style={{ color: textPri }}>{title}</p>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: textMut }}>{subtitle}</p>}
        </div>
      </div>

      {/* Only the partner's code. JashMen's own number is the operator's
          reconciliation key, not something a learner has any use for — it
          only made them wonder which of two codes to show at the till. It
          still exists on the record, and still appears in the admin's
          coupon list. The fallback is for a prize with no partner code at
          all: something has to stand as proof of the claim. */}
      <p className="mt-2.5 mb-1 text-[11px] font-semibold" style={{ color: textMut }}>
        {r.promoCode ? t('profile.couponPartnerCode') : t('profile.couponTapToCopy')}
      </p>
      <motion.button
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={() => copy(r.promoCode || r.code, 'code')}
        aria-label={`${r.promoCode || r.code}. ${t('profile.couponTapToCopy')}`}
        className="w-full rounded-xl py-2.5 flex items-center justify-center gap-2 font-mono font-extrabold text-sm tracking-wider"
        style={r.promoCode
          ? { background: 'rgba(88,204,2,0.12)', border: '1.5px solid rgba(88,204,2,0.4)', color: '#58CC02' }
          : { background: bright ? '#f1f5f9' : '#0b1220', color: '#1CB0F6' }}
      >
        {r.promoCode || r.code}
        {copied === 'code'
          ? <Check size={14} className="shrink-0" color="#58CC02" />
          : <Copy size={14} className="shrink-0 opacity-60" />}
      </motion.button>
    </motion.div>
  );
}

export default function ProfilePage() {
  const { user, state, token, updateUser } = useAuth();
  const content = useContent();
  const { bright } = useBrightMode();
  const { t, locale } = useI18n();

  // `xp` is the general league's score — what the league card ranks on.
  // The "Total XP" stat is the lifetime figure, which keeps climbing
  // while the learner is competing on a campus board instead.
  const xp = state?.xp || 0;
  const lifetimeXp = state?.lifetimeXp || 0;
  const streak = state?.streak || 0;
  const coins = state?.coins || 0;
  const completedLessons = state?.completedLessons || [];
  const earnedAchievements = new Set(state?.achievements || []);

  const leagues = content?.leagues || [];
  const achievements = content?.achievements || [];
  const myLeague = getCurrentLeague(xp, leagues);
  const totalLessons = (content?.modules || []).reduce((a, m) => a + m.lessons.length, 0);

  const cardBg     = bright ? '#ffffff' : '#1e293b';
  const cardBorder = bright ? '#e2e8f0' : '#334155';
  const textPri    = bright ? '#0f172a' : 'white';
  const textMuted  = bright ? '#64748b' : '#94a3b8';

  // A run that a missed day ended today can be bought back with energy — the
  // offer, its price and the balance it is paid from all come from the same
  // state the rest of the app reads, so nothing here can disagree with what
  // the server will decide (utils.js#streakRepairOffer).
  const repair = streakRepairOffer(state, content);
  const { dailyFreeLessons, energyRefillHours } = energySettings(content);
  const { remaining: energy } = computeLiveEnergy(state, dailyFreeLessons, energyRefillHours);
  const [repairBusy, setRepairBusy] = useState(false);
  const [repairError, setRepairError] = useState('');

  async function handleRepair() {
    setRepairBusy(true);
    setRepairError('');
    try {
      const { user: fresh } = await api.repairStreak(token);
      updateUser(fresh);
    } catch (e) {
      setRepairError(e.message || t('profile.streakRepairNoEnergy'));
    } finally {
      setRepairBusy(false);
    }
  }

  // Task 6 — avatar upload (tap the camera badge on the profile photo).
  const fileInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked later if it fails
    if (!file) return;
    setAvatarError('');
    setUploadingAvatar(true);
    try {
      const u = await api.uploadAvatar(token, file);
      updateUser(u);
    } catch (err) {
      setAvatarError(err.message || t('common.error'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Task 6 — editable username, right on the profile (Settings keeps its
  // own copy of this control too; both write through the same endpoint).
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);

  // Coupon history — null = still loading, [] = loaded (possibly empty).
  const [coupons, setCoupons] = useState(null);
  const [couponsError, setCouponsError] = useState('');
  useEffect(() => {
    let alive = true;
    api.fetchMyRedemptions(token)
      .then(list => { if (alive) setCoupons(Array.isArray(list) ? list : []); })
      .catch(err => {
        if (alive) { setCouponsError(err.message || ''); setCoupons([]); }
      });
    return () => { alive = false; };
  }, [token]);

  const startEditName = () => { setNameDraft(user?.name || ''); setEditingName(true); };
  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === user?.name) { setEditingName(false); return; }
    setSavingName(true);
    try {
      const u = await api.patchState(token, { name: trimmed });
      updateUser(u);
    } catch (e) { console.error(e); }
    finally { setSavingName(false); setEditingName(false); }
  };

  return (
    <div className="py-4 px-4">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row items-center lg:items-start gap-4 mb-6 pt-2"
      >
        <div className="relative shrink-0">
          <Avatar name={user?.name} photoUrl={user?.avatar} size={96} style={{ border: `3px solid ${cardBorder}` }} />
          <motion.button
            whileTap={{ scale: 0.92 }}
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label={t('profile.changePhoto')}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-70"
            style={{ background: '#1CB0F6', border: `2.5px solid ${bright ? '#f8fafc' : '#0f172a'}` }}
          >
            {uploadingAvatar
              ? <Loader2 size={14} color="white" className="animate-spin" />
              : <Camera size={14} color="white" />}
          </motion.button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div className="text-center lg:text-left">
          {editingName ? (
            <div className="flex items-center gap-1.5 justify-center lg:justify-start">
              <input
                autoFocus
                value={nameDraft}
                maxLength={60}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveName();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                className="font-extrabold text-xl bg-transparent outline-none px-1 pb-0.5"
                style={{ color: textPri, borderBottom: '2px solid #1CB0F6', maxWidth: 200 }}
              />
              <button onClick={saveName} disabled={savingName} className="p-1 disabled:opacity-50" style={{ color: '#58CC02' }}>
                {savingName ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              </button>
              <button onClick={() => setEditingName(false)} className="p-1" style={{ color: '#FF4B4B' }}>
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 justify-center lg:justify-start">
              <h2 className="font-extrabold text-xl" style={{ color: textPri }}>{user?.name}</h2>
              <button onClick={startEditName} aria-label={t('settings.editName')} className="p-1" style={{ color: textMuted }}>
                <Pencil size={13} />
              </button>
            </div>
          )}
          {avatarError && <p className="text-xs mt-1" style={{ color: '#FF4B4B' }}>{avatarError}</p>}
          {user?.email && <p className="text-xs mt-0.5" style={{ color: textMuted }}>{user.email}</p>}
          {myLeague && (
            <div
              className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full"
              style={{ background: `${myLeague.color}20`, border: `1px solid ${myLeague.color}40` }}
            >
              <LeagueBadge id={myLeague.id} color={myLeague.color} size={20} iconUrl={myLeague.iconUrl} icon={myLeague.icon} />
              <span className="text-xs font-bold" style={{ color: myLeague.color }}>{t('profile.leagueBadge', { name: localizedText(myLeague.name, locale) })}</span>
            </div>
          )}
        </div>
      </motion.div>

      <div className="flex gap-2 mb-4">
        <StatCard icon={Star}     label={t('profile.totalXp')} value={lifetimeXp.toLocaleString()}                     color="#FFD700" bright={bright} />
        <StatCard icon={Flame}    label={t('profile.streak')}  value={formatDays(streak, locale)}              color={STREAK.soft} bright={bright} />
        <StatCard icon={BookOpen} label={t('profile.lessons')} value={`${completedLessons.length}/${totalLessons}`} color="#1CB0F6" bright={bright} />
      </div>

      {/* The streak card sits directly under the three stat tiles, because
          the "streak: 12 days" tile above is the number and this is the
          story behind it — which days those twelve actually were. */}
      <StreakCalendar
        streak={streak}
        activeDays={state?.activeDays || []}
        bright={bright}
        repair={repair}
        energy={energy}
        repairBusy={repairBusy}
        repairError={repairError}
        onRepair={handleRepair}
      />

      <div
        className="flex items-center justify-between px-4 py-3 rounded-2xl mb-5"
        style={{ background: cardBg, border: `1.5px solid ${cardBorder}` }}
      >
        <div className="flex items-center gap-2">
          <Coins size={26} color="#FFD700" fill="#FFD700" />
          <div>
            <p className="font-bold text-sm" style={{ color: textPri }}>{t('profile.coinsTitle')}</p>
            <p className="text-xs" style={{ color: textMuted }}>{t('profile.coinsDesc')}</p>
          </div>
        </div>
        <span className="font-extrabold text-lg" style={{ color: textPri }}>{coins}</span>
      </div>

      {achievements.length > 0 && (
        <div id="achievements">
          <h3 className="font-bold text-base mb-3" style={{ color: textPri }}>{t('profile.achievements')}</h3>
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
            {achievements.map(ach => (
              <AchievementBadge key={ach.id} ach={ach} earned={earnedAchievements.has(ach.id)} bright={bright} locale={locale} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="font-bold text-base mb-3" style={{ color: textPri }}>{t('profile.coupons')}</h3>
        {coupons === null ? (
          <div className="rounded-2xl h-24 animate-pulse" style={{ background: cardBg, border: `1.5px solid ${cardBorder}` }} />
        ) : coupons.length === 0 ? (
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: bright ? '#f1f5f9' : '#141e2e', border: `1.5px solid ${cardBorder}` }}
          >
            <Ticket size={18} color={textMuted} className="shrink-0" />
            <p className="text-xs leading-relaxed" style={{ color: textMuted }}>
              {couponsError || t('profile.couponsEmpty')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2">
            {coupons.map(r => (
              <CouponRow key={r.id} r={r} bright={bright} locale={locale} t={t} />
            ))}
          </div>
        )}
      </div>

      <div className="h-4" />
    </div>
  );
}
