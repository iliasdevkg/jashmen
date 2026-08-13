/// Lesson player — port of src/pages/LessonPage.jsx.
///
/// A lesson is an ordered deck of cards: theory (read), media (look), quiz
/// (answer). Quiz cards are the only ones that can be got wrong, and the
/// mistake count is what the server turns into a reward.
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../core/haptics.dart';
import '../core/i18n.dart';
import '../core/logic.dart';
import '../core/theme.dart';
import '../models/content.dart';
import '../models/user_state.dart';
import '../state/providers.dart';
import '../widgets/confetti.dart';
import '../widgets/count_up.dart';
import '../widgets/states.dart';

class LessonScreen extends ConsumerStatefulWidget {
  const LessonScreen({super.key, required this.lessonId});
  final String lessonId;

  @override
  ConsumerState<LessonScreen> createState() => _LessonScreenState();
}

class _LessonScreenState extends ConsumerState<LessonScreen> {
  int _index = 0;
  int _mistakes = 0;

  /// Task 7 — the live play order. Starts as the lesson's cards and grows
  /// each time a quiz question is answered wrong: the missed card is appended
  /// so it comes back around, and the lesson can't finish until every
  /// question has been answered correctly at least once (Duolingo "repeat").
  /// Lazily initialised on first build since the deck comes from async
  /// content; `_mistakes` is untouched so scoring reflects first-try accuracy.
  List<LessonCard>? _deck;

  /// Null until the learner commits to an answer on the current quiz card.
  int? _selected;
  bool _checked = false;

  bool _submitting = false;
  LessonReward? _reward;
  String? _submitError;

  /// Distinct quiz cards missed at least once (keyed by original index in
  /// lesson.cards) — powers the first-try accuracy summary on the result
  /// screen, so Task 7 re-queues don't retroactively read as correct.
  final Set<int> _missed = {};

  /// Achievements unlocked by finishing this lesson, shown on the result
  /// screen. Populated in _submit after the server grants them.
  List<Achievement> _earnedAchievements = const [];

  /// The one deliberately showy moment in the lesson flow — fired once,
  /// right as the result screen appears, for a genuine (non-review) win.
  final _confetti = ConfettiController();

  @override
  void dispose() {
    _confetti.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final content = ref.watch(contentProvider);

    return content.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (err, _) => Scaffold(
        appBar: AppBar(),
        body: ErrorView(error: err, onRetry: () => ref.invalidate(contentProvider)),
      ),
      data: (data) {
        final lesson = _findLesson(data, widget.lessonId);
        if (lesson == null || lesson.cards.isEmpty) {
          return Scaffold(
            appBar: AppBar(),
            body: EmptyView(
              icon: Icons.help_outline_rounded,
              title: StringsScope.of(context).t('common.error'),
            ),
          );
        }
        if (_reward != null) {
          final totalQuiz =
              lesson.cards.where((c) => c.type == CardType.quiz).length;
          return ConfettiOverlay(
            controller: _confetti,
            child: _ResultView(
              reward: _reward!,
              lesson: lesson,
              totalQuestions: totalQuiz,
              correctCount: (totalQuiz - _missed.length).clamp(0, totalQuiz),
              earnedAchievements: _earnedAchievements,
            ),
          );
        }
        return _buildPlayer(context, lesson);
      },
    );
  }

  Lesson? _findLesson(AppContent content, String id) {
    for (final m in content.modules) {
      for (final l in m.lessons) {
        if (l.id == id) return l;
      }
    }
    return null;
  }

  Widget _buildPlayer(BuildContext context, Lesson lesson) {
    final s = StringsScope.of(context);
    final locale = ref.watch(localeProvider);
    final tokens = context.tokens;

    final deck = _deck ??= List.of(lesson.cards);
    final card = deck[_index];
    final isQuiz = card.type == CardType.quiz;
    // A wrong quiz answer re-queues, so this is not truly the last step even
    // when it's the last deck slot — keep the button on "Continue".
    final willRequeue = isQuiz && _checked && _selected != card.answerIndex;
    final isLast = _index == deck.length - 1 && !willRequeue;
    final progress = (_index + 1) / deck.length;

    // Theory/media advance freely; a quiz must be answered and checked.
    final canAdvance = !isQuiz || _checked;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmExit(context);
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.close_rounded),
            tooltip: s.t('lesson.exit'),
            onPressed: () => _confirmExit(context),
          ),
          title: ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 10,
              backgroundColor: tokens.cardAlt,
              valueColor: const AlwaysStoppedAnimation(AppColors.success),
            ),
          ),
          titleSpacing: 0,
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: Gap.lg),
              child: Center(
                child: Text('${_index + 1}/${deck.length}',
                    style: Theme.of(context).textTheme.labelSmall),
              ),
            ),
          ],
        ),
        body: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(Gap.xl),
                  child: switch (card.type) {
                    CardType.quiz => _QuizCard(
                        card: card,
                        locale: locale,
                        selected: _selected,
                        checked: _checked,
                        onSelect: (i) => setState(() => _selected = i),
                      ),
                    _ => _ContentCard(card: card, locale: locale),
                  },
                ),
              ),
              _Footer(
                isQuiz: isQuiz,
                checked: _checked,
                correct: _selected == card.answerIndex,
                canSubmit: isQuiz ? _selected != null : true,
                canAdvance: canAdvance,
                isLast: isLast,
                submitting: _submitting,
                error: _submitError,
                correctAnswerText: localizedContent(
                  card.options.length > card.answerIndex ? card.options[card.answerIndex] : null,
                  locale,
                ),
                explanationText: localizedContent(card.explanation, locale),
                onCheck: () {
                  final isCorrect = _selected == card.answerIndex;
                  isCorrect ? Haptics.success() : Haptics.error();
                  setState(() {
                    _checked = true;
                    if (!isCorrect) {
                      _mistakes++;
                      _missed.add(lesson.cards.indexOf(card));
                    }
                  });
                },
                onNext: () {
                  // Re-queue a missed question to the end of the deck, then
                  // advance. Only truly finish when nothing is left to retry.
                  final wrong = card.type == CardType.quiz &&
                      _selected != card.answerIndex;
                  if (wrong) deck.add(card);
                  if (_index < deck.length - 1) {
                    setState(() {
                      _index++;
                      _selected = null;
                      _checked = false;
                    });
                  } else {
                    _submit(lesson);
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _confirmExit(BuildContext context) async {
    final s = StringsScope.of(context);
    final leave = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: Text(s.t('lesson.exitConfirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(s.t('common.cancel')),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(s.t('lesson.exit'),
                style: const TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (leave == true && context.mounted) Navigator.of(context).pop();
  }

  Future<void> _submit(Lesson lesson) async {
    setState(() {
      _submitting = true;
      _submitError = null;
    });

    try {
      final api = ref.read(apiClientProvider);
      final result = await api.completeLesson(
        lessonId: lesson.id,
        mistakes: _mistakes,
      );
      var state = result.state;

      // Mirror the web flow (LessonPage.jsx): propose the achievement ids
      // this lesson may have unlocked; the server re-derives which actually
      // qualify and grants their XP (it never trusts a client-sent xp). Then
      // reflect the granted state and surface the new badges on the result.
      final content = ref.read(contentProvider).value;
      var earned = const <Achievement>[];
      if (content != null) {
        final ids = checkNewAchievements(
          state: state,
          all: content.achievements,
          totalLessons: content.totalLessons,
          rewardPerfect: result.reward.perfect,
          rewardIsReview: result.reward.isReview,
        );
        if (ids.isNotEmpty) {
          try {
            state = await api.patchState({'achievements': ids});
          } catch (_) {
            // Non-fatal — the lesson itself already counted server-side.
          }
          earned = [
            for (final id in ids)
              for (final a in content.achievements)
                if (a.id == id) a,
          ];
        }
      }

      ref.read(authProvider.notifier).applyState(state);
      if (mounted) {
        setState(() {
          _reward = result.reward;
          _earnedAchievements = earned;
        });
        // A review earns nothing, so it doesn't get the celebration either
        // — firing confetti over a 0-XP screen would read as a glitch, not
        // a win. Deferred a frame so ConfettiOverlay is already mounted.
        if (!result.reward.isReview) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            Haptics.celebrate();
            _confetti.play();
          });
        }
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      final s = StringsScope.of(context);
      setState(() => _submitError = switch (e.kind) {
            ApiErrorKind.offline => s.t('common.offline'),
            ApiErrorKind.timeout || ApiErrorKind.server => s.t('common.serverError'),
            _ => e.message,
          });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}

class _ContentCard extends StatelessWidget {
  const _ContentCard({required this.card, required this.locale});

  final LessonCard card;
  final AppLocale locale;

  @override
  Widget build(BuildContext context) {
    final title = localizedContent(card.title, locale);
    final body = localizedContent(card.body, locale);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (card.imageUrl != null) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: CachedNetworkImage(
              imageUrl: card.imageUrl!,
              width: double.infinity,
              fit: BoxFit.cover,
              placeholder: (_, __) => const SkeletonBox(height: 200, radius: 20),
              errorWidget: (_, __, ___) => const SizedBox.shrink(),
            ),
          ),
          const SizedBox(height: Gap.xl),
        ],
        if (title.isNotEmpty) ...[
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: Gap.md),
        ],
        if (body.isNotEmpty)
          Text(body, style: Theme.of(context).textTheme.bodyLarge),
      ],
    );
  }
}

class _QuizCard extends StatelessWidget {
  const _QuizCard({
    required this.card,
    required this.locale,
    required this.selected,
    required this.checked,
    required this.onSelect,
  });

  final LessonCard card;
  final AppLocale locale;
  final int? selected;
  final bool checked;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (card.imageUrl != null) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: CachedNetworkImage(
              imageUrl: card.imageUrl!,
              width: double.infinity,
              fit: BoxFit.cover,
              placeholder: (_, __) => const SkeletonBox(height: 180, radius: 20),
              errorWidget: (_, __, ___) => const SizedBox.shrink(),
            ),
          ),
          const SizedBox(height: Gap.xl),
        ],
        Text(
          localizedContent(card.question, locale),
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: Gap.xl),
        for (var i = 0; i < card.options.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: Gap.md),
            child: _Option(
              text: localizedContent(card.options[i], locale),
              // After checking, the right answer is always revealed — even
              // when the learner picked something else — so a wrong answer
              // teaches rather than just scoring.
              state: !checked
                  ? (selected == i ? _OptionState.selected : _OptionState.idle)
                  : i == card.answerIndex
                      ? _OptionState.correct
                      : (selected == i ? _OptionState.wrong : _OptionState.idle),
              onTap: checked ? null : () => onSelect(i),
              tokens: tokens,
            ),
          ),
      ],
    );
  }
}

enum _OptionState { idle, selected, correct, wrong }

class _Option extends StatelessWidget {
  const _Option({
    required this.text,
    required this.state,
    required this.onTap,
    required this.tokens,
  });

  final String text;
  final _OptionState state;
  final VoidCallback? onTap;
  final dynamic tokens;

  @override
  Widget build(BuildContext context) {
    final (border, bg, fg, icon) = switch (state) {
      _OptionState.idle => (tokens.border as Color, Colors.transparent, tokens.text as Color, null),
      _OptionState.selected => (AppColors.primary, AppColors.primary.withValues(alpha: 0.1), tokens.text as Color, null),
      _OptionState.correct => (AppColors.success, AppColors.success.withValues(alpha: 0.12), AppColors.success, Icons.check_circle_rounded),
      _OptionState.wrong => (AppColors.danger, AppColors.danger.withValues(alpha: 0.12), AppColors.danger, Icons.cancel_rounded),
    };

    return Semantics(
      button: onTap != null,
      selected: state == _OptionState.selected,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          constraints: const BoxConstraints(minHeight: 56),
          padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: Gap.md),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: border, width: 2),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  text,
                  style: Theme.of(context)
                      .textTheme
                      .bodyLarge
                      ?.copyWith(color: fg, fontWeight: FontWeight.w600),
                ),
              ),
              if (icon != null) Icon(icon, color: fg),
            ],
          ),
        ),
      ),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({
    required this.isQuiz,
    required this.checked,
    required this.correct,
    required this.canSubmit,
    required this.canAdvance,
    required this.isLast,
    required this.submitting,
    required this.error,
    required this.correctAnswerText,
    required this.explanationText,
    required this.onCheck,
    required this.onNext,
  });

  final bool isQuiz;
  final bool checked;
  final bool correct;
  final bool canSubmit;
  final bool canAdvance;
  final bool isLast;
  final bool submitting;
  final String? error;
  final String correctAnswerText;
  final String explanationText;
  final VoidCallback onCheck;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: checked
            ? (correct
                ? AppColors.success.withValues(alpha: 0.12)
                : AppColors.danger.withValues(alpha: 0.12))
            : tokens.bg,
        border: Border(top: BorderSide(color: tokens.border)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (checked) ...[
              Row(
                children: [
                  Icon(
                    correct ? Icons.check_circle_rounded : Icons.cancel_rounded,
                    color: correct ? AppColors.success : AppColors.danger,
                  ),
                  const SizedBox(width: Gap.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          correct ? s.t('lesson.correct') : s.t('lesson.wrong'),
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                color: correct ? AppColors.success : AppColors.danger,
                              ),
                        ),
                        if (!correct && correctAnswerText.isNotEmpty)
                          Text(
                            '${s.t('lesson.correctAnswer')} $correctAnswerText',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              if (explanationText.isNotEmpty) ...[
                const SizedBox(height: Gap.md),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(Gap.md),
                  decoration: BoxDecoration(
                    color: tokens.card,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: tokens.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        s.t('lesson.explanation').toUpperCase(),
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: tokens.muted,
                              letterSpacing: 1,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(explanationText,
                          style: Theme.of(context).textTheme.bodyMedium),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: Gap.md),
            ],
            if (error != null) ...[
              Text(
                error!,
                textAlign: TextAlign.center,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: AppColors.danger),
              ),
              const SizedBox(height: Gap.md),
            ],
            FilledButton(
              onPressed: submitting
                  ? null
                  : isQuiz && !checked
                      ? (canSubmit ? onCheck : null)
                      : (canAdvance ? onNext : null),
              style: FilledButton.styleFrom(
                backgroundColor: checked && !correct ? AppColors.danger : AppColors.success,
              ),
              child: submitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                    )
                  : Text(
                      isQuiz && !checked
                          ? s.t('lesson.check')
                          : isLast
                              ? s.t('lesson.complete')
                              : s.t('lesson.continue'),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResultView extends ConsumerWidget {
  const _ResultView({
    required this.reward,
    required this.lesson,
    required this.totalQuestions,
    required this.correctCount,
    required this.earnedAchievements,
  });

  final LessonReward reward;
  final Lesson lesson;
  final int totalQuestions;
  final int correctCount;
  final List<Achievement> earnedAchievements;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;
    final locale = ref.watch(localeProvider);
    final perfect = reward.perfect;
    final allCorrect = totalQuestions > 0 && correctCount >= totalQuestions;
    final haloColor = perfect ? AppColors.gold : AppColors.success;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Gap.xl),
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: Gap.xl),
                      // Icon medallion with a soft glow — Trophy for a
                      // flawless run, a filled check otherwise — popped in
                      // with an elastic scale.
                      Center(
                        child: TweenAnimationBuilder<double>(
                          tween: Tween(begin: 0, end: 1),
                          duration: const Duration(milliseconds: 500),
                          curve: Curves.elasticOut,
                          builder: (_, v, child) =>
                              Transform.scale(scale: v, child: child),
                          child: Container(
                            width: 104,
                            height: 104,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: haloColor,
                              boxShadow: [
                                BoxShadow(
                                  color: haloColor.withValues(alpha: 0.4),
                                  blurRadius: 32,
                                  spreadRadius: 2,
                                ),
                              ],
                            ),
                            child: Center(
                              child: Icon(
                                perfect ? Icons.emoji_events_rounded : Icons.check_circle_rounded,
                                color: Colors.white,
                                size: 50,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: Gap.xl),
                      Text(
                        perfect
                            ? s.t('lesson.resultPerfect')
                            : s.t('lesson.resultGood'),
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.displaySmall,
                      ),
                      const SizedBox(height: Gap.sm),
                      Text(
                        reward.isReview
                            ? s.t('lesson.reviewDone')
                            : s.t('lesson.lessonDone'),
                        textAlign: TextAlign.center,
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(color: tokens.muted),
                      ),
                      if (totalQuestions > 0) ...[
                        const SizedBox(height: Gap.xxl),
                        _AccuracyBar(
                          label: s.t('lesson.accuracyLabel'),
                          correct: correctCount,
                          total: totalQuestions,
                          allCorrect: allCorrect,
                          tokens: tokens,
                        ),
                      ],
                      if (!reward.isReview) ...[
                        const SizedBox(height: Gap.xxl),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            _RewardTile(
                              icon: Icons.star_rounded,
                              color: AppColors.primary,
                              label: 'XP',
                              count: reward.xp,
                              delay: const Duration(milliseconds: 280),
                            ),
                            const SizedBox(width: Gap.lg),
                            _RewardTile(
                              icon: Icons.monetization_on_rounded,
                              color: AppColors.gold,
                              label: s.t('profile.coins'),
                              count: reward.coins,
                              delay: const Duration(milliseconds: 440),
                            ),
                          ],
                        ),
                        if (perfect) ...[
                          const SizedBox(height: Gap.lg),
                          Center(
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: Gap.lg, vertical: 6),
                              decoration: BoxDecoration(
                                color: AppColors.success.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                    color: AppColors.success.withValues(alpha: 0.4)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.verified_rounded,
                                      color: AppColors.success, size: 16),
                                  const SizedBox(width: 6),
                                  Text(
                                    s.t('lesson.perfectBadge'),
                                    style: Theme.of(context)
                                        .textTheme
                                        .labelMedium
                                        ?.copyWith(
                                          color: AppColors.success,
                                          fontWeight: FontWeight.w800,
                                        ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ],
                      if (earnedAchievements.isNotEmpty) ...[
                        const SizedBox(height: Gap.xxl),
                        Text(
                          s.t('lesson.newAchievement').toUpperCase(),
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: tokens.muted,
                                letterSpacing: 1,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                        const SizedBox(height: Gap.md),
                        for (final a in earnedAchievements) ...[
                          _AchievementRow(achievement: a, tokens: tokens, locale: locale),
                          const SizedBox(height: Gap.sm),
                        ],
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: Gap.md),
              FilledButton(
                onPressed: () {
                  // Content is unchanged by finishing a lesson, but the path's
                  // lock states come from user progress, which just moved.
                  ref.read(authProvider.notifier).refreshMe();
                  Navigator.of(context).pop();
                },
                child: Text(s.t('lesson.continue')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AccuracyBar extends StatelessWidget {
  const _AccuracyBar({
    required this.label,
    required this.correct,
    required this.total,
    required this.allCorrect,
    required this.tokens,
  });

  final String label;
  final int correct;
  final int total;
  final bool allCorrect;
  final dynamic tokens;

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? (correct / total) : 0.0;
    final color = allCorrect ? AppColors.success : AppColors.primary;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label.toUpperCase(),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tokens.muted,
                    letterSpacing: 1,
                    fontWeight: FontWeight.w700,
                  ),
            ),
            Text(
              '$correct/$total · ${(pct * 100).round()}%',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: allCorrect ? AppColors.success : tokens.text,
                    fontWeight: FontWeight.w800,
                  ),
            ),
          ],
        ),
        const SizedBox(height: Gap.sm),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: pct),
            duration: const Duration(milliseconds: 600),
            curve: Curves.easeOut,
            builder: (_, v, __) => LinearProgressIndicator(
              value: v,
              minHeight: 10,
              backgroundColor: tokens.cardAlt,
              valueColor: AlwaysStoppedAnimation(color),
            ),
          ),
        ),
      ],
    );
  }
}

class _AchievementRow extends StatelessWidget {
  const _AchievementRow({required this.achievement, required this.tokens, required this.locale});

  final Achievement achievement;
  final dynamic tokens;
  final AppLocale locale;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Gap.md),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            clipBehavior: Clip.antiAlias,
            child: achievement.iconUrl != null
                ? CachedNetworkImage(
                    imageUrl: achievement.iconUrl!,
                    fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => const Icon(
                        Icons.emoji_events_rounded,
                        color: AppColors.gold,
                        size: 20),
                  )
                : const Icon(Icons.emoji_events_rounded,
                    color: AppColors.gold, size: 20),
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(localizedContent(achievement.title, locale),
                    style: Theme.of(context).textTheme.titleSmall),
                if (localizedContent(achievement.description, locale).isNotEmpty || achievement.xp > 0)
                  Text(
                    achievement.xp > 0
                        ? '${localizedContent(achievement.description, locale)} · +${achievement.xp} XP'
                        : localizedContent(achievement.description, locale),
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: tokens.muted),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RewardTile extends StatelessWidget {
  const _RewardTile({
    required this.icon,
    required this.color,
    required this.label,
    required this.count,
    this.delay = Duration.zero,
  });

  final IconData icon;
  final Color color;
  final String label;
  final int count;
  final Duration delay;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      width: 120,
      padding: const EdgeInsets.symmetric(vertical: Gap.lg),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(height: Gap.sm),
          CountUpNumber(
            value: count,
            prefix: '+',
            delay: delay,
            style: Theme.of(context)
                .textTheme
                .headlineSmall
                ?.copyWith(color: tokens.text),
          ),
          Text(label, style: Theme.of(context).textTheme.labelSmall),
        ],
      ),
    );
  }
}
