// src/locales/ky.js — Kyrgyz. The default/fallback locale — this is the
// exact text the app already shipped with before i18n existed, so turning
// the switcher to Kyrgyz (or having it unset) reproduces the original app
// byte-for-byte.
export const ky = {
  // ── common ──
  'common.loading': '...',
  'common.continue': 'Улантуу',
  'common.finish': 'Аяктоо',
  'common.gotIt': 'Түшүндүм',
  'common.error': 'Ката болду',
  'common.cancel': 'Жокко чыгаруу',
  'common.close': 'Жабуу',

  // ── nav ──
  'nav.learn': 'Үйрөнүү',
  'nav.league': 'Лига',
  'nav.shop': 'Дүкөн',
  'nav.profile': 'Профиль',
  'nav.settings': 'Орнотуу',
  'nav.logout': 'Аккаунттан чыгуу',
  'nav.achievements': 'Жетишкендиктер',

  // ── auth ──
  'auth.tagline': 'Каржылык сабаттуулук — оюн сыяктуу',
  'auth.or': 'же',
  'auth.google': 'Google менен улантуу',
  'auth.googleFailed': 'Google аркылуу кирүү ишке ашкан жок',
  'auth.login': 'Кирүү',
  'auth.signup': 'Катталуу',
  'auth.namePlaceholder': 'Атыңыз',
  'auth.passwordPlaceholder': 'Сыр сөз',
  'auth.createAccount': 'Аккаунт түзүү',

  // ── learn (path) ──
  'learn.moduleLabel': '{{n}}-БӨЛҮМ',
  'learn.courseFrom': 'Курс от {{partner}}',
  'learn.noEnergyTitle': 'Бүгүнкү энергия бүттү!',
  'learn.noEnergyDesc': 'Жаңы энергия {{time}} ден кийин · же дүкөндөн сатып ал',
  'learn.cardsCount': '{{n}} карта',
  'learn.start': 'БАШТОО',
  'learn.noEnergyShort': 'ЭНЕРГИЯ ЖОК',

  // ── lesson ──
  'lesson.noEnergyTitle': 'Бүгүнкү энергия бүттү!',
  'lesson.noEnergyDesc': 'Жаңы энергия {{time}} ден кийин чыгат.',
  'lesson.goToShop': 'Дүкөнгө өтүү',
  'lesson.goBack': 'Артка кайтуу',
  'lesson.notFound': 'Сабак табылган жок',
  'lesson.backArrow': '← Артка',
  'lesson.correct': 'Туура!',
  'lesson.correctAnswerIs': 'Туура жооп: {{answer}}',
  'lesson.stepCounter': '{{current}}/{{total}} кадам',
  'lesson.resultPerfect': 'Мыкты!',
  'lesson.resultGood': 'Жакшы!',
  'lesson.reviewDone': 'Кайталоо аяктады',
  'lesson.lessonDone': 'Сабак аяктады',
  'lesson.perfectBadge': 'Идеал!',
  'lesson.newAchievement': 'ЖАҢЫ ЖЕТИШКЕНДИК',
  'lesson.share': 'Жетишкендикти бөлүшүү',
  'lesson.shareText': 'Мен JashMen\'де "{{lesson}}" сабагын аяктадым жана {{xp}} XP таптым! 🏆',

  // ── lesson preview sheet (path node tap) ──
  'lesson.previewLesson': 'Сабак',
  'lesson.previewCheckpoint': 'Текшерүү',
  'lesson.previewAvailableDesc': '{{n}} суроодон турат. Аякта да, {{xp}} XPге чейин жана монета тап!',
  'lesson.previewCompletedDesc': 'Бул сабакты мурда аяктагансың. Кайра өтүп, билимиңди чыңда.',
  'lesson.previewGatedDesc': 'Бүгүнкү акысыз сабактарың бүттү. Дүкөндөн кошумча энергия сатып ал же эртеңге чейин күт.',
  'lesson.previewNoEnergyBadge': 'Энергия жок',
  'lesson.previewQuestions': '{{n}} суроо',
  'lesson.previewXpUpTo': '+{{xp}} XPге чейин',
  'lesson.previewCompletedBadge': 'Аякталды',
  'lesson.previewStart': 'Баштоо',
  'lesson.previewReview': 'Кайталоо',

  // ── shop / marketplace ──
  'shop.title': 'Дүкөн',
  'shop.subtitle': 'Монетаңды сарп кыл',
  'shop.empty': 'Дүкөн бош',
  'shop.owned': 'Сатып алынды',
  'shop.partnerPrizes': 'Өнөктөштөрдөн сыйлык',
  'shop.buySuccess': '{{title}} сатып алынды!',
  'shop.redeemInstructions': 'Бул кодду көрсөтүп сыйлыгыңды ал:',

  // ── profile ──
  'profile.leagueBadge': '{{name}} лигасы',
  'profile.totalXp': 'Жалпы XP',
  'profile.streak': 'Стрик',
  'profile.lessons': 'Сабак',
  'profile.coinsTitle': 'Jashmen Coins',
  'profile.coinsDesc': 'Дүкөндөн жана сыйлыктарга алмаштыруу үчүн',
  'profile.achievements': 'Жетишкендиктер',

  // ── settings ──
  'settings.title': 'Орнотуулар',
  'settings.brightMode': 'Жарык режим',
  'settings.brightDesc': 'Ачык фон — көзгө жеңил',
  'settings.sound': 'Үн',
  'settings.soundDesc': 'Жооп берүүдөгү сигналдар',
  'settings.animations': 'Анимациялар',
  'settings.animationsDesc': 'Жылтылдак эффекттер',
  'settings.language': 'Тил',
  'settings.languageDesc': 'Интерфейстин тили',
  'settings.notifications': 'Эскертмелер',
  'settings.notificationsDesc': 'Стрик үзүлүп баратканда эскертет',
  'settings.version': 'Версия',
  'settings.editName': 'Атын өзгөртүү',

  // ── league / right panel ──
  'league.prevLeagues': 'Мурунку лигалар',
  'league.nextLeagues': 'Кийинки лигалар',
  'league.myLeague': 'Лигаң',
  'league.next': 'Кийинки:',
  'league.xpLeft': 'XP калды',
  'league.streakBadge': '{{n}} күндүк стрик',
  'league.streakDesc': 'Үзгүлтүксүз окуу',
  'league.rating': 'Рейтинг',
  'league.participants': 'катышуучу',
  'league.leaderXp': 'лидер XP',
  'league.myRank': 'сенин орун',
  'league.emptyTitle': 'Бул лигада азырынча эч ким жок',
  'league.emptyDesc': 'Биринчи болуп XP топто!',
};
