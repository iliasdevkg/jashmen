// src/locales/en.js — English. Per the manifest: "задел на будущее для
// Долины, Индии и Y Combinator" — UI chrome only, same fallback rule as ru.js.
export const en = {
  // ── common ──
  'common.loading': '...',
  'common.continue': 'Continue',
  'common.finish': 'Finish',
  'common.gotIt': 'Got it',
  'common.error': 'Something went wrong',
  'common.cancel': 'Cancel',
  'common.close': 'Close',

  // ── nav ──
  'nav.learn': 'Learn',
  'nav.league': 'League',
  'nav.shop': 'Shop',
  'nav.profile': 'Profile',
  'nav.settings': 'Settings',
  'nav.logout': 'Log out',
  'nav.achievements': 'Achievements',

  // ── auth ──
  'auth.tagline': 'Financial literacy — like a game',
  'auth.login': 'Log in',
  'auth.signup': 'Sign up',
  'auth.namePlaceholder': 'Your name',
  'auth.passwordPlaceholder': 'Password',
  'auth.createAccount': 'Create account',

  // ── learn (path) ──
  'learn.moduleLabel': 'SECTION {{n}}',
  'learn.courseFrom': 'Course by {{partner}}',
  'learn.noEnergyTitle': 'Out of energy for today!',
  'learn.noEnergyDesc': 'New energy in {{time}} · or buy more in the shop',
  'learn.cardsCount': '{{n}} cards',
  'learn.start': 'START',
  'learn.noEnergyShort': 'NO ENERGY',

  // ── lesson ──
  'lesson.noEnergyTitle': 'Out of energy for today!',
  'lesson.noEnergyDesc': 'New energy arrives in {{time}}.',
  'lesson.goToShop': 'Go to shop',
  'lesson.goBack': 'Go back',
  'lesson.notFound': 'Lesson not found',
  'lesson.backArrow': '← Back',
  'lesson.correct': 'Correct!',
  'lesson.correctAnswerIs': 'Correct answer: {{answer}}',
  'lesson.stepCounter': '{{current}}/{{total}} step',
  'lesson.resultPerfect': 'Perfect!',
  'lesson.resultGood': 'Good job!',
  'lesson.reviewDone': 'Review complete',
  'lesson.lessonDone': 'Lesson complete',
  'lesson.perfectBadge': 'Perfect!',
  'lesson.newAchievement': 'NEW ACHIEVEMENT',
  'lesson.share': 'Share your win',
  'lesson.shareText': 'I finished "{{lesson}}" on JashMen and earned {{xp}} XP! 🏆',

  // ── lesson preview sheet (path node tap) ──
  'lesson.previewLesson': 'Lesson',
  'lesson.previewCheckpoint': 'Checkpoint',
  'lesson.previewAvailableDesc': 'Consists of {{n}} questions. Finish it to earn up to {{xp}} XP and coins!',
  'lesson.previewCompletedDesc': "You've already completed this lesson. Go through it again to reinforce what you learned.",
  'lesson.previewGatedDesc': "You've used up today's free lessons. Buy more energy in the shop, or wait until tomorrow.",
  'lesson.previewNoEnergyBadge': 'No energy',
  'lesson.previewQuestions': '{{n}} questions',
  'lesson.previewXpUpTo': 'up to +{{xp}} XP',
  'lesson.previewCompletedBadge': 'Completed',
  'lesson.previewStart': 'Start',
  'lesson.previewReview': 'Review',

  // ── shop / marketplace ──
  'shop.title': 'Shop',
  'shop.subtitle': 'Spend your coins',
  'shop.empty': 'Shop is empty',
  'shop.owned': 'Owned',
  'shop.partnerPrizes': 'Partner rewards',
  'shop.buySuccess': '{{title}} purchased!',
  'shop.redeemInstructions': 'Show this code to claim your prize:',

  // ── profile ──
  'profile.leagueBadge': '{{name}} League',
  'profile.totalXp': 'Total XP',
  'profile.streak': 'Streak',
  'profile.lessons': 'Lessons',
  'profile.coinsTitle': 'Jashmen Coins',
  'profile.coinsDesc': 'For shop purchases and prize redemptions',
  'profile.achievements': 'Achievements',

  // ── settings ──
  'settings.title': 'Settings',
  'settings.brightMode': 'Light mode',
  'settings.brightDesc': 'Light background — easier on the eyes',
  'settings.sound': 'Sound',
  'settings.soundDesc': 'Answer feedback sounds',
  'settings.animations': 'Animations',
  'settings.animationsDesc': 'Flashy effects',
  'settings.language': 'Language',
  'settings.languageDesc': 'Interface language',
  'settings.notifications': 'Notifications',
  'settings.notificationsDesc': 'Reminds you before your streak breaks',
  'settings.version': 'Version',
  'settings.editName': 'Edit name',

  // ── league / right panel ──
  'league.prevLeagues': 'Previous leagues',
  'league.nextLeagues': 'Next leagues',
  'league.myLeague': 'Your league',
  'league.next': 'Next:',
  'league.xpLeft': 'XP left',
  'league.streakBadge': '{{n}}-day streak',
  'league.streakDesc': 'Learning streak',
  'league.rating': 'Ranking',
  'league.participants': 'participants',
  'league.leaderXp': 'leader XP',
  'league.myRank': 'your rank',
  'league.emptyTitle': 'Nobody in this league yet',
  'league.emptyDesc': 'Be the first to earn XP!',
};
