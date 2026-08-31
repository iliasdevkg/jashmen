/// League screen — built to the "Лига экраны" design.
///
/// Two tabs sit at the top:
///
/// **General league** — every player, four stacked blocks:
///   1. Rank carousel — the user's current league, glowing, followed by the
///      locked ones. Hexagon badges, page dots.
///   2. Podium — top three, #1 raised and crowned.
///   3. Stats strip — participants / leader XP / your rank.
///   4. The rest of the leaderboard, from 4th place down.
///
/// **University league** — campus against campus. Entering it asks two
/// questions once (are you a student or a viewer, and which university),
/// then shows that university's contest card and its top ten students.
/// Until both are answered the general league stays on screen behind the
/// dialogs, which is what the design shows.
///
/// The palette is the design's own (near-black #0a0e18 with #0d1220 cards),
/// not the app's shared tokens: this screen is deliberately its own
/// "arena" surface. It therefore renders the same in bright mode, which is
/// intentional — a light podium would lose the glow the design is built on.
library;

import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_client.dart';
import '../core/haptics.dart';
import '../core/logic.dart';
import '../core/i18n.dart';
import '../core/lesson_icons.dart';
import '../core/theme.dart';
import '../models/content.dart';
import '../models/university.dart';
import '../models/user_state.dart';
import '../state/providers.dart';
import '../widgets/medal_wreath.dart';
import '../widgets/app_header.dart';
import '../widgets/press_scale.dart';
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

  /// Viewer support — the purple that runs through the role card, the
  /// backer counts and the gift button.
  static const supportTint = Color(0xFFA855F7);
  static const supportDeep = Color(0xFF6D28D9);
  static const energy = Color(0xFF38BDF8);

  /// The rules card — the profile's "lessons" green, so the four contest
  /// cards read as the same family as the four profile stats.
  static const rules = Color(0xFF58CC02);
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
    required this.tabTop,
    required this.tabBottom,
    required this.uniCardTop,
    required this.uniCardBottom,
    required this.uniCardBorder,
    required this.tile,
    required this.tileBorder,
    required this.scrim,
    required this.glowOpacity,
  });

  final bool bright;
  final Color page, bar, card, line, lockBorder;
  final Color text, muted, faint;
  final Color rankChip, dotOff;
  final Color lockTop, lockBottom, lockIcon;
  final Color chevronBg, chevronFg;

  /// Selected tab pill — the same deep-blue wash as the current rank card,
  /// so "this is where you are" reads identically in both places.
  final Color tabTop, tabBottom;

  /// The university contest card and the boxes inside it. The card is a
  /// tinted panel; the boxes sit one step back from it so the numbers, not
  /// their containers, are what carry.
  final Color uniCardTop, uniCardBottom, uniCardBorder;
  final Color tile, tileBorder;

  /// Behind the role/university dialogs.
  final Color scrim;

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
    tabTop: Color(0xFF14294A),
    tabBottom: Color(0xFF0D1A31),
    uniCardTop: Color(0xFF0E1B33),
    uniCardBottom: Color(0xFF0A1223),
    uniCardBorder: Color(0xFF1D3358),
    tile: Color(0xFF0C1526),
    tileBorder: Color(0xFF1B2A45),
    scrim: Color(0xB3050810),
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
    tabTop: Color(0xFFEFF6FF),
    tabBottom: Color(0xFFDBEAFE),
    uniCardTop: Color(0xFFF5F9FF),
    uniCardBottom: Color(0xFFEAF2FE),
    uniCardBorder: Color(0xFFBFDBFE),
    tile: Color(0xFFFFFFFF),
    tileBorder: Color(0xFFDBEAFE),
    scrim: Color(0x99334155),
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

  /// Which tab's chrome is lit. The content can still be the general league
  /// while this says [_LeagueTab.uni] — that is exactly the state the design
  /// shows behind the role and university dialogs.
  _LeagueTab _tab = _LeagueTab.general;

  /// Guards the dialog chain: a second tap while it is open would stack a
  /// duplicate flow on top of itself.
  bool _asking = false;

  /// True while the enrolment PUT is in flight — the tab shows a spinner
  /// rather than flashing the general league on its way to the campus.
  bool _enrolling = false;

  void _selectTab(_LeagueTab tab) {
    if (tab == _tab) return;
    Haptics.tap();
    setState(() => _tab = tab);
    if (tab == _LeagueTab.uni) _enrol();
  }

  /// Asks the two questions the university league needs, in order, and falls
  /// back to the general league if either is dismissed — landing on an empty
  /// university tab would be a dead end.
  Future<void> _enrol() async {
    if (_asking) return;
    _asking = true;
    try {
      final enrolment = ref.read(uniLeagueProvider);

      var role = enrolment.role;
      if (role == null) {
        role = await showUniRoleDialog(context);
        if (!mounted) return;
        if (role == null) {
          setState(() => _tab = _LeagueTab.general);
          return;
        }
      }

      // Resolved, not just non-null: a university saved on the account can
      // disappear from the list upstream, and that has to re-ask rather
      // than leave the tab pointing at nothing.
      var id = enrolment.universityId;
      final catalogue = ref.read(universitiesProvider);
      if (_findUniversity(catalogue, id) == null || role != enrolment.role) {
        id = await showUniversityPicker(context, role: role);
        if (!mounted) return;
        if (id == null) {
          setState(() => _tab = _LeagueTab.general);
          return;
        }
      }

      await _commitEnrolment(role, id!);
    } finally {
      _asking = false;
    }
  }

  /// Enrolment is a server write now, so it can fail. A failure drops back
  /// to the general league with a message rather than silently leaving the
  /// tab on a campus the account was never actually joined to.
  Future<void> _commitEnrolment(UniLeagueRole role, String universityId) async {
    final s = StringsScope.of(context);
    setState(() => _enrolling = true);
    try {
      await ref
          .read(authProvider.notifier)
          .setUniversity(role: role, universityId: universityId);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _tab = _LeagueTab.general);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(switch (e.kind) {
          ApiErrorKind.offline => s.t('common.offline'),
          ApiErrorKind.timeout || ApiErrorKind.server => s.t('common.serverError'),
          _ => e.message,
        }),
      ));
    } finally {
      if (mounted) setState(() => _enrolling = false);
    }
  }

  /// "Өзгөртүү / Изменить / Change". Nothing is written until both answers
  /// come back, so backing out of either dialog leaves the screen exactly as
  /// it was instead of clearing it.
  Future<void> _changeEnrolment() async {
    if (_asking) return;
    _asking = true;
    try {
      final current = ref.read(uniLeagueProvider);
      final role = await showUniRoleDialog(context, current: current.role);
      if (!mounted || role == null) return;

      final id = await showUniversityPicker(
        context,
        role: role,
        current: role == current.role ? current.universityId : null,
      );
      if (!mounted || id == null) return;

      await _commitEnrolment(role, id);
    } finally {
      _asking = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final p = _Pal.of(ref);
    final enrolment = ref.watch(uniLeagueProvider);

    final university = _tab == _LeagueTab.uni
        ? _findUniversity(ref.watch(universitiesProvider), enrolment.universityId)
        : null;
    final showUni = university != null && enrolment.role != null;

    return Scaffold(
      backgroundColor: p.page,
      appBar: const AppHeader(),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _LeagueTabs(tab: _tab, onSelect: _selectTab),
            if (!showUni)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
                child: Text(
                  s.t('league.generalSubtitle'),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: p.muted,
                  ),
                ),
              ),
            Expanded(
              child: _tab == _LeagueTab.uni && _enrolling
                  ? const Center(child: CircularProgressIndicator())
                  : showUni
                      ? UniLeagueView(
                          university: university,
                          onChange: _changeEnrolment,
                        )
                      : _buildGeneralLeague(context),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGeneralLeague(BuildContext context) {
    final s = StringsScope.of(context);
    final board = ref.watch(leaderboardProvider);
    final content = ref.watch(contentProvider);
    final session = ref.watch(authProvider);
    final me = session is SessionSignedIn ? session.user : null;
    final p = _Pal.of(ref);

    return RefreshIndicator(
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
    );
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────────

enum _LeagueTab { general, uni }

class _LeagueTabs extends ConsumerWidget {
  const _LeagueTabs({required this.tab, required this.onSelect});

  final _LeagueTab tab;
  final ValueChanged<_LeagueTab> onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = StringsScope.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
      child: Row(
        children: [
          Expanded(
            child: _TabPill(
              label: s.t('league.tabGeneral'),
              selected: tab == _LeagueTab.general,
              onTap: () => onSelect(_LeagueTab.general),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _TabPill(
              label: s.t('league.tabUni'),
              selected: tab == _LeagueTab.uni,
              onTap: () => onSelect(_LeagueTab.uni),
            ),
          ),
        ],
      ),
    );
  }
}

class _TabPill extends ConsumerWidget {
  const _TabPill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = _Pal.of(ref);

    return PressScale(
      onTap: onTap,
      scale: 0.97,
      child: Semantics(
        button: true,
        selected: selected,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          height: 48,
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? _C.blue : p.lockBorder,
              width: selected ? 1.5 : 1,
            ),
            gradient: selected
                ? LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [p.tabTop, p.tabBottom],
                  )
                : null,
            color: selected ? null : p.card,
          ),
          // Scaled down, not clipped: "УНИВЕРСИТЕТ ЛИГАСЫ" is a fixed label
          // the design shows in full, and on a 402pt phone it was landing as
          // "УНИВЕРСИТЕТ ЛИГ…".
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              label,
              maxLines: 1,
              softWrap: false,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.4,
                color: selected ? p.text : p.muted,
              ),
            ),
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
            // An icon picked from the built-in set outranks an upload — the
            // same order the server stores the two fields in.
            : lessonIconFor(league.icon) != null
                ? Icon(lessonIconFor(league.icon),
                    size: isCurrent ? 40 : 30, color: Colors.white)
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
        MedalWreath(place: place, size: place == 1 ? 50 : 38),
        const SizedBox(height: 4),
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
          // Flexed, not fixed: 148+130+130 plus the gaps needs 432pt and a
          // phone gives 374, so the fixed version overflowed the moment the
          // league opened on a loading board.
          Row(
            children: [
              for (var i = 0; i < 3; i++) ...[
                if (i > 0) const SizedBox(width: 12),
                Expanded(
                  flex: i == 0 ? 148 : 130,
                  child: const SkeletonBox(height: 176, radius: 18),
                ),
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

// ── University league ─────────────────────────────────────────────────────

/// The contest card plus that university's top ten, under a "change my
/// university" affordance. Scrolls as one column: the card is tall enough
/// on small phones that pinning anything would eat the standings.
///
/// Public so it can be rendered on its own in a widget test — it is the
/// densest layout in the app, and the one most likely to overflow when a
/// translation grows.
class UniLeagueView extends ConsumerWidget {
  const UniLeagueView({super.key, required this.university, required this.onChange});

  final University university;
  final VoidCallback onChange;

  /// Who a tap on the board belongs to. A viewer taps anyone — that is the
  /// gift. A student taps only their own row, which is how they open "who
  /// backed me".
  void _pick(BuildContext context, WidgetRef ref, UniBoardEntry entry, {required bool isViewer, required String? myId}) {
    if (isViewer) {
      showUniSupportSheet(context, entry);
      return;
    }
    if (entry.id == myId) showUniSupportersDialog(context);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = StringsScope.of(context);
    final locale = ref.watch(localeProvider);
    final p = _Pal.of(ref);
    final contest = university.competition;

    final myId = ref.watch(currentUserProvider)?.id;
    final isViewer = ref.watch(uniLeagueProvider).role == UniLeagueRole.viewer;
    final boardAsync = ref.watch(uniBoardProvider(university.id));
    final board = boardAsync.valueOrNull;
    final students = board?.students ?? const <UniBoardEntry>[];
    final canPick = isViewer || students.any((e) => e.id == myId);

    void onPick(UniBoardEntry entry) =>
        _pick(context, ref, entry, isViewer: isViewer, myId: myId);

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(uniBoardProvider(university.id)),
      child: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 16, 8),
            child: Align(
              alignment: Alignment.centerRight,
              child: PressScale(
                onTap: onChange,
                scale: 0.94,
                child: Semantics(
                  button: true,
                  child: Padding(
                    // Enlarges the target to a comfortable 44pt without
                    // moving the label off the card's right edge.
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          s.t('uni.change'),
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: p.muted,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Icon(Icons.edit_rounded, size: 15, color: p.muted),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (contest == null)
            _NoContest(university: university, onChange: onChange)
          else ...[
            _UniContestCard(
              university: university,
              contest: contest,
              totalXp: board?.totalXp,
              studentCount: board?.studentCount,
              viewerCount: board?.viewerCount,
            ),
            const SizedBox(height: 22),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      university.topStudentsTitle(s, locale),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.4,
                        color: p.text,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  // Eye + how many people follow this campus rather than
                  // compete on it. Viewers are counted here and nowhere
                  // else — they are never ranked below.
                  Semantics(
                    label: s.t('uni.viewersAria',
                        params: {'n': '${board?.viewerCount ?? 0}'}),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          formatGrouped(board?.viewerCount ?? 0),
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: p.muted,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Icon(Icons.visibility_rounded, size: 17, color: p.muted),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (isViewer)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Text(
                  '${s.t('uni.viewerXpNote')} ${s.t('uni.viewerHint')}',
                  style: TextStyle(fontSize: 11, height: 1.35, color: p.muted),
                ),
              ),
            boardAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (err, _) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: ErrorView(
                  error: err,
                  onRetry: () => ref.invalidate(uniBoardProvider(university.id)),
                ),
              ),
              data: (data) => data.students.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.symmetric(vertical: 32),
                      child: EmptyView(
                        icon: Icons.groups_rounded,
                        title: s.t('uni.emptyBoard'),
                      ),
                    )
                  : Column(
                      children: [
                        _UniPodium(
                          students: data.students,
                          onPick: canPick ? onPick : null,
                        ),
                        const SizedBox(height: 16),
                        if (data.students.length > 3)
                          _UniStandings(
                            students: data.students.sublist(3),
                            meId: myId,
                            onPick: canPick ? onPick : null,
                          ),
                        // A student outside the top ten still has supporters
                        // to look at, so the sheet gets its own entry point
                        // rather than living only behind their row.
                        if (!isViewer && data.me.supporters > 0) ...[
                          const SizedBox(height: 14),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            child: PressScale(
                              onTap: () => showUniSupportersDialog(context),
                              child: Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(vertical: 13),
                                decoration: BoxDecoration(
                                  color: _C.supportTint.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                      color: _C.supportTint.withValues(alpha: 0.4)),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(Icons.favorite_rounded,
                                        size: 15, color: _C.supportTint),
                                    const SizedBox(width: 8),
                                    Text(
                                      '${s.t('uni.supportersCta')} · '
                                      '${s.t('uni.supportersCount', params: {'n': '${data.me.supporters}'})}',
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: _C.supportTint,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
            ),
          ],
        ],
      ),
    );
  }
}

/// A university that hasn't launched a contest. Deliberately not a blank
/// panel: it says why the space is empty and offers the one action that can
/// change what's on screen.
class _NoContest extends ConsumerWidget {
  const _NoContest({required this.university, required this.onChange});

  final University university;
  final VoidCallback onChange;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = StringsScope.of(context);
    final locale = ref.watch(localeProvider);
    final p = _Pal.of(ref);

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 0),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: p.uniCardBorder),
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [p.uniCardTop, p.uniCardBottom],
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _UniCrest(university: university, size: 56),
            const SizedBox(height: 14),
            Text(
              localizedContent(university.name, locale),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: p.text,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              s.t('uni.noContestTitle'),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: p.text,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              s.t('uni.noContestDesc'),
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, height: 1.4, color: p.muted),
            ),
            const SizedBox(height: 20),
            PressScale(
              onTap: onChange,
              child: Container(
                height: 46,
                padding: const EdgeInsets.symmetric(horizontal: 22),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: _C.blue,
                  borderRadius: BorderRadius.circular(23),
                ),
                child: Text(
                  s.t('uni.chooseAnother'),
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The contest card: who runs it, what's at stake, how much has been earned
/// so far, and the window it runs in.
class _UniContestCard extends ConsumerWidget {
  const _UniContestCard({
    required this.university,
    required this.contest,
    this.totalXp,
    this.studentCount,
    this.viewerCount,
  });

  final University university;
  final UniversityCompetition contest;

  /// The campus's live totals from the board, once it has loaded. Null
  /// while it is still in flight, which the cards show as a dash rather
  /// than as a zero that would read as real.
  final int? totalXp;
  final int? studentCount;
  final int? viewerCount;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = StringsScope.of(context);
    final locale = ref.watch(localeProvider);
    final p = _Pal.of(ref);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: p.uniCardBorder),
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [p.uniCardTop, p.uniCardBottom],
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _UniCrest(university: university, size: 44),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        localizedContent(university.name, locale),
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          height: 1.25,
                          color: p.text,
                        ),
                      ),
                      const SizedBox(height: 5),
                      _ContestMeta(
                        label: s.t('uni.organizer'),
                        value: contest.organizerPhone,
                        onTap: () => _dial(contest.organizerPhone),
                      ),
                      const SizedBox(height: 2),
                      _ContestMeta(
                        label: s.t('uni.address'),
                        value: localizedContent(contest.address, locale),
                      ),
                    ],
                  ),
                ),
                if (contest.sponsorName != null) ...[
                  const SizedBox(width: 8),
                  _SponsorMark(
                    name: contest.sponsorName!,
                    logoUrl: contest.sponsorLogoUrl,
                  ),
                ],
              ],
            ),
            const SizedBox(height: 14),

            // The four contest facts, in the very card the profile uses for
            // XP / streak / coins / lessons — same tint-on-tint fill, same
            // 2x2 grid, same colours. Each is a button: the card carries one
            // headline number and everything behind it opens in a panel, the
            // way the role and campus pickers already work.
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              // 1.7, not the profile's 1.9: these cards carry a two-line
              // label ("Шарттар жана мөөнөт") where the profile's carry one
              // word, and at 320dp the taller content overflowed the shorter
              // box by a hair.
              childAspectRatio: 1.7,
              padding: EdgeInsets.zero,
              children: [
                _ContestStatCard(
                  icon: Icons.emoji_events_rounded,
                  color: _C.gold,
                  value: formatSom(contest.prizePool, locale),
                  label: s.t('uni.prizePool'),
                  onTap: () => _showUniDialog<void>(
                    context,
                    panel: _ContestFactPanel(
                      icon: Icons.emoji_events_rounded,
                      color: _C.gold,
                      title: s.t('uni.prizePool'),
                      headline: formatSom(contest.prizePool, locale),
                      rows: [
                        (s.t('uni.organizer'), contest.organizerPhone),
                        (s.t('uni.address'), localizedContent(contest.address, locale)),
                        if (contest.sponsorName != null)
                          (s.t('uni.sponsor'), contest.sponsorName!),
                      ],
                    ),
                  ),
                ),
                _ContestStatCard(
                  icon: Icons.bolt_rounded,
                  color: _C.blue,
                  value: totalXp == null ? '\u2014' : formatGrouped(totalXp!),
                  label: s.t('uni.totalCollected'),
                  onTap: () => _showUniDialog<void>(
                    context,
                    panel: _ContestFactPanel(
                      icon: Icons.bolt_rounded,
                      color: _C.blue,
                      title: s.t('uni.totalCollected'),
                      headline: totalXp == null
                          ? '\u2014'
                          : '${formatGrouped(totalXp!)} XP',
                      rows: [
                        (s.t('uni.studentsCount'), '${studentCount ?? 0}'),
                        (s.t('uni.viewersCount'), '${viewerCount ?? 0}'),
                      ],
                      note: s.t('uni.totalCollectedNote'),
                    ),
                  ),
                ),
                _ContestStatCard(
                  icon: Icons.card_giftcard_rounded,
                  color: _C.fire,
                  value: s.t('uni.giftsTop', params: {'n': contest.giftsTopN}),
                  label: s.t('uni.prizes'),
                  onTap: () => _showUniDialog<void>(
                    context,
                    panel: _ContestFactPanel(
                      icon: Icons.card_giftcard_rounded,
                      color: _C.fire,
                      title: s.t('uni.prizes'),
                      rows: [
                        (s.t('uni.place1'), formatSom(contest.firstPrize, locale)),
                        (s.t('uni.place2'), formatSom(contest.secondPrize, locale)),
                        (s.t('uni.place3'), formatSom(contest.thirdPrize, locale)),
                        (
                          s.t('uni.gifts'),
                          s.t('uni.giftsTop', params: {'n': contest.giftsTopN})
                        ),
                      ],
                    ),
                  ),
                ),
                _ContestStatCard(
                  icon: Icons.menu_book_rounded,
                  color: _C.rules,
                  value: s.t('uni.rulesValue'),
                  label: s.t('uni.rulesLabel'),
                  onTap: () => _showUniDialog<void>(
                    context,
                    panel: _ContestFactPanel(
                      icon: Icons.menu_book_rounded,
                      color: _C.rules,
                      title: s.t('uni.rulesValue'),
                      rows: [
                        (s.t('uni.start'), formatLongDate(contest.startsAt, locale)),
                        (s.t('uni.end'), formatLongDate(contest.endsAt, locale)),
                      ],
                      note: localizedContent(contest.rules, locale),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            Row(
              children: [
                Expanded(
                  child: _UniTile(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        _TileLabel(s.t('uni.start')),
                        const SizedBox(height: 4),
                        _DateValue(formatLongDate(contest.startsAt, locale)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _UniTile(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        _TileLabel(s.t('uni.end')),
                        const SizedBox(height: 4),
                        _DateValue(formatLongDate(contest.endsAt, locale)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Best-effort: a tablet with no dialler simply does nothing rather than
  /// throwing a platform exception at the user.
  Future<void> _dial(String phone) async {
    final uri = Uri(scheme: 'tel', path: phone.replaceAll(' ', ''));
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }
}

/// One of the four contest facts. Deliberately the same shape as the
/// profile's stat card (profile_screen.dart#_StatCard): a 10%-tint fill, a
/// 25%-tint border, radius 18, a 26pt icon and a value over a label — so
/// the league and the profile read as one design, not two.
class _ContestStatCard extends ConsumerWidget {
  const _ContestStatCard({
    required this.icon,
    required this.color,
    required this.value,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String value;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = _Pal.of(ref);

    return PressScale(
      onTap: onTap,
      scale: 0.97,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      value,
                      maxLines: 1,
                      softWrap: false,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                        height: 1.1,
                        color: p.text,
                      ),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                      height: 1.15,
                      color: p.muted,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 17, color: p.faint),
          ],
        ),
      ),
    );
  }
}

/// What a contest card opens: the headline again, then the detail rows, then
/// any long-form note. Same panel chrome as the role and campus pickers, so
/// there is one modal language in this screen rather than three.
class _ContestFactPanel extends ConsumerWidget {
  const _ContestFactPanel({
    required this.icon,
    required this.color,
    required this.title,
    this.headline,
    this.rows = const [],
    this.note,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String? headline;
  final List<(String, String)> rows;
  final String? note;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = StringsScope.of(context);
    final p = _Pal.of(ref);

    return _DialogPanel(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 4),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Icon(icon, size: 19, color: color),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.3,
                      color: p.text,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (headline != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  headline!,
                  style: TextStyle(
                    fontSize: 27,
                    fontWeight: FontWeight.w900,
                    color: color,
                  ),
                ),
              ),
            ),
          if (rows.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
              child: Column(
                children: [
                  for (var i = 0; i < rows.length; i++) ...[
                    if (i > 0) Divider(height: 1, thickness: 1, color: p.line),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              rows[i].$1,
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                                color: p.muted,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Flexible(
                            child: Text(
                              rows[i].$2,
                              textAlign: TextAlign.right,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: p.text,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          if (note != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: p.tile,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: p.tileBorder),
                ),
                child: Text(
                  note!,
                  style: TextStyle(fontSize: 12, height: 1.4, color: p.muted),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
            child: FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(46),
                backgroundColor: color,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              child: Text(
                s.t('uni.close').toUpperCase(),
                style: const TextStyle(
                    fontWeight: FontWeight.w900, letterSpacing: 0.4),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ContestMeta extends ConsumerWidget {
  const _ContestMeta({required this.label, required this.value, this.onTap});

  final String label;
  final String value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = _Pal.of(ref);

    final line = Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: '$label ',
            style: TextStyle(fontSize: 11.5, color: p.muted),
          ),
          TextSpan(
            text: value,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: onTap == null ? p.text : _C.blue,
            ),
          ),
        ],
      ),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
    );

    if (onTap == null) return line;
    return GestureDetector(onTap: onTap, child: line);
  }
}

class _UniTile extends ConsumerWidget {
  const _UniTile({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = _Pal.of(ref);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: p.tile,
        borderRadius: BorderRadius.circular(11),
        border: Border.all(color: p.tileBorder),
      ),
      child: child,
    );
  }
}

class _TileLabel extends ConsumerWidget {
  const _TileLabel(this.text);
  final String text;

  @override
  // Scaled down rather than ellipsised: these labels are short and known
  // ("БАЙГЕ ФОНДУ", "ЖАЛПЫ ЧОГУЛГАН"), and the design shows them whole. The
  // card is ~120pt narrower on a real phone than in the mockup, so on
  // ellipsis they turned into "БАЙГЕ ФО…" — which reads as a bug, not as a
  // tight layout.
  Widget build(BuildContext context, WidgetRef ref) => FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.centerLeft,
        child: Text(
          text,
          maxLines: 1,
          softWrap: false,
          style: TextStyle(
            fontSize: 9.5,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
            color: _Pal.of(ref).muted,
          ),
        ),
      );
}

class _DateValue extends ConsumerWidget {
  const _DateValue(this.text);
  final String text;

  @override
  Widget build(BuildContext context, WidgetRef ref) => FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(
          text,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: _Pal.of(ref).text,
          ),
        ),
      );
}




/// Sponsor wordmark. A supplied logo wins; otherwise the name is set in the
/// same lower-case, tight-tracked style partner marks use, so the slot reads
/// as a brand rather than as body copy.
class _SponsorMark extends ConsumerWidget {
  const _SponsorMark({required this.name, this.logoUrl});

  final String name;
  final String? logoUrl;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (logoUrl != null) {
      // A box rather than a bare height: an uploaded mark can be a wide
      // wordmark or a square icon, and both have to sit in the same slot
      // without stretching the header row or vanishing.
      return ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 92, maxHeight: 26, minHeight: 20),
        child: CachedNetworkImage(
          imageUrl: logoUrl!,
          fit: BoxFit.contain,
          // A sponsor logo that fails to load falls through to the wordmark
          // rather than leaving a broken box on the card.
          errorWidget: (_, __, ___) => _wordmark(ref),
          placeholder: (_, __) => const SizedBox(height: 20),
        ),
      );
    }
    return _wordmark(ref);
  }

  Widget _wordmark(WidgetRef ref) => Text(
        name,
        style: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.4,
          color: _Pal.of(ref).text,
        ),
      );
}

/// University crest: the supplied artwork, or a monogram disc in the
/// university's own accent colour — a designed stand-in, not a gap.
class _UniCrest extends ConsumerWidget {
  const _UniCrest({required this.university, required this.size});

  final University university;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tint = _parseHex(university.color);

    if (university.logoUrl != null) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: university.logoUrl!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          // No crest uploaded yet, or it failed: the monogram below is the
          // designed stand-in, so fall through to it rather than showing a
          // broken image.
          errorWidget: (_, __, ___) => _monogram(context, ref, tint),
          placeholder: (_, __) => _monogram(context, ref, tint),
        ),
      );
    }

    return _monogram(context, ref, tint);
  }

  /// The designed stand-in: the campus's initials on a white disc in its own
  /// accent colour. Used when no crest is uploaded, and while one loads.
  Widget _monogram(BuildContext context, WidgetRef ref, Color tint) {
    final locale = ref.watch(localeProvider);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      padding: EdgeInsets.all(size * 0.16),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white,
        border: Border.all(color: tint, width: size * 0.06),
      ),
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(
          _crestLabel(localizedContent(university.shortName, locale)),
          style: TextStyle(
            fontSize: size * 0.34,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.5,
            color: tint,
          ),
        ),
      ),
    );
  }
}

/// "КГТУ" stays whole; "Салымбеков" and "Ала-Тоо" become initials — four
/// glyphs is as much as a crest can hold before it turns into a label.
String _crestLabel(String shortName) {
  final name = shortName.trim();
  if (name.isEmpty) return '?';
  if (name.length <= 4 && name == name.toUpperCase()) return name;

  final parts = name
      .split(RegExp(r'[\s\-–—]+'))
      .where((w) => w.isNotEmpty)
      .toList(growable: false);
  final initials = parts
      .take(3)
      .map((w) => w.characters.first.toUpperCase())
      .join();
  return initials.isEmpty ? name.characters.first.toUpperCase() : initials;
}

// ── University podium and standings ───────────────────────────────────────

/// Top three, laid out 2–1–3 with the winner's card taller. Aligned on the
/// bottom edge, so the extra height is what raises it — no magic offsets.
class _UniPodium extends StatelessWidget {
  const _UniPodium({required this.students, this.onPick});
  final List<UniBoardEntry> students;
  final void Function(UniBoardEntry)? onPick;

  @override
  Widget build(BuildContext context) {
    UniBoardEntry? at(int i) => i < students.length ? students[i] : null;
    Widget slot(int i, int place) =>
        Expanded(child: _UniPodiumSlot(entry: at(i), place: place, onPick: onPick));

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          slot(1, 2),
          const SizedBox(width: 9),
          slot(0, 1),
          const SizedBox(width: 9),
          slot(2, 3),
        ],
      ),
    );
  }
}

class _UniPodiumSlot extends ConsumerWidget {
  const _UniPodiumSlot({required this.entry, required this.place, this.onPick});

  final UniBoardEntry? entry;
  final int place;
  final void Function(UniBoardEntry)? onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = _Pal.of(ref);

    // A contest with fewer than three students leaves the slot blank rather
    // than promoting someone into a place they haven't earned.
    if (entry == null) return const SizedBox.shrink();

    final (border, fill) = switch (place) {
      1 => (
          _C.gold,
          p.bright
              ? [const Color(0xFFFEF9C3), const Color(0xFFFDE68A)]
              : [const Color(0xFF2A1E06), const Color(0xFF15100A)],
        ),
      2 => (
          p.bright ? const Color(0xFFCBD5E1) : const Color(0xFF2A3142),
          p.bright
              ? [const Color(0xFFFFFFFF), const Color(0xFFF1F5F9)]
              : [const Color(0xFF141B2A), const Color(0xFF0D1220)],
        ),
      _ => (
          p.bright ? const Color(0xFFFDBA74) : const Color(0xFF6D3617),
          p.bright
              ? [const Color(0xFFFFF7ED), const Color(0xFFFFEDD5)]
              : [const Color(0xFF1F1108), const Color(0xFF130C08)],
        ),
    };

    final ring = switch (place) {
      1 => _C.gold,
      2 => const Color(0xFF9AA3B2),
      _ => const Color(0xFFC2703A),
    };

    final xpColor = switch (place) {
      1 => _C.gold,
      2 => p.bright ? const Color(0xFF64748B) : const Color(0xFFC3C9D4),
      _ => const Color(0xFFF59E0B),
    };

    final card = Container(
      margin: const EdgeInsets.only(top: 15),
      padding: EdgeInsets.fromLTRB(6, place == 1 ? 26 : 22, 6, place == 1 ? 16 : 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border, width: place == 1 ? 1.5 : 1),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: fill,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _Avatar(
            entry: entry!.asLeaderboardEntry,
            size: place == 1 ? 50 : 44,
            ring: ring,
            ringWidth: 2.5,
            glow: place == 1,
          ),
          const SizedBox(height: 8),
          Text(
            entry!.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: p.text,
            ),
          ),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              '${formatGrouped(entry!.xp)} XP',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w800,
                color: xpColor,
              ),
            ),
          ),
          if (entry!.supporters > 0) ...[
            const SizedBox(height: 5),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.favorite_rounded, size: 10, color: _C.supportTint),
                const SizedBox(width: 3),
                Text(
                  '${entry!.supporters}',
                  style: const TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: _C.supportTint,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );

    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.topCenter,
      children: [
        onPick == null
            ? card
            : PressScale(onTap: () => onPick!(entry!), scale: 0.96, child: card),
        _WreathBadge(place: place),
      ],
    );
  }
}

/// The laurel medal that straddles the top edge of a podium card. Drawn
/// rather than shipped as three images: it has to sit on a gold, a silver
/// and a bronze card and pick up each one's tint.
class _WreathBadge extends StatelessWidget {
  const _WreathBadge({required this.place});
  final int place;

  @override
  Widget build(BuildContext context) {
    final (tint, deep) = switch (place) {
      1 => (_C.goldLight, _C.gold),
      2 => (const Color(0xFFE2E6EC), const Color(0xFF9AA3B2)),
      _ => (const Color(0xFFE9A87C), const Color(0xFFC2703A)),
    };

    return SizedBox(
      width: 40,
      height: 30,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(size: const Size(40, 30), painter: _WreathPainter(tint)),
          Container(
            width: 19,
            height: 19,
            alignment: Alignment.center,
            decoration: BoxDecoration(shape: BoxShape.circle, color: deep),
            child: Text(
              '$place',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w900,
                color: Colors.white,
              ),
            ),
          ),
          Positioned(
            top: 0,
            child: Icon(Icons.star_rounded, size: 11, color: tint),
          ),
        ],
      ),
    );
  }
}

class _WreathPainter extends CustomPainter {
  const _WreathPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    final centre = Offset(size.width / 2, size.height / 2 + 1);
    const leaves = 5;
    const radius = 13.0;

    // Two mirrored arcs sweeping up from the bottom, leaves tilting outward
    // and shrinking towards the tips — the shape a real wreath makes.
    for (final side in [-1, 1]) {
      for (var i = 0; i < leaves; i++) {
        final t = i / (leaves - 1);
        final angle = math.pi / 2 - side * (0.35 + t * 1.55);
        final at = centre +
            Offset(math.cos(angle) * radius * side.abs() * (side < 0 ? -1 : 1),
                math.sin(angle) * radius);

        canvas.save();
        canvas.translate(at.dx, at.dy);
        canvas.rotate(side * (0.9 - t * 0.7));
        canvas.drawOval(
          Rect.fromCenter(
            center: Offset.zero,
            width: 7.5 - t * 2.5,
            height: 3.6 - t * 1.1,
          ),
          paint,
        );
        canvas.restore();
      }
    }
  }

  @override
  bool shouldRepaint(_WreathPainter old) => old.color != color;
}

/// Ranks four and down, in one panel — the standings read as a single list,
/// which separate cards per row would break up.
class _UniStandings extends ConsumerWidget {
  const _UniStandings({required this.students, this.meId, this.onPick});
  final List<UniBoardEntry> students;
  final String? meId;
  final void Function(UniBoardEntry)? onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = _Pal.of(ref);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Container(
        decoration: BoxDecoration(
          color: p.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: p.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < students.length; i++) ...[
              if (i > 0) Divider(height: 1, thickness: 1, color: p.line),
              _UniStudentRow(
                entry: students[i],
                isMe: students[i].id == meId,
                onPick: onPick,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _UniStudentRow extends ConsumerWidget {
  const _UniStudentRow({required this.entry, this.isMe = false, this.onPick});

  final UniBoardEntry entry;
  final bool isMe;
  final void Function(UniBoardEntry)? onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = StringsScope.of(context);
    final p = _Pal.of(ref);

    final row = Container(
      color: isMe ? _C.blue.withValues(alpha: 0.12) : Colors.transparent,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      child: Row(
        children: [
          SizedBox(
            width: 22,
            child: Text(
              '${entry.rank}',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: p.faint,
              ),
            ),
          ),
          _Avatar(entry: entry.asLeaderboardEntry, size: 28),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              isMe ? '${entry.name} · ${s.t('uni.you')}' : entry.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: p.text,
              ),
            ),
          ),
          if (entry.supporters > 0) ...[
            const SizedBox(width: 6),
            const Icon(Icons.favorite_rounded, size: 11, color: _C.supportTint),
            const SizedBox(width: 2),
            Text(
              '${entry.supporters}',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: _C.supportTint,
              ),
            ),
          ],
          const SizedBox(width: 8),
          Text(
            '${formatGrouped(entry.xp)} XP',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: p.text,
            ),
          ),
        ],
      ),
    );

    if (onPick == null) return row;
    return InkWell(onTap: () => onPick!(entry), child: row);
  }
}

// ── University league dialogs ─────────────────────────────────────────────

/// Null for an id that is no longer in the catalogue — a campus can be
/// deleted in the admin while a learner still has it saved on their
/// account, and that has to re-ask rather than render an empty tab.
University? _findUniversity(List<University> universities, String? id) {
  if (id == null) return null;
  for (final u in universities) {
    if (u.id == id) return u;
  }
  return null;
}

/// Shared presentation for both questions: the league blurs back behind a
/// scrim and the panel scales in. Blur rather than a plain dim because the
/// standings stay recognisable underneath — the player can see they haven't
/// left the screen.
Future<T?> _showUniDialog<T>(
  BuildContext context, {
  required Widget panel,
}) {
  final animate = ProviderScope.containerOf(context, listen: false)
          .read(userStateProvider)
          ?.settings
          .animations ??
      true;

  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: true,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    barrierColor: Colors.transparent,
    transitionDuration: Duration(milliseconds: animate ? 220 : 0),
    pageBuilder: (_, __, ___) => const SizedBox.shrink(),
    transitionBuilder: (context, animation, _, __) {
      final t = Curves.easeOutCubic.transform(animation.value);

      return Consumer(
        builder: (context, ref, _) {
          final p = _Pal.of(ref);
          return Stack(
            children: [
              // Ignores pointers so a tap outside the panel reaches the
              // modal barrier and dismisses, as it should.
              Positioned.fill(
                child: IgnorePointer(
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 9 * t, sigmaY: 9 * t),
                    child: ColoredBox(
                      color: p.scrim.withValues(alpha: p.scrim.a * t),
                    ),
                  ),
                ),
              ),
              Center(
                child: Opacity(
                  opacity: t,
                  child: Transform.scale(scale: 0.94 + 0.06 * t, child: panel),
                ),
              ),
            ],
          );
        },
      );
    },
  );
}

/// "Are you a student here, or just watching?" — returns null if dismissed.
Future<UniLeagueRole?> showUniRoleDialog(
  BuildContext context, {
  UniLeagueRole? current,
}) =>
    _showUniDialog<UniLeagueRole>(
      context,
      panel: _RoleDialog(current: current),
    );

/// Returns the chosen university id, or null if dismissed.
Future<String?> showUniversityPicker(
  BuildContext context, {
  required UniLeagueRole role,
  String? current,
}) =>
    _showUniDialog<String>(
      context,
      panel: _UniversityPickerDialog(role: role, current: current),
    );

class _DialogPanel extends ConsumerWidget {
  const _DialogPanel({required this.child, this.maxWidth = 360});

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = _Pal.of(ref);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Material(
        color: Colors.transparent,
        child: Container(
          constraints: BoxConstraints(
            maxWidth: maxWidth,
            maxHeight: MediaQuery.sizeOf(context).height * 0.78,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: p.uniCardBorder),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [p.uniCardTop, p.uniCardBottom],
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: p.bright ? 0.18 : 0.5),
                blurRadius: 40,
                offset: const Offset(0, 18),
              ),
            ],
          ),
          child: child,
        ),
      ),
    );
  }
}

class _RoleDialog extends ConsumerWidget {
  const _RoleDialog({this.current});
  final UniLeagueRole? current;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = StringsScope.of(context);
    final p = _Pal.of(ref);

    return _DialogPanel(
      maxWidth: 380,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              s.t('uni.roleTitle'),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.5,
                color: p.text,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              s.t('uni.roleSubtitle'),
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12.5, height: 1.35, color: p.muted),
            ),
            const SizedBox(height: 18),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: _RoleCard(
                      icon: Icons.school_rounded,
                      title: s.t('uni.roleStudent'),
                      description: s.t('uni.roleStudentDesc'),
                      colors: const [Color(0xFF3B82F6), Color(0xFF1D4ED8)],
                      selected: current == UniLeagueRole.student,
                      onTap: () => Navigator.of(context)
                          .pop(UniLeagueRole.student),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _RoleCard(
                      icon: Icons.visibility_rounded,
                      title: s.t('uni.roleViewer'),
                      description: s.t('uni.roleViewerDesc'),
                      colors: const [Color(0xFFA855F7), Color(0xFF7C3AED)],
                      selected: current == UniLeagueRole.viewer,
                      onTap: () =>
                          Navigator.of(context).pop(UniLeagueRole.viewer),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.colors,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String description;
  final List<Color> colors;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => PressScale(
        onTap: onTap,
        scale: 0.96,
        haptic: true,
        child: Semantics(
          button: true,
          selected: selected,
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 16, 12, 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: colors,
              ),
              // The current answer keeps a light ring so reopening the
              // dialog shows what was chosen last time.
              border: Border.all(
                color: selected ? Colors.white : Colors.white24,
                width: selected ? 2 : 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: colors.last.withValues(alpha: 0.35),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 30, color: Colors.white),
                const SizedBox(height: 10),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.4,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  description,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    height: 1.35,
                    color: Colors.white.withValues(alpha: 0.88),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

class _UniversityPickerDialog extends ConsumerStatefulWidget {
  const _UniversityPickerDialog({required this.role, this.current});

  final UniLeagueRole role;
  final String? current;

  @override
  ConsumerState<_UniversityPickerDialog> createState() =>
      _UniversityPickerDialogState();
}

class _UniversityPickerDialogState
    extends ConsumerState<_UniversityPickerDialog> {
  late String? _selected = widget.current;

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final p = _Pal.of(ref);
    final universities = ref.watch(universitiesProvider);

    return _DialogPanel(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
            child: Stack(
              children: [
                Padding(
                  // Keeps the centred title clear of the close button.
                  padding: const EdgeInsets.symmetric(horizontal: 28),
                  child: Column(
                    children: [
                      Text(
                        s.t('uni.pickTitle'),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.4,
                          color: p.text,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        s.t(widget.role == UniLeagueRole.student
                            ? 'uni.pickSubtitle'
                            : 'uni.pickSubtitleViewer'),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 12.5,
                          height: 1.35,
                          color: p.muted,
                        ),
                      ),
                    ],
                  ),
                ),
                Positioned(
                  top: -6,
                  right: -6,
                  child: IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: Icon(Icons.close_rounded, size: 20, color: p.muted),
                    tooltip: MaterialLocalizations.of(context)
                        .modalBarrierDismissLabel,
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: universities.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final university = universities[i];
                return _UniversityOption(
                  index: i + 1,
                  university: university,
                  selected: university.id == _selected,
                  onTap: () => setState(() => _selected = university.id),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
            child: PressScale(
              onTap: _selected == null
                  ? null
                  : () {
                      Haptics.success();
                      Navigator.of(context).pop(_selected);
                    },
              enabled: _selected != null,
              child: AnimatedOpacity(
                duration: const Duration(milliseconds: 150),
                opacity: _selected == null ? 0.45 : 1,
                child: Container(
                  height: 50,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(25),
                  ),
                  child: Text(
                    s.t('uni.ok'),
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                      color: Color(0xFF1D4ED8),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _UniversityOption extends ConsumerWidget {
  const _UniversityOption({
    required this.index,
    required this.university,
    required this.selected,
    required this.onTap,
  });

  final int index;
  final University university;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = _Pal.of(ref);

    return PressScale(
      onTap: onTap,
      scale: 0.98,
      haptic: true,
      child: Semantics(
        button: true,
        selected: selected,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: selected ? _C.blue.withValues(alpha: 0.14) : p.tile,
            borderRadius: BorderRadius.circular(11),
            border: Border.all(
              color: selected ? _C.blue : p.tileBorder,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              _UniCrest(university: university, size: 30),
              const SizedBox(width: 10),
              Text(
                '$index.',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: p.muted,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  university.listName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.2,
                    color: p.text,
                  ),
                ),
              ),
              if (selected)
                const Icon(Icons.check_circle_rounded,
                    size: 18, color: _C.blue),
            ],
          ),
        ),
      ),
    );
  }
}


// ── Viewer support ─────────────────────────────────────────────────────────
//
// The other half of the university league: a viewer spends their own energy
// to back a student, and the student can see who backed them. Both live
// here rather than in their own file because they only ever open from this
// screen's board.

/// The sheet a viewer gets after tapping a student. Rising from the bottom
/// keeps the connection to the row that was touched, which a centred dialog
/// would lose.
Future<void> showUniSupportSheet(BuildContext context, UniBoardEntry student) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _UniSupportSheet(student: student),
  );
}

class _UniSupportSheet extends ConsumerStatefulWidget {
  const _UniSupportSheet({required this.student});
  final UniBoardEntry student;

  @override
  ConsumerState<_UniSupportSheet> createState() => _UniSupportSheetState();
}

class _UniSupportSheetState extends ConsumerState<_UniSupportSheet> {
  bool _sending = false;
  bool _sent = false;
  String? _error;

  Future<void> _send(int amount) async {
    if (_sending || _sent) return;
    final s = StringsScope.of(context);
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final res =
          await ref.read(apiClientProvider).sendSupportEnergy(widget.student.id);
      ref.read(authProvider.notifier).applyUser(res.user);
      // The board carries supporter counts, so it has to refetch for the
      // heart beside this student to tick up.
      final uniId = ref.read(uniLeagueProvider).universityId;
      if (uniId != null) ref.invalidate(uniBoardProvider(uniId));
      Haptics.success();
      if (!mounted) return;
      setState(() => _sent = true);
      await Future<void>.delayed(const Duration(milliseconds: 1100));
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = switch (e) {
            // 429 is "already gave one this period" — a rule, not a failure,
            // so it gets its own copy rather than the raw server line.
            ApiException(status: 429) => s.t('uni.supportAlready'),
            ApiException(kind: ApiErrorKind.offline) => s.t('common.offline'),
            ApiException(kind: ApiErrorKind.timeout) ||
            ApiException(kind: ApiErrorKind.server) =>
              s.t('common.serverError'),
            _ => e.message,
          });
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final p = _Pal.of(ref);
    final st = ref.watch(userStateProvider);
    final limits = ref.watch(contentProvider).valueOrNull?.limits;

    final amount = limits?.supportEnergyAmount ?? 5;
    final energy = computeLiveEnergy(
      st,
      dailyFreeLessons: limits?.dailyFreeLessons ?? 3,
      energyRefillHours: limits?.energyRefillHours ?? kDefaultRefillHours,
    ).remaining;
    final short = energy < amount;
    final disabled = _sending || _sent || short;

    return Container(
      decoration: BoxDecoration(
        color: p.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
        border: Border(top: BorderSide(color: p.line)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 10,
        bottom: MediaQuery.of(context).viewPadding.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: p.line,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  s.t('uni.supportTitle'),
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    height: 1.2,
                    color: p.text,
                  ),
                ),
              ),
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded, size: 20),
                color: p.muted,
                tooltip: s.t('uni.close'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _Avatar(
                entry: widget.student.asLeaderboardEntry,
                size: 58,
                ring: _C.gold,
                ringWidth: 3,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.student.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                        color: p.text,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      s.t('uni.supportPlace',
                          params: {'n': '${widget.student.rank}'}),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: p.muted,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 132,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: p.tile,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: p.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        s.t('uni.supportYourEnergy'),
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          color: _C.energy,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(Icons.bolt_rounded, size: 19, color: _C.energy),
                          const SizedBox(width: 4),
                          Text(
                            '$energy',
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                              height: 1,
                              color: p.text,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: PressScale(
                    onTap: disabled ? null : () => _send(amount),
                    child: Opacity(
                      opacity: disabled ? 0.5 : 1,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: _sent
                                ? const [Color(0xFF3FA51A), Color(0xFF2F7D13)]
                                : const [Color(0xFF8B2BE2), _C.supportDeep],
                          ),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if (_sending)
                              const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white),
                              )
                            else ...[
                              Text(
                                _sent
                                    ? s.t('uni.supportSent',
                                        params: {'name': widget.student.name})
                                    : s.t('uni.supportCta'),
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w900,
                                  height: 1.15,
                                  color: Colors.white,
                                ),
                              ),
                              if (!_sent) ...[
                                const SizedBox(height: 4),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(Icons.bolt_rounded,
                                        size: 13, color: Colors.white),
                                    const SizedBox(width: 3),
                                    Text(
                                      '$amount  ${s.t('uni.supportCtaSub')}',
                                      style: const TextStyle(
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.white70,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: Text(
              _error ?? (short && !_sent ? s.t('uni.supportNoEnergy') : s.t('uni.supportNote')),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11.5,
                height: 1.35,
                fontWeight: _error != null ? FontWeight.w600 : FontWeight.w400,
                color: _error != null
                    ? AppColors.danger
                    : short && !_sent
                        ? AppColors.warning
                        : p.muted,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// "СЕНИ КОЛДОГОНДОР" — what the student sees after viewers have backed
/// them, one row per backer with their running total.
Future<void> showUniSupportersDialog(BuildContext context) {
  return _showUniDialog<void>(context, panel: const _UniSupportersDialog());
}

class _UniSupportersDialog extends ConsumerWidget {
  const _UniSupportersDialog();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = StringsScope.of(context);
    final p = _Pal.of(ref);
    final async = ref.watch(supportersProvider);

    return _DialogPanel(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 8, 8),
            child: Row(
              children: [
                const SizedBox(width: 28),
                Expanded(
                  child: Text(
                    s.t('uni.supportersTitle'),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.4,
                      color: p.text,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, size: 20),
                  color: p.muted,
                  tooltip: s.t('uni.close'),
                ),
              ],
            ),
          ),
          Flexible(
            child: async.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 34),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (err, _) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: ErrorView(
                  error: err,
                  onRetry: () => ref.invalidate(supportersProvider),
                ),
              ),
              data: (rows) => rows.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.symmetric(vertical: 26),
                      child: EmptyView(
                        icon: Icons.favorite_border_rounded,
                        title: s.t('uni.supportersEmpty'),
                      ),
                    )
                  : ListView.separated(
                      shrinkWrap: true,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: rows.length,
                      separatorBuilder: (_, __) =>
                          Divider(height: 1, thickness: 1, color: p.line),
                      itemBuilder: (_, i) {
                        final r = rows[i];
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 9),
                          child: Row(
                            children: [
                              SizedBox(
                                width: 20,
                                child: Text(
                                  '${i + 1}',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: p.faint,
                                  ),
                                ),
                              ),
                              _Avatar(
                                entry: LeaderboardEntry(
                                    id: r.id, name: r.name, xp: 0, avatar: r.avatar),
                                size: 28,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  r.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: p.text,
                                  ),
                                ),
                              ),
                              const Icon(Icons.bolt_rounded, size: 14, color: _C.energy),
                              const SizedBox(width: 2),
                              Text(
                                '${r.amount}',
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: _C.energy,
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF1D4ED8),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(999)),
                ),
                child: Text(
                  s.t('uni.close').toUpperCase(),
                  style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 0.4),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
