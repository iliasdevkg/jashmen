/// Leaderboard + the user's current league. Port of src/pages/LeaguePage.jsx.
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/i18n.dart';
import '../core/logic.dart';
import '../core/theme.dart';
import '../models/content.dart';
import '../state/providers.dart';
import '../widgets/states.dart';

Color _parseHex(String hex, {Color fallback = AppColors.primary}) {
  var value = hex.replaceFirst('#', '').trim();
  if (value.length == 6) value = 'FF$value';
  final parsed = int.tryParse(value, radix: 16);
  return parsed == null ? fallback : Color(parsed);
}

class LeagueScreen extends ConsumerWidget {
  const LeagueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = StringsScope.of(context);
    final board = ref.watch(leaderboardProvider);
    final content = ref.watch(contentProvider);
    final userState = ref.watch(userStateProvider);

    return Scaffold(
      appBar: AppBar(title: Text(s.t('league.title'))),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(leaderboardProvider);
          await ref.read(leaderboardProvider.future);
        },
        child: board.when(
          loading: () => ListView(
            padding: const EdgeInsets.all(Gap.lg),
            children: [
              for (var i = 0; i < 8; i++)
                const Padding(
                  padding: EdgeInsets.only(bottom: Gap.md),
                  child: SkeletonBox(height: 64, radius: 16),
                ),
            ],
          ),
          error: (err, _) => ListView(
            children: [
              SizedBox(
                height: MediaQuery.sizeOf(context).height * 0.6,
                child: ErrorView(
                  error: err,
                  onRetry: () => ref.invalidate(leaderboardProvider),
                ),
              ),
            ],
          ),
          data: (rows) {
            final league = content.hasValue
                ? getCurrentLeague(userState?.xp ?? 0, content.value!.leagues)
                : null;

            if (rows.isEmpty) {
              return ListView(
                children: [
                  SizedBox(
                    height: MediaQuery.sizeOf(context).height * 0.6,
                    child: EmptyView(
                      icon: Icons.emoji_events_rounded,
                      title: s.t('league.empty'),
                    ),
                  ),
                ],
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.all(Gap.lg),
              itemCount: rows.length + (league != null ? 1 : 0),
              itemBuilder: (context, i) {
                if (league != null && i == 0) return _LeagueBanner(league: league);
                final index = league != null ? i - 1 : i;
                return _Row(rank: index + 1, entry: rows[index]);
              },
            );
          },
        ),
      ),
    );
  }
}

class _LeagueBanner extends StatelessWidget {
  const _LeagueBanner({required this.league});
  final League league;

  @override
  Widget build(BuildContext context) {
    final color = _parseHex(league.color);
    return Container(
      margin: const EdgeInsets.only(bottom: Gap.xl),
      padding: const EdgeInsets.all(Gap.xl),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color.withValues(alpha: 0.25), color.withValues(alpha: 0.08)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(18)),
            clipBehavior: Clip.antiAlias,
            child: league.iconUrl == null
                ? const Icon(Icons.emoji_events_rounded, color: Colors.white, size: 28)
                : CachedNetworkImage(
                    imageUrl: league.iconUrl!,
                    fit: BoxFit.contain,
                    errorWidget: (_, __, ___) =>
                        const Icon(Icons.emoji_events_rounded, color: Colors.white, size: 28),
                  ),
          ),
          const SizedBox(width: Gap.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(league.name, style: Theme.of(context).textTheme.headlineSmall),
                Text('${league.minXp}+ XP',
                    style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.rank, required this.entry});

  final int rank;
  final dynamic entry;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    // Top three get medal tints; everyone else a neutral chip.
    final medal = switch (rank) {
      1 => AppColors.gold,
      2 => const Color(0xFFC0C0C0),
      3 => const Color(0xFFCD7F32),
      _ => null,
    };

    return Container(
      margin: const EdgeInsets.only(bottom: Gap.md),
      padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: Gap.md),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: medal ?? tokens.border, width: medal != null ? 1.5 : 1),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 32,
            child: Text(
              '$rank',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: medal ?? tokens.muted,
                    fontWeight: FontWeight.w800,
                  ),
            ),
          ),
          const SizedBox(width: Gap.sm),
          Expanded(
            child: Text(
              entry.name as String,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ),
          Text('${entry.xp} XP',
              style: Theme.of(context)
                  .textTheme
                  .labelSmall
                  ?.copyWith(fontWeight: FontWeight.w800, color: AppColors.primary)),
        ],
      ),
    );
  }
}
