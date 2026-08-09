/// Stats + achievements. Port of src/pages/ProfilePage.jsx.
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

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;
    final session = ref.watch(authProvider);
    final content = ref.watch(contentProvider);

    if (session is! SessionSignedIn) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final user = session.user;
    final state = user.state;
    final league = content.hasValue
        ? getCurrentLeague(state.xp, content.value!.leagues)
        : null;

    return Scaffold(
      appBar: AppBar(title: Text(s.t('profile.title'))),
      body: RefreshIndicator(
        onRefresh: () => ref.read(authProvider.notifier).refreshMe(),
        child: ListView(
          padding: const EdgeInsets.all(Gap.lg),
          children: [
            // Identity
            Row(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: const BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    user.name.isEmpty ? '?' : user.name.characters.first.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(width: Gap.lg),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              user.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.headlineSmall,
                            ),
                          ),
                          if (state.vipBadge) ...[
                            const SizedBox(width: 6),
                            const Icon(Icons.workspace_premium_rounded,
                                size: 18, color: AppColors.gold),
                          ],
                        ],
                      ),
                      Text(user.email,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall),
                      if (league != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            league.name,
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: Gap.xl),
            Text(s.t('profile.stats'),
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: Gap.md),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: Gap.md,
              crossAxisSpacing: Gap.md,
              childAspectRatio: 1.9,
              children: [
                _StatCard(
                  icon: Icons.star_rounded,
                  color: AppColors.primary,
                  label: s.t('profile.xp'),
                  value: '${state.xp}',
                ),
                _StatCard(
                  icon: Icons.local_fire_department_rounded,
                  color: AppColors.warning,
                  label: s.t('profile.streak'),
                  value: '${state.streak}',
                ),
                _StatCard(
                  icon: Icons.monetization_on_rounded,
                  color: AppColors.gold,
                  label: s.t('profile.coins'),
                  value: '${state.coins}',
                ),
                _StatCard(
                  icon: Icons.menu_book_rounded,
                  color: AppColors.success,
                  label: s.t('profile.lessons'),
                  value: '${state.completedLessons.length}',
                ),
              ],
            ),

            const SizedBox(height: Gap.xl),
            Text(s.t('profile.achievements'),
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: Gap.md),

            content.when(
              loading: () => const SkeletonBox(height: 90, radius: 16),
              error: (_, __) => const SizedBox.shrink(),
              data: (data) {
                if (data.achievements.isEmpty) {
                  return EmptyView(
                    icon: Icons.military_tech_rounded,
                    title: s.t('profile.noAchievements'),
                  );
                }
                final earned = state.achievements.toSet();
                return Column(
                  children: [
                    for (final a in data.achievements)
                      _AchievementRow(
                        achievement: a,
                        earned: earned.contains(a.id),
                        tokens: tokens,
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color color;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 26),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(value,
                    style: Theme.of(context)
                        .textTheme
                        .headlineSmall
                        ?.copyWith(color: tokens.text)),
                Text(label, style: Theme.of(context).textTheme.labelSmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AchievementRow extends StatelessWidget {
  const _AchievementRow({
    required this.achievement,
    required this.earned,
    required this.tokens,
  });

  final Achievement achievement;
  final bool earned;
  final dynamic tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: Gap.md),
      padding: const EdgeInsets.all(Gap.md),
      decoration: BoxDecoration(
        color: tokens.card as Color,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: earned ? AppColors.success : tokens.border as Color,
        ),
      ),
      child: Row(
        children: [
          Opacity(
            // Unearned achievements stay visible but dimmed — they're a goal,
            // not a secret.
            opacity: earned ? 1 : 0.35,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: tokens.cardAlt as Color,
                borderRadius: BorderRadius.circular(14),
              ),
              clipBehavior: Clip.antiAlias,
              child: achievement.iconUrl == null
                  ? Icon(Icons.military_tech_rounded, color: tokens.faint as Color)
                  : CachedNetworkImage(
                      imageUrl: achievement.iconUrl!,
                      fit: BoxFit.contain,
                      errorWidget: (_, __, ___) =>
                          Icon(Icons.military_tech_rounded, color: tokens.faint as Color),
                    ),
            ),
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(achievement.title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: earned ? tokens.text as Color : tokens.muted as Color,
                        )),
                if (achievement.description.isNotEmpty)
                  Text(achievement.description,
                      style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          if (earned)
            const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 20)
          else
            Text('+${achievement.xp}',
                style: Theme.of(context)
                    .textTheme
                    .labelSmall
                    ?.copyWith(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}
