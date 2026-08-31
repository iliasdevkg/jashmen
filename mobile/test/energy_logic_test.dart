/// computeLiveEnergy — the client mirror of admin-api/energy.js. A drift
/// between the two shows up as a lesson that looks unlocked and then 403s,
/// so the period arithmetic is worth pinning down here rather than finding
/// out on a phone.
library;

import 'package:flutter_test/flutter_test.dart';

import 'package:jashmen/src/core/logic.dart';
import 'package:jashmen/src/models/user_state.dart';

String _todayUtc() => DateTime.now().toUtc().toIso8601String().substring(0, 10);

int _period(int hours) =>
    DateTime.now().toUtc().millisecondsSinceEpoch ~/ (hours * 3600 * 1000);

void main() {
  group('normalizeRefillHours', () {
    test('falls back to a day for junk, and clamps to a week', () {
      expect(normalizeRefillHours(0), 24);
      expect(normalizeRefillHours(-5), 24);
      expect(normalizeRefillHours(8), 8);
      expect(normalizeRefillHours(9999), 168);
    });
  });

  group('computeLiveEnergy', () {
    test('a null state reports the full allowance', () {
      expect(computeLiveEnergy(null, dailyFreeLessons: 3).remaining, 3);
    });

    test('spent lessons come off the allowance inside the period', () {
      final state = UserState(
        energyPeriod: _period(24),
        energyDate: _todayUtc(),
        lessonsToday: 2,
      );
      expect(computeLiveEnergy(state, dailyFreeLessons: 3).remaining, 1);
    });

    test('a stale period resets the counters without a server round trip', () {
      final state = UserState(
        energyPeriod: _period(24) - 1,
        energyDate: '2020-01-01',
        lessonsToday: 99,
      );
      expect(computeLiveEnergy(state, dailyFreeLessons: 3).remaining, 3);
    });

    test('a pre-interval state mid-day keeps its counters', () {
      // energyPeriod is null on every state written before the refill
      // period existed; energyDate is then the only marker of "today".
      final state = UserState(energyDate: _todayUtc(), lessonsToday: 1);
      expect(computeLiveEnergy(state, dailyFreeLessons: 3).remaining, 2);
    });

    test('bought and gifted energy stack on the allowance', () {
      final state = UserState(
        energyPeriod: _period(24),
        energyDate: _todayUtc(),
        lessonsToday: 3,
        bonusEnergyToday: 1,
        supportEnergyToday: 5,
      );
      expect(computeLiveEnergy(state, dailyFreeLessons: 3).remaining, 6);
    });

    test('energy gifted away is spent from the giver own pool', () {
      final state = UserState(
        energyPeriod: _period(24),
        energyDate: _todayUtc(),
        energyGivenToday: 5,
      );
      expect(computeLiveEnergy(state, dailyFreeLessons: 10).remaining, 5);
    });

    test('an exhausted allowance counts down to the end of its period', () {
      final state = UserState(
        energyPeriod: _period(8),
        energyDate: _todayUtc(),
        lessonsToday: 3,
      );
      final energy =
          computeLiveEnergy(state, dailyFreeLessons: 3, energyRefillHours: 8);
      expect(energy.remaining, 0);
      expect(energy.resetMs, isNotNull);
      expect(energy.resetMs!, greaterThan(0));
      expect(energy.resetMs!, lessThanOrEqualTo(8 * 3600 * 1000));
    });

    test('at 24h a period boundary is UTC midnight, exactly as before', () {
      final state = UserState(
        energyPeriod: _period(24),
        energyDate: _todayUtc(),
        lessonsToday: 3,
      );
      final energy = computeLiveEnergy(state, dailyFreeLessons: 3);
      final now = DateTime.now().toUtc();
      final midnight = DateTime.utc(now.year, now.month, now.day + 1);
      expect(
        (energy.resetMs! - midnight.difference(now).inMilliseconds).abs(),
        lessThan(2000),
      );
    });
  });

  group('formatCountdown', () {
    test('promotes to h:mm:ss past an hour', () {
      expect(formatCountdown(0), '0:00');
      expect(formatCountdown(65 * 1000), '1:05');
      expect(formatCountdown((3 * 3600 + 4 * 60 + 5) * 1000), '3:04:05');
    });
  });
}
