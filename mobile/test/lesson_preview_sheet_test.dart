/// Covers the lesson preview sheet's use of the module's colour.
///
/// The web sheet (src/components/LessonPreviewSheet.jsx) paints the icon
/// disc, the eyebrow and the Start button in whatever colour the module was
/// given in the admin, so a purple module opens a purple sheet. Mobile did
/// the first two and then painted the button a fixed green, which read as a
/// different product's control sitting under the module's own colour.
///
/// The gated state is the deliberate exception: that button does not start
/// the lesson, it goes to the shop, and it keeps the shop's blue.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:jashmen/src/core/i18n.dart';
import 'package:jashmen/src/core/logic.dart';
import 'package:jashmen/src/core/theme.dart';
import 'package:jashmen/src/models/content.dart';
import 'package:jashmen/src/widgets/lesson_preview_sheet.dart';

const _moduleColor = Color(0xFFCE82FF); // the purple from the web screenshot

final _lesson = Lesson(
  id: 'l1',
  title: const {'ky': 'Карыздан кантип качуу керек'},
  cards: List.generate(
    4,
    (i) => LessonCard(
      type: CardType.quiz,
      question: {'ky': 'Суроо $i'},
      options: const [
        {'ky': 'A'},
        {'ky': 'B'},
      ],
    ),
  ),
);

Future<void> _open(
  WidgetTester tester, {
  required LessonStatus status,
  required bool isGated,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(430, 932);
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    StringsScope(
      strings: Strings(AppLocale.ky),
      child: MaterialApp(
        theme: AppTheme.build(bright: false),
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () => showLessonPreviewSheet(
                  context,
                  locale: AppLocale.ky,
                  lesson: _lesson,
                  status: status,
                  isCheckpoint: false,
                  isGated: isGated,
                  moduleColor: _moduleColor,
                  limits: const ContentLimits(),
                  onStart: () {},
                  onReview: () {},
                  onGoShop: () {},
                ),
                child: const Text('open'),
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

/// The resolved background of the sheet's one FilledButton.
Color? _ctaColor(WidgetTester tester) {
  final button = tester.widget<FilledButton>(find.byType(FilledButton));
  return button.style?.backgroundColor?.resolve(<WidgetState>{});
}

void main() {
  testWidgets('the Start button wears the module colour', (tester) async {
    await _open(tester, status: LessonStatus.available, isGated: false);

    expect(find.text('Карыздан кантип качуу керек'), findsOneWidget);
    expect(_ctaColor(tester), _moduleColor,
        reason: 'the web sheet paints this button with moduleColor');
  });

  testWidgets('a finished lesson keeps the module colour too', (tester) async {
    await _open(tester, status: LessonStatus.completed, isGated: false);
    expect(_ctaColor(tester), _moduleColor);
  });

  testWidgets('the out-of-energy button stays the shop blue', (tester) async {
    await _open(tester, status: LessonStatus.available, isGated: true);

    expect(_ctaColor(tester), AppColors.primary,
        reason: 'this one goes to the shop, not into the lesson');
  });

  testWidgets('the icon disc and the eyebrow carry the module colour',
      (tester) async {
    await _open(tester, status: LessonStatus.available, isGated: false);

    // A circle, like the web's rounded-full.
    final disc = tester.widgetList<Container>(find.byType(Container)).where((c) {
      final d = c.decoration;
      return d is BoxDecoration &&
          d.color == _moduleColor &&
          d.shape == BoxShape.circle;
    });
    expect(disc, isNotEmpty, reason: 'the icon disc is a module-coloured circle');

    final eyebrow = tester.widget<Text>(find.text(Strings(AppLocale.ky).t('lesson.previewLesson')));
    expect(eyebrow.style?.color, _moduleColor);
  });
}
