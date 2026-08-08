import { motion } from 'framer-motion';
import { Flame, Star, BookOpen } from 'lucide-react';
import { useAuth, useContent, useBrightMode } from '../store.jsx';
import { useI18n, formatDays } from '../i18n.jsx';
import { getCurrentLeague } from '../utils.js';
import Avatar from '../components/Avatar.jsx';
import LeagueBadge from '../components/icons/LeagueBadges.jsx';

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

function AchievementBadge({ ach, earned, bright }) {
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
      <span className="text-2xl">{ach.emoji}</span>
      <p className="text-[10px] font-bold text-center leading-tight" style={{ color: bright ? '#0f172a' : 'white' }}>{ach.title}</p>
    </div>
  );
}

export default function ProfilePage() {
  const { user, state } = useAuth();
  const content = useContent();
  const { bright } = useBrightMode();
  const { t, locale } = useI18n();

  const xp = state?.xp || 0;
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

  return (
    <div className="py-4 px-4">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row items-center lg:items-start gap-4 mb-6 pt-2"
      >
        <Avatar name={user?.name} size={96} style={{ border: `3px solid ${cardBorder}` }} />
        <div className="text-center lg:text-left">
          <h2 className="font-extrabold text-xl" style={{ color: textPri }}>{user?.name}</h2>
          {user?.email && <p className="text-xs mt-0.5" style={{ color: textMuted }}>{user.email}</p>}
          {myLeague && (
            <div
              className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full"
              style={{ background: `${myLeague.color}20`, border: `1px solid ${myLeague.color}40` }}
            >
              <LeagueBadge id={myLeague.id} color={myLeague.color} size={20} />
              <span className="text-xs font-bold" style={{ color: myLeague.color }}>{t('profile.leagueBadge', { name: myLeague.name })}</span>
            </div>
          )}
        </div>
      </motion.div>

      <div className="flex gap-2 mb-4">
        <StatCard icon={Star}     label={t('profile.totalXp')} value={xp.toLocaleString()}                     color="#FFD700" bright={bright} />
        <StatCard icon={Flame}    label={t('profile.streak')}  value={formatDays(streak, locale)}              color="#fb923c" bright={bright} />
        <StatCard icon={BookOpen} label={t('profile.lessons')} value={`${completedLessons.length}/${totalLessons}`} color="#1CB0F6" bright={bright} />
      </div>

      <div
        className="flex items-center justify-between px-4 py-3 rounded-2xl mb-5"
        style={{ background: cardBg, border: `1.5px solid ${cardBorder}` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">🪙</span>
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
              <AchievementBadge key={ach.id} ach={ach} earned={earnedAchievements.has(ach.id)} bright={bright} />
            ))}
          </div>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
