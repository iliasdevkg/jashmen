/// End-to-end smoke test against the REAL backend
/// (https://jashmenstudio.com/admin/api).
///
/// Deliberately not mocked: the thing most likely to break in this port is
/// the auth handshake — access token in the keychain, refresh token in a
/// cookie jar the browser used to manage for us. A mocked client would pass
/// while the real one logs the user out on every cold start.
///
/// Run:
///   flutter test integration_test/app_flow_test.dart \
///     -d `<simulator-id>` \
///     --dart-define=TEST_EMAIL=... --dart-define=TEST_PASSWORD=...
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

/// `pumpAndSettle` is unusable past the login screen: the learn path runs a
/// looping "bob" animation on the next-up node and a 1s countdown timer, so
/// frames are always scheduled and settle never returns. Pump a fixed number
/// of frames instead — enough wall-clock for the real network call to land.
Future<void> pumpFor(WidgetTester tester, Duration total) async {
  const step = Duration(milliseconds: 100);
  for (var elapsed = Duration.zero; elapsed < total; elapsed += step) {
    await tester.pump(step);
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('sign in, land on the learn path, walk every tab',
      (tester) async {
    expect(_email.isNotEmpty, isTrue,
        reason: 'Pass --dart-define=TEST_EMAIL=...');

    SharedPreferences.setMockInitialValues({});
    final api = await ApiClient.create();
    final prefs = await SharedPreferences.getInstance();

    // Start signed out so the login path is what gets exercised, not a token
    // left behind by an earlier run.
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
    // The signed-out screen is static, so settle is still safe here.
    await tester.pumpAndSettle(const Duration(seconds: 10));

    // ── Auth ───────────────────────────────────────────────────────────
    expect(find.text('Кайра кош келиңиз'), findsOneWidget,
        reason: 'a signed-out app should open on the login screen');

    final fields = find.byType(TextFormField);
    expect(fields, findsNWidgets(2), reason: 'login has email + password');

    await tester.enterText(fields.at(0), _email);
    await tester.enterText(fields.at(1), _password);
    await tester.pumpAndSettle();

    // The submit button, not the "Аккаунтуңуз жокпу? Катталуу" toggle below.
    await tester.tap(find.widgetWithText(FilledButton, 'Кирүү'));
    await pumpFor(tester, const Duration(seconds: 25));

    // ── Learn ──────────────────────────────────────────────────────────
    // 'Окуу' appears twice (app bar + nav label), so assert on the shell
    // itself rather than a string that is legitimately duplicated.
    expect(find.byType(NavigationBar), findsOneWidget,
        reason: 'login should land on the tabbed shell');
    expect(tester.takeException(), isNull, reason: 'learn path threw');

    // ── Every other tab renders ────────────────────────────────────────
    // byTooltip targets the NavigationDestination unambiguously; find.text
    // would also match each screen's own app-bar title.
    for (final label in ['Лига', 'Дүкөн', 'Профиль', 'Жөндөөлөр']) {
      await tester.tap(find.byTooltip(label));
      await pumpFor(tester, const Duration(seconds: 12));
      expect(tester.takeException(), isNull,
          reason: '$label tab threw while rendering');
      expect(find.byType(NavigationBar), findsOneWidget,
          reason: '$label should stay inside the shell');
    }

    // Back to Learn, leaving the app there for screenshots.
    await tester.tap(find.byTooltip('Окуу'));
    await pumpFor(tester, const Duration(seconds: 8));
    expect(tester.takeException(), isNull);
  });
}
