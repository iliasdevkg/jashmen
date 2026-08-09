/// App root: theme, locale scope, and routing.
///
/// The web app is a sidebar on desktop and a bottom bar on mobile; this is
/// mobile-only, so it's a bottom bar with the same five destinations, plus
/// the lesson player pushed on top as a full-screen route.
library;

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/i18n.dart';
import 'core/theme.dart';
import 'screens/auth_screen.dart';
import 'screens/learn_screen.dart';
import 'screens/league_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/shop_screen.dart';
import 'state/providers.dart';

class JashMenApp extends ConsumerWidget {
  const JashMenApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bright = ref.watch(brightModeProvider);
    final strings = ref.watch(stringsProvider);
    final session = ref.watch(authProvider);

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
        // there are only three top-level cases and this keeps them obvious.
        home: switch (session) {
          SessionLoading() => const _Splash(),
          SessionSignedOut() => const AuthScreen(),
          SessionSignedIn() => const _HomeShell(),
        },
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: Image.asset('assets/images/logo.png', width: 88, height: 88),
        ),
      );
}

/// Bottom-nav shell. Each tab keeps its own Navigator so pushing a lesson
/// from Learn doesn't blow away Shop's scroll position, and the tab bar
/// stays put while a lesson is open only if it was pushed inside the tab —
/// lessons push on the root navigator instead, deliberately full-screen.
class _HomeShell extends ConsumerStatefulWidget {
  const _HomeShell();

  @override
  ConsumerState<_HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<_HomeShell> {
  int _index = 0;

  static const _tabs = [
    LearnScreen(),
    LeagueScreen(),
    ShopScreen(),
    ProfileScreen(),
    SettingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;

    return Scaffold(
      // IndexedStack rather than swapping children: tab state (scroll
      // offsets, in-flight requests) survives switching.
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: tokens.nav,
          border: Border(top: BorderSide(color: tokens.border)),
        ),
        child: SafeArea(
          top: false,
          child: NavigationBarTheme(
            data: NavigationBarThemeData(
              backgroundColor: Colors.transparent,
              indicatorColor: AppColors.primary.withValues(alpha: 0.14),
              labelTextStyle: WidgetStateProperty.resolveWith(
                (states) => TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: states.contains(WidgetState.selected)
                      ? AppColors.primary
                      : tokens.muted,
                ),
              ),
              iconTheme: WidgetStateProperty.resolveWith(
                (states) => IconThemeData(
                  size: 24,
                  color: states.contains(WidgetState.selected)
                      ? AppColors.primary
                      : tokens.muted,
                ),
              ),
            ),
            child: NavigationBar(
              selectedIndex: _index,
              onDestinationSelected: (i) => setState(() => _index = i),
              height: 64,
              labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
              destinations: [
                NavigationDestination(
                  icon: const Icon(Icons.home_rounded),
                  label: s.t('nav.learn'),
                ),
                NavigationDestination(
                  icon: const Icon(Icons.emoji_events_rounded),
                  label: s.t('nav.league'),
                ),
                NavigationDestination(
                  icon: const Icon(Icons.shopping_bag_rounded),
                  label: s.t('nav.shop'),
                ),
                NavigationDestination(
                  icon: const Icon(Icons.person_rounded),
                  label: s.t('nav.profile'),
                ),
                NavigationDestination(
                  icon: const Icon(Icons.settings_rounded),
                  label: s.t('nav.settings'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

