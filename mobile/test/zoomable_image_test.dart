/// Covers the tap-to-enlarge wrapper — the twin of the web's
/// src/components/ZoomableImage.jsx.
///
/// Three things are worth pinning down. That the wrapper stays invisible
/// when nobody taps it, because it sits around images on almost every
/// screen and must not change how any of them look. That the full-screen
/// view opens and closes, since it is a route and a stuck one traps the
/// learner. And that two pictures on the same screen carry different hero
/// tags — sharing one is a hard crash, and the same photo really can appear
/// on two prizes.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:jashmen/src/core/i18n.dart';
import 'package:jashmen/src/core/theme.dart';
import 'package:jashmen/src/widgets/zoomable_image.dart';

const _url = 'https://example.test/a.png';

/// The full-screen view shows a spinner while the image loads, and in a
/// test that image never arrives — so the tree never goes idle and
/// pumpAndSettle would sit there until it times out. Pump past the route
/// transition instead.
Future<void> _settleRoute(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}

Widget _wrap(Widget child, {AppLocale locale = AppLocale.ky}) => StringsScope(
      strings: Strings(locale),
      child: MaterialApp(
        theme: AppTheme.build(bright: false),
        home: Scaffold(body: Center(child: child)),
      ),
    );

void main() {
  testWidgets('draws its child untouched until it is tapped', (tester) async {
    await tester.pumpWidget(_wrap(
      const ZoomableImage(
        imageUrl: _url,
        tag: 'prize-1',
        child: SizedBox(width: 80, height: 80, child: Placeholder()),
      ),
    ));

    expect(find.byType(Placeholder), findsOneWidget);
    expect(find.byType(InteractiveViewer), findsNothing);
    expect(find.byIcon(Icons.close_rounded), findsNothing);
  });

  testWidgets('a tap opens the full-screen view and the X closes it',
      (tester) async {
    await tester.pumpWidget(_wrap(
      const ZoomableImage(
        imageUrl: _url,
        tag: 'prize-1',
        caption: 'Бир чыны кофе',
        child: SizedBox(width: 80, height: 80, child: Placeholder()),
      ),
    ));

    await tester.tap(find.byType(ZoomableImage));
    await _settleRoute(tester);

    // Pinch and pan come from InteractiveViewer; the caption comes along.
    expect(find.byType(InteractiveViewer), findsOneWidget);
    expect(find.text('Бир чыны кофе'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close_rounded));
    await _settleRoute(tester);

    expect(find.byType(InteractiveViewer), findsNothing);
    expect(find.byType(Placeholder), findsOneWidget);
  });

  testWidgets('a caption-less image opens without an empty strip',
      (tester) async {
    await tester.pumpWidget(_wrap(
      const ZoomableImage(
        imageUrl: _url,
        tag: 'logo-1',
        child: SizedBox(width: 40, height: 40, child: Placeholder()),
      ),
    ));

    await tester.tap(find.byType(ZoomableImage));
    await _settleRoute(tester);

    expect(find.byType(InteractiveViewer), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('the same photo twice on one screen still has two tags',
      (tester) async {
    await tester.pumpWidget(_wrap(
      const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ZoomableImage(
            imageUrl: _url,
            tag: 'prize-1',
            child: SizedBox(width: 40, height: 40, child: Placeholder()),
          ),
          ZoomableImage(
            imageUrl: _url,
            tag: 'prize-2',
            child: SizedBox(width: 40, height: 40, child: Icon(Icons.star)),
          ),
        ],
      ),
    ));

    final tags = tester
        .widgetList<Hero>(find.byType(Hero))
        .map((h) => h.tag)
        .toSet();
    expect(tags.length, 2, reason: 'two heroes sharing a tag is a crash');

    // And opening one of them really does fly, rather than throwing.
    await tester.tap(find.byType(ZoomableImage).first);
    await _settleRoute(tester);
    expect(tester.takeException(), isNull);
    expect(find.byType(InteractiveViewer), findsOneWidget);
  });

  testWidgets('every locale labels the control', (tester) async {
    for (final locale in AppLocale.values) {
      await tester.pumpWidget(_wrap(
        const ZoomableImage(
          imageUrl: _url,
          tag: 'prize-1',
          child: SizedBox(width: 40, height: 40, child: Placeholder()),
        ),
        locale: locale,
      ));

      final label = Strings(locale).t('common.zoomImage');
      expect(label, isNot('common.zoomImage'),
          reason: '${locale.code} is missing the string');
      expect(find.bySemanticsLabel(label), findsOneWidget);
    }
  });
}
