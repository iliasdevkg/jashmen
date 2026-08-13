/// Design tokens, ported from the web app's Tailwind classes so the two
/// clients read as one product. The web app calls its light theme "bright
/// mode" (src/store.jsx#useBrightMode) — same two palettes here.
library;

import 'package:flutter/material.dart';

class AppColors {
  const AppColors._();

  // Brand — identical hex values to the web app.
  static const primary = Color(0xFF1CB0F6); // blue: primary action, active nav
  static const success = Color(0xFF58CC02); // green: correct, completed
  static const danger = Color(0xFFFF4B4B); // red: wrong, destructive
  static const warning = Color(0xFFFF9600); // orange: streak / fire
  static const purple = Color(0xFFCE82FF);
  static const gold = Color(0xFFFFD700); // coins

  // Dark (default)
  static const bgDark = Color(0xFF0F172A);
  static const surfaceDark = Color(0xFF1E293B);
  static const borderDark = Color(0xFF334155);
  static const textDark = Color(0xFFFFFFFF);
  static const textMutedDark = Color(0xFF94A3B8);
  static const textFaintDark = Color(0xFF64748B);
  static const navDark = Color(0xFF070C16);

  // Bright
  static const bgLight = Color(0xFFF8FAFC);
  static const surfaceLight = Color(0xFFFFFFFF);
  static const borderLight = Color(0xFFE2E8F0);
  static const textLight = Color(0xFF0F172A);
  static const textMutedLight = Color(0xFF64748B);
  static const textFaintLight = Color(0xFF94A3B8);
}

/// Apple's San Francisco system family. `CupertinoSystemText` is Flutter's
/// alias that resolves to SF Pro natively on iOS/macOS; the dot-prefixed
/// fallbacks cover older engines, and Android quietly keeps its default —
/// SF can't be bundled off-platform under Apple's font license.
class AppFonts {
  const AppFonts._();
  static const sanFrancisco = 'CupertinoSystemText';
  static const sanFranciscoFallback = ['.SF Pro Text', '.SF UI Text'];
}

/// The 4px spacing scale the web app uses. Named so call sites read as
/// intent rather than magic numbers.
class Gap {
  const Gap._();
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
  static const xxl = 32.0;
}

class AppTheme {
  const AppTheme._();

  static ThemeData build({required bool bright}) {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: bright ? Brightness.light : Brightness.dark,
      primary: AppColors.primary,
      error: AppColors.danger,
      surface: bright ? AppColors.surfaceLight : AppColors.surfaceDark,
    );

    final bg = bright ? AppColors.bgLight : AppColors.bgDark;
    final text = bright ? AppColors.textLight : AppColors.textDark;
    final muted = bright ? AppColors.textMutedLight : AppColors.textMutedDark;

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: bg,
      splashFactory: InkRipple.splashFactory,

      // Weights match the web app's type ramp: headings are heavy (w800) and
      // tight, body is w500 — the hierarchy has to read instantly on a phone.
      textTheme: TextTheme(
        displaySmall: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: text, letterSpacing: -0.5),
        headlineMedium: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: text, letterSpacing: -0.3),
        headlineSmall: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: text),
        titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: text),
        titleSmall: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: text),
        bodyLarge: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: text, height: 1.5),
        bodyMedium: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: text, height: 1.5),
        bodySmall: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: muted, height: 1.4),
        labelLarge: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: text),
        labelSmall: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: muted),
      ),

      appBarTheme: AppBarTheme(
        backgroundColor: bg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: text),
        iconTheme: IconThemeData(color: text),
      ),

      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: bright ? AppColors.surfaceLight : const Color(0xFF0B1220),
        contentPadding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: Gap.lg),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: bright ? AppColors.borderLight : AppColors.borderDark, width: 1.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: bright ? AppColors.borderLight : AppColors.borderDark, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.danger, width: 2),
        ),
        hintStyle: TextStyle(color: muted, fontWeight: FontWeight.w500),
      ),

      dividerTheme: DividerThemeData(
        color: bright ? AppColors.borderLight : const Color(0xFF1E293B),
        thickness: 1,
      ),
    );
  }
}

/// Surface/border colors that widgets need but ThemeData has no slot for.
/// Read via `context.tokens` so no widget hardcodes a hex.
extension ThemeTokens on BuildContext {
  AppTokens get tokens {
    final bright = Theme.of(this).brightness == Brightness.light;
    return AppTokens(
      bright: bright,
      card: bright ? AppColors.surfaceLight : AppColors.surfaceDark,
      cardAlt: bright ? const Color(0xFFF1F5F9) : const Color(0xFF12141C),
      border: bright ? AppColors.borderLight : AppColors.borderDark,
      text: bright ? AppColors.textLight : AppColors.textDark,
      muted: bright ? AppColors.textMutedLight : AppColors.textMutedDark,
      faint: bright ? AppColors.textFaintLight : AppColors.textFaintDark,
      nav: bright ? AppColors.surfaceLight : AppColors.navDark,
      bg: bright ? AppColors.bgLight : AppColors.bgDark,
    );
  }
}

class AppTokens {
  const AppTokens({
    required this.bright,
    required this.card,
    required this.cardAlt,
    required this.border,
    required this.text,
    required this.muted,
    required this.faint,
    required this.nav,
    required this.bg,
  });

  final bool bright;
  final Color card;
  final Color cardAlt;
  final Color border;
  final Color text;
  final Color muted;
  final Color faint;
  final Color nav;
  final Color bg;
}
