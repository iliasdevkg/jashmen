/// Covers the rule that decides how often the app talks to the server.
///
/// It is worth its own test because getting it wrong is invisible in the UI
/// and expensive in the wild: too eager and every tab tap costs a round trip
/// on a phone plan; too lazy and an admin's edit stays hidden behind stale
/// content, which is the bug this whole mechanism exists to fix.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:jashmen/src/state/providers.dart';

void main() {
  /// A clock the test moves by hand — real time in a test is a flake.
  late DateTime now;
  StaleClock make() => StaleClock(now: () => now);

  setUp(() => now = DateTime.utc(2026, 9, 3, 12));

  test('the first ask always goes through', () {
    expect(make().due('content'), isTrue);
  });

  test('a second ask inside the window is refused', () {
    final clock = make();
    expect(clock.due('content'), isTrue);

    now = now.add(kStaleAfter - const Duration(milliseconds: 1));
    expect(clock.due('content'), isFalse, reason: 'still fresh');
  });

  test('the window reopens once it has passed', () {
    final clock = make();
    clock.due('content');

    now = now.add(kStaleAfter);
    expect(clock.due('content'), isTrue);
  });

  test('force ignores the window — a pull-to-refresh always asks', () {
    final clock = make();
    clock.due('content');

    now = now.add(const Duration(seconds: 1));
    expect(clock.due('content', force: true), isTrue);
  });

  test('each source keeps its own clock', () {
    final clock = make();
    clock.due('content');

    expect(clock.due('leaderboard'), isTrue,
        reason: 'refreshing one must not silence another');
    expect(clock.due('content'), isFalse);
  });

  test('answering true also starts the clock, so two callers do not both fire',
      () {
    final clock = make();
    expect(clock.due('content'), isTrue);
    expect(clock.due('content'), isFalse, reason: 'same instant, same key');
  });

  test('reset makes everything due again', () {
    final clock = make();
    clock.due('content');
    clock.due('leaderboard');

    clock.reset();
    expect(clock.due('content'), isTrue);
    expect(clock.due('leaderboard'), isTrue);
  });
}
