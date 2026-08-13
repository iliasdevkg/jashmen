/// Tiny semantic wrapper over [HapticFeedback] — call sites say what
/// *happened* (a correct answer, a purchase, a mistake), not which raw
/// impact level to fire. Keeps every "does this feel right?" tuning
/// decision in one place instead of scattered `HapticFeedback.x()` calls.
library;

import 'package:flutter/services.dart';

class Haptics {
  const Haptics._();

  /// A lightweight UI acknowledgement — a tab switch, a tap on a card.
  static void tap() => HapticFeedback.selectionClick();

  /// Something good just happened at small/medium scale — a correct
  /// answer, a purchase, code copied. One crisp tap.
  static void success() => HapticFeedback.mediumImpact();

  /// A big win — lesson finished perfectly, an achievement unlocked, a
  /// prize redeemed. Two-pulse pattern reads as more celebratory than a
  /// single impact without needing a real vibration-pattern API.
  static Future<void> celebrate() async {
    HapticFeedback.mediumImpact();
    await Future.delayed(const Duration(milliseconds: 90));
    HapticFeedback.heavyImpact();
  }

  /// A wrong answer, a blocked action. Deliberately blunter than
  /// [success] so the two are never confused eyes-closed.
  static void error() => HapticFeedback.heavyImpact();
}
