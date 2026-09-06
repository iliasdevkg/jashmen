/// App root: theme, locale scope, and routing.
///
/// The web app is a sidebar on desktop and a bottom bar on mobile; this is
/// mobile-only, so it's a bottom bar with the same five destinations, plus
/// the lesson player pushed on top as a full-screen route.
library;

import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/i18n.dart';
import 'core/theme.dart';
import 'screens/auth_screen.dart';
import 'screens/learn_screen.dart';
import 'screens/league_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/streak_screen.dart';
import 'screens/shop_screen.dart';
import 'state/providers.dart';
import 'widgets/lucide_icon.dart';

class JashMenApp extends ConsumerWidget {
  const JashMenApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bright = ref.watch(brightModeProvider);
    final strings = ref.watch(stringsProvider);
    final session = ref.watch(authProvider);
    final onboarded = ref.watch(onboardedProvider);

    return StringsScope(
      strings: strings,
      child: MaterialApp(
        title: 'JashMen',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.build(bright: bright),
        locale: Locale(strings.locale.code),
        supportedLocales: const [Locale('ky'), Locale('ru'), Locale('en')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        // Routing is driven off session state rather than a redirect chain:
        // there are only four top-level cases and this keeps them obvious.
        // Task 9 — onboarding only ever gets in front of a signed-OUT
        // session; a live one (restored from the stored refresh token)
        // skips straight to the app, same as before onboarding existed.
        //
        // Wrapped in AnimatedSwitcher so a session flip (splash → onboarding
        // → auth → home) crossfades instead of hard-cutting — the four
        // screens read as one continuous flow rather than a stack of
        // independent pages.
        home: AnimatedSwitcher(
          duration: const Duration(milliseconds: 320),
          switchInCurve: Curves.easeOut,
          switchOutCurve: Curves.easeIn,
          child: switch (session) {
            SessionLoading() => const _Splash(key: ValueKey('splash')),
            SessionSignedOut() when !onboarded =>
              const OnboardingScreen(key: ValueKey('onboarding')),
            SessionSignedOut() => const AuthScreen(key: ValueKey('auth')),
            SessionSignedIn() => const _HomeShellWithStreak(key: ValueKey('home')),
          },
        ),
      ),
    );
  }
}

/// Shown only while [SessionLoading] — restoring a stored refresh token from
/// the keychain/keystore, typically well under a second. The bar is
/// indeterminate on purpose: it communicates "working" without promising a
/// duration this screen has no way to know, so it never has to fake or pad
/// out a delay to look "complete".
class _Splash extends StatelessWidget {
  const _Splash({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: AppColors.authBg,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.85, end: 1),
                duration: const Duration(milliseconds: 480),
                curve: Curves.easeOutBack,
                builder: (_, v, child) => Transform.scale(scale: v, child: child),
                child: Image.asset('assets/images/logo.png', width: 96, height: 96),
              ),
              const SizedBox(height: 44),
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: SizedBox(
                  width: 160,
                  height: 6,
                  child: LinearProgressIndicator(
                    backgroundColor: const Color(0xFF8B8B8B),
                    valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                ),
              ),
              const SizedBox(height: 44),
              Image.asset('assets/images/wordmark_white.png', height: 28),
            ],
          ),
        ),
      );
}

/// Bottom-nav shell. Each tab keeps its own Navigator so pushing a lesson
/// from Learn doesn't blow away Shop's scroll position, and the tab bar
/// stays put while a lesson is open only if it was pushed inside the tab —
/// lessons push on the root navigator instead, deliberately full-screen.
/// The signed-in app with the streak screen laid over it. A full overlay
/// rather than a route, so it can appear the moment the daily claim lands,
/// whatever tab the player happens to be on.
class _HomeShellWithStreak extends ConsumerWidget {
  const _HomeShellWithStreak({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final streak = ref.watch(streakEventProvider);
    return Stack(
      children: [
        const _HomeShell(),
        if (streak != null)
          StreakScreen(
            event: streak,
            onDismiss: () => ref.read(streakEventProvider.notifier).state = null,
          ),
      ],
    );
  }
}

class _HomeShell extends ConsumerStatefulWidget {
  // No key: the AnimatedSwitcher's ValueKey now lives on the wrapper above.
  const _HomeShell();

  @override
  ConsumerState<_HomeShell> createState() => _HomeShellState();
}

class _Destination {
  const _Destination(this.glyph, this.labelKey);

  /// A key of `kLucideSvg` — the same drawing the web's bottom bar uses.
  /// Material Rounded was here before and read as a different product beside
  /// it: filled and heavy against lucide's thin geometry.
  final String glyph;
  final String labelKey;
}

const _destinations = [
  _Destination('nav-learn', 'nav.learn'),
  _Destination('nav-league', 'nav.league'),
  _Destination('nav-shop', 'nav.shop'),
  _Destination('nav-profile', 'nav.profile'),
  _Destination('nav-settings', 'nav.settings'),
];

class _HomeShellState extends ConsumerState<_HomeShell>
    with WidgetsBindingObserver {
  static const _tabs = [
    LearnScreen(),
    LeagueScreen(),
    ShopScreen(),
    ProfileScreen(),
    SettingsScreen(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Back from the background, however long it was away — refresh the lot.
  /// This is the case that used to bite hardest: a phone left in a pocket
  /// came back showing an hour-old shop.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(refresherProvider).everything();
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;
    final index = ref.watch(homeTabIndexProvider);

    // Switching tabs refreshes what that tab draws — but only when it has
    // had time to go stale, so flicking back and forth costs nothing.
    ref.listen<int>(homeTabIndexProvider, (_, next) {
      if (next >= 0 && next < HomeTab.values.length) {
        ref.read(refresherProvider).tab(HomeTab.values[next]);
      }
    });

    return Scaffold(
      // IndexedStack rather than swapping children: tab state (scroll
      // offsets, in-flight requests) survives switching.
      body: IndexedStack(index: index, children: _tabs),
      // BottomNav.jsx: a translucent blurred bar with a hairline top border,
      // 22px icons that thicken to strokeWidth 2.5 when active, and 10px
      // labels. Material's NavigationBar can't do the blur or the pill-free
      // active state, so this is built directly.
      bottomNavigationBar: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Container(
            decoration: BoxDecoration(
              color: tokens.bright
                  ? const Color(0xF7FFFFFF)
                  : const Color(0xF20F172A),
              border: Border(
                top: BorderSide(
                  color: tokens.bright
                      ? const Color(0xFFE2E8F0)
                      : const Color(0x99334155),
                ),
              ),
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  for (var i = 0; i < _destinations.length; i++)
                    Expanded(
                      child: _NavTab(
                        glyph: _destinations[i].glyph,
                        label: s.t(_destinations[i].labelKey),
                        active: index == i,
                        bright: tokens.bright,
                        onTap: () => ref.read(homeTabIndexProvider.notifier).state = i,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}


class _NavTab extends StatelessWidget {
  const _NavTab({
    required this.glyph,
    required this.label,
    required this.active,
    required this.bright,
    required this.onTap,
  });

  final String glyph;
  final String label;
  final bool active, bright;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active
        ? AppColors.primary
        : (bright ? const Color(0xFF94A3B8) : const Color(0xFF64748B));

    return Semantics(
      button: true,
      selected: active,
      label: label,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // 2.4 rather than lucide's default 2: at 22px the web renders
              // its 24-box glyph slightly scaled down, and matching the
              // apparent weight matters more than matching the number.
              LucideIcon(glyph, size: 22, color: color, strokeWidth: active ? 2.4 : 2),
              const SizedBox(height: 2),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: 10, fontWeight: FontWeight.w500, color: color),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
