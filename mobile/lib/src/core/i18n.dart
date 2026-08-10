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
    'auth.tagline': 'Каржылык сабаттуулук — оюн сыяктуу',
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
    'auth.passwordShort': 'Сыр сөз кеминде 8 белгиден турушу керек',
    'auth.or': 'же',
    'auth.google': 'Google менен улантуу',
    'auth.googleFailed': 'Google аркылуу кирүү ишке ашкан жок',
    'auth.googleCancelled': 'Кирүү жокко чыгарылды',

    'learn.title': 'Окуу',
    'learn.noEnergyTitle': 'Энергия түгөндү',
    'learn.noEnergyDesc': 'Жаңы сабактар {time} кийин ачылат',
    'learn.empty': 'Азырынча сабак жок',
    'learn.emptyDesc': 'Жакында жаңы модулдар кошулат',

    'lesson.start': 'Баштоо',
    'lesson.review': 'Кайталоо',
    'lesson.continue': 'Улантуу',
    'lesson.check': 'Текшерүү',
    'lesson.correct': 'Туура!',
    'lesson.wrong': 'Туура эмес',
    'lesson.correctAnswer': 'Туура жооп:',
    'lesson.complete': 'Сабак бүттү!',
    'lesson.quizCount': '{n} суроо',
    'lesson.upToXp': '+{n} XP чейин',
    'lesson.previewCheckpoint': 'Текшерүү',
    'lesson.exit': 'Чыгуу',
    'lesson.exitConfirm': 'Сабактан чыгасызбы? Прогресс сакталбайт.',
    'lesson.noEnergy': 'Энергия жок',

    'league.title': 'Лига',
    'league.yourRank': 'Сиздин орун',
    'league.empty': 'Азырынча катышуучу жок',
    'league.participants': 'катышуучу',
    'league.leaderXp': 'лидер XP',
    'league.yourPlace': 'сенин орун',
    'league.days': '{n} күн',
    'league.locked': 'Жабык',
    'league.xpNeeded': '{n}+ XP',

    'shop.title': 'Дүкөн',
    'shop.buy': 'Сатып алуу',
    'shop.owned': 'Сатып алынган',
    'shop.notEnough': 'Монета жетишсиз',
    'shop.empty': 'Дүкөн бош',

    'profile.title': 'Профиль',
    'profile.stats': 'Статистика',
    'profile.achievements': 'Жетишкендиктер',
    'profile.xp': 'XP',
    'profile.streak': 'Серия',
    'profile.coins': 'Монета',
    'profile.lessons': 'Сабактар',
    'profile.noAchievements': 'Азырынча жетишкендик жок',

    'settings.title': 'Жөндөөлөр',
    'settings.language': 'Тил',
    'settings.theme': 'Тема',
    'settings.themeDark': 'Күңүрт',
    'settings.themeBright': 'Жарык',
    'settings.sound': 'Үн',
    'settings.animations': 'Анимациялар',
    'settings.logout': 'Чыгуу',
    'settings.logoutConfirm': 'Аккаунттан чыгасызбы?',
    'settings.about': 'Колдонмо жөнүндө',
    'settings.privacy': 'Купуялык саясаты',
    'settings.version': 'Версия',

    'common.loading': 'Жүктөлүүдө...',
    'common.retry': 'Кайталоо',
    'common.cancel': 'Жокко чыгаруу',
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
    'auth.tagline': 'Финансовая грамотность — как игра',
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
    'auth.passwordShort': 'Пароль минимум 8 символов',
    'auth.or': 'или',
    'auth.google': 'Продолжить с Google',
    'auth.googleFailed': 'Не удалось войти через Google',
    'auth.googleCancelled': 'Вход отменён',

    'learn.title': 'Учёба',
    'learn.noEnergyTitle': 'Энергия закончилась',
    'learn.noEnergyDesc': 'Новые уроки откроются через {time}',
    'learn.empty': 'Пока нет уроков',
    'learn.emptyDesc': 'Скоро появятся новые модули',

    'lesson.start': 'Начать',
    'lesson.review': 'Повторить',
    'lesson.continue': 'Продолжить',
    'lesson.check': 'Проверить',
    'lesson.correct': 'Верно!',
    'lesson.wrong': 'Неверно',
    'lesson.correctAnswer': 'Правильный ответ:',
    'lesson.complete': 'Урок завершён!',
    'lesson.quizCount': '{n} вопросов',
    'lesson.upToXp': 'до +{n} XP',
    'lesson.previewCheckpoint': 'Проверка',
    'lesson.exit': 'Выйти',
    'lesson.exitConfirm': 'Выйти из урока? Прогресс не сохранится.',
    'lesson.noEnergy': 'Нет энергии',

    'league.title': 'Лига',
    'league.yourRank': 'Ваше место',
    'league.empty': 'Пока нет участников',
    'league.participants': 'участников',
    'league.leaderXp': 'лидер XP',
    'league.yourPlace': 'твоё место',
    'league.days': '{n} дн.',
    'league.locked': 'Закрыто',
    'league.xpNeeded': '{n}+ XP',

    'shop.title': 'Магазин',
    'shop.buy': 'Купить',
    'shop.owned': 'Куплено',
    'shop.notEnough': 'Недостаточно монет',
    'shop.empty': 'Магазин пуст',

    'profile.title': 'Профиль',
    'profile.stats': 'Статистика',
    'profile.achievements': 'Достижения',
    'profile.xp': 'XP',
    'profile.streak': 'Серия',
    'profile.coins': 'Монеты',
    'profile.lessons': 'Уроки',
    'profile.noAchievements': 'Пока нет достижений',

    'settings.title': 'Настройки',
    'settings.language': 'Язык',
    'settings.theme': 'Тема',
    'settings.themeDark': 'Тёмная',
    'settings.themeBright': 'Светлая',
    'settings.sound': 'Звук',
    'settings.animations': 'Анимации',
    'settings.logout': 'Выйти',
    'settings.logoutConfirm': 'Выйти из аккаунта?',
    'settings.about': 'О приложении',
    'settings.privacy': 'Политика конфиденциальности',
    'settings.version': 'Версия',

    'common.loading': 'Загрузка...',
    'common.retry': 'Повторить',
    'common.cancel': 'Отмена',
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
    'auth.tagline': 'Financial literacy — like a game',
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
    'auth.passwordShort': 'Password must be at least 8 characters',
    'auth.or': 'or',
    'auth.google': 'Continue with Google',
    'auth.googleFailed': 'Google sign-in failed',
    'auth.googleCancelled': 'Sign-in cancelled',

    'learn.title': 'Learn',
    'learn.noEnergyTitle': 'Out of energy',
    'learn.noEnergyDesc': 'New lessons unlock in {time}',
    'learn.empty': 'No lessons yet',
    'learn.emptyDesc': 'New modules are coming soon',

    'lesson.start': 'Start',
    'lesson.review': 'Review',
    'lesson.continue': 'Continue',
    'lesson.check': 'Check',
    'lesson.correct': 'Correct!',
    'lesson.wrong': 'Incorrect',
    'lesson.correctAnswer': 'Correct answer:',
    'lesson.complete': 'Lesson complete!',
    'lesson.quizCount': '{n} questions',
    'lesson.upToXp': 'up to +{n} XP',
    'lesson.previewCheckpoint': 'Checkpoint',
    'lesson.exit': 'Exit',
    'lesson.exitConfirm': 'Exit the lesson? Progress will not be saved.',
    'lesson.noEnergy': 'No energy',

    'league.title': 'League',
    'league.yourRank': 'Your rank',
    'league.empty': 'No participants yet',
    'league.participants': 'players',
    'league.leaderXp': 'leader XP',
    'league.yourPlace': 'your place',
    'league.days': '{n}d',
    'league.locked': 'Locked',
    'league.xpNeeded': '{n}+ XP',

    'shop.title': 'Shop',
    'shop.buy': 'Buy',
    'shop.owned': 'Owned',
    'shop.notEnough': 'Not enough coins',
    'shop.empty': 'The shop is empty',

    'profile.title': 'Profile',
    'profile.stats': 'Stats',
    'profile.achievements': 'Achievements',
    'profile.xp': 'XP',
    'profile.streak': 'Streak',
    'profile.coins': 'Coins',
    'profile.lessons': 'Lessons',
    'profile.noAchievements': 'No achievements yet',

    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.themeDark': 'Dark',
    'settings.themeBright': 'Light',
    'settings.sound': 'Sound',
    'settings.animations': 'Animations',
    'settings.logout': 'Log out',
    'settings.logoutConfirm': 'Log out of your account?',
    'settings.about': 'About',
    'settings.privacy': 'Privacy policy',
    'settings.version': 'Version',

    'common.loading': 'Loading...',
    'common.retry': 'Retry',
    'common.cancel': 'Cancel',
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
