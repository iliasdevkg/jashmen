/// Covers where the module's artwork tile sits on the learning path.
///
/// It used to be centred directly above the module card. The design moves it
/// beside the FIRST LESSON instead, hanging off the edge of the screen — see
/// LearnPage.jsx, which this screen mirrors. The numbers are shared
/// constants rather than magic values in two files, and this pins them so
/// the two clients cannot drift apart again.
///
/// Which edge it hangs off is per module (`artSide`, chosen in the admin
/// panel). The rule this file protects hardest is the boring one: a module
/// the panel has never touched keeps its tile on the left, because that is
/// where every existing tile already sits and a silent migration would move
/// artwork on courses nobody edited.
library;

import 'package:flutter_test/flutter_test.dart';

import 'package:jashmen/src/models/content.dart';
import 'package:jashmen/src/screens/learn_screen.dart';

Module _module(Map<String, dynamic> extra) => Module.fromJson({
      'id': 'm1',
      'title': {'ky': 'Модуль'},
      'color': '#58CC02',
      'lessons': const [],
      ...extra,
    });

void main() {
  test('the tile hangs off the left edge, not the centred canvas', () {
    // The canvas is 288 wide and centred, so on a 320px phone it leaves only
    // 16px of margin. Anchoring the tile to the canvas would push it off
    // screen; anchoring it to the edge cannot.
    expect(kModuleTileLeft, greaterThanOrEqualTo(0));
    expect(kModuleTileLeft, lessThan(32),
        reason: 'it should sit against the edge, not wander inward');
  });

  test('the tile lines up with the first node, a little low', () {
    // The first node's circle centre, in canvas coordinates.
    const firstNodeCentre = kPathTopPad + kNodeRadius;
    final tileCentre = kModuleTileTop + kModuleTileSize / 2;

    expect(tileCentre, greaterThan(firstNodeCentre),
        reason: 'the design sits it against the label, not level with it');
    expect(tileCentre - firstNodeCentre, lessThan(32),
        reason: 'but still beside that node, not adrift between two');
  });

  test('the tile never starts above the path', () {
    expect(kModuleTileTop, greaterThanOrEqualTo(0));
  });

  group('which edge the artwork hangs off', () {
    test('a module the panel has never touched stays on the left', () {
      expect(_module(const {}).artSide, 'left',
          reason: 'content written before artSide existed must not move');
    });

    test('the panel can put it on the right', () {
      expect(_module(const {'artSide': 'right'}).artSide, 'right');
    });

    test('an explicit left is still left', () {
      expect(_module(const {'artSide': 'left'}).artSide, 'left');
    });

    test('anything else falls back to the left rather than to nothing', () {
      // A value from a newer panel this build does not know, or plain junk.
      // Positioned() would throw on an empty string, so the fallback is not
      // cosmetic — it is what keeps the screen from crashing.
      for (final bad in <dynamic>[null, '', 'RIGHT', 'middle', 0, true, ['right']]) {
        expect(_module({'artSide': bad}).artSide, 'left',
            reason: '$bad is not a side');
      }
    });

    test('both sides use the same inset, so the two mirror each other', () {
      // learn_screen.dart positions with `left: kModuleTileLeft` or
      // `right: kModuleTileLeft`. One constant for both is what makes a
      // page of modules read as a column rather than as a ragged edge.
      expect(kModuleTileLeft, greaterThan(0));
    });
  });

  group('room above the list', () {
    test('the learn screen does not start flush against the header', () {
      // The card used to touch the header's divider, which read as it being
      // stuck to the bar rather than sitting under it.
      expect(kLearnTopGap, greaterThanOrEqualTo(16));
      expect(kLearnTopGap, lessThan(48),
          reason: 'a gap, not a hole — the first module must stay in view');
    });
  });
}
