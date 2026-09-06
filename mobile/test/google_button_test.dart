/// Covers the Google sign-in button's one hard safety rule.
///
/// On iOS the Google SDK needs a client id — from GIDClientID in Info.plist
/// or from the one handed to GoogleSignIn(). This app ships neither yet, and
/// calling the SDK without one raises an Objective-C exception that no Dart
/// catch can hold: the process dies. A fresh install used to hit exactly
/// that and show a white screen.
///
/// The button stays on screen regardless — taking a sign-in method away is
/// worse than one that is not ready. What must never happen is the tap
/// reaching the SDK unconfigured.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:jashmen/src/core/i18n.dart';
import 'package:jashmen/src/core/theme.dart';
import 'package:jashmen/src/models/content.dart';
import 'package:jashmen/src/state/providers.dart';
import 'package:jashmen/src/widgets/google_sign_in_button.dart';

Future<void> _pump(
  WidgetTester tester, {
  required PublicConfig config,
  void Function(String)? onError,
}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();

  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(390, 900);
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        prefsProvider.overrideWithValue(prefs),
        publicConfigProvider.overrideWith((ref) async => config),
      ],
      child: StringsScope(
        strings: Strings(AppLocale.ky),
        child: MaterialApp(
          theme: AppTheme.build(bright: false),
          home: Scaffold(
            body: SingleChildScrollView(
              child: GoogleSignInButton(onError: onError),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));
}

void main() {
  testWidgets('the button is on screen even before Google is configured',
      (tester) async {
    await _pump(tester, config: const PublicConfig());

    expect(find.text(Strings(AppLocale.ky).t('auth.google')),
        findsOneWidget,
        reason: 'hiding it removes a sign-in method the learner may rely on');
  });

  testWidgets('tapping it unconfigured explains, and never starts the SDK',
      (tester) async {
    String? said;
    await _pump(
      tester,
      config: const PublicConfig(),
      onError: (m) => said = m,
    );

    // The label, not the widget's centre — the widget also contains the
    // "or" divider above the pill.
    await tester.tap(find.text(Strings(AppLocale.ky).t('auth.google')));
    await tester.pump(const Duration(milliseconds: 200));

    // Reaching the SDK here is what killed the process on iOS. A message is
    // the whole of the correct behaviour.
    expect(tester.takeException(), isNull);
    expect(said, Strings(AppLocale.ky).t('auth.googleUnavailable'));
  });

  testWidgets('it still renders once a client id arrives', (tester) async {
    await _pump(
      tester,
      config: const PublicConfig(googleClientId: 'web-id.apps.googleusercontent.com'),
    );

    expect(tester.takeException(), isNull);
    expect(find.text(Strings(AppLocale.ky).t('auth.google')),
        findsOneWidget);
  });

  testWidgets('it wears Google\u2019s own mark, not the drawn stand-in',
      (tester) async {
    await _pump(tester, config: const PublicConfig());

    // The painted four-arc "G" is the fallback for a bundle that somehow
    // shipped without the file. Normally the real artwork is what shows, and
    // a rename that quietly reverted to the drawing would be invisible in
    // review — the two look almost alike at 26px.
    final image = tester.widget<Image>(find.descendant(
      of: find.byType(GoogleSignInButton),
      matching: find.byType(Image),
    ));
    expect(
      (image.image as AssetImage).assetName,
      'assets/medals/googlelogo.png',
    );
  });
}
