// src/locales/ru.js — Russian. Any key missing here falls back to Kyrgyz
// (see i18n.jsx#LocaleProvider) rather than showing blank — safe to add
// keys incrementally.
export const ru = {
  // ── common ──
  'common.loading': '...',
  'common.continue': 'Продолжить',
  'common.finish': 'Завершить',
  'common.gotIt': 'Понятно',
  'common.error': 'Произошла ошибка',
  'common.cancel': 'Отмена',
  'common.close': 'Закрыть',

  // ── nav ──
  'nav.learn': 'Учёба',
  'nav.league': 'Лига',
  'nav.shop': 'Магазин',
  'nav.profile': 'Профиль',
  'nav.settings': 'Настройки',
  'nav.logout': 'Выйти из аккаунта',
  'nav.achievements': 'Достижения',

  // ── auth ──
  'auth.tagline': 'Финансовая грамотность — как игра',
  'auth.or': 'или',
  'auth.google': 'Продолжить с Google',
  'auth.googleFailed': 'Не удалось войти через Google',
  'auth.login': 'Войти',
  'auth.signup': 'Регистрация',
  'auth.namePlaceholder': 'Ваше имя',
  'auth.passwordPlaceholder': 'Пароль',
  'auth.createAccount': 'Создать аккаунт',

  // ── learn (path) ──
  'learn.moduleLabel': 'РАЗДЕЛ {{n}}',
  'learn.courseFrom': 'Курс от {{partner}}',
  'learn.noEnergyTitle': 'Энергия на сегодня закончилась!',
  'learn.noEnergyDesc': 'Новая энергия через {{time}} · или купи в магазине',
  'learn.cardsCount': '{{n}} карточек',
  'learn.start': 'НАЧАТЬ',
  'learn.noEnergyShort': 'НЕТ ЭНЕРГИИ',

  // ── lesson ──
  'lesson.noEnergyTitle': 'Энергия на сегодня закончилась!',
  'lesson.noEnergyDesc': 'Новая энергия появится через {{time}}.',
  'lesson.goToShop': 'Перейти в магазин',
  'lesson.goBack': 'Назад',
  'lesson.notFound': 'Урок не найден',
  'lesson.backArrow': '← Назад',
  'lesson.correct': 'Верно!',
  'lesson.correctAnswerIs': 'Правильный ответ: {{answer}}',
  'lesson.stepCounter': '{{current}}/{{total}} шаг',
  'lesson.resultPerfect': 'Отлично!',
  'lesson.resultGood': 'Хорошо!',
  'lesson.reviewDone': 'Повторение завершено',
  'lesson.lessonDone': 'Урок завершён',
  'lesson.perfectBadge': 'Идеально!',
  'lesson.newAchievement': 'НОВОЕ ДОСТИЖЕНИЕ',
  'lesson.share': 'Поделиться успехом',
  'lesson.shareText': 'Я закрыл урок "{{lesson}}" в JashMen и получил {{xp}} XP! 🏆',

  // ── lesson preview sheet (тап по узлу пути) ──
  'lesson.previewLesson': 'Урок',
  'lesson.previewCheckpoint': 'Проверка',
  'lesson.previewAvailableDesc': 'Состоит из {{n}} вопросов. Заверши урок, чтобы получить до {{xp}} XP и монеты!',
  'lesson.previewCompletedDesc': 'Ты уже прошёл этот урок. Повтори его ещё раз, чтобы закрепить материал.',
  'lesson.previewGatedDesc': 'Бесплатные уроки на сегодня закончились. Купи энергию в магазине или подожди до завтра.',
  'lesson.previewNoEnergyBadge': 'Нет энергии',
  'lesson.previewQuestions': '{{n}} вопросов',
  'lesson.previewXpUpTo': 'до +{{xp}} XP',
  'lesson.previewCompletedBadge': 'Завершено',
  'lesson.previewStart': 'Начать',
  'lesson.previewReview': 'Повторить',

  // ── shop / marketplace ──
  'shop.title': 'Магазин',
  'shop.subtitle': 'Трать свои монеты',
  'shop.empty': 'Магазин пуст',
  'shop.owned': 'Куплено',
  'shop.partnerPrizes': 'Призы от партнёров',
  'shop.buySuccess': '{{title}} куплено!',
  'shop.redeemInstructions': 'Покажи этот код и получи приз:',

  // ── profile ──
  'profile.leagueBadge': 'Лига «{{name}}»',
  'profile.totalXp': 'Всего XP',
  'profile.streak': 'Серия',
  'profile.lessons': 'Уроки',
  'profile.coinsTitle': 'Jashmen Coins',
  'profile.coinsDesc': 'Для покупок в магазине и обмена призов',
  'profile.achievements': 'Достижения',

  // ── settings ──
  'settings.title': 'Настройки',
  'settings.brightMode': 'Светлая тема',
  'settings.brightDesc': 'Светлый фон — легче для глаз',
  'settings.sound': 'Звук',
  'settings.soundDesc': 'Сигналы при ответах',
  'settings.animations': 'Анимации',
  'settings.animationsDesc': 'Красивые эффекты',
  'settings.language': 'Язык',
  'settings.languageDesc': 'Язык интерфейса',
  'settings.notifications': 'Уведомления',
  'settings.notificationsDesc': 'Напомнит, когда серия вот-вот прервётся',
  'settings.version': 'Версия',
  'settings.editName': 'Изменить имя',

  // ── league / right panel ──
  'league.prevLeagues': 'Предыдущие лиги',
  'league.nextLeagues': 'Следующие лиги',
  'league.myLeague': 'Твоя лига',
  'league.next': 'Следующая:',
  'league.xpLeft': 'XP осталось',
  'league.streakBadge': '{{n}}-дневная серия',
  'league.streakDesc': 'Учёба без перерыва',
  'league.rating': 'Рейтинг',
  'league.participants': 'участников',
  'league.leaderXp': 'лидер XP',
  'league.myRank': 'твоё место',
  'league.emptyTitle': 'В этой лиге пока никого нет',
  'league.emptyDesc': 'Стань первым, набери XP!',
};
