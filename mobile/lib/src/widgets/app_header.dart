/// The app-wide header, lifted out of the league screen so every tab wears
/// the same chrome — which is how the web works too: TopBar.jsx is rendered
/// once in App.jsx for all pages, and page titles live inside the content
/// as headings rather than in the bar.
///
/// Brand mark on the left, live counters on the right: streak, coins and
/// energy. Values come from the session, so the header updates itself after
/// a lesson without the screen having to pass anything in.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/logic.dart';
import '../core/theme.dart';
import '../state/providers.dart';

/// Accent colours for the counter chips. Fixed in both themes — a flame is
/// orange on any background — while the chip's fill and border are derived
/// from the accent so they read correctly on a dark bar and a white one.
class _Accent {
  const _Accent._();
  static const crown = Color(0xFFEAB308);
  static const fire = Color(0xFFF97316);
  static const coin = Color(0xFFD4A72C);
  static const energy = Color(0xFF38BDF8);
}

class AppHeader extends ConsumerWidget implements PreferredSizeWidget {
  const AppHeader({super.key});

  static const double height = 56; // web: h-14

  @override
  Size get preferredSize => const Size.fromHeight(height);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final content = ref.watch(contentProvider);
    final st = ref.watch(userStateProvider);

    final energy = computeLiveEnergy(
      st,
      dailyFreeLessons: content.valueOrNull?.limits.dailyFreeLessons ?? 3,
    );

    // Scaffold reserves `preferredSize.height + status-bar inset` for an
    // appBar and hands the widget that whole box. A fixed-height child would
    // sit at the top of it, i.e. underneath the clock and battery — so the
    // decoration fills the box and SafeArea pushes the row clear of the
    // status bar, leaving the bar's colour behind it the way a real AppBar
    // does.
    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.nav,
        border: Border(bottom: BorderSide(color: tokens.border)),
      ),
      child: SafeArea(
        bottom: false,
        child: Container(
          height: height,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Row(
            children: [
              ClipOval(
                child: Image.asset(
                  'assets/images/logo.png',
                  width: 32,
                  height: 32,
                  fit: BoxFit.cover,
                  excludeFromSemantics: true,
                ),
              ),
              const SizedBox(width: 8),
              Image.asset(
                tokens.bright
                    ? 'assets/images/wordmark_blue.png'
                    : 'assets/images/wordmark_white.png',
                height: 16,
                fit: BoxFit.contain,
                semanticLabel: 'JashMen',
              ),
              const SizedBox(width: 8),

              // Right-aligned, and scrollable only as a safety valve: a four
              // digit coin balance on a narrow phone should push the chips
              // rather than overflow the row.
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  reverse: true,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      const HeaderChip(
                        icon: Icons.workspace_premium_rounded,
                        tint: _Accent.crown,
                      ),
                      const SizedBox(width: 7),
                      HeaderChip(
                        icon: Icons.local_fire_department_rounded,
                        tint: _Accent.fire,
                        value: '${st?.streak ?? 0}',
                      ),
                      const SizedBox(width: 7),
                      HeaderChip(
                        icon: Icons.monetization_on_rounded,
                        tint: _Accent.coin,
                        value: '${st?.coins ?? 0}',
                      ),
                      const SizedBox(width: 7),
                      HeaderChip(
                        icon: Icons.bolt_rounded,
                        tint: _Accent.energy,
                        value: '${energy.remaining}',
                        // The web shows a countdown under the bolt once energy
                        // runs out; same here, so "0" is never a dead end.
                        caption: energy.remaining <= 0
                            ? formatCountdown(energy.resetMs)
                            : null,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class HeaderChip extends StatelessWidget {
  const HeaderChip({
    super.key,
    required this.icon,
    required this.tint,
    this.value,
    this.caption,
  });

  final IconData icon;
  final Color tint;
  final String? value;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    // Derived rather than hand-picked per chip, so the same call site works
    // on the dark bar and the white one.
    final bg = Color.alphaBlend(
      tint.withValues(alpha: 0.10),
      tokens.bright ? tokens.nav : const Color(0xFF0A0A0A),
    );
    final border = tokens.bright
        ? tint.withValues(alpha: 0.35)
        : Color.alphaBlend(tint.withValues(alpha: 0.55), Colors.black);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: value == null ? 10 : 12,
        vertical: 5,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: tint),
          if (value != null) ...[
            const SizedBox(width: 5),
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value!,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    height: 1.1,
                    color: tokens.text,
                  ),
                ),
                if (caption != null)
                  Text(
                    caption!,
                    style: TextStyle(fontSize: 8, height: 1.1, color: tint),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// The in-content page title the web uses (`<h2 class="font-extrabold
/// text-xl">`), now that the bar carries the brand instead of a title.
class PageTitle extends StatelessWidget {
  const PageTitle(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
    child: Text(
      text,
      style: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w800,
        color: context.tokens.text,
      ),
    ),
  );
}
