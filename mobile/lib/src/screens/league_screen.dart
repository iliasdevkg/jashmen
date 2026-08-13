/// League screen — built to the "Лига экраны" design.
///
/// Four stacked blocks, top to bottom:
///   1. Rank carousel — the user's current league, glowing, followed by the
///      locked ones. Hexagon badges, page dots.
///   2. Podium — top three, #1 raised and crowned.
///   3. Stats strip — participants / leader XP / your rank.
///   4. The rest of the leaderboard, from 4th place down.
///
/// The palette is the design's own (near-black #0a0e18 with #0d1220 cards),
/// not the app's shared tokens: this screen is deliberately its own
/// "arena" surface. It therefore renders the same in bright mode, which is
/// intentional — a light podium would lose the glow the design is built on.
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/i18n.dart';
import '../models/content.dart';
import '../models/user_state.dart';
import '../state/providers.dart';
import '../widgets/app_header.dart';
import '../widgets/states.dart';

// ── Design tokens ─────────────────────────────────────────────────────────
//
// Split in two on purpose:
//
//   _C  — brand and medal colours. A gold medal is gold on any background,
//         so these are the same in both themes.
//   _Pal — surfaces, lines and text, which have to flip.
//
// The light values are the app's own bright-mode palette (theme.dart), so
// this screen sits in the same world as the rest of the app rather than
// inventing a second light theme.
class _C {
  const _C._();
  static const blue = Color(0xFF3B82F6);
  static const gold = Color(0xFFEAB308);
  static const goldLight = Color(0xFFFDE047);
  static const goldDeep = Color(0xFF854D0E);
  static const silver = Color(0xFFE5E7EB);
  static const silverDeep = Color(0xFFB9BEC8);
  static const silverText = Color(0xFF6B7280);
  static const bronze = Color(0xFFD97B3F);
  static const bronzeDeep = Color(0xFFB45F2A);
  static const bronzeText = Color(0xFF5C2E0E);
  static const fire = Color(0xFFF97316);
}

class _Pal {
  const _Pal({
    required this.bright,
    required this.page,
    required this.bar,
    required this.card,
    required this.line,
    required this.lockBorder,
    required this.text,
    required this.muted,
    required this.faint,
    required this.rankChip,
    required this.dotOff,
    required this.lockTop,
    required this.lockBottom,
    required this.lockIcon,
    required this.chevronBg,
    required this.chevronFg,
    required this.glowOpacity,
  });

  final bool bright;
  final Color page, bar, card, line, lockBorder;
  final Color text, muted, faint;
  final Color rankChip, dotOff;
  final Color lockTop, lockBottom, lockIcon;
  final Color chevronBg, chevronFg;

  /// The pulsing halo is the design's signature, but a blue glow on a white
  /// page reads as blur rather than light — so it's dialled down rather than
  /// dropped, keeping the "this is your rank" cue in both themes.
  final double glowOpacity;

  static const dark = _Pal(
    bright: false,
    page: Color(0xFF0A0E18),
    bar: Color(0xFF070B13),
    card: Color(0xFF0D1220),
    line: Color(0xFF161D2C),
    lockBorder: Color(0xFF1B2334),
    text: Colors.white,
    muted: Color(0xFF8A93A6),
    faint: Color(0xFF6B7386),
    rankChip: Color(0xFF1A2132),
    dotOff: Color(0xFF2A3142),
    lockTop: Color(0xFF2A3142),
    lockBottom: Color(0xFF151A26),
    lockIcon: Color(0xFF4B5568),
    chevronBg: Color(0xD9141A28),
    chevronFg: Color(0xFFC8D0DE),
    glowOpacity: 1,
  );

  static const light = _Pal(
    bright: true,
    page: Color(0xFFF8FAFC),
    bar: Color(0xFFFFFFFF),
    card: Color(0xFFFFFFFF),
    line: Color(0xFFE2E8F0),
    lockBorder: Color(0xFFE2E8F0),
    text: Color(0xFF0F172A),
    muted: Color(0xFF64748B),
    faint: Color(0xFF94A3B8),
    rankChip: Color(0xFFF1F5F9),
    dotOff: Color(0xFFCBD5E1),
    lockTop: Color(0xFFE2E8F0),
    lockBottom: Color(0xFFCBD5E1),
    lockIcon: Color(0xFF94A3B8),
    chevronBg: Color(0xF2FFFFFF),
    chevronFg: Color(0xFF475569),
    glowOpacity: 0.45,
  );

  static _Pal of(WidgetRef ref) =>
      ref.watch(brightModeProvider) ? light : dark;
}

/// clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)
class _HexClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size s) => Path()
    ..moveTo(s.width * 0.50, 0)
    ..lineTo(s.width * 0.93, s.height * 0.25)
    ..lineTo(s.width * 0.93, s.height * 0.75)
    ..lineTo(s.width * 0.50, s.height)
    ..lineTo(s.width * 0.07, s.height * 0.75)
    ..lineTo(s.width * 0.07, s.height * 0.25)
    ..close();

  @override
  bool shouldReclip(_HexClipper oldClipper) => false;
}

Color _parseHex(String hex, {Color fallback = _C.blue}) {
  var v = hex.replaceFirst('#', '').trim();
  if (v.length == 6) v = 'FF$v';
  final n = int.tryParse(v, radix: 16);
  return n == null ? fallback : Color(n);
}

/// Deterministic avatar tint so a given player keeps the same colour across
/// rebuilds and screens. The design shows cyan / teal / orange / purple.
const _avatarPalette = [
  Color(0xFF06B6D4), Color(0xFF14B8A6), Color(0xFFF97316),
  Color(0xFFA855F7), Color(0xFF3B82F6), Color(0xFF22C55E),
  Color(0xFFEC4899), Color(0xFFF59E0B),
];
Color _avatarColor(String seed) =>
    _avatarPalette[seed.hashCode.abs() % _avatarPalette.length];

String _initial(String name) =>
    name.trim().isEmpty ? '?' : name.trim().characters.first.toUpperCase();

/// A league "tab" is a real filter — port of src/pages/LeaguePage.jsx's
/// `leagueBounds`/`viewLeaderboard`: each league owns the XP half-open
/// range [thisLeague.minXp, nextLeague.minXp). `leagues` must already be
/// sorted by minXp ascending.
class _LeagueBand {
  const _LeagueBand(this.min, this.max);
  final int min;
  final double max; // double so "no next league" can be +infinity
  bool contains(int xp) => xp >= min && xp < max;
}

Map<String, _LeagueBand> _leagueBounds(List<League> sortedLeagues) {
  final map = <String, _LeagueBand>{};
  for (var i = 0; i < sortedLeagues.length; i++) {
    final next = i + 1 < sortedLeagues.length ? sortedLeagues[i + 1] : null;
    map[sortedLeagues[i].id] =
        _LeagueBand(sortedLeagues[i].minXp, (next?.minXp ?? double.infinity).toDouble());
  }
  return map;
}

class LeagueScreen extends ConsumerStatefulWidget {
  const LeagueScreen({super.key});

  @override
  ConsumerState<LeagueScreen> createState() => _LeagueScreenState();
}

class _LeagueScreenState extends ConsumerState<LeagueScreen> {
  /// null until leagues load, at which point it defaults to the player's
  /// own current league — same as web's `useEffect(() => { if
  /// (!activeLeague && myLeague) setActiveLeague(myLeague) }, [myLeague])`.
  String? _activeLeagueId;

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final board = ref.watch(leaderboardProvider);
    final content = ref.watch(contentProvider);
    final session = ref.watch(authProvider);
    final me = session is SessionSignedIn ? session.user : null;
    final p = _Pal.of(ref);

    return Scaffold(
      backgroundColor: p.page,
      appBar: const AppHeader(),
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          backgroundColor: p.card,
          color: _C.blue,
          onRefresh: () async {
            ref.invalidate(leaderboardProvider);
            await ref.read(leaderboardProvider.future);
          },
          child: board.when(
            loading: () => const _LeagueSkeleton(),
            error: (err, _) => ListView(
              children: [
                SizedBox(
                  height: MediaQuery.sizeOf(context).height * 0.7,
                  child: ErrorView(
                    error: err,
                    onRetry: () => ref.invalidate(leaderboardProvider),
                  ),
                ),
              ],
            ),
            data: (rows) {
              final leagues = content.hasValue
                  ? ([...content.value!.leagues]..sort((a, b) => a.minXp.compareTo(b.minXp)))
                  : <League>[];
              final myXp = me?.state.xp ?? 0;

              // Highest league whose threshold the player has met — the
              // default selection, and what "browsing your own league"
              // means for the synthetic row below.
              String? currentLeagueId;
              for (final l in leagues) {
                if (myXp >= l.minXp) currentLeagueId = l.id;
              }
              currentLeagueId ??= leagues.isNotEmpty ? leagues.first.id : null;
              final activeLeagueId = _activeLeagueId ?? currentLeagueId;

              // Task 5 — each league tab genuinely filters the leaderboard
              // into that league's XP band, matching the web leaderboard
              // page 1:1, rather than showing one global list under a
              // purely decorative carousel.
              final bounds = _leagueBounds(leagues);
              final activeBand = activeLeagueId == null ? null : bounds[activeLeagueId];
              final viewRows = activeBand == null
                  ? rows
                  : rows.where((r) => activeBand.contains(r.xp)).toList(growable: false);

              final myIndex = viewRows.indexWhere((r) => r.id == me?.id);
              final iAmRanked = myIndex >= 0;
              // Only synthesize a "you" row while browsing your OWN league —
              // browsing a league you're not in shouldn't imply you have a
              // rank there.
              final showSyntheticMe = me != null &&
                  !iAmRanked &&
                  activeLeagueId != null &&
                  activeLeagueId == currentLeagueId;

              return CustomScrollView(
                slivers: [
                  if (leagues.isNotEmpty)
                    SliverToBoxAdapter(
                      child: _RankCarousel(
                        leagues: leagues,
                        myXp: myXp,
                        activeLeagueId: activeLeagueId,
                        onSelect: (id) => setState(() => _activeLeagueId = id),
                      ),
                    ),

                  if (viewRows.isEmpty && !showSyntheticMe)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: EmptyView(
                        icon: Icons.emoji_events_rounded,
                        title: s.t('league.empty'),
                      ),
                    )
                  else ...[
                    SliverToBoxAdapter(child: _Podium(rows: viewRows)),
                    SliverToBoxAdapter(
                      child: _StatsStrip(
                        participants: viewRows.length,
                        leaderXp: viewRows.isNotEmpty ? viewRows.first.xp : 0,
                        myRank: iAmRanked ? myIndex + 1 : null,
                      ),
                    ),
                    // Ranks 4+ — the podium already covers the top three.
                    SliverPadding(
                      padding: EdgeInsets.fromLTRB(12, 12, 12, showSyntheticMe ? 8 : 24),
                      sliver: SliverList.separated(
                        itemCount: viewRows.length > 3 ? viewRows.length - 3 : 0,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, i) => _LeaderRow(
                          rank: i + 4,
                          entry: viewRows[i + 3],
                          isMe: viewRows[i + 3].id == me?.id,
                        ),
                      ),
                    ),
                    if (showSyntheticMe)
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
                        sliver: SliverToBoxAdapter(
                          child: _LeaderRow(
                            rank: rows.length + 1,
                            entry: LeaderboardEntry(
                              id: me.id,
                              name: me.name,
                              xp: myXp,
                              avatar: me.avatar,
                              streak: me.state.streak,
                            ),
                            isMe: true,
                          ),
                        ),
                      ),
                  ],
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

// ── Rank carousel ─────────────────────────────────────────────────────────

class _RankCarousel extends ConsumerStatefulWidget {
  const _RankCarousel({
    required this.leagues,
    required this.myXp,
    required this.activeLeagueId,
    required this.onSelect,
  });
  final List<League> leagues;
  final int myXp;
  final String? activeLeagueId;
  final ValueChanged<String> onSelect;

  @override
  ConsumerState<_RankCarousel> createState() => _RankCarouselState();
}

class _RankCarouselState extends ConsumerState<_RankCarousel> {
  late final ScrollController _controller;

  int get _activeIndex {
    final i = widget.leagues.indexWhere((l) => l.id == widget.activeLeagueId);
    return i < 0 ? 0 : i;
  }

  @override
  void initState() {
    super.initState();
    _controller = ScrollController(initialScrollOffset: _activeIndex * 142.0);
  }

  @override
  void didUpdateWidget(covariant _RankCarousel old) {
    super.didUpdateWidget(old);
    // Keep the selected card scrolled into view — including when a tap on
    // a dot or another card moves the selection programmatically.
    if (old.activeLeagueId != widget.activeLeagueId && _controller.hasClients) {
      _controller.animateTo(
        (_activeIndex * 142.0).clamp(0, _controller.position.maxScrollExtent),
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _select(int i) {
    if (i < 0 || i >= widget.leagues.length) return;
    widget.onSelect(widget.leagues[i].id);
  }

  @override
  Widget build(BuildContext context) {
    final canScrollRight = _activeIndex < widget.leagues.length - 1;
    final p = _Pal.of(ref);

    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 8),
      child: Column(
        children: [
          SizedBox(
            height: 196,
            child: Stack(
              children: [
                ListView.separated(
                  controller: _controller,
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  itemCount: widget.leagues.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 12),
                  itemBuilder: (context, i) {
                    final league = widget.leagues[i];
                    return _RankCard(
                      league: league,
                      unlocked: widget.myXp >= league.minXp,
                      isCurrent: i == _activeIndex,
                      onTap: () => _select(i),
                    );
                  },
                ),
                if (canScrollRight)
                  Positioned(
                    right: 0,
                    top: 0,
                    bottom: 0,
                    child: Center(
                      child: GestureDetector(
                        onTap: () => _select(_activeIndex + 1),
                        child: Container(
                          width: 44,
                          height: 56,
                          decoration: BoxDecoration(
                            color: p.chevronBg,
                            borderRadius: const BorderRadius.horizontal(
                                left: Radius.circular(28)),
                          ),
                          child: Icon(Icons.chevron_right_rounded,
                              color: p.chevronFg),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < widget.leagues.length; i++) ...[
                if (i > 0) const SizedBox(width: 7),
                GestureDetector(
                  onTap: () => _select(i),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: i == _activeIndex ? 22 : 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: i == _activeIndex ? _C.blue : p.dotOff,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 4),
        ],
      ),
    );
  }
}

class _RankCard extends ConsumerWidget {
  const _RankCard({
    required this.league,
    required this.unlocked,
    required this.isCurrent,
    required this.onTap,
  });

  final League league;
  final bool unlocked;
  final bool isCurrent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = StringsScope.of(context);
    final p = _Pal.of(ref);
    final locale = ref.watch(localeProvider);
    final tint = _parseHex(league.color);

    final badge = ClipPath(
      clipper: _HexClipper(),
      child: Container(
        width: isCurrent ? 96 : 78,
        height: isCurrent ? 96 : 78,
        decoration: BoxDecoration(
          gradient: unlocked
              ? RadialGradient(
                  center: const Alignment(0, -0.3),
                  colors: [
                    Color.lerp(tint, Colors.white, 0.45)!,
                    Color.lerp(tint, Colors.black, 0.35)!,
                  ],
                  stops: const [0, 0.7],
                )
              : LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [p.lockTop, p.lockBottom],
                ),
        ),
        alignment: Alignment.center,
        child: !unlocked
            ? Icon(Icons.lock_rounded, size: 26, color: p.lockIcon)
            : league.iconUrl != null
                ? Padding(
                    padding: const EdgeInsets.all(22),
                    child: CachedNetworkImage(
                      imageUrl: league.iconUrl!,
                      fit: BoxFit.contain,
                      errorWidget: (_, __, ___) => const Icon(
                          Icons.school_rounded, size: 36, color: Colors.white),
                    ),
                  )
                : Icon(Icons.school_rounded,
                    size: isCurrent ? 40 : 30, color: Colors.white),
      ),
    );

    return GestureDetector(
      onTap: onTap,
      child: Container(
      width: isCurrent ? 148 : 130,
      padding: EdgeInsets.fromLTRB(isCurrent ? 10 : 8, 20, isCurrent ? 10 : 8, 18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isCurrent ? _C.blue : p.lockBorder,
          width: isCurrent ? 1.5 : 1,
        ),
        // The current card's deep-blue wash is what lifts it off the page;
        // on light it becomes a pale tint of the same hue rather than a
        // near-black block.
        gradient: isCurrent
            ? LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: p.bright
                    ? [const Color(0xFFEFF6FF), const Color(0xFFDBEAFE)]
                    : [const Color(0xFF0E1A33), const Color(0xFF0A1122)],
              )
            : null,
        color: isCurrent ? null : p.card,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          isCurrent ? _Glow(child: badge) : badge,
          const SizedBox(height: 10),
          Text(
            localizedContent(league.name, locale).toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: isCurrent ? 15 : 13,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
              color: isCurrent ? p.text : p.muted,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            s.t('league.xpNeeded', params: {'n': league.minXp}),
            style: TextStyle(
              fontSize: isCurrent ? 13 : 12,
              fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w600,
              color: isCurrent ? _C.blue : p.faint,
            ),
          ),
        ],
      ),
      ),
    );
  }
}

/// The design's `pulse-glow` keyframes: box-shadow 24px→40px rgba(59,130,246).
class _Glow extends ConsumerStatefulWidget {
  const _Glow({required this.child});
  final Widget child;

  @override
  ConsumerState<_Glow> createState() => _GlowState();
}

class _GlowState extends ConsumerState<_Glow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2500),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final animate = ref.watch(userStateProvider)?.settings.animations ?? true;
    final k = _Pal.of(ref).glowOpacity;

    if (!animate) {
      return DecoratedBox(
        decoration: BoxDecoration(boxShadow: [
          BoxShadow(color: _C.blue.withValues(alpha: 0.45 * k), blurRadius: 24),
        ]),
        child: widget.child,
      );
    }

    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final t = Curves.easeInOut.transform(_c.value);
        return DecoratedBox(
          decoration: BoxDecoration(boxShadow: [
            BoxShadow(
              color: _C.blue.withValues(alpha: (0.45 + 0.30 * t) * k),
              blurRadius: 24 + 16 * t,
            ),
          ]),
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

// ── Podium ────────────────────────────────────────────────────────────────

class _Podium extends ConsumerWidget {
  const _Podium({required this.rows});
  final List<LeaderboardEntry> rows;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    LeaderboardEntry? at(int i) => i < rows.length ? rows[i] : null;

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(flex: 100, child: _PodiumSlot(entry: at(1), place: 2)),
          const SizedBox(width: 10),
          Expanded(flex: 115, child: _PodiumSlot(entry: at(0), place: 1)),
          const SizedBox(width: 10),
          Expanded(flex: 100, child: _PodiumSlot(entry: at(2), place: 3)),
        ],
      ),
    );
  }
}

class _PodiumSlot extends ConsumerWidget {
  const _PodiumSlot({required this.entry, required this.place});
  final LeaderboardEntry? entry;
  final int place;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = _Pal.of(ref);
    // A league with fewer than three players leaves a slot empty; reserve the
    // block's height so the remaining podium keeps its stepped shape.
    final (blockH, blockTop, blockBottom, blockText) = switch (place) {
      1 => (104.0, _C.goldLight, _C.gold, _C.goldDeep),
      2 => (74.0, _C.silver, _C.silverDeep, _C.silverText),
      _ => (52.0, _C.bronze, _C.bronzeDeep, _C.bronzeText),
    };
    final ringColor = switch (place) {
      1 => _C.gold,
      2 => const Color(0xFF9AA3B2),
      _ => const Color(0xFFC2703A),
    };
    final xpColor = switch (place) {
      1 => _C.gold,
      2 => p.bright ? const Color(0xFF64748B) : const Color(0xFFC3C9D4),
      _ => const Color(0xFFF59E0B),
    };
    final avatarSize = place == 1 ? 72.0 : 58.0;

    if (entry == null) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [SizedBox(height: blockH)],
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (place == 1)
          const Icon(Icons.workspace_premium_rounded, size: 26, color: _C.gold),
        if (place == 1) const SizedBox(height: 6),
        _Avatar(
          entry: entry!,
          size: avatarSize,
          ring: ringColor,
          ringWidth: 3,
          glow: place == 1,
        ),
        const SizedBox(height: 6),
        Text(
          entry!.name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: place == 1 ? 15 : 14,
            fontWeight: place == 1 ? FontWeight.w700 : FontWeight.w600,
            color: p.text,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '${entry!.xp} XP',
          style: TextStyle(
            fontSize: place == 1 ? 14 : 13,
            fontWeight: place == 1 ? FontWeight.w800 : FontWeight.w700,
            color: xpColor,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          height: blockH,
          decoration: BoxDecoration(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [blockTop, blockBottom],
            ),
            // Silver against a near-white page would otherwise dissolve into
            // it; gold and bronze carry enough contrast on their own.
            border: p.bright && place == 2
                ? Border.all(color: const Color(0xFFCBD5E1))
                : null,
          ),
          alignment: Alignment.center,
          child: Text(
            '#$place',
            style: TextStyle(
              fontSize: place == 1 ? 30 : (place == 2 ? 26 : 24),
              fontWeight: FontWeight.w900,
              color: blockText,
            ),
          ),
        ),
      ],
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({
    required this.entry,
    required this.size,
    this.ring,
    this.ringWidth = 0,
    this.glow = false,
  });

  final LeaderboardEntry entry;
  final double size;
  final Color? ring;
  final double ringWidth;
  final bool glow;

  @override
  Widget build(BuildContext context) {
    final bg = _avatarColor(entry.id.isEmpty ? entry.name : entry.id);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: bg,
        shape: BoxShape.circle,
        border: ring == null ? null : Border.all(color: ring!, width: ringWidth),
        boxShadow: glow
            ? [BoxShadow(color: _C.gold.withValues(alpha: 0.4), blurRadius: 20)]
            : null,
      ),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      // ClipOval, not just the decoration clip: the explicit oval is what
      // guarantees the photo renders as a true circle inside the ring.
      child: entry.avatar != null
          ? ClipOval(
              child: CachedNetworkImage(
                imageUrl: entry.avatar!,
                fit: BoxFit.cover,
                width: size,
                height: size,
                errorWidget: (_, __, ___) => _initialText(size),
              ),
            )
          : _initialText(size),
    );
  }

  Widget _initialText(double size) => Text(
        _initial(entry.name),
        style: TextStyle(
          fontSize: size * 0.42,
          fontWeight: FontWeight.w800,
          color: Colors.white,
        ),
      );
}

// ── Stats strip ───────────────────────────────────────────────────────────

class _StatsStrip extends ConsumerWidget {
  const _StatsStrip({
    required this.participants,
    required this.leaderXp,
    required this.myRank,
  });

  final int participants;
  final int leaderXp;
  final int? myRank;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = StringsScope.of(context);
    final p = _Pal.of(ref);

    return Container(
      decoration: BoxDecoration(
        color: p.card,
        border: Border(
          top: BorderSide(color: p.line),
          bottom: BorderSide(color: p.line),
        ),
      ),
      child: IntrinsicHeight(
        child: Row(
          children: [
            Expanded(
              child: _Stat(
                icon: Icons.groups_rounded,
                tint: _C.blue,
                value: '$participants',
                label: s.t('league.participants'),
              ),
            ),
            VerticalDivider(width: 1, color: p.line),
            Expanded(
              child: _Stat(
                icon: Icons.emoji_events_rounded,
                tint: _C.gold,
                value: '$leaderXp',
                label: s.t('league.leaderXp'),
              ),
            ),
            VerticalDivider(width: 1, color: p.line),
            Expanded(
              child: _Stat(
                icon: Icons.my_location_rounded,
                tint: const Color(0xFF22C55E),
                // A player who isn't on the board yet gets an em dash rather
                // than a misleading "#0".
                value: myRank == null ? '—' : '#$myRank',
                label: s.t('league.yourPlace'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Stat extends ConsumerWidget {
  const _Stat({
    required this.icon,
    required this.tint,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final Color tint;
  final String value, label;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = _Pal.of(ref);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: tint),
          const SizedBox(height: 4),
          Text(value,
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w800, color: p.text)),
          const SizedBox(height: 4),
          Text(label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 13, color: p.muted)),
        ],
      ),
    );
  }
}

// ── Leaderboard row ───────────────────────────────────────────────────────

class _LeaderRow extends ConsumerWidget {
  const _LeaderRow({required this.rank, required this.entry, this.isMe = false});

  final int rank;
  final LeaderboardEntry entry;
  final bool isMe;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = StringsScope.of(context);
    final p = _Pal.of(ref);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: p.card,
        borderRadius: BorderRadius.circular(14),
        // The signed-in player's own row is picked out, which the static
        // mockup had no way to show.
        border: Border.all(color: isMe ? _C.blue : p.line),
      ),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(color: p.rankChip, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Text('$rank',
                style: TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w700, color: p.muted)),
          ),
          const SizedBox(width: 12),
          _Avatar(entry: entry, size: 44),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  entry.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w700, color: p.text),
                ),
                if (entry.streak > 0) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const Icon(Icons.local_fire_department_rounded,
                          size: 13, color: _C.fire),
                      const SizedBox(width: 3),
                      Text(
                        s.t('league.days', params: {'n': entry.streak}),
                        style: TextStyle(fontSize: 13, color: p.muted),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '${entry.xp}',
                  style: TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w900, color: p.text),
                ),
                TextSpan(
                  text: ' XP',
                  style: TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w600, color: p.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Loading ───────────────────────────────────────────────────────────────

class _LeagueSkeleton extends StatelessWidget {
  const _LeagueSkeleton();

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(14),
        children: [
          Row(
            children: [
              for (var i = 0; i < 3; i++) ...[
                if (i > 0) const SizedBox(width: 12),
                SkeletonBox(width: i == 0 ? 148 : 130, height: 176, radius: 18),
              ],
            ],
          ),
          const SizedBox(height: 32),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: const [
              Expanded(child: SkeletonBox(height: 150, radius: 12)),
              SizedBox(width: 10),
              Expanded(child: SkeletonBox(height: 190, radius: 12)),
              SizedBox(width: 10),
              Expanded(child: SkeletonBox(height: 130, radius: 12)),
            ],
          ),
          const SizedBox(height: 24),
          for (var i = 0; i < 4; i++) ...[
            const SkeletonBox(height: 66, radius: 14),
            const SizedBox(height: 8),
          ],
        ],
      );
}
