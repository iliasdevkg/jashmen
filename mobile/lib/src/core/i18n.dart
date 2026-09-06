/// Bilingual/trilingual text handling.
///
/// Two separate things share this file because they're the same problem at
/// different layers:
///
///  1. **UI strings** — ported from the web app's src/locales/{ky,ru,en}.js.
///  2. **Content strings** — lesson/quiz text comes back from the API as
///     `{"ky": "...", "ru": "..."}` maps, or, for content written before
///     that change, as a bare string. `localizedContent()` handles both.
library;

import 'package:flutter/widgets.dart';

enum AppLocale {
  ky('ky', 'Кыргызча'),
  ru('ru', 'Русский'),
  en('en', 'English');

  const AppLocale(this.code, this.label);
  final String code;
  final String label;

  static AppLocale fromCode(String? code) =>
      AppLocale.values.firstWhere((l) => l.code == code, orElse: () => AppLocale.ky);
}

/// Reads a content field that may be a `{ky, ru}` map or a plain legacy
/// string. Falls back ky → ru → en → first non-empty, so a half-translated
/// lesson renders something rather than a blank card.
String localizedContent(dynamic value, AppLocale locale) {
  if (value == null) return '';
  if (value is String) return value;
  if (value is Map) {
    final map = value.map((k, v) => MapEntry(k.toString(), v?.toString() ?? ''));
    for (final key in [locale.code, 'ky', 'ru', 'en']) {
      final v = map[key];
      if (v != null && v.trim().isNotEmpty) return v;
    }
    final any = map.values.where((v) => v.trim().isNotEmpty);
    return any.isEmpty ? '' : any.first;
  }
  return value.toString();
}

// ── Locale-aware formatting ───────────────────────────────────────────────
//
// Small and hand-rolled on purpose: the app needs exactly three shapes
// (grouped integers, a som amount, a long date) in exactly three locales,
// and pulling in `intl` for that would add a dependency plus a locale-data
// initialisation step at startup for no gain.

/// Kyrgyz vowels, grouped by the harmony class that decides which vowel a
/// suffix takes. `ё/ю/я` appear in Russian loanwords and abbreviations, so
/// they map onto their nearest native class.
const _kyVowelClass = {
  'а': 'ы', 'ы': 'ы', 'я': 'ы',
  'о': 'у', 'у': 'у', 'ю': 'у', 'ё': 'у',
  'э': 'и', 'е': 'и', 'и': 'и',
  'ө': 'ү', 'ү': 'ү',
};

const _kyVoiceless = {'к', 'п', 'с', 'т', 'ф', 'х', 'ц', 'ч', 'ш', 'щ'};

/// Kyrgyz genitive: "КГТУ" → "КГТУНУН", "АУЦА" → "АУЦАНЫН",
/// "САЛЫМБЕКОВ" → "САЛЫМБЕКОВДУН".
///
/// Needed because headings like "КГТУНУН ТОП 10 СТУДЕНТИ" are built from a
/// university name that varies — concatenating one fixed suffix would be
/// wrong for most of them. Vowel harmony picks the suffix vowel; the final
/// letter picks the consonant (-н- after a vowel, -т- after a voiceless
/// consonant, -д- otherwise).
String kyGenitive(String word) {
  final trimmed = word.trim();
  if (trimmed.isEmpty) return trimmed;

  final lower = trimmed.toLowerCase();
  final upper = trimmed == trimmed.toUpperCase();

  var vowel = 'ы';
  for (var i = lower.length - 1; i >= 0; i--) {
    final v = _kyVowelClass[lower[i]];
    if (v != null) {
      vowel = v;
      break;
    }
  }

  final last = lower[lower.length - 1];
  final lead = _kyVowelClass.containsKey(last)
      ? 'н'
      : (_kyVoiceless.contains(last) ? 'т' : 'д');

  final suffix = '$lead$vowel\u043D';  // \u043D is Cyrillic 'н'
  return trimmed + (upper ? suffix.toUpperCase() : suffix);
}

/// 1248560 → "1 248 560". The separator is a non-breaking space so an XP
/// figure never wraps across two lines mid-number.
String formatGrouped(int value) {
  final digits = value.abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write('\u00A0');
    buffer.write(digits[i]);
  }
  return '${value < 0 ? '-' : ''}$buffer';
}

/// "120 000 сом" / "120 000 KGS" — the currency is written out in Kyrgyz and
/// Russian, and given as the ISO code in English where "som" would not read.
/// Non-breaking throughout: an amount that wraps between its digits and its
/// currency reads as two separate facts.
String formatSom(int amount, AppLocale locale) =>
    '${formatGrouped(amount)}\u00A0${locale == AppLocale.en ? 'KGS' : 'сом'}';

const _monthsKy = [
  'ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ',
  'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ',
];

/// Russian dates take the genitive month ("18 сентября"), which is a
/// different word from the nominative Kyrgyz uses.
const _monthsRu = [
  'ЯНВАРЯ', 'ФЕВРАЛЯ', 'МАРТА', 'АПРЕЛЯ', 'МАЯ', 'ИЮНЯ',
  'ИЮЛЯ', 'АВГУСТА', 'СЕНТЯБРЯ', 'ОКТЯБРЯ', 'НОЯБРЯ', 'ДЕКАБРЯ',
];

const _monthsEn = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

/// "18 СЕНТЯБРЬ 2025" / "18 СЕНТЯБРЯ 2025" / "SEPTEMBER 18, 2025".
/// Upper-case because every date in the design sits in a label slot.
String formatLongDate(DateTime date, AppLocale locale) => switch (locale) {
      AppLocale.ky => '${date.day} ${_monthsKy[date.month - 1]} ${date.year}',
      AppLocale.ru => '${date.day} ${_monthsRu[date.month - 1]} ${date.year}',
      AppLocale.en => '${_monthsEn[date.month - 1]} ${date.day}, ${date.year}',
    };

/// UI copy. Kept as one flat map per locale — mirrors the shape of the web
/// app's locale files so the two stay diffable by eye.
const Map<String, Map<String, String>> _strings = {
  'ky': {
    'nav.learn': 'Окуу',
    'nav.league': 'Лига',
    'nav.shop': 'Дүкөн',
    'nav.profile': 'Профиль',
    'nav.settings': 'Жөндөөлөр',
    'nav.logout': 'Чыгуу',

    'auth.loginTitle': 'Кайра кош келиңиз',
    'onboarding.skip': 'Өткөрүп жиберүү',
    'onboarding.next': 'Кийинки',
    'onboarding.getStarted': 'Баштайлы',
    'onboarding.slide1.title': 'Каржы сабаттуулугун досторуң менен атаандашып үйрөн!',
    'onboarding.slide2.title': 'Оңой үйрөн, ишенимдүү башкар!',
    'onboarding.slide3.title': 'Акча сен үчүн иштесин!',

    'auth.tagline': 'Оюн аркылуу акчаңды башкарганды үйрөн!',
    'auth.createAccount': 'Аккаунт түзүү',
    'auth.signupTitle': 'JashMen\'ге кош келиңиз',
    'auth.loginSubtitle': 'Окууну улантуу үчүн кириңиз',
    'auth.signupSubtitle': 'Каржы сабаттуулугун бүгүн баштаңыз',
    'auth.name': 'Атыңыз',
    'auth.email': 'Электрондук почта',
    'auth.password': 'Сыр сөз',
    'auth.login': 'Кирүү',
    'auth.signup': 'Катталуу',
    'auth.noAccount': 'Аккаунтуңуз жокпу?',
    'auth.haveAccount': 'Аккаунтуңуз барбы?',
    'auth.nameRequired': 'Атыңызды жазыңыз',
    'auth.emailRequired': 'Электрондук почтаңызды жазыңыз',
    'auth.emailInvalid': 'Электрондук почта туура эмес',
    'auth.passwordShort': 'Сырсөз жок дегенде 6 белгиден турушу керек',
    'auth.or': 'же',
    'auth.google': 'Google менен улантуу',
    'auth.googleFailed': 'Google аркылуу кирүү ишке ашкан жок',
    'auth.googleUnavailable': 'Google менен кирүү азырынча күйгүзүлө элек',
    'auth.googleCancelled': 'Кирүү жокко чыгарылды',

    'learn.title': 'Окуу',
    'learn.noEnergyTitle': 'Энергия түгөндү',
    'learn.noEnergyDesc': 'Жаңы сабактар {time} кийин ачылат',
    'learn.empty': 'Азырынча сабак жок',
    'learn.emptyDesc': 'Жакында жаңы модулдар кошулат',
    'learn.courseFrom': 'Курс от {partner}',

    'lesson.start': 'Баштоо',
    'lesson.review': 'Кайталоо',
    'lesson.continue': 'Улантуу',
    'lesson.nextLesson': 'Кийинки сабак',
    'lesson.playVideo': 'Видеону ойнотуу',
    'lesson.backToPath': 'Үйрөнүүгө кайтуу',
    'lesson.check': 'Текшерүү',
    'lesson.correct': 'Туура!',
    'lesson.wrong': 'Туура эмес',
    'lesson.correctAnswer': 'Туура жооп:',
    'lesson.explanation': 'Түшүндүрмө',
    'lesson.matchPrompt': 'Жуптарды тап',
    'lesson.buildPrompt': 'Сүйлөмдү түз',
    'lesson.buildHint': 'Сөздөрдү ирети менен бас',
    'lesson.complete': 'Сабак бүттү!',
    'lesson.resultPerfect': 'Мыкты!',
    'lesson.resultGood': 'Жакшы!',
    'lesson.lessonDone': 'Сабак аяктады',
    'lesson.reviewDone': 'Кайталоо аяктады',
    'lesson.perfectBadge': 'Идеал!',
    'lesson.newAchievement': 'Жаңы жетишкендик',
    'lesson.accuracyLabel': 'Туура жооптор',
    'lesson.quizCount': '{n} суроо',
    'lesson.upToXp': '+{n} XP чейин',
    'lesson.previewCheckpoint': 'Текшерүү',
    'lesson.previewLesson': 'Сабак',
    'lesson.previewAvailableDesc': '{n} тапшырмадан турат. Сабакты аякта да, {xp}XPге чейин топто жана тыйын чогулт!',
    'lesson.previewCompletedDesc': 'Бул сабакты мурда аяктагансың. Кайра өтүп, билимиңди бышыкта.',
    'lesson.previewGatedDesc': 'Бүгүнкү акысыз сабактарың бүттү. Дүкөндөн кошумча энергия сатып ал же эртеңге чейин күт.',
    'lesson.previewNoEnergyBadge': 'Энергия жок',
    'lesson.previewCompletedBadge': 'Аякталды',
    'lesson.exit': 'Чыгуу',
    'lesson.exitConfirm': 'Сабактан чыгасызбы? Прогресс сакталбайт.',
    'lesson.noEnergy': 'Энергия жок',
    'lesson.goToShop': 'Дүкөнгө өтүү',

    'league.title': 'Лига',
    'league.yourRank': 'Сиздин орун',
    'league.empty': 'Азырынча катышуучу жок',
    'league.participants': 'катышуучу',
    'league.leaderXp': 'лидер XP',
    'league.yourPlace': 'сенин ордуң',
    'league.days': '{n} күн',
    'league.locked': 'Жабык',
    'league.xpNeeded': '{n}+ XP',
    'league.tabGeneral': 'ЖАЛПЫ ЛИГА',
    'league.tabUni': 'УНИВЕРСИТЕТ ЛИГАСЫ',
    'league.generalSubtitle': 'Бардык оюнчулар менен жарыш!',

    'uni.roleTitle': 'РОЛЬ ТАНДА',
    'uni.roleSubtitle': 'Университет лигасына ким болуп катышасың?',
    'uni.roleStudent': 'СТУДЕНТ',
    'uni.roleStudentDesc': 'Мен өзүмдүн университетимдин атынан катышам',
    'uni.roleViewer': 'КӨРҮҮЧҮ',
    'uni.roleViewerDesc': 'Мен катышпайм, жөн гана рейтингди көрөм',
    'uni.pickTitle': 'ӨЗҮНДҮН УНИВЕРСИТЕТИҢДИ ТАНДА',
    'uni.pickSubtitle': 'Кайсы университеттин атынан ойнойсуң?',
    'uni.pickSubtitleViewer': 'Кайсы университеттин рейтингин көргүң келет?',
    'uni.ok': 'OK',
    'uni.close': 'Жабуу',
    'uni.change': 'Өзгөртүү',
    'uni.leave': 'Чыгуу',
    'uni.leaveConfirm': 'Университет лигасынан чыгасыңбы? Ушул кампуста чогулткан бардык XP жоголот жана сен жалпы лигага кайтасың. Артка кайтарылгыс.',
    'uni.organizer': 'Уюштуруучу:',
    'uni.address': 'Дареги:',
    'uni.prizePool': 'БАЙГЕ ФОНДУ',
    'uni.sponsor': 'Спонсор',
    'uni.studentsCount': 'Катышкан студент',
    'uni.viewersCount': 'Көрүүчүлөр',
    'uni.totalCollectedNote': 'Бул университеттин студенттери чогулткан жалпы XP. Ар бир аяктаган сабак ушул санды өстүрөт.',
    'uni.rulesValue': 'Эрежелер',
    'uni.rulesLabel': 'Шарттар жана мөөнөт',
    'uni.prizes': 'БАЙГЕ',
    'uni.place1': '1-ОРУН',
    'uni.place2': '2-ОРУН',
    'uni.place3': '3-ОРУН',
    'uni.gifts': 'БЕЛЕК',
    'uni.giftsTop': 'ТОП {n}',
    'uni.totalCollected': 'ЖАЛПЫ ЧОГУЛГАН',
    'uni.start': 'БАШТАЛЫШЫ',
    'uni.end': 'БҮТҮШҮ',
    'uni.topStudentsTitle': '{uni} ТОП 10 СТУДЕНТИ',
    'uni.noContestTitle': 'Бул университетте азырынча конкурс жок',
    'uni.noContestDesc': 'Уюштуруучулар конкурсту жарыялаганда, ал ушул жерден көрүнөт.',
    'uni.chooseAnother': 'Башка университет тандоо',
    'uni.emptyBoard': 'Азырынча студент катталган жок',
    'uni.viewersAria': '{n} көрүүчү',
    'uni.viewerXpNote': 'Көрүүчүнүн XPси университет лигасына кошулбайт — жалпы лигага гана эсептелет.',
    'uni.viewerHint': 'Студентти басып, ага энергияңды бер',
    'uni.studentHint': 'Өз атыңды бассаң, сени колдогондорду көрөсүң',
    'uni.you': 'Сен',
    'uni.supportTitle': 'Лидер менен энергияңды бөлүш!',
    'uni.supportPlace': '{n}-орунда',
    'uni.supportYourEnergy': 'СЕНИН ЭНЕРГИЯҢ',
    'uni.supportCta': 'ЭНЕРГИЯ БЕРҮҮ',
    'uni.supportCtaSub': 'энергия жөнөтүү',
    'uni.supportNote': 'Колдоо XPге таасир этпейт, бирок лидерге чоң күч берет!',
    'uni.supportSent': '{name} сенин колдооңду алды!',
    'uni.supportAlready': 'Бул мезгилде энергия бердиң, кийинкисин күт',
    'uni.supportNoEnergy': 'Энергияң жетишсиз',
    'uni.supportersTitle': 'СЕНИ КОЛДОГОНДОР',
    'uni.supportersEmpty': 'Азырынча эч ким энергия берген жок',
    'uni.supportersCta': 'Сени колдогондор',
    'uni.supportersCount': '{n} колдоочу',
    'uni.boardError': 'Рейтингди жүктөө мүмкүн болбоду',

    'shop.title': 'Дүкөн',
    'shop.buy': 'Сатып алуу',
    'shop.owned': 'Сатып алынган',
    'shop.notEnough': 'Монета жетишсиз',
    'shop.empty': 'Дүкөн бош',
    'shop.partnersTitle': 'Өнөктөштөр',
    'shop.prizeCount': '{n} сыйлык',
    'shop.noPrizesForPartner': 'Бул өнөктөштүн азырынча сыйлыгы жок',
    'shop.soldOut': 'Бүттү',
    'shop.redeemInstructions': 'Бул кодду көрсөтүп сыйлыгыңды ал',
    'shop.yourReceipt': 'Текшерүү коду: {code}',
    'shop.showAtTill': 'Ушул кодду дүкөндө көрсөтүңүз',
    'shop.redeemed': 'Сыйлык алынды!',
    'shop.whatIsCoinsTitle': 'Акча деген эмне?',
    'shop.whatIsCoinsDesc':
        'Акча — JashMenдин ички монетасы. Сабактарды аяктап акча тап, аны дүкөндөгү буюмдарга жана өнөктөштөрдүн сыйлыктарына алмаштыр.',
    'common.back': 'Артка',
    'common.copied': 'Көчүрүлдү',

    'profile.title': 'Профиль',
    'profile.stats': 'Статистика',
    'profile.achievements': 'Жетишкендиктер',
    'profile.xp': 'XP',
    'profile.streak': 'Серия',
    'profile.streakSub': 'Күнүмдүк серия',
    'profile.streakWeek': 'Жума',
    'profile.streakMonth': 'Ай',
    'profile.streakPrevMonth': 'Мурунку ай',
    'profile.streakNextMonth': 'Кийинки ай',
    'profile.streakNoData': 'маалымат жок',
    'profile.streakLostTitle': '{n} күндүк серия үзүлдү',
    'profile.streakLostDesc': 'Бүгүн эле {cost} энергия менен кайтарып ала аласың — эртең кеч болот.',
    'profile.streakRepairCta': '{cost} энергия менен кайтаруу',
    'profile.streakRepairBusy': 'Кайтарылып жатат…',
    'profile.streakRepairNoEnergy': 'Энергия жетишсиз — энергия толгондо кайтара аласың',
    'profile.streakStudied': '{total} күндүн {n} күнү окудуң',
    'profile.coins': 'Монета',
    'profile.lessons': 'Сабактар',
    'profile.noAchievements': 'Азырынча жетишкендик жок',
    'profile.changePhoto': 'Сүрөттү өзгөртүү',
    'profile.coupons': 'Купондорум',
    'profile.couponsEmpty':
        'Азырынча купон жок. Дүкөндөгү өнөктөштөрдөн сыйлык алмаштырсаң, коду ушул жерде сакталат.',
    'profile.couponTapToCopy': 'Көчүрүү үчүн бас',
    'profile.couponPartnerCode': 'Өнөктөштүн коду — дүкөндө ушуну көрсөтүңүз',
    'profile.couponOwnCode': 'JashMen коду',

    'settings.title': 'Жөндөөлөр',
    'settings.editName': 'Атын өзгөртүү',
    'settings.language': 'Тил',
    'settings.theme': 'Тема',
    'settings.themeDark': 'Караңгы',
    'settings.themeBright': 'Жарык',
    'settings.sound': 'Үн',
    'settings.animations': 'Анимациялар',
    'settings.logout': 'Чыгуу',
    'settings.logoutConfirm': 'Аккаунттан чыгасызбы?',
    'settings.account': 'Аккаунт',
    'settings.changePassword': 'Сырсөздү өзгөртүү',
    'settings.changePasswordDesc': 'Кирүү сырсөзүн жаңылоо',
    'settings.setPassword': 'Сырсөз коюу',
    'settings.setPasswordDesc': 'Google менен киргенсиң — email жана сырсөз менен да кире аласың',
    'settings.currentPassword': 'Азыркы сырсөз',
    'settings.newPassword': 'Жаңы сырсөз',
    'settings.repeatPassword': 'Жаңы сырсөздү кайталаңыз',
    'settings.passwordSaved': 'Сырсөз жаңыланды',
    'settings.passwordMismatch': 'Сырсөздөр дал келбейт',
    'settings.passwordShort': 'Сырсөз жок дегенде 6 белгиден турушу керек',
    'common.save': 'Сактоо',
    'streak.dayStreak': 'күндүк серия!',
    'streak.perfectWeekStart': 'Идеалдуу жумага жол башталды!',
    'streak.perfectWeekHalf': 'Идеалдуу жумага жарым жол калды!',
    'streak.perfectWeekClose': 'Идеалдуу жумага бир аз калды!',
    'streak.perfectWeekDone': 'Идеалдуу жума! Азаматсың!',
    'streak.continue': 'УЛАНТУУ',
    'streak.dow0': 'Жк',
    'streak.dow1': 'Дш',
    'streak.dow2': 'Шш',
    'streak.dow3': 'Шр',
    'streak.dow4': 'Бш',
    'streak.dow5': 'Жм',
    'streak.dow6': 'Иш',
    'settings.about': 'Колдонмо жөнүндө',
    'settings.privacy': 'Купуялык саясаты',
    'settings.deleteAccount': 'Аккаунтту өчүрүү',
    'auth.apple': 'Apple менен улантуу',
    'auth.appleFailed': 'Apple менен кирүү болбоду. Кайра аракет кылыңыз.',
    'settings.deleteWarning': 'Аккаунтуңуз биротоло өчүрүлөт: email, атыңыз, сүрөтүңүз, сырсөзүңүз, сабактарыңыз, монеталарыңыз жана купондоруңуз кайтарылгыс жоголот. Университетиңиздин жалпы упайы гана калат — ал эч кимге байланышпайт. Бул аракетти артка кайтарууга болбойт.',
    'settings.deleteTypePassword': 'Ырастоо үчүн сырсөзүңүздү жазыңыз',
    'settings.deleteTypeWord': 'Ырастоо үчүн «{word}» деп жазыңыз',
    'settings.deleteConfirm': 'Биротоло өчүрүү',
    'settings.version': 'Версия',

    'common.loading': 'Жүктөлүүдө...',
    'common.retry': 'Кайталоо',
    'common.cancel': 'Жокко чыгаруу',
    'common.close': 'Жабуу',
    'common.zoomImage': 'Сүрөттү чоңойтуу',
    'common.confirm': 'Ооба',
    'common.error': 'Ката кетти',
    'common.offline': 'Интернет байланышы жок',
    'common.serverError': 'Сервер жооп бербей жатат',
  },
  'ru': {
    'nav.learn': 'Учёба',
    'nav.league': 'Лига',
    'nav.shop': 'Магазин',
    'nav.profile': 'Профиль',
    'nav.settings': 'Настройки',
    'nav.logout': 'Выйти',

    'auth.loginTitle': 'С возвращением',
    'onboarding.skip': 'Пропустить',
    'onboarding.next': 'Далее',
    'onboarding.getStarted': 'Начать',
    'onboarding.slide1.title': 'Учись финансовой грамотности, соревнуясь с друзьями!',
    'onboarding.slide2.title': 'Учись легко, управляй уверенно!',
    'onboarding.slide3.title': 'Пусть деньги работают на тебя!',

    'auth.tagline': 'Учись управлять деньгами через игру!',
    'auth.createAccount': 'Создать аккаунт',
    'auth.signupTitle': 'Добро пожаловать в JashMen',
    'auth.loginSubtitle': 'Войдите, чтобы продолжить обучение',
    'auth.signupSubtitle': 'Начните финансовую грамотность сегодня',
    'auth.name': 'Ваше имя',
    'auth.email': 'Электронная почта',
    'auth.password': 'Пароль',
    'auth.login': 'Войти',
    'auth.signup': 'Регистрация',
    'auth.noAccount': 'Нет аккаунта?',
    'auth.haveAccount': 'Уже есть аккаунт?',
    'auth.nameRequired': 'Введите имя',
    'auth.emailRequired': 'Введите электронную почту',
    'auth.emailInvalid': 'Некорректная электронная почта',
    'auth.passwordShort': 'Пароль минимум из 6 символов',
    'auth.or': 'или',
    'auth.google': 'Продолжить с Google',
    'auth.googleFailed': 'Не удалось войти через Google',
    'auth.googleUnavailable': 'Вход через Google пока не включён',
    'auth.googleCancelled': 'Вход отменён',

    'learn.title': 'Учёба',
    'learn.noEnergyTitle': 'Энергия закончилась',
    'learn.noEnergyDesc': 'Новые уроки откроются через {time}',
    'learn.empty': 'Пока нет уроков',
    'learn.emptyDesc': 'Скоро появятся новые модули',
    'learn.courseFrom': 'Курс от {partner}',

    'lesson.start': 'Начать',
    'lesson.review': 'Повторить',
    'lesson.continue': 'Продолжить',
    'lesson.nextLesson': 'Следующий урок',
    'lesson.playVideo': 'Смотреть видео',
    'lesson.backToPath': 'Вернуться к обучению',
    'lesson.check': 'Проверить',
    'lesson.correct': 'Верно!',
    'lesson.wrong': 'Неверно',
    'lesson.correctAnswer': 'Правильный ответ:',
    'lesson.explanation': 'Пояснение',
    'lesson.matchPrompt': 'Найди пары',
    'lesson.buildPrompt': 'Составь предложение',
    'lesson.buildHint': 'Нажимай на слова по порядку',
    'lesson.complete': 'Урок завершён!',
    'lesson.resultPerfect': 'Отлично!',
    'lesson.resultGood': 'Хорошо!',
    'lesson.lessonDone': 'Урок завершён',
    'lesson.reviewDone': 'Повторение завершено',
    'lesson.perfectBadge': 'Идеально!',
    'lesson.newAchievement': 'Новое достижение',
    'lesson.accuracyLabel': 'Правильные ответы',
    'lesson.quizCount': '{n} вопросов',
    'lesson.upToXp': 'до +{n} XP',
    'lesson.previewCheckpoint': 'Проверка',
    'lesson.previewLesson': 'Урок',
    'lesson.previewAvailableDesc': 'Состоит из {n} заданий. Заверши урок, чтобы получить до {xp} XP и монеты!',
    'lesson.previewCompletedDesc': 'Ты уже прошёл этот урок. Повтори его ещё раз, чтобы закрепить материал.',
    'lesson.previewGatedDesc': 'Бесплатные уроки на сегодня закончились. Купи энергию в магазине или подожди до завтра.',
    'lesson.previewNoEnergyBadge': 'Нет энергии',
    'lesson.previewCompletedBadge': 'Завершено',
    'lesson.exit': 'Выйти',
    'lesson.exitConfirm': 'Выйти из урока? Прогресс не сохранится.',
    'lesson.noEnergy': 'Нет энергии',
    'lesson.goToShop': 'Перейти в магазин',

    'league.title': 'Лига',
    'league.yourRank': 'Ваше место',
    'league.empty': 'Пока нет участников',
    'league.participants': 'участников',
    'league.leaderXp': 'лидер XP',
    'league.yourPlace': 'твоё место',
    'league.days': '{n} дн.',
    'league.locked': 'Закрыто',
    'league.xpNeeded': '{n}+ XP',
    'league.tabGeneral': 'ОБЩАЯ ЛИГА',
    'league.tabUni': 'ЛИГА ВУЗОВ',
    'league.generalSubtitle': 'Соревнуйтесь со всеми игроками!',

    'uni.roleTitle': 'ВЫБЕРИ РОЛЬ',
    'uni.roleSubtitle': 'Кем ты участвуешь в вузовской лиге?',
    'uni.roleStudent': 'СТУДЕНТ',
    'uni.roleStudentDesc': 'Я студент и представляю свой университет',
    'uni.roleViewer': 'ЗРИТЕЛЬ',
    'uni.roleViewerDesc': 'Я не участвую, только смотрю рейтинг',
    'uni.pickTitle': 'ВЫБЕРИ СВОЙ УНИВЕРСИТЕТ',
    'uni.pickSubtitle': 'Выбери университет, за который будешь играть',
    'uni.pickSubtitleViewer': 'Выбери университет, чей рейтинг хочешь смотреть',
    'uni.ok': 'OK',
    'uni.close': 'Закрыть',
    'uni.change': 'Изменить',
    'uni.leave': 'Выйти',
    'uni.leaveConfirm': 'Выйти из университетской лиги? Все XP, набранные в этом кампусе, обнулятся, и ты вернёшься в общую лигу. Это необратимо.',
    'uni.organizer': 'Организатор:',
    'uni.address': 'Адрес:',
    'uni.prizePool': 'ПРИЗОВОЙ ФОНД',
    'uni.sponsor': 'Спонсор',
    'uni.studentsCount': 'Участников',
    'uni.viewersCount': 'Зрителей',
    'uni.totalCollectedNote': 'Общий XP, собранный студентами этого вуза. Каждый пройденный урок увеличивает это число.',
    'uni.rulesValue': 'Правила',
    'uni.rulesLabel': 'Условия и сроки',
    'uni.prizes': 'ПРИЗЫ',
    'uni.place1': '1-МЕСТО',
    'uni.place2': '2-МЕСТО',
    'uni.place3': '3-МЕСТО',
    'uni.gifts': 'ПОДАРКИ',
    'uni.giftsTop': 'ТОП {n}',
    'uni.totalCollected': 'ВСЕГО СОБРАНО',
    'uni.start': 'НАЧАЛО',
    'uni.end': 'ЗАВЕРШЕНИЕ',
    'uni.topStudentsTitle': 'ТОП 10 СТУДЕНТОВ {uni}',
    'uni.noContestTitle': 'У этого вуза пока нет конкурса',
    'uni.noContestDesc': 'Как только организаторы его объявят, он появится здесь.',
    'uni.chooseAnother': 'Выбрать другой университет',
    'uni.emptyBoard': 'Пока нет зарегистрированных студентов',
    'uni.viewersAria': '{n} зрителей',
    'uni.viewerXpNote': 'XP зрителя не идёт в университетскую лигу — только в общую.',
    'uni.viewerHint': 'Нажми на студента, чтобы отдать ему энергию',
    'uni.studentHint': 'Нажми на своё имя, чтобы увидеть, кто тебя поддержал',
    'uni.you': 'Ты',
    'uni.supportTitle': 'Поделись энергией с лидером!',
    'uni.supportPlace': '{n}-е место',
    'uni.supportYourEnergy': 'ТВОЯ ЭНЕРГИЯ',
    'uni.supportCta': 'ОТДАТЬ ЭНЕРГИЮ',
    'uni.supportCtaSub': 'отправить энергию',
    'uni.supportNote': 'Поддержка не влияет на XP, но даёт лидеру большую силу!',
    'uni.supportSent': '{name} получил твою поддержку!',
    'uni.supportAlready': 'В этом периоде ты уже отдал энергию',
    'uni.supportNoEnergy': 'Недостаточно энергии',
    'uni.supportersTitle': 'ТЕБЯ ПОДДЕРЖАЛИ',
    'uni.supportersEmpty': 'Пока никто не отдал тебе энергию',
    'uni.supportersCta': 'Кто тебя поддержал',
    'uni.supportersCount': '{n} поддержали',
    'uni.boardError': 'Не удалось загрузить рейтинг',

    'shop.title': 'Магазин',
    'shop.buy': 'Купить',
    'shop.owned': 'Куплено',
    'shop.notEnough': 'Недостаточно монет',
    'shop.empty': 'Магазин пуст',
    'shop.partnersTitle': 'Партнёры',
    'shop.prizeCount': '{n} призов',
    'shop.noPrizesForPartner': 'У этого партнёра пока нет призов',
    'shop.soldOut': 'Закончилось',
    'shop.redeemInstructions': 'Покажи этот код и получи приз',
    'shop.yourReceipt': 'Код проверки: {code}',
    'shop.showAtTill': 'Покажите этот код в магазине',
    'shop.redeemed': 'Приз получен!',
    'shop.whatIsCoinsTitle': 'Что такое акчи?',
    'shop.whatIsCoinsDesc':
        'Акчи — внутренняя монета JashMen. Проходи уроки, зарабатывай акчи и обменивай их на товары в магазине и призы партнёров.',
    'common.back': 'Назад',
    'common.copied': 'Скопировано',

    'profile.title': 'Профиль',
    'profile.stats': 'Статистика',
    'profile.achievements': 'Достижения',
    'profile.xp': 'XP',
    'profile.streak': 'Серия',
    'profile.streakSub': 'Ежедневная серия',
    'profile.streakWeek': 'Неделя',
    'profile.streakMonth': 'Месяц',
    'profile.streakPrevMonth': 'Предыдущий месяц',
    'profile.streakNextMonth': 'Следующий месяц',
    'profile.streakNoData': 'нет данных',
    'profile.streakLostTitle': 'Серия из {n} дней прервана',
    'profile.streakLostDesc': 'Вернуть её можно только сегодня — за {cost} энергии.',
    'profile.streakRepairCta': 'Вернуть за {cost} энергии',
    'profile.streakRepairBusy': 'Восстанавливаем…',
    'profile.streakRepairNoEnergy': 'Не хватает энергии — вернитесь, когда она восстановится',
    'profile.streakStudied': 'Учился {n} из {total} дней',
    'profile.coins': 'Монеты',
    'profile.lessons': 'Уроки',
    'profile.noAchievements': 'Пока нет достижений',
    'profile.changePhoto': 'Изменить фото',
    'profile.coupons': 'Мои купоны',
    'profile.couponsEmpty':
        'Пока нет купонов. Обменяй монеты на приз партнёра в магазине — код сохранится здесь.',
    'profile.couponTapToCopy': 'Нажми, чтобы скопировать',
    'profile.couponPartnerCode': 'Код партнёра — покажите его в магазине',
    'profile.couponOwnCode': 'Код JashMen',

    'settings.title': 'Настройки',
    'settings.editName': 'Изменить имя',
    'settings.language': 'Язык',
    'settings.theme': 'Тема',
    'settings.themeDark': 'Тёмная',
    'settings.themeBright': 'Светлая',
    'settings.sound': 'Звук',
    'settings.animations': 'Анимации',
    'settings.logout': 'Выйти',
    'settings.logoutConfirm': 'Выйти из аккаунта?',
    'settings.account': 'Аккаунт',
    'settings.changePassword': 'Изменить пароль',
    'settings.changePasswordDesc': 'Обновить пароль для входа',
    'settings.setPassword': 'Установить пароль',
    'settings.setPasswordDesc': 'Вы вошли через Google — задайте пароль, чтобы входить и по email',
    'settings.currentPassword': 'Текущий пароль',
    'settings.newPassword': 'Новый пароль',
    'settings.repeatPassword': 'Повторите новый пароль',
    'settings.passwordSaved': 'Пароль обновлён',
    'settings.passwordMismatch': 'Пароли не совпадают',
    'settings.passwordShort': 'Пароль минимум из 6 символов',
    'common.save': 'Сохранить',
    'streak.dayStreak': 'дней подряд!',
    'streak.perfectWeekStart': 'Идеальная неделя начинается!',
    'streak.perfectWeekHalf': 'Ты на полпути к идеальной неделе!',
    'streak.perfectWeekClose': 'До идеальной недели совсем чуть-чуть!',
    'streak.perfectWeekDone': 'Идеальная неделя! Молодец!',
    'streak.continue': 'ПРОДОЛЖИТЬ',
    'streak.dow0': 'Вс',
    'streak.dow1': 'Пн',
    'streak.dow2': 'Вт',
    'streak.dow3': 'Ср',
    'streak.dow4': 'Чт',
    'streak.dow5': 'Пт',
    'streak.dow6': 'Сб',
    'settings.about': 'О приложении',
    'settings.privacy': 'Политика конфиденциальности',
    'settings.deleteAccount': 'Удалить аккаунт',
    'auth.apple': 'Продолжить с Apple',
    'auth.appleFailed': 'Не удалось войти через Apple. Попробуйте ещё раз.',
    'settings.deleteWarning': 'Аккаунт будет удалён навсегда: email, имя, фото, пароль, пройденные уроки, монеты и купоны исчезнут безвозвратно. Останется только общий счёт вашего университета — он ни с кем не связан. Это действие нельзя отменить.',
    'settings.deleteTypePassword': 'Введите пароль для подтверждения',
    'settings.deleteTypeWord': 'Напишите «{word}» для подтверждения',
    'settings.deleteConfirm': 'Удалить навсегда',
    'settings.version': 'Версия',

    'common.loading': 'Загрузка...',
    'common.retry': 'Повторить',
    'common.cancel': 'Отмена',
    'common.close': 'Закрыть',
    'common.zoomImage': 'Увеличить фото',
    'common.confirm': 'Да',
    'common.error': 'Произошла ошибка',
    'common.offline': 'Нет подключения к интернету',
    'common.serverError': 'Сервер не отвечает',
  },
  'en': {
    'nav.learn': 'Learn',
    'nav.league': 'League',
    'nav.shop': 'Shop',
    'nav.profile': 'Profile',
    'nav.settings': 'Settings',
    'nav.logout': 'Log out',

    'auth.loginTitle': 'Welcome back',
    'onboarding.skip': 'Skip',
    'onboarding.next': 'Next',
    'onboarding.getStarted': 'Get started',
    'onboarding.slide1.title': 'Learn financial literacy while competing with friends!',
    'onboarding.slide2.title': 'Learn with ease, manage with confidence!',
    'onboarding.slide3.title': 'Make your money work for you!',

    'auth.tagline': 'Learn money management through play!',
    'auth.createAccount': 'Create account',
    'auth.signupTitle': 'Welcome to JashMen',
    'auth.loginSubtitle': 'Sign in to continue learning',
    'auth.signupSubtitle': 'Start your financial literacy today',
    'auth.name': 'Your name',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.login': 'Sign in',
    'auth.signup': 'Sign up',
    'auth.noAccount': "Don't have an account?",
    'auth.haveAccount': 'Already have an account?',
    'auth.nameRequired': 'Enter your name',
    'auth.emailRequired': 'Enter your email',
    'auth.emailInvalid': 'Invalid email',
    'auth.passwordShort': 'Password must be at least 6 characters',
    'auth.or': 'or',
    'auth.google': 'Continue with Google',
    'auth.googleFailed': 'Google sign-in failed',
    'auth.googleUnavailable': 'Google sign-in isn\'t switched on yet',
    'auth.googleCancelled': 'Sign-in cancelled',

    'learn.title': 'Learn',
    'learn.noEnergyTitle': 'Out of energy',
    'learn.noEnergyDesc': 'New lessons unlock in {time}',
    'learn.empty': 'No lessons yet',
    'learn.emptyDesc': 'New modules are coming soon',
    'learn.courseFrom': 'Course by {partner}',

    'lesson.start': 'Start',
    'lesson.review': 'Review',
    'lesson.continue': 'Continue',
    'lesson.nextLesson': 'Next lesson',
    'lesson.playVideo': 'Play video',
    'lesson.backToPath': 'Back to the path',
    'lesson.check': 'Check',
    'lesson.correct': 'Correct!',
    'lesson.wrong': 'Incorrect',
    'lesson.correctAnswer': 'Correct answer:',
    'lesson.explanation': 'Explanation',
    'lesson.matchPrompt': 'Tap the pairs',
    'lesson.buildPrompt': 'Build the sentence',
    'lesson.buildHint': 'Tap the words in order',
    'lesson.complete': 'Lesson complete!',
    'lesson.resultPerfect': 'Perfect!',
    'lesson.resultGood': 'Good job!',
    'lesson.lessonDone': 'Lesson complete',
    'lesson.reviewDone': 'Review complete',
    'lesson.perfectBadge': 'Perfect!',
    'lesson.newAchievement': 'New achievement',
    'lesson.accuracyLabel': 'Correct answers',
    'lesson.quizCount': '{n} questions',
    'lesson.upToXp': 'up to +{n} XP',
    'lesson.previewCheckpoint': 'Checkpoint',
    'lesson.previewLesson': 'Lesson',
    'lesson.previewAvailableDesc': 'Consists of {n} exercises. Finish it to earn up to {xp} XP and coins!',
    'lesson.previewCompletedDesc': "You've already completed this lesson. Go through it again to reinforce what you learned.",
    'lesson.previewGatedDesc': "You've used up today's free lessons. Buy more energy in the shop, or wait until tomorrow.",
    'lesson.previewNoEnergyBadge': 'No energy',
    'lesson.previewCompletedBadge': 'Completed',
    'lesson.exit': 'Exit',
    'lesson.exitConfirm': 'Exit the lesson? Progress will not be saved.',
    'lesson.noEnergy': 'No energy',
    'lesson.goToShop': 'Go to shop',

    'league.title': 'League',
    'league.yourRank': 'Your rank',
    'league.empty': 'No participants yet',
    'league.participants': 'players',
    'league.leaderXp': 'leader XP',
    'league.yourPlace': 'your place',
    'league.days': '{n}d',
    'league.locked': 'Locked',
    'league.xpNeeded': '{n}+ XP',
    'league.tabGeneral': 'GENERAL LEAGUE',
    'league.tabUni': 'UNI LEAGUE',
    'league.generalSubtitle': 'Compete with all players!',

    'uni.roleTitle': 'CHOOSE A ROLE',
    'uni.roleSubtitle': 'Who are you in the university league?',
    'uni.roleStudent': 'STUDENT',
    'uni.roleStudentDesc': 'I am a student and I represent my university',
    'uni.roleViewer': 'VIEWER',
    'uni.roleViewerDesc': "I'm not participating, just checking the rankings",
    'uni.pickTitle': 'CHOOSE YOUR UNIVERSITY',
    'uni.pickSubtitle': 'Choose the university you will play for',
    'uni.pickSubtitleViewer': 'Choose the university whose rankings you want to see',
    'uni.ok': 'OK',
    'uni.close': 'Close',
    'uni.change': 'Change',
    'uni.leave': 'Leave',
    'uni.leaveConfirm': 'Leave the university league? All XP earned on this campus will be reset and you will return to the general league. This cannot be undone.',
    'uni.organizer': 'Organizer:',
    'uni.address': 'Address:',
    'uni.prizePool': 'PRIZE POOL',
    'uni.sponsor': 'Sponsor',
    'uni.studentsCount': 'Students',
    'uni.viewersCount': 'Viewers',
    'uni.totalCollectedNote': 'The total XP this university\'s students have collected. Every finished lesson adds to it.',
    'uni.rulesValue': 'Rules',
    'uni.rulesLabel': 'Terms and dates',
    'uni.prizes': 'PRIZES',
    'uni.place1': '1st PLACE',
    'uni.place2': '2nd PLACE',
    'uni.place3': '3rd PLACE',
    'uni.gifts': 'GIFTS',
    'uni.giftsTop': 'TOP {n}',
    'uni.totalCollected': 'TOTAL COLLECTED',
    'uni.start': 'START',
    'uni.end': 'END',
    'uni.topStudentsTitle': '{uni} TOP 10 STUDENTS',
    'uni.noContestTitle': 'This university has no contest yet',
    'uni.noContestDesc': 'It will show up here as soon as the organisers announce one.',
    'uni.chooseAnother': 'Choose another university',
    'uni.emptyBoard': 'No students have signed up yet',
    'uni.viewersAria': '{n} viewers',
    'uni.viewerXpNote': 'A viewer\'s XP counts toward the general league only, never the university one.',
    'uni.viewerHint': 'Tap a student to send them your energy',
    'uni.studentHint': 'Tap your own name to see who backed you',
    'uni.you': 'You',
    'uni.supportTitle': 'Share your energy with the leader!',
    'uni.supportPlace': 'Rank {n}',
    'uni.supportYourEnergy': 'YOUR ENERGY',
    'uni.supportCta': 'GIVE ENERGY',
    'uni.supportCtaSub': 'send energy',
    'uni.supportNote': 'Support doesn\'t change XP, but it powers the leader up!',
    'uni.supportSent': '{name} got your support!',
    'uni.supportAlready': 'You already gave energy this period',
    'uni.supportNoEnergy': 'Not enough energy',
    'uni.supportersTitle': 'YOUR SUPPORTERS',
    'uni.supportersEmpty': 'Nobody has sent you energy yet',
    'uni.supportersCta': 'Your supporters',
    'uni.supportersCount': '{n} supporters',
    'uni.boardError': 'Could not load the board',

    'shop.title': 'Shop',
    'shop.buy': 'Buy',
    'shop.owned': 'Owned',
    'shop.notEnough': 'Not enough coins',
    'shop.empty': 'The shop is empty',
    'shop.partnersTitle': 'Partners',
    'shop.prizeCount': '{n} rewards',
    'shop.noPrizesForPartner': 'This partner has no rewards yet',
    'shop.soldOut': 'Sold out',
    'shop.redeemInstructions': 'Show this code to claim your reward',
    'shop.yourReceipt': 'Reference code: {code}',
    'shop.showAtTill': 'Show this code at the till',
    'shop.redeemed': 'Reward claimed!',
    'shop.whatIsCoinsTitle': 'What is Akchi?',
    'shop.whatIsCoinsDesc':
        'Akchi is the JashMen in-app coin. Finish lessons to earn Akchi, then trade it for shop items and partner rewards.',
    'common.back': 'Back',
    'common.copied': 'Copied',

    'profile.title': 'Profile',
    'profile.stats': 'Stats',
    'profile.achievements': 'Achievements',
    'profile.xp': 'XP',
    'profile.streak': 'Streak',
    'profile.streakSub': 'Daily streak',
    'profile.streakWeek': 'Week',
    'profile.streakMonth': 'Month',
    'profile.streakPrevMonth': 'Previous month',
    'profile.streakNextMonth': 'Next month',
    'profile.streakNoData': 'no data',
    'profile.streakLostTitle': 'Your {n}-day streak broke',
    'profile.streakLostDesc': 'Today is the only day you can buy it back — {cost} energy.',
    'profile.streakRepairCta': 'Restore for {cost} energy',
    'profile.streakRepairBusy': 'Restoring…',
    'profile.streakRepairNoEnergy': 'Not enough energy — come back when it refills',
    'profile.streakStudied': 'Studied {n} of {total} days',
    'profile.coins': 'Coins',
    'profile.lessons': 'Lessons',
    'profile.noAchievements': 'No achievements yet',
    'profile.changePhoto': 'Change photo',
    'profile.coupons': 'My coupons',
    'profile.couponsEmpty':
        'No coupons yet. Redeem a partner reward in the shop and its code will be kept here.',
    'profile.couponTapToCopy': 'Tap to copy',
    'profile.couponPartnerCode': 'Partner code — show this at the till',
    'profile.couponOwnCode': 'JashMen code',

    'settings.title': 'Settings',
    'settings.editName': 'Change name',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.themeDark': 'Dark',
    'settings.themeBright': 'Light',
    'settings.sound': 'Sound',
    'settings.animations': 'Animations',
    'settings.logout': 'Log out',
    'settings.logoutConfirm': 'Log out of your account?',
    'settings.account': 'Account',
    'settings.changePassword': 'Change password',
    'settings.changePasswordDesc': 'Update your sign-in password',
    'settings.setPassword': 'Set a password',
    'settings.setPasswordDesc': 'You signed in with Google — add a password to sign in by email too',
    'settings.currentPassword': 'Current password',
    'settings.newPassword': 'New password',
    'settings.repeatPassword': 'Repeat new password',
    'settings.passwordSaved': 'Password updated',
    'settings.passwordMismatch': 'Passwords do not match',
    'settings.passwordShort': 'Password must be at least 6 characters',
    'common.save': 'Save',
    'streak.dayStreak': 'day streak!',
    'streak.perfectWeekStart': 'Your perfect week starts here!',
    'streak.perfectWeekHalf': 'You\'re halfway to your perfect week!',
    'streak.perfectWeekClose': 'You\'re almost at a perfect week!',
    'streak.perfectWeekDone': 'A perfect week! Nice work!',
    'streak.continue': 'CONTINUE',
    'streak.dow0': 'Su',
    'streak.dow1': 'Mo',
    'streak.dow2': 'Tu',
    'streak.dow3': 'We',
    'streak.dow4': 'Th',
    'streak.dow5': 'Fr',
    'streak.dow6': 'Sa',
    'settings.about': 'About',
    'settings.privacy': 'Privacy policy',
    'settings.deleteAccount': 'Delete account',
    'auth.apple': 'Continue with Apple',
    'auth.appleFailed': 'Apple sign-in did not work. Please try again.',
    'settings.deleteWarning': 'Your account will be deleted permanently: your email, name, photo, password, completed lessons, coins and coupons are gone for good. Only your university’s overall score remains, attached to nobody. This cannot be undone.',
    'settings.deleteTypePassword': 'Type your password to confirm',
    'settings.deleteTypeWord': 'Type “{word}” to confirm',
    'settings.deleteConfirm': 'Delete permanently',
    'settings.version': 'Version',

    'common.loading': 'Loading...',
    'common.retry': 'Retry',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.zoomImage': 'Enlarge image',
    'common.confirm': 'Yes',
    'common.error': 'Something went wrong',
    'common.offline': 'No internet connection',
    'common.serverError': 'The server is not responding',
  },
};

class Strings {
  const Strings(this.locale);
  final AppLocale locale;

  /// `{name}` placeholders are substituted from [params]. A missing key
  /// returns the key itself — visible in the UI on purpose, so a gap is
  /// caught in review rather than shipping as a blank label.
  String t(String key, {Map<String, Object?>? params}) {
    var value = _strings[locale.code]?[key] ?? _strings['ky']?[key] ?? key;
    if (params != null) {
      params.forEach((k, v) => value = value.replaceAll('{$k}', '${v ?? ''}'));
    }
    return value;
  }
}

/// Lets widgets read strings without threading the locale through every
/// constructor. Provided by the app root; see app.dart.
class StringsScope extends InheritedWidget {
  const StringsScope({super.key, required this.strings, required super.child});
  final Strings strings;

  static Strings of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<StringsScope>();
    assert(scope != null, 'StringsScope is missing above this widget');
    return scope!.strings;
  }

  @override
  bool updateShouldNotify(StringsScope oldWidget) =>
      oldWidget.strings.locale != strings.locale;
}
