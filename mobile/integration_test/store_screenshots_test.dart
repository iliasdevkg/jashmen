/// Takes the App Store screenshot set by driving the real app.
///
/// Not a correctness test — a tool that happens to be written as one, because
/// `integration_test` is the way to reach a running simulator without needing
/// macOS Accessibility permission to type into it. It signs in as a seeded
/// learner against a LOCAL API (never production: these screenshots must not
/// need a real person's account) and captures each screen at the device's
/// native resolution, which on an iPhone 17 Pro Max is the 1320x2868 App
/// Store asks for.
///
/// The learner and the league around them are built by the script that runs
/// this — see docs/STORE_SUBMISSION.md, "Скриншоттор".
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:jashmen/src/api/api_client.dart';
import 'package:jashmen/src/app.dart';
import 'package:jashmen/src/state/providers.dart';

const _email = String.fromEnvironment('TEST_EMAIL');
const _password = String.fromEnvironment('TEST_PASSWORD');

/// Fixed-length pump: the learn path loops animations, so `pumpAndSettle`
/// never returns once signed in.
Future<void> pumpFor(WidgetTester tester, Duration total) async {
  const step = Duration(milliseconds: 100);
  for (var elapsed = Duration.zero; elapsed < total; elapsed += step) {
    await tester.pump(step);
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('capture the store screenshots', (tester) async {
    expect(_email.isNotEmpty, isTrue, reason: 'Pass --dart-define=TEST_EMAIL=...');

    SharedPreferences.setMockInitialValues({});
    final api = await ApiClient.create();
    final prefs = await SharedPreferences.getInstance();
    await api.clearToken();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          prefsProvider.overrideWithValue(prefs),
        ],
        child: const JashMenApp(),
      ),
    );
    await tester.pumpAndSettle(const Duration(seconds: 10));

    // The picture is taken from OUTSIDE, by `xcrun simctl io ... screenshot`,
    // not by binding.takeScreenshot. Flutter's own capture renders only the
    // app, so the status bar area comes out as an empty band; simctl
    // photographs the whole device, with the 9:41 clock and full battery the
    // run sets up beforehand.
    //
    // This just puts the screen on show and says so on stdout, then holds it
    // long enough for the host to react. The host watches for "SHOT:<name>".
    Future<void> shot(String name) async {
      await pumpFor(tester, const Duration(milliseconds: 900));
      // ignore: avoid_print
      print('SHOT:$name');
      await pumpFor(tester, const Duration(seconds: 3));
    }

    // A fresh install opens on the onboarding carousel, and it is one of the
    // best-looking screens in the app — it goes in the set.
    await shot('0_onboarding');

    // Skip it. On a fresh install this lands on the auth screen.
    await tester.tap(find.text('Өткөрүп жиберүү'));
    await pumpFor(tester, const Duration(seconds: 2));

    // ── Sign in ────────────────────────────────────────────────────────
    // The auth screen can open on either tab; sign-up has an extra name
    // field, so three fields means the wrong tab.
    if (find.byType(TextFormField).evaluate().length == 3) {
      await tester.tap(find.text('Кирүү').first);
      await pumpFor(tester, const Duration(seconds: 1));
    }
    // Sign in, and be patient about it. The first request after a login can
    // reach the server before the token is stored, get a 401, and bounce the
    // app to the auth screen for a moment before the refresh cookie brings it
    // back — a race in a fresh install that a person never sees, because they
    // are still looking at the spinner. The test would see it as "not signed
    // in", so it waits for the shell and signs in again if it got bounced.
    bool onShell() =>
        find.text('Лига').evaluate().isNotEmpty &&
        find.byType(TextFormField).evaluate().isEmpty;

    for (var attempt = 0; attempt < 3 && !onShell(); attempt++) {
      final fields = find.byType(TextFormField);
      if (fields.evaluate().length >= 2) {
        await tester.enterText(fields.at(0), _email);
        await tester.enterText(fields.at(1), _password);
        await tester.pumpAndSettle();
        // "Кирүү" is on screen twice — the tab at the top and the submit
        // button below the form — and the button is the later of the two.
        await tester.tap(find.text('Кирүү').last);
      }
      for (var i = 0; i < 80 && !onShell(); i++) {
        await tester.pump(const Duration(milliseconds: 500));
      }
    }
    expect(onShell(), isTrue, reason: 'sign-in did not reach the shell');
    await pumpFor(tester, const Duration(seconds: 3));

    // ── 1. The learn path ──────────────────────────────────────────────
    await shot('1_learn');

    // ── 2. A lesson's preview sheet ────────────────────────────────────
    // The next lesson the learner has not done yet.
    await tester.tap(find.text('Жеке бюджет түзүү').first);
    await pumpFor(tester, const Duration(seconds: 2));
    await shot('2_preview');

    // ── 3. Inside the lesson ───────────────────────────────────────────
    await tester.tap(find.text('Баштоо'));
    await pumpFor(tester, const Duration(seconds: 3));
    await shot('3_lesson');

    // Leave without finishing: back out of the lesson, confirming the exit.
    final close = find.byIcon(Icons.close_rounded);
    if (close.evaluate().isNotEmpty) {
      await tester.tap(close.first);
      await pumpFor(tester, const Duration(seconds: 1));
      final leave = find.textContaining('Чыгуу');
      if (leave.evaluate().isNotEmpty) {
        await tester.tap(leave.last);
        await pumpFor(tester, const Duration(seconds: 2));
      }
    }

    // ── 4. The university league ───────────────────────────────────────
    await tester.tap(find.text('Лига').last);
    await pumpFor(tester, const Duration(seconds: 6));

    // The league opens on the general table, where a student's points do not
    // count: every learner enrolled at a university earns into the campus
    // table instead. So that is the one with something to show.
    final campusTab = find.byWidgetPredicate(
      (w) => w is Text && (w.data ?? '').toLowerCase().contains('университет ли'),
    );
    if (campusTab.evaluate().isNotEmpty) {
      await tester.tap(campusTab.first);
      await pumpFor(tester, const Duration(seconds: 5));
    }
    // Scroll past the campus header to the podium and the table: that is the
    // part worth showing, and the header carries demo data (an organiser's
    // phone number, last year's dates) that has no place in a store listing.
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -760));
    await pumpFor(tester, const Duration(seconds: 2));
    await shot('4_league');

    // ── 5. The shop ────────────────────────────────────────────────────
    await tester.tap(find.text('Дүкөн').last);
    await pumpFor(tester, const Duration(seconds: 6));
    await shot('5_shop');

    // ── 6. Profile ─────────────────────────────────────────────────────
    await tester.tap(find.text('Профиль').last);
    await pumpFor(tester, const Duration(seconds: 6));
    await shot('6_profile');

    expect(tester.takeException(), isNull);
  });
}
