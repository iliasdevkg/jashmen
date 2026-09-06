/// Covers the dialog behind "delete my account".
///
/// Both stores require the action to exist inside the app (App Store
/// 5.1.1(v), Play's "Data deletion"). What this file protects is the other
/// half — that it cannot happen by accident. The failure mode worth writing
/// tests against is not a bug in the request; it is a borrowed phone and a
/// thumb in the wrong place.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:jashmen/src/core/i18n.dart';
import 'package:jashmen/src/core/theme.dart';
import 'package:jashmen/src/state/providers.dart';
import 'package:jashmen/src/widgets/delete_account_dialog.dart';

Future<void> _open(WidgetTester tester, {required bool hasPassword}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();

  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(390, 900);
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [prefsProvider.overrideWithValue(prefs)],
      child: StringsScope(
        strings: Strings(AppLocale.ky),
        child: MaterialApp(
          theme: AppTheme.build(bright: false),
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: TextButton(
                  onPressed: () =>
                      showDeleteAccountDialog(context, hasPassword: hasPassword),
                  child: const Text('open'),
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

/// The one control that actually destroys anything.
Finder get _deleteButton => find.widgetWithText(FilledButton, 'Биротоло өчүрүү');

bool _enabled(WidgetTester tester) =>
    tester.widget<FilledButton>(_deleteButton).onPressed != null;

void main() {
  group('an account with a password', () {
    testWidgets('opens disabled — it is never one tap', (tester) async {
      await _open(tester, hasPassword: true);
      expect(_deleteButton, findsOneWidget);
      expect(_enabled(tester), isFalse,
          reason: 'a borrowed phone must not be able to delete by tapping through');
    });

    testWidgets('asks for the password, and hides it while typing', (tester) async {
      await _open(tester, hasPassword: true);
      expect(find.text('Ырастоо үчүн сырсөзүңүздү жазыңыз'), findsOneWidget);

      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.obscureText, isTrue,
          reason: 'the password is typed in front of whoever is standing there');
    });

    testWidgets('typing anything at all arms it', (tester) async {
      await _open(tester, hasPassword: true);
      await tester.enterText(find.byType(TextField), 'x');
      await tester.pump();
      // The server decides whether it is right; the client only decides
      // whether the button is worth offering.
      expect(_enabled(tester), isTrue);
    });
  });

  group('an account made with Google or Apple', () {
    testWidgets('asks for the confirmation word instead of a password',
        (tester) async {
      await _open(tester, hasPassword: false);
      expect(find.textContaining(kDeleteConfirmWord), findsWidgets);

      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.obscureText, isFalse, reason: 'there is nothing secret to hide');
    });

    testWidgets('the wrong word leaves it disabled', (tester) async {
      await _open(tester, hasPassword: false);
      for (final wrong in ['ооба', 'delete', 'ӨЧ', '']) {
        await tester.enterText(find.byType(TextField), wrong);
        await tester.pump();
        expect(_enabled(tester), isFalse, reason: '"$wrong" is not the word');
      }
    });

    testWidgets('the right word arms it, in any case', (tester) async {
      await _open(tester, hasPassword: false);
      await tester.enterText(find.byType(TextField), 'өчүр');
      await tester.pump();
      expect(_enabled(tester), isTrue,
          reason: 'a keyboard that lowercases must not lock someone out');
    });
  });

  testWidgets('it says what survives, not just what is destroyed',
      (tester) async {
    await _open(tester, hasPassword: true);
    // "Your data is deleted" is a promise; the honest version names the one
    // thing that stays and says it belongs to nobody.
    expect(find.textContaining('Университет'), findsWidgets);
  });

  testWidgets('cancel closes it and destroys nothing', (tester) async {
    await _open(tester, hasPassword: true);
    await tester.tap(find.widgetWithText(TextButton, 'Жокко чыгаруу'));
    await tester.pumpAndSettle();
    expect(_deleteButton, findsNothing);
  });

  testWidgets('the confirmation word matches the server', (tester) async {
    // admin-api/routes.js#DELETE_CONFIRM_WORD. If these two ever drift, the
    // dialog enables its button for a word the server then refuses.
    expect(kDeleteConfirmWord, 'ӨЧҮР');
  });
}
