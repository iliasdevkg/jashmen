// src/pages/LandingPage.jsx — https://jashmenstudio.com/
//
// Before this existed, an anonymous visitor was dropped straight onto the
// onboarding slides and then the sign-in wall: no explanation of what
// JashMen is, and nothing a search engine could read beyond index.html's
// <head>. This is the front door.
//
// Every word comes from the admin store (admin-api/landing.seed.js, edited
// in the panel's "Landing бет" tab) resolved through the visitor's chosen
// language; the numbers come from GET /public/stats; the campuses come from
// the same university content the league itself uses. Nothing on this page
// is a hardcoded marketing claim, which is what keeps it from going stale.
//
// The look is deliberately NOT the app's: frosted glass over a blue aurora,
// nothing sharper than a 22px corner, Onest over Inter, and the brand blue
// taken straight from the logo's own ground. It is all scoped under `.lp`
// (landing.css) so none of it can leak into the product.
import { useEffect, useMemo, useState } from 'react';
import { useContent } from '../store.jsx';
import { useI18n, localizedText, formatSom } from '../i18n.jsx';
import * as api from '../api.js';
import '../components/landing/landing.css';
import LandingNav from '../components/landing/LandingNav.jsx';
import LandingHero from '../components/landing/LandingHero.jsx';
import LandingRibbon from '../components/landing/LandingRibbon.jsx';
import LandingStats from '../components/landing/LandingStats.jsx';
import LandingCards from '../components/landing/LandingCards.jsx';
import LandingSteps from '../components/landing/LandingSteps.jsx';
import LandingUniversities from '../components/landing/LandingUniversities.jsx';
import LandingPartners from '../components/landing/LandingPartners.jsx';
import LandingTestimonials from '../components/landing/LandingTestimonials.jsx';
import LandingDownload from '../components/landing/LandingDownload.jsx';
import LandingFaq from '../components/landing/LandingFaq.jsx';
import LandingFooter from '../components/landing/LandingFooter.jsx';

// Turns one stored section into flat, already-localized strings so the
// section components never have to know that content is trilingual. Values
// that aren't text — a visibility flag, an icon slug, a url, a person's
// name — pass through untouched.
const PASSTHROUGH = new Set([
  'enabled', 'id', 'icon', 'apkUrl', 'instagram', 'email', 'name', 'avatarUrl', 'badgeStat',
]);

function resolve(section, locale) {
  if (!section) return null;
  const out = {};
  for (const [key, value] of Object.entries(section)) {
    if (PASSTHROUGH.has(key)) out[key] = value;
    else if (Array.isArray(value)) out[key] = value.map(item => resolve(item, locale));
    else out[key] = localizedText(value, locale);
  }
  return out;
}

function Splash() {
  return (
    <div className="flex-1 grid place-items-center" style={{ background: '#050B1F' }}>
      <img src="/logo1.png" alt="JashMen" className="w-20 h-20 object-contain animate-pulse" />
    </div>
  );
}

export default function LandingPage() {
  const content = useContent();
  const { locale, t } = useI18n();
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // The app shell caps #root at 480px below 1024px — right for a phone-shaped
  // product, wrong for a marketing page, which would otherwise render as a
  // narrow column floating in the middle of a tablet. Scoped to this route
  // and removed on unmount so nothing else sees it (src/index.css).
  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.add('landing');
    return () => root?.classList.remove('landing');
  }, []);

  useEffect(() => {
    let alive = true;
    api.fetchPublicStats()
      .then(s => { if (alive) setStats(s); })
      // A failed counter is not a failed page: the band keeps its skeleton
      // rather than showing four zeros or an error a visitor can't act on.
      .catch(() => {})
      .finally(() => { if (alive) setStatsLoading(false); });
    return () => { alive = false; };
  }, []);

  const sections = useMemo(() => {
    const landing = content?.landing;
    if (!landing) return null;
    return Object.fromEntries(
      Object.entries(landing).map(([key, section]) => [key, resolve(section, locale)]),
    );
  }, [content, locale]);

  if (!sections) return <Splash />;

  const on = (key) => sections[key]?.enabled !== false;
  const hero = sections.hero;

  // The screens in the hero mock-up show the REAL first two modules, their
  // real colours and their real lessons. Inventing a curriculum for a
  // marketing shot is how a landing page ends up promising a course that
  // doesn't exist.
  const [mod1, mod2] = content.modules || [];
  const mod1Lessons = (mod1?.lessons || []).map(l => localizedText(l.title, locale));
  const topCampus = (content.universities || [])
    .filter(u => u.contest?.prizePool > 0)
    .sort((a, b) => b.contest.prizePool - a.contest.prizePool)[0];
  const nextLeague = content.leagues?.[1];

  const showcase = {
    navLearn: t('nav.learn'),
    navLeague: t('nav.league'),
    navShop: t('nav.shop'),
    navProfile: t('nav.profile'),
    navSettings: t('nav.settings'),

    mod1Label: t('learn.moduleLabel', { n: 1 }),
    mod1Title: localizedText(mod1?.title, locale),
    mod1Color: mod1?.color || '#1CB0F6',
    mod1Partner: localizedText(
      (content.partners || []).find(p => p.id === mod1?.partnerId)?.name, locale,
    ),
    mod2Label: t('learn.moduleLabel', { n: 2 }),
    mod2Title: localizedText(mod2?.title, locale),
    mod2Color: mod2?.color || '#FF9600',

    lesson1: mod1Lessons[0] || '',
    lesson2: mod1Lessons[1] || '',
    lesson3: mod1Lessons[2] || '',
    checkLabel: t('lesson.previewCheckpoint'),

    // The sidebar's account row shows the app's own label rather than a
    // person's name — the page is public, and nobody consented to appear on it.
    userLine: t('nav.profile'),

    leagueKicker: t('league.myLeague'),
    leagueName: localizedText(content.leagues?.[0]?.name, locale),
    leagueNext: nextLeague
      ? `${t('league.next')} ${localizedText(nextLeague.name, locale)} · ${nextLeague.minXp} ${t('league.xpLeft')}`
      : '',
    streakLine: t('league.streakBadge', { n: 1 }),
    streakSub: t('league.streakDesc'),

    uniKicker: sections.uni?.title || '',
    uniName: topCampus?.listName || '',
    uniPrizeLabel: sections.uni?.prizeLabel || '',
    uniPrize: topCampus ? formatSom(topCampus.contest.prizePool, locale) : '',
  };

  // The one number on the page presented as a fact rather than as UI. The
  // admin picks which counter it is; 'none' (or a counter that hasn't
  // arrived) takes the badge off entirely.
  const badge = {
    value: hero.badgeStat && hero.badgeStat !== 'none' ? stats?.[hero.badgeStat] ?? null : null,
    label: hero.badgeLabel,
  };

  return (
    <div className="lp flex-1 min-w-0">
      <LandingNav
        signInLabel={hero.secondaryCta || t('auth.login')}
        startLabel={hero.primaryCta || t('auth.createAccount')}
      />

      <main>
        {on('hero') && (
          <LandingHero hero={hero} showcase={showcase} badge={badge} />
        )}

        {on('ribbon') && <LandingRibbon items={sections.ribbon.items} />}

        {on('partners') && (
          <LandingPartners copy={sections.partners} partners={content.partners} locale={locale} />
        )}

        {on('stats') && (
          <LandingStats copy={sections.stats} stats={stats} loading={statsLoading} />
        )}

        {on('features') && <LandingCards id="features" copy={sections.features} columns={3} />}

        {on('steps') && <LandingSteps copy={sections.steps} />}

        {on('uni') && (
          <LandingUniversities
            copy={sections.uni}
            universities={content.universities}
            locale={locale}
          />
        )}

        {/* The one light band on the page — it lands right where a reader
            scrolling a long dark page needs the pace to change, and it is the
            only place the glass is white-on-pale rather than white-on-blue. */}
        {on('gamification') && (
          <LandingCards id="gamification" copy={sections.gamification} columns={4} tone="paper" />
        )}

        {on('testimonials') && <LandingTestimonials copy={sections.testimonials} />}

        {on('faq') && <LandingFaq copy={sections.faq} />}

        {on('download') && <LandingDownload copy={sections.download} />}
      </main>

      {on('footer') && (
        <LandingFooter copy={sections.footer} privacyLabel={t('landing.privacy')} />
      )}
    </div>
  );
}
