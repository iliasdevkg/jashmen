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

class _Destination {
  const _Destination(this.icon, this.labelKey);
  final IconData icon;
  final String labelKey;
}

const _destinations = [
  _Destination(Icons.home_rounded, 'nav.learn'),
  _Destination(Icons.emoji_events_rounded, 'nav.league'),
  _Destination(Icons.shopping_bag_rounded, 'nav.shop'),
  _Destination(Icons.person_rounded, 'nav.profile'),
  _Destination(Icons.settings_rounded, 'nav.settings'),
];

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
                        icon: _destinations[i].icon,
                        label: s.t(_destinations[i].labelKey),
                        active: _index == i,
                        bright: tokens.bright,
                        onTap: () => setState(() => _index = i),
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
    required this.icon,
    required this.label,
    required this.active,
    required this.bright,
    required this.onTap,
  });

  final IconData icon;
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
              Icon(icon, size: 22, color: color),
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
