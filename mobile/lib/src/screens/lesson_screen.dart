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
import '../core/i18n.dart';
import '../core/theme.dart';
import '../models/content.dart';
import '../models/user_state.dart';
import '../state/providers.dart';
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

  /// Null until the learner commits to an answer on the current quiz card.
  int? _selected;
  bool _checked = false;

  bool _submitting = false;
  LessonReward? _reward;
  String? _submitError;

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
        return _reward != null
            ? _ResultView(reward: _reward!, lesson: lesson)
            : _buildPlayer(context, lesson);
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

    final card = lesson.cards[_index];
    final isQuiz = card.type == CardType.quiz;
    final isLast = _index == lesson.cards.length - 1;
    final progress = (_index + 1) / lesson.cards.length;

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
                child: Text('${_index + 1}/${lesson.cards.length}',
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
                onCheck: () {
                  setState(() {
                    _checked = true;
                    if (_selected != card.answerIndex) _mistakes++;
                  });
                },
                onNext: () {
                  if (isLast) {
                    _submit(lesson);
                  } else {
                    setState(() {
                      _index++;
                      _selected = null;
                      _checked = false;
                    });
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
      ref.read(authProvider.notifier).applyState(result.state);
      if (mounted) setState(() => _reward = result.reward);
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
  const _ResultView({required this.reward, required this.lesson});

  final LessonReward reward;
  final Lesson lesson;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Gap.xl),
          child: Column(
            children: [
              const Spacer(),
              Container(
                width: 96,
                height: 96,
                decoration: const BoxDecoration(
                  color: AppColors.success,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_rounded, size: 52, color: Colors.white),
              ),
              const SizedBox(height: Gap.xl),
              Text(s.t('lesson.complete'),
                  style: Theme.of(context).textTheme.displaySmall),
              const SizedBox(height: Gap.sm),
              Text(lesson.title,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: tokens.muted)),
              const SizedBox(height: Gap.xxl),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _RewardTile(
                    icon: Icons.star_rounded,
                    color: AppColors.primary,
                    label: 'XP',
                    value: '+${reward.xp}',
                  ),
                  const SizedBox(width: Gap.lg),
                  _RewardTile(
                    icon: Icons.monetization_on_rounded,
                    color: AppColors.gold,
                    label: s.t('profile.coins'),
                    value: '+${reward.coins}',
                  ),
                ],
              ),
              const Spacer(),
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

class _RewardTile extends StatelessWidget {
  const _RewardTile({
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
          Text(value,
              style: Theme.of(context)
                  .textTheme
                  .headlineSmall
                  ?.copyWith(color: tokens.text)),
          Text(label, style: Theme.of(context).textTheme.labelSmall),
        ],
      ),
    );
  }
}
