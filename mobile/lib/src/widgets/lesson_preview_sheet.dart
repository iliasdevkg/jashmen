/// Bottom sheet shown when tapping a path node, before anything navigates
/// — port of src/components/LessonPreviewSheet.jsx (Task 3). Shows what the
/// lesson actually is (type chip, title, question count, potential reward)
/// and lets the player commit to exactly one truthful primary action: start
/// it fresh, review it again if it's already done, or go buy energy if
/// today's free lessons are used up. This is what a tap on a COMPLETED
/// lesson opens now, instead of silently relaunching the full player.
library;

import 'package:flutter/material.dart';

import '../core/i18n.dart';
import '../core/logic.dart';
import '../core/theme.dart';
import '../models/content.dart';

Future<void> showLessonPreviewSheet(
  BuildContext context, {
  required AppLocale locale,
  required Lesson lesson,
  required LessonStatus status,
  required bool isCheckpoint,
  required bool isGated,
  required Color moduleColor,
  /// The reward formula's terms, straight from the Лимиттер tab, so the
  /// "up to +N XP" line promises what the server will actually pay.
  ContentLimits? limits,
  required VoidCallback onStart,
  required VoidCallback onReview,
  required VoidCallback onGoShop,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _LessonPreviewSheet(
      lesson: lesson,
      status: status,
      isCheckpoint: isCheckpoint,
      isGated: isGated,
      moduleColor: moduleColor,
      locale: locale,
      limits: limits,
      onStart: onStart,
      onReview: onReview,
      onGoShop: onGoShop,
    ),
  );
}

class _LessonPreviewSheet extends StatelessWidget {
  const _LessonPreviewSheet({
    required this.lesson,
    required this.status,
    required this.isCheckpoint,
    required this.isGated,
    required this.moduleColor,
    required this.locale,
    required this.limits,
    required this.onStart,
    required this.onReview,
    required this.onGoShop,
  });

  final Lesson lesson;
  final LessonStatus status;
  final bool isCheckpoint;
  final bool isGated;
  final Color moduleColor;
  final AppLocale locale;
  final ContentLimits? limits;
  final VoidCallback onStart;
  final VoidCallback onReview;
  final VoidCallback onGoShop;

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;
    final isCompleted = status == LessonStatus.completed;
    final quizCount = quizCountOf(lesson);
    final maxXp = maxLessonXp(lesson, limits);
    final title = localizedContent(lesson.title, locale);

    final description = isCompleted
        ? s.t('lesson.previewCompletedDesc')
        : isGated
            ? s.t('lesson.previewGatedDesc')
            : s.t('lesson.previewAvailableDesc',
                params: {'n': quizCount, 'xp': maxXp});

    final ctaLabel = isCompleted
        ? s.t('lesson.review')
        : isGated
            ? s.t('lesson.goToShop')
            : s.t('lesson.start');

    final onCta = isCompleted ? onReview : (isGated ? onGoShop : onStart);

    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(0, 0, 0, 0),
        padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.md, Gap.xl, Gap.xl),
        decoration: BoxDecoration(
          color: tokens.card,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Drag handle
            Center(
              child: Container(
                width: 40,
                height: 5,
                margin: const EdgeInsets.only(bottom: Gap.lg),
                decoration: BoxDecoration(
                  color: tokens.border,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),

            // Type chip
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    // A circle, like the web sheet's rounded-full — the two
                    // are the same screen and were drawing different shapes.
                    color: moduleColor,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    isCheckpoint
                        ? Icons.school_rounded
                        : Icons.fitness_center_rounded,
                    color: Colors.white,
                    size: 18,
                  ),
                ),
                const SizedBox(width: Gap.sm),
                Text(
                  isCheckpoint
                      ? s.t('lesson.previewCheckpoint')
                      : s.t('lesson.previewLesson'),
                  style: TextStyle(
                    color: moduleColor,
                    fontWeight: FontWeight.w800,
                    fontSize: 11,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
            const SizedBox(height: Gap.md),

            Text(title, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: Gap.sm),
            Text(description,
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: tokens.muted, height: 1.4)),
            const SizedBox(height: Gap.lg),

            // Status pills
            Wrap(
              spacing: Gap.sm,
              runSpacing: Gap.sm,
              children: [
                _Pill(
                  icon: Icons.quiz_rounded,
                  label: s.t('lesson.quizCount', params: {'n': quizCount}),
                  tokens: tokens,
                ),
                if (isCompleted)
                  _Pill(
                    icon: Icons.check_circle_rounded,
                    label: s.t('lesson.previewCompletedBadge'),
                    color: AppColors.success,
                  )
                else if (isGated)
                  _Pill(
                    icon: Icons.bolt_rounded,
                    label: s.t('lesson.previewNoEnergyBadge'),
                    color: AppColors.danger,
                  )
                else
                  _Pill(
                    icon: Icons.star_rounded,
                    label: s.t('lesson.upToXp', params: {'n': maxXp}),
                    color: AppColors.gold,
                  ),
              ],
            ),
            const SizedBox(height: Gap.xl),

            FilledButton(
              onPressed: () {
                Navigator.of(context).pop();
                onCta();
              },
              style: FilledButton.styleFrom(
                minimumSize: const Size(double.infinity, 52),
                // The module's own colour, the same as the web sheet
                // (LessonPreviewSheet.jsx): the icon and the eyebrow above
                // already wear it, and a green button under a purple module
                // read as a different product's control. The one exception
                // is the gated state, where the button is not "start this
                // lesson" at all — it goes to the shop, and takes the
                // shop's blue with it.
                backgroundColor: isGated ? AppColors.primary : moduleColor,
              ),
              child: Text(ctaLabel,
                  style: const TextStyle(fontWeight: FontWeight.w800)),
            ),
          ],
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.icon, required this.label, this.color, this.tokens});

  final IconData icon;
  final String label;
  final Color? color;
  final dynamic tokens;

  @override
  Widget build(BuildContext context) {
    final c = color ?? (tokens?.muted as Color? ?? AppColors.primary);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: c),
          const SizedBox(width: 4),
          Text(label,
              style: TextStyle(
                  color: c, fontWeight: FontWeight.w700, fontSize: 11)),
        ],
      ),
    );
  }
}
