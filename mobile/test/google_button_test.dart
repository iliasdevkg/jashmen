/// Covers when the Google sign-in button is shown at all.
///
/// Two rules meet here, and the second one changed.
///
/// The safety rule: on iOS the Google SDK needs a client id — from
/// GIDClientID in Info.plist or from the one handed to GoogleSignIn().
/// Calling it without one raises an Objective-C exception that no Dart catch
/// can hold: the process dies. A fresh install used to hit exactly that and
/// show a white screen.
///
/// The visibility rule USED to be "show it anyway and explain on tap", on
/// the reasoning that taking a sign-in method away is worse than one that is
/// not ready. App Store review does not read it that way — a visible control
/// that cannot do its job is a broken feature (Guideline 2.1) — and iPhone
/// users are no longer left without a social option, because Sign in with
/// Apple sits directly below it. So: not configured, not on screen.
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
  testWidgets('an unconfigured Google is not on screen at all', (tester) async {
    await _pump(tester, config: const PublicConfig());

    expect(find.text(Strings(AppLocale.ky).t('auth.google')), findsNothing,
        reason: 'App Store review treats a control that cannot work as broken');
    // And nothing of the surrounding chrome either — an "or" divider above
    // nothing is its own small bug.
    expect(find.text(Strings(AppLocale.ky).t('auth.or')), findsNothing);
  });

  testWidgets('it appears the moment a client id arrives', (tester) async {
    await _pump(
      tester,
      config: const PublicConfig(googleClientId: 'web-id.apps.googleusercontent.com'),
    );

    expect(tester.takeException(), isNull);
    expect(find.text(Strings(AppLocale.ky).t('auth.google')), findsOneWidget,
        reason: 'configuring the server is enough — no store release to turn it on');
  });

  testWidgets('a configured button never reaches the SDK during a test',
      (tester) async {
    // The guard that matters on iOS: the tap must not reach the plugin
    // unconfigured. Here the plugin has no platform behind it, so what is
    // being checked is that the widget survives the attempt rather than
    // throwing something the app cannot catch.
    await _pump(
      tester,
      config: const PublicConfig(googleClientId: 'web-id.apps.googleusercontent.com'),
    );
    await tester.tap(find.text(Strings(AppLocale.ky).t('auth.google')));
    await tester.pump(const Duration(milliseconds: 200));
    expect(tester.takeException(), isNull);
  });

  testWidgets('it wears Google\u2019s own mark, not the drawn stand-in',
      (tester) async {
    await _pump(
      tester,
      config: const PublicConfig(googleClientId: 'web-id.apps.googleusercontent.com'),
    );

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
