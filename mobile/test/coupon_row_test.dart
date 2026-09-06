/// Covers the profile's "Купондорум" row.
///
/// It exists because of one real bug: the partner logo was handed
/// [Redemption.prizeTitle] — a trilingual map — where a plain String was
/// wanted. `prizeTitle` is `dynamic`, so that satisfied the compiler and
/// `flutter analyze` saw nothing; it threw when the row was built, and a
/// release build paints a thrown widget as a featureless grey block. The
/// whole coupon list disappeared behind one.
///
/// So the assertion that matters here is simply: the row builds, with a
/// map title, without throwing.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:jashmen/src/core/i18n.dart';
import 'package:jashmen/src/core/theme.dart';
import 'package:jashmen/src/models/user_state.dart';
import 'package:jashmen/src/screens/profile_screen.dart';
import 'package:jashmen/src/state/providers.dart';

Redemption _redemption({
  dynamic prizeTitle,
  dynamic partnerName,
  String? partnerLogoUrl,
  String? promoCode,
}) =>
    Redemption(
      id: 'r1',
      code: 'JASHMEN-AB12CD34',
      date: '2026-09-03',
      ts: 1788000000000,
      promoCode: promoCode,
      prizeTitle: prizeTitle,
      partnerName: partnerName,
      partnerLogoUrl: partnerLogoUrl,
      priceCoins: 100,
    );

Future<void> _pump(
  WidgetTester tester,
  Redemption r, {
  AppLocale locale = AppLocale.ky,
  bool bright = false,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(390, 900);
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    // PressScale reads the animations setting off the session, so the row
    // needs a scope even though it holds no state of its own.
    ProviderScope(
      overrides: [userStateProvider.overrideWithValue(null)],
      child: StringsScope(
        strings: Strings(locale),
        child: MaterialApp(
          theme: AppTheme.build(bright: bright),
          home: Scaffold(
            body: SingleChildScrollView(
              child: CouponRow(redemption: r, locale: locale),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('a trilingual title with a partner logo builds', (tester) async {
    await _pump(
      tester,
      _redemption(
        prizeTitle: const {'ky': 'Бир чыны кофе', 'ru': 'Кофе', 'en': 'Coffee'},
        partnerName: const {'ky': 'MBANK'},
        partnerLogoUrl: 'https://example.test/logo.png',
      ),
    );

    expect(tester.takeException(), isNull, reason: 'the grey-block bug');
    expect(find.text('Бир чыны кофе'), findsOneWidget);
    expect(find.textContaining('JASHMEN-AB12CD34'), findsWidgets);
  });

  testWidgets('only the partner code is shown, never JashMen\'s own',
      (tester) async {
    await _pump(
      tester,
      _redemption(
        prizeTitle: const {'ky': 'Бир чыны кофе'},
        partnerName: const {'ky': 'MBANK'},
        promoCode: 'MBANK-0001',
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('MBANK-0001'), findsOneWidget);
    // JashMen's own number is the operator's reconciliation key. Showing it
    // beside the partner's only made the learner wonder which to hand over.
    expect(find.textContaining('JASHMEN-'), findsNothing);
    expect(find.text('Өнөктөштүн коду — дүкөндө ушуну көрсөтүңүз'), findsOneWidget);
  });

  testWidgets('a prize with no partner code falls back to the claim number',
      (tester) async {
    await _pump(tester, _redemption(prizeTitle: const {'ky': 'Кофе'}));

    expect(tester.takeException(), isNull);
    // Something has to stand as proof of the claim when the partner has no
    // code programme at all — an empty coupon proves nothing.
    expect(find.text('JASHMEN-AB12CD34'), findsOneWidget);
    expect(find.textContaining('Өнөктөштүн коду'), findsNothing);
  });

  testWidgets('a legacy bare-string title still builds', (tester) async {
    await _pump(
      tester,
      _redemption(prizeTitle: 'Кофе', partnerName: 'MBANK'),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('Кофе'), findsOneWidget);
  });

  testWidgets('a deleted prize leaves the code standing on its own',
      (tester) async {
    await _pump(tester, _redemption());

    expect(tester.takeException(), isNull);
    expect(find.textContaining('JASHMEN-AB12CD34'), findsWidgets);
  });

  testWidgets('no overflow in any locale or theme', (tester) async {
    for (final locale in AppLocale.values) {
      for (final bright in [false, true]) {
        await _pump(
          tester,
          _redemption(
            prizeTitle: const {
              'ky': 'Абдан узун сыйлыктын аталышы бир сапка батпайт',
              'ru': 'Очень длинное название приза, которое не помещается',
              'en': 'A very long prize title that will not fit on one line',
            },
            partnerName: const {'ky': 'MBANK'},
            partnerLogoUrl: 'https://example.test/logo.png',
          ),
          locale: locale,
          bright: bright,
        );
        expect(tester.takeException(), isNull,
            reason: '${locale.code} bright=$bright');
      }
    }
  });
}
