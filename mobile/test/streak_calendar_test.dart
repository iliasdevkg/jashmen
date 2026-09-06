/// Covers the profile's streak card — the twin of the web's
/// src/components/StreakCalendar.jsx.
///
/// Two things are worth pinning down. The date maths, because it is UTC and
/// week-aligned and would silently mark the wrong squares if it drifted; and
/// the layout, because the month view lays a whole calendar month across
/// seven columns and a narrow phone is exactly where that overflows.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:jashmen/src/api/api_client.dart';
import 'package:jashmen/src/core/i18n.dart';
import 'package:jashmen/src/core/theme.dart';
import 'package:jashmen/src/widgets/streak_calendar.dart';

String _iso(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

/// How many cells a Sunday-aligned grid for [year]/[month] takes — the same
/// arithmetic the widget does, spelled out here so the test would catch it
/// changing rather than follow it.
int _gridSize(int year, int month) {
  final first = DateTime.utc(year, month, 1);
  final last = DateTime.utc(year, month + 1, 0);
  return first.weekday % 7 + last.day + (6 - (last.weekday % 7));
}

/// Today and the [n] days before it, as the server would store them.
List<String> _lastDays(int n) {
  final now = DateTime.now().toUtc();
  final today = DateTime.utc(now.year, now.month, now.day);
  return List.generate(n, (i) => _iso(today.subtract(Duration(days: i))));
}

void main() {
  Future<void> pump(
    WidgetTester tester, {
    required Size size,
    required AppLocale locale,
    required bool bright,
    List<String> activeDays = const [],
    int streak = 0,
    ({int lost, int cost})? repair,
    int energy = 0,
    Future<void> Function()? onRepair,
  }) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = size;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      StringsScope(
        strings: Strings(locale),
        child: MaterialApp(
          theme: AppTheme.build(bright: bright),
          home: Scaffold(
            body: SingleChildScrollView(
              child: StreakCalendar(
                streak: streak,
                activeDays: activeDays,
                repair: repair,
                energy: energy,
                onRepair: onRepair,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('opens on the week view and shows seven days', (tester) async {
    await pump(tester,
        size: const Size(390, 900),
        locale: AppLocale.ky,
        bright: false,
        activeDays: _lastDays(3),
        streak: 3);

    expect(find.text('Жума'), findsOneWidget);
    expect(find.text('Ай'), findsOneWidget);
    // Su–Sa headers.
    expect(find.text('Жк'), findsOneWidget);
    expect(find.text('Иш'), findsOneWidget);
    // Today is always inside this week and always studied in this fixture.
    expect(find.text('✓'), findsWidgets);
  });

  testWidgets('the month tab shows this calendar month', (tester) async {
    await pump(tester,
        size: const Size(390, 900),
        locale: AppLocale.ky,
        bright: false,
        activeDays: _lastDays(10),
        streak: 10);

    await tester.tap(find.text('Ай'));
    await tester.pumpAndSettle();

    final now = DateTime.now().toUtc();

    // Whole weeks, spill-over included, so the columns line up under the
    // Su–Sa headers.
    final cells = tester.widgetList<Container>(find.descendant(
      of: find.byType(GridView),
      matching: find.byType(Container),
    ));
    expect(cells.length, _gridSize(now.year, now.month));
    expect(cells.length % 7, 0);

    // Which month it is, spelled out — the whole point of the header.
    expect(find.textContaining('${now.year}'), findsOneWidget);
  });

  testWidgets('the arrows page back but never into the future',
      (tester) async {
    await pump(tester,
        size: const Size(390, 900),
        locale: AppLocale.ky,
        bright: false,
        activeDays: _lastDays(40),
        streak: 40);

    await tester.tap(find.text('Ай'));
    await tester.pumpAndSettle();

    final now = DateTime.now().toUtc();

    // Forward is a no-op on the current month: there is nothing to see there.
    await tester.tap(find.bySemanticsLabel('Кийинки ай'));
    await tester.pumpAndSettle();
    expect(find.textContaining('${now.year}'), findsOneWidget);
    final stayed = tester.widgetList<Container>(find.descendant(
      of: find.byType(GridView),
      matching: find.byType(Container),
    ));
    expect(stayed.length, _gridSize(now.year, now.month));

    // Back one month, then forward again, lands where it started.
    await tester.tap(find.bySemanticsLabel('Мурунку ай'));
    await tester.pumpAndSettle();
    final prev = DateTime.utc(now.year, now.month - 1, 1);
    final back = tester.widgetList<Container>(find.descendant(
      of: find.byType(GridView),
      matching: find.byType(Container),
    ));
    expect(back.length, _gridSize(prev.year, prev.month));

    await tester.tap(find.bySemanticsLabel('Кийинки ай'));
    await tester.pumpAndSettle();
    final forward = tester.widgetList<Container>(find.descendant(
      of: find.byType(GridView),
      matching: find.byType(Container),
    ));
    expect(forward.length, _gridSize(now.year, now.month));
  });

  // The Dart t() substitutes {key}; the web's substitutes {{key}}. Copying a
  // string across without changing the braces leaves "{7} күндүн {5} күнү" on
  // screen — which is exactly what shipped once.
  testWidgets('the studied-days line has no braces left in it', (tester) async {
    for (final locale in AppLocale.values) {
      await pump(tester,
          size: const Size(390, 900),
          locale: locale,
          bright: false,
          activeDays: _lastDays(3),
          streak: 3);

      final line = find.textContaining(RegExp(r'[{}]'));
      expect(line, findsNothing,
          reason: '${locale.code} left a placeholder unsubstituted');
    }
  });

  testWidgets('a learner with no history still renders', (tester) async {
    await pump(tester,
        size: const Size(390, 900),
        locale: AppLocale.en,
        bright: true,
        activeDays: const [],
        streak: 0);

    expect(find.byType(StreakCalendar), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  // ── The buy-it-back offer ──────────────────────────────────────────────
  //
  // It only exists on the day a run breaks, so the card has to render both
  // with and without it, and the button has to be dead when the energy it
  // costs is not there.

  group('streak repair', () {
    testWidgets('no offer means no banner', (tester) async {
      await pump(tester,
          size: const Size(390, 900),
          locale: AppLocale.ky,
          bright: false,
          activeDays: _lastDays(2),
          streak: 2);

      expect(find.byIcon(Icons.heart_broken_rounded), findsNothing);
    });

    testWidgets('an affordable offer restores on tap', (tester) async {
      var called = 0;
      await pump(tester,
          size: const Size(390, 900),
          locale: AppLocale.ky,
          bright: false,
          streak: 0,
          repair: (lost: 12, cost: 1),
          energy: 3,
          onRepair: () async => called++);

      expect(find.byIcon(Icons.heart_broken_rounded), findsOneWidget);
      expect(find.textContaining('12'), findsWidgets);

      await tester.tap(find.text('1 энергия менен кайтаруу'));
      await tester.pumpAndSettle();
      expect(called, 1);
    });

    testWidgets('an empty energy bar disables the button and says why',
        (tester) async {
      var called = 0;
      await pump(tester,
          size: const Size(390, 900),
          locale: AppLocale.ky,
          bright: false,
          streak: 0,
          repair: (lost: 7, cost: 2),
          energy: 1,
          onRepair: () async => called++);

      expect(find.text('Энергия жетишсиз — энергия толгондо кайтара аласың'),
          findsOneWidget);

      await tester.tap(find.text('2 энергия менен кайтаруу'),
          warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(called, 0, reason: 'the tap must not reach the callback');
    });

    testWidgets('a failed repair shows the error and re-enables the button',
        (tester) async {
      await pump(tester,
          size: const Size(390, 900),
          locale: AppLocale.en,
          bright: true,
          streak: 0,
          repair: (lost: 5, cost: 1),
          energy: 3,
          onRepair: () async => throw const ApiException(
              ApiErrorKind.badRequest, 'Энергия жетишсиз',
              status: 400));

      await tester.tap(find.text('Restore for 1 energy'));
      await tester.pumpAndSettle();

      expect(find.text('Энергия жетишсиз'), findsOneWidget);
      expect(find.textContaining('Restore for'), findsOneWidget);
    });
  });

  // 320dp is the narrowest phone still in the wild (iPhone SE 1st gen); seven
  // columns of day cells are the first thing that would break there.
  group('no overflow in any locale, theme, size or view', () {
    for (final locale in AppLocale.values) {
      for (final bright in [false, true]) {
        for (final size in [const Size(320, 700), const Size(430, 900)]) {
          testWidgets('${locale.name} bright=$bright ${size.width.toInt()}dp',
              (tester) async {
            await pump(tester,
                size: size,
                locale: locale,
                bright: bright,
                activeDays: _lastDays(12),
                streak: 12);
            expect(tester.takeException(), isNull);

            await tester.tap(find.byType(GestureDetector).last);
            await tester.pumpAndSettle();
            expect(tester.takeException(), isNull);
          });
        }
      }
    }
  });
}
