/// Covers the university-league helpers and the two dialogs that gate the
/// tab. The dialogs are the risky part: they are the only place in the app
/// where a modal has to size itself around a scrolling list, so a layout
/// regression there would ship as an overflow stripe rather than a crash.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:jashmen/src/core/i18n.dart';
import 'package:jashmen/src/models/university.dart';
import 'package:jashmen/src/screens/league_screen.dart';
import 'package:jashmen/src/state/providers.dart';

/// The campuses are admin content now (Module Г), delivered inside
/// /public/content. The two the widget tests need are declared here so the
/// test states its own inputs instead of leaning on whatever an admin has
/// authored.
final _kstu = University(
  id: 'kstu',
  listName: 'ПОЛИТЕХ',
  name: const {
    'ky': 'И. Раззаков атындагы КГТУ',
    'ru': 'КГТУ им. И. Раззакова',
    'en': 'KSTU named after I. Razzakov',
  },
  shortName: const {'ky': 'КГТУ', 'ru': 'КГТУ', 'en': 'KSTU'},
  color: '#1E5FBF',
  competition: UniversityCompetition(
    organizerPhone: '+996700123123',
    address: const {
      'ky': 'Чыңгыз Айтматов көчөсү, 66',
      'ru': 'Чынгыза Айтматова, 66',
      'en': 'Chyngyz Aitmatov St., 66',
    },
    sponsorName: 'mbank',
    prizePool: 120000,
    firstPrize: 70000,
    secondPrize: 30000,
    thirdPrize: 20000,
    giftsTopN: 10,
    startsAt: DateTime(2025, 9, 18),
    endsAt: DateTime(2025, 10, 18),
    rules: const {
      'ky': 'КГТУнун студенттери гана конкурска катыша алат.',
      'ru': 'Только студенты КГТУ могут участвовать.',
      'en': 'Only KSTU students can participate.',
    },
  ),
);

const _auca = University(
  id: 'auca',
  listName: 'АУЦА',
  name: {
    'ky': 'Борбор Азиядагы Америка университети',
    'ru': 'Американский университет в Центральной Азии',
    'en': 'American University of Central Asia',
  },
  shortName: {'ky': 'АУЦА', 'ru': 'АУЦА', 'en': 'AUCA'},
  color: '#F5B301',
);

/// The rest of the catalogue, contest-free. They exist so the picker test
/// still exercises a list taller than the panel — the case where an entry
/// would be clipped instead of scrollable.
const _otherCampuses = [
  University(
    id: 'salymbekov',
    listName: 'САЛЫМБЕКОВ УНИВЕРСИТЕТ',
    name: {'ky': 'Салымбеков университети', 'ru': 'Университет Салымбекова', 'en': 'Salymbekov University'},
    shortName: {'ky': 'Салымбеков', 'ru': 'Салымбеков', 'en': 'Salymbekov'},
    color: '#1D4ED8',
  ),
  University(
    id: 'alatoo',
    listName: 'АЛА-ТОО УНИВЕРСИТЕТИ',
    name: {'ky': 'Ала-Тоо эл аралык университети', 'ru': 'Международный университет Ала-Тоо', 'en': 'Ala-Too International University'},
    shortName: {'ky': 'Ала-Тоо', 'ru': 'Ала-Тоо', 'en': 'Ala-Too'},
    color: '#C0392B',
  ),
  University(
    id: 'krsu',
    listName: 'КРСУ',
    name: {'ky': 'Кыргыз-Орус Славян университети', 'ru': 'Кыргызско-Российский Славянский университет', 'en': 'Kyrgyz-Russian Slavic University'},
    shortName: {'ky': 'КРСУ', 'ru': 'КРСУ', 'en': 'KRSU'},
    color: '#2563EB',
  ),
  University(
    id: 'knu',
    listName: 'КНУ',
    name: {'ky': 'Кыргыз улуттук университети', 'ru': 'Кыргызский национальный университет', 'en': 'Kyrgyz National University'},
    shortName: {'ky': 'КНУ', 'ru': 'КНУ', 'en': 'KNU'},
    color: '#1D6FB8',
  ),
];

final _catalogue = [_kstu, _auca, ..._otherCampuses];

/// The board the server would return for a campus. The rows are a fixture
/// here rather than authored content: the standings are live data now, so
/// the widget under test has to be fed them the way the API would.
const _fixtureStudents = [
  ('Асан', 124560), ('Үсөн', 98400), ('Саян', 87200),
  ('Айбеков Н.', 54210), ('Данияр уулу М.', 48760), ('Кочкорбаев Э.', 42500),
  ('Медер кызы А.', 41230), ('Токтогулов Б.', 38890), ('Нурланбекова С.', 36450),
  ('Рыскулов Ы.', 33780),
];

UniBoard _boardFor(University university) {
  final rows = university.hasCompetition ? _fixtureStudents : const [];
  return UniBoard(
    universityId: university.id,
    studentCount: rows.length,
    viewerCount: 4063,
    totalXp: 1248560,
    students: [
      for (var i = 0; i < rows.length; i++)
        UniBoardEntry(
          id: 'stu-$i',
          name: rows[i].$1,
          xp: rows[i].$2,
          rank: i + 1,
        ),
    ],
  );
}

void main() {
  group('kyGenitive', () {
    test('adds -нун after a back-rounded vowel', () {
      expect(kyGenitive('КГТУ'), 'КГТУНУН');
      expect(kyGenitive('КНУ'), 'КНУНУН');
    });

    test('adds -нын after a back-unrounded vowel', () {
      expect(kyGenitive('АУЦА'), 'АУЦАНЫН');
    });

    test('adds -дун after a voiced consonant', () {
      expect(kyGenitive('САЛЫМБЕКОВ'), 'САЛЫМБЕКОВДУН');
    });

    test('keeps lower case when the word is lower case', () {
      expect(kyGenitive('Ала-Тоо'), 'Ала-Тоонун');
    });

    test('survives an empty or vowel-less name', () {
      expect(kyGenitive(''), '');
      expect(kyGenitive('КРСУ'), 'КРСУНУН');
    });
  });

  group('formatting', () {
    test('groups thousands with a non-breaking space', () {
      expect(formatGrouped(1248560), '1\u00A0248\u00A0560');
      expect(formatGrouped(560), '560');
      expect(formatGrouped(0), '0');
    });

    test('writes som in ky/ru and the ISO code in en', () {
      expect(formatSom(120000, AppLocale.ky), '120\u00A0000\u00A0сом');
      expect(formatSom(120000, AppLocale.ru), '120\u00A0000\u00A0сом');
      expect(formatSom(120000, AppLocale.en), '120\u00A0000\u00A0KGS');
    });

    test('formats the contest dates per locale', () {
      final date = DateTime(2025, 9, 18);
      expect(formatLongDate(date, AppLocale.ky), '18 СЕНТЯБРЬ 2025');
      expect(formatLongDate(date, AppLocale.ru), '18 СЕНТЯБРЯ 2025');
      expect(formatLongDate(date, AppLocale.en), 'SEPTEMBER 18, 2025');
    });
  });

  group('UniLeagueView', () {
    /// Locale and theme are seeded through SharedPreferences rather than set
    /// on the controllers: their notifiers read prefs at construction, and
    /// writing to a provider from inside build is what Riverpod forbids.
    Future<void> render(
      WidgetTester tester, {
      required University university,
      required AppLocale locale,
      required bool bright,
      Size size = const Size(360, 800),
    }) async {
      SharedPreferences.setMockInitialValues({
        'jashmen.locale': locale.code,
        'jashmen.bright': bright,
      });
      final prefs = await SharedPreferences.getInstance();

      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = size;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            prefsProvider.overrideWithValue(prefs),
            userStateProvider.overrideWithValue(null),
            currentUserProvider.overrideWithValue(null),
            universitiesProvider.overrideWithValue(_catalogue),
            // The board is a server read now, so it is stubbed rather than
            // stood up: the widget under test is the layout, not the fetch.
            uniBoardProvider(university.id)
                .overrideWith((ref) async => _boardFor(university)),
          ],
          child: StringsScope(
            strings: Strings(locale),
            child: MaterialApp(
              home: Scaffold(
                body: UniLeagueView(university: university, onChange: () {}),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    final kstu = _kstu;
    final auca = _auca;

    // 320dp is the narrowest phone still in the wild (iPhone SE 1st gen);
    // the four prize columns are the first thing that would break there.
    const sizes = [Size(360, 800), Size(320, 640)];

    for (final locale in AppLocale.values) {
      for (final bright in [false, true]) {
        for (final size in sizes) {
          testWidgets(
            'lays out the whole screen in ${locale.code} '
            '(${bright ? 'bright' : 'dark'}, ${size.width.toInt()}dp) '
            'without overflowing',
            (tester) async {
              await render(tester,
                  university: kstu,
                  locale: locale,
                  bright: bright,
                  size: size);
              expect(tester.takeException(), isNull);

              // Scroll to the end so every row below the fold is actually
              // laid out — an overflow that never gets built never throws.
              for (var i = 0; i < 6; i++) {
                await tester.drag(find.byType(ListView), const Offset(0, -300));
                await tester.pumpAndSettle();
                expect(tester.takeException(), isNull);
              }
            },
          );
        }
      }
    }

    testWidgets('shows the localised prize pool, XP total and dates',
        (tester) async {
      await render(tester,
          university: kstu, locale: AppLocale.ky, bright: false);

      expect(find.text('120\u00A0000\u00A0сом'), findsOneWidget);
      // The four contest cards carry the headline number only; the unit and
      // the breakdown live in the panel each one opens.
      expect(find.text('1\u00A0248\u00A0560'), findsOneWidget);
      expect(find.text('ТОП 10'), findsOneWidget);
      expect(find.text('Эрежелер'), findsOneWidget);
      expect(find.text('18 СЕНТЯБРЬ 2025'), findsOneWidget);
      expect(find.text('18 ОКТЯБРЬ 2025'), findsOneWidget);
      expect(find.text('КГТУНУН ТОП 10 СТУДЕНТИ'), findsOneWidget);
    });

    testWidgets('switches every label to English', (tester) async {
      await render(tester,
          university: kstu, locale: AppLocale.en, bright: false);

      expect(find.text('PRIZE POOL'), findsOneWidget);
      expect(find.text('120\u00A0000\u00A0KGS'), findsOneWidget);
      expect(find.text('SEPTEMBER 18, 2025'), findsOneWidget);
      expect(find.text('KSTU TOP 10 STUDENTS'), findsOneWidget);
    });

    testWidgets('podium holds the top three and the list starts at four',
        (tester) async {
      await render(tester,
          university: kstu, locale: AppLocale.ru, bright: false);

      expect(find.text('Асан'), findsOneWidget);
      expect(find.text('Үсөн'), findsOneWidget);
      expect(find.text('Саян'), findsOneWidget);

      // Ranks four and down sit below the fold on a 360x800 phone.
      await tester.drag(find.byType(ListView), const Offset(0, -420));
      await tester.pumpAndSettle();
      expect(find.text('4'), findsOneWidget);
      expect(find.text('Айбеков Н.'), findsOneWidget);
      expect(find.text('10'), findsOneWidget);
      expect(find.text('Рыскулов Ы.'), findsOneWidget);
    });

    testWidgets('each contest card opens its own detail panel', (tester) async {
      await render(tester, university: kstu, locale: AppLocale.ky, bright: false);

      // Prizes: the card shows the reach, the panel shows every placing.
      expect(find.text('70\u00A0000\u00A0сом'), findsNothing);
      await tester.tap(find.text('ТОП 10'));
      await tester.pumpAndSettle();
      expect(find.text('70\u00A0000\u00A0сом'), findsOneWidget);
      expect(find.text('30\u00A0000\u00A0сом'), findsOneWidget);
      expect(find.text('20\u00A0000\u00A0сом'), findsOneWidget);
      await tester.tap(find.text('ЖАБУУ'));
      await tester.pumpAndSettle();
      expect(find.text('70\u00A0000\u00A0сом'), findsNothing);

      // Rules: the full text is behind the card, not stretching the layout.
      await tester.tap(find.text('Эрежелер'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('КГТУнун студенттери гана'),
        findsOneWidget,
      );
    });

    testWidgets('a university with no contest gets the empty state',
        (tester) async {
      await render(tester,
          university: auca, locale: AppLocale.ky, bright: false);

      expect(find.text('Бул университетте азырынча конкурс жок'),
          findsOneWidget);
      expect(find.text('Башка университет тандоо'), findsOneWidget);
      expect(find.text('БАЙГЕ ФОНДУ'), findsNothing);
    });
  });

  group('dialogs', () {
    late SharedPreferences prefs;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      prefs = await SharedPreferences.getInstance();
    });

    Future<void> pump(WidgetTester tester, Future<void> Function(BuildContext) open) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            prefsProvider.overrideWithValue(prefs),
            userStateProvider.overrideWithValue(null),
            universitiesProvider.overrideWithValue(_catalogue),
          ],
          child: Consumer(
            builder: (context, ref, _) => StringsScope(
              strings: Strings(ref.watch(localeProvider)),
              child: MaterialApp(
                home: Builder(
                  builder: (context) => Scaffold(
                    body: Center(
                      child: TextButton(
                        onPressed: () => open(context),
                        child: const Text('open'),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
    }

    testWidgets('role dialog returns the tapped role', (tester) async {
      UniLeagueRole? picked;
      await pump(tester, (context) async {
        picked = await showUniRoleDialog(context);
      });

      expect(find.text('РОЛЬ ТАНДА'), findsOneWidget);
      expect(find.text('СТУДЕНТ'), findsOneWidget);
      expect(find.text('КӨРҮҮЧҮ'), findsOneWidget);

      await tester.tap(find.text('КӨРҮҮЧҮ'));
      await tester.pumpAndSettle();
      expect(picked, UniLeagueRole.viewer);
    });

    testWidgets('picker lists every university and returns the selection',
        (tester) async {
      String? picked;
      await pump(tester, (context) async {
        picked = await showUniversityPicker(
          context,
          role: UniLeagueRole.student,
        );
      });

      expect(find.text('ӨЗҮНДҮН УНИВЕРСИТЕТИҢДИ ТАНДА'), findsOneWidget);
      expect(find.text('ПОЛИТЕХ'), findsOneWidget);
      expect(find.text('САЛЫМБЕКОВ УНИВЕРСИТЕТ'), findsOneWidget);

      // The list is taller than the panel on a phone, so the last entry has
      // to be reachable by scrolling rather than clipped away.
      await tester.drag(find.byType(ListView), const Offset(0, -220));
      await tester.pumpAndSettle();
      expect(find.text('КНУ'), findsWidgets);

      await tester.drag(find.byType(ListView), const Offset(0, 400));
      await tester.pumpAndSettle();

      // OK stays inert until something is chosen — popping null here would
      // silently drop the player back to the general league.
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      expect(find.text('ПОЛИТЕХ'), findsOneWidget);

      await tester.tap(find.text('ПОЛИТЕХ'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      expect(picked, 'kstu');
    });

    testWidgets('picker close button returns nothing', (tester) async {
      var called = false;
      String? picked;
      await pump(tester, (context) async {
        picked = await showUniversityPicker(
          context,
          role: UniLeagueRole.viewer,
        );
        called = true;
      });

      await tester.tap(find.byIcon(Icons.close_rounded));
      await tester.pumpAndSettle();
      expect(called, isTrue);
      expect(picked, isNull);
    });
  });
}
