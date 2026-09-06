/// Lesson player — port of src/pages/LessonPage.jsx.
///
/// A lesson is an ordered deck of cards: theory (read), media (look) and the
/// graded three — quiz (pick the option), match (tap the pairs), build
/// (assemble the sentence). Only a graded card can be got wrong, and the
/// mistake count is what the server turns into a reward.
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_client.dart';
import '../core/haptics.dart';
import '../core/i18n.dart';
import '../core/logic.dart';
import '../core/routes.dart';
import '../core/sounds.dart';
import '../core/theme.dart';
import '../models/content.dart';
import '../models/user_state.dart';
import '../state/providers.dart';
import '../widgets/confetti.dart';
import '../widgets/count_up.dart';
import '../widgets/match_pairs_card.dart';
import '../widgets/reward_burst.dart';
import '../widgets/ticking_number.dart';
import '../widgets/states.dart';
import '../widgets/zoomable_image.dart';
import '../widgets/word_bank_card.dart';

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

  /// The option tapped on a quiz card, null until one is. Match and build
  /// cards keep their working state inside their own widget and report
  /// upward through [_answerReady] / [_pendingCorrect].
  int? _selected;

  /// Whether the current card's answer is committed, and how it was graded.
  /// Every graded type funnels through [_commit], so these two drive the
  /// banner, the re-queue and the button label whatever the card is.
  bool _checked = false;
  bool _correct = false;

  /// Reported by a build card as the learner assembles: whether the footer's
  /// Check button may fire, and the verdict it would commit. A match card
  /// needs neither — it commits itself the moment its last pair locks.
  bool _answerReady = false;
  bool _pendingCorrect = false;

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

  // ── Reward burst ─────────────────────────────────────────────────────
  // The HUD counters are optimistic: XP and coins are only actually awarded
  // when the lesson completes, so these mirror the server's own formula
  // (contentStore.js#limits) closely enough for a live readout and are then
  // replaced by the real numbers on the result screen.
  final _burst = RewardBurstController();
  final _coinChipKey = GlobalKey();
  final _xpChipKey = GlobalKey();
  final _cardAreaKey = GlobalKey();
  int _sessionXp = 0;
  int _sessionCoins = 0;

  /// Analytics is fire-and-forget, but "started" has to be written exactly
  /// once per visit or the admin's funnel over-counts. The web guards this
  /// the same way (LessonPage.jsx#startLogged).
  bool _startLogged = false;

  @override
  void initState() {
    super.initState();
    // Post-frame so the provider read happens outside the build phase.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _startLogged) return;
      _startLogged = true;
      ref.read(apiClientProvider)
          .logEvent('lesson_start', {'lessonId': widget.lessonId});
    });
  }

  @override
  void dispose() {
    _confetti.dispose();
    _burst.dispose();
    super.dispose();
  }

  /// Centre of a laid-out widget in global coordinates, or null if it isn't
  /// on screen — a burst with no target is simply skipped.
  Offset? _centreOf(GlobalKey key) {
    final box = key.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return null;
    return box.localToGlobal(box.size.center(Offset.zero));
  }

  /// Coins fly to the coin chip, XP badges to the XP chip, and the counters
  /// tick up. A review earns nothing, so it gets the chime but no burst —
  /// flying coins that credit nobody would be a lie.
  /// The lesson that follows this one in the flat course order — the same
  /// order the path is drawn from (logic.dart#getLessonOrder).
  ///
  /// Null when the course ends here, when this was a review (which earns
  /// nothing and is entered from the path), or when there is no energy left:
  /// a button that lands on the "come back tomorrow" screen is worse than no
  /// button at all.
  String? _nextLessonId(AppContent data) {
    if (_reward?.isReview ?? false) return null;

    final order = getLessonOrder(data.modules);
    final at = order.indexOf(widget.lessonId);
    if (at < 0 || at + 1 >= order.length) return null;

    final remaining = computeLiveEnergy(
      ref.read(userStateProvider),
      dailyFreeLessons: data.limits.dailyFreeLessons,
      energyRefillHours: data.limits.energyRefillHours,
    ).remaining;
    if (remaining <= 0) return null;

    return order[at + 1];
  }

  void _fireRewardBurst(ContentLimits? limits) {
    final coinGoal = _mistakes == 0
        ? (limits?.coinsPerfectLesson ?? 10)
        : (limits?.coinsNormalLesson ?? 5);
    setState(() {
      _sessionXp += limits?.xpPerQuestion ?? 10;
      _sessionCoins = (_sessionCoins + 1).clamp(0, coinGoal);
    });

    final origin = _centreOf(_cardAreaKey);
    final coin = _centreOf(_coinChipKey);
    final xp = _centreOf(_xpChipKey);
    if (origin == null || coin == null || xp == null) return;
    _burst.play(origin: origin, coinTarget: coin, xpTarget: xp);
  }

  @override
  Widget build(BuildContext context) {
    final content = ref.watch(contentProvider);
    // Read once for the whole method: the result screen needs it to count
    // the questions the same way the player counted them.
    final locale = ref.watch(localeProvider);

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
          // Counted with the same predicate the player uses to decide what
          // is answerable (_isPlayable). Counting every graded card instead
          // let a card that could not be played in this locale inflate the
          // denominator, so it read on the result screen as one more
          // question the learner had got right without ever seeing it.
          final totalQuiz = lesson.cards
              .where((c) => c.isGraded && _isPlayable(c, locale))
              .length;
          return ConfettiOverlay(
            controller: _confetti,
            child: _ResultView(
              reward: _reward!,
              lesson: lesson,
              totalQuestions: totalQuiz,
              correctCount: (totalQuiz - _missed.length).clamp(0, totalQuiz),
              earnedAchievements: _earnedAchievements,
              nextLessonId: _nextLessonId(data),
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
    final st = ref.watch(userStateProvider);
    final limits = ref.watch(contentProvider).valueOrNull?.limits;

    // A finished lesson can only be replayed as a review, which earns
    // nothing — the server enforces the same rule (routes.js#/u/me/lesson).
    final alreadyDone = st?.completedSet.contains(lesson.id) ?? false;

    // Optimistic during the lesson, replaced by the server's numbers the
    // moment the result screen mounts.
    final liveCoins = (st?.coins ?? 0) + _sessionCoins;
    // The lifetime total, not either league's score: this chip has to
    // climb whether the points land on the general board or a campus one
    // (admin-api/routes.js#awardXp).
    final liveXp = (st?.lifetimeXp ?? 0) + _sessionXp;
    final liveEnergy = computeLiveEnergy(
      st,
      dailyFreeLessons: limits?.dailyFreeLessons ?? 3,
      energyRefillHours: limits?.energyRefillHours ?? kDefaultRefillHours,
    ).remaining;

    final deck = _deck ??= List.of(lesson.cards);
    final card = deck[_index];

    // Graded means "can be got wrong" — but only while the card is playable
    // in this locale. A match card with no usable pairs, or a build card
    // with no sentence, would otherwise strand the learner behind a Check
    // button that can never enable, so a half-authored one reads through.
    final graded = card.isGraded && _isPlayable(card, locale);

    // A wrong answer re-queues, so this is not truly the last step even when
    // it's the last deck slot — keep the button on "Continue".
    final willRequeue = _checked && !_correct;
    final isLast = _index == deck.length - 1 && !willRequeue;
    final progress = (_index + 1) / deck.length;

    // Theory/media advance freely; a graded card must be answered first.
    final canAdvance = !graded || _checked;

    // What it takes to enable the Check button. A match card grades itself
    // as the last pair locks, so it never has anything for the button to do.
    final canSubmit = switch (card.type) {
      CardType.quiz => _selected != null,
      CardType.build => _answerReady,
      CardType.match => false,
      _ => true,
    };

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
          child: RewardBurstOverlay(
            controller: _burst,
            child: Column(
            children: [
              // Live counters — the targets the reward burst flies into,
              // which is why they live here rather than only in the app
              // header (which the lesson player replaces).
              _LessonHud(
                coins: liveCoins,
                energy: liveEnergy,
                xp: liveXp,
                coinKey: _coinChipKey,
                xpKey: _xpChipKey,
              ),
              Expanded(
                child: SingleChildScrollView(
                  key: _cardAreaKey,
                  padding: const EdgeInsets.all(Gap.xl),
                  child: switch (card.type) {
                    CardType.quiz => _QuizCard(
                        card: card,
                        locale: locale,
                        slot: _index,
                        selected: _selected,
                        checked: _checked,
                        onSelect: (i) => setState(() => _selected = i),
                      ),
                    // Keyed by deck slot: both of these shuffle once in
                    // initState, so they have to re-mount when the deck
                    // moves on — including onto a re-queued second sitting
                    // of the very same card, which must start unsolved.
                    CardType.match => MatchPairsCard(
                        key: ValueKey('match-$_index-${locale.code}'),
                        card: card,
                        locale: locale,
                        checked: _checked,
                        onComplete: (isCorrect) => _commit(
                          lesson: lesson,
                          card: card,
                          isCorrect: isCorrect,
                          alreadyDone: alreadyDone,
                          limits: limits,
                        ),
                      ),
                    CardType.build => WordBankCard(
                        key: ValueKey('build-$_index-${locale.code}'),
                        card: card,
                        locale: locale,
                        checked: _checked,
                        correct: _correct,
                        onChanged: (ready, isCorrect) => setState(() {
                          _answerReady = ready;
                          _pendingCorrect = isCorrect;
                        }),
                      ),
                    CardType.media =>
                      _MediaCard(card: card, locale: locale, slot: _index),
                    _ => _ContentCard(card: card, locale: locale, slot: _index),
                  },
                ),
              ),
              _Footer(
                graded: graded,
                checked: _checked,
                correct: _correct,
                canSubmit: canSubmit,
                canAdvance: canAdvance,
                isLast: isLast,
                submitting: _submitting,
                error: _submitError,
                // What the banner reveals under "Correct answer:". A match
                // card is left out on purpose: by the time it commits, every
                // pair is locked on screen already, and restating the grid
                // as a line of text would be noise.
                correctAnswerText: switch (card.type) {
                  CardType.quiz => localizedContent(
                      card.answerIndex >= 0 &&
                              card.answerIndex < card.options.length
                          ? card.options[card.answerIndex]
                          : null,
                      locale,
                    ),
                  CardType.build => localizedContent(card.sentence, locale),
                  _ => '',
                },
                explanationText: localizedContent(card.explanation, locale),
                onCheck: () => _commit(
                  lesson: lesson,
                  card: card,
                  // Quiz grades itself from the tapped option; build reports
                  // its verdict up as the learner assembles.
                  isCorrect: card.type == CardType.quiz
                      ? _selected == card.answerIndex
                      : _pendingCorrect,
                  alreadyDone: alreadyDone,
                  limits: limits,
                ),
                onNext: () {
                  // Re-queue a missed card to the end of the deck, then
                  // advance. Only truly finish when nothing is left to retry.
                  if (_checked && !_correct) deck.add(card);
                  if (_index < deck.length - 1) {
                    setState(() {
                      _index++;
                      _selected = null;
                      _checked = false;
                      _correct = false;
                      _answerReady = false;
                      _pendingCorrect = false;
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
      ),
    );
  }

  /// Whether a graded card has enough authored content to be answerable in
  /// [locale]. The admin adds a card first and fills it in after, so the app
  /// can fetch a half-written one; the alternative to this check is a lesson
  /// nobody can get past.
  bool _isPlayable(LessonCard card, AppLocale locale) => switch (card.type) {
        CardType.quiz => card.options.isNotEmpty,
        CardType.match => playablePairs(card, locale).isNotEmpty,
        CardType.build => answerWords(card, locale).isNotEmpty,
        _ => false,
      };

  /// Commits the current card's verdict.
  ///
  /// The single path every graded card lands in — quiz from the Check
  /// button, build from the same button once its tiles are placed, match
  /// from its own last locking pair — so the mistake count, the analytics
  /// event, the sounds and the reward burst can never diverge between card
  /// types. Guarded against a second call because match commits from a
  /// timer, which can land after the learner has already moved on.
  void _commit({
    required Lesson lesson,
    required LessonCard card,
    required bool isCorrect,
    required bool alreadyDone,
    required ContentLimits? limits,
  }) {
    if (_checked) return;

    isCorrect ? Haptics.success() : Haptics.error();
    final soundOn = ref.read(userStateProvider)?.settings.sound ?? true;
    if (soundOn) {
      // A review pays nothing per question — the flat rate is settled once,
      // when the lesson is handed in. Chiming at every right answer promised
      // a reward that never arrived, so a replay stays silent on the way
      // through. A mistake still says so: that is feedback, not a payout.
      if (!isCorrect) {
        Sounds.wrong();
      } else if (!alreadyDone) {
        Sounds.correct();
      }
    }
    // Keyed on the card's position in the authored lesson, not in the live
    // deck — a re-queued card has to land on the same heatmap row as its
    // first attempt (events.js keys on `lessonId::questionIndex`).
    ref.read(apiClientProvider).logEvent('question_answered', {
      'lessonId': lesson.id,
      'questionIndex': lesson.cards.indexOf(card),
      'correct': isCorrect,
    });
    setState(() {
      _checked = true;
      _correct = isCorrect;
      if (!isCorrect) {
        _mistakes++;
        _missed.add(lesson.cards.indexOf(card));
      }
    });
    if (isCorrect && !alreadyDone) {
      if (soundOn) {
        // Layered over the "correct" chime rather than replacing it — the
        // short delay is what lets both be heard, and it is the same 190ms
        // the web uses (LessonPage.jsx#REWARD_DELAY_MS).
        Future<void>.delayed(
          const Duration(milliseconds: 190),
          Sounds.reward,
        );
      }
      _fireRewardBurst(limits);
    }
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
        // The celebration follows the payout, not the lesson type: a review
        // earns a flat XP rate now and deserves the same confetti. It stays
        // silent only when nothing at all was earned, where it would read as
        // a glitch. Deferred a frame so ConfettiOverlay is already mounted.
        if (result.reward.xp > 0 || result.reward.coins > 0) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            Haptics.celebrate();
            if (ref.read(userStateProvider)?.settings.sound ?? true) {
              Sounds.lessonComplete();
            }
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
  const _ContentCard({
    required this.card,
    required this.locale,
    required this.slot,
  });

  final LessonCard card;
  final AppLocale locale;

  /// Position in the deck. Only ever one card is on screen, but a card
  /// transition briefly mounts two — and two heroes sharing a tag is a
  /// crash, so the tag carries the slot.
  final int slot;

  @override
  Widget build(BuildContext context) {
    final title = localizedContent(card.title, locale);
    final body = localizedContent(card.body, locale);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (card.imageUrl != null) ...[
          ZoomableImage(
            imageUrl: card.imageUrl!,
            tag: 'lesson-content-$slot',
            caption: body,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: CachedNetworkImage(
                imageUrl: card.imageUrl!,
                width: double.infinity,
                fit: BoxFit.cover,
                placeholder: (_, __) => const SkeletonBox(height: 200, radius: 20),
                errorWidget: (_, __, ___) => const SizedBox.shrink(),
              ),
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

/// A `media` card — the twin of the web's media branch in
/// src/pages/LessonPage.jsx. An image renders inline; a video opens in the
/// system player, because bundling a video engine for the handful of clips a
/// lesson carries is a large native dependency for a small feature.
class _MediaCard extends StatelessWidget {
  const _MediaCard({
    required this.card,
    required this.locale,
    required this.slot,
  });

  final LessonCard card;
  final AppLocale locale;

  /// Position in the deck — see _ContentCard.slot.
  final int slot;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final title = localizedContent(card.title, locale);
    final caption = localizedContent(card.caption, locale);
    final url = card.url;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title.isNotEmpty) ...[
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: Gap.md),
        ],
        if (url != null && url.isNotEmpty) ...[
          // Video keeps its own player controls — only a still picture has
          // anything more to show full-screen.
          _MaybeZoom(
            enabled: !card.isVideo,
            imageUrl: url,
            tag: 'lesson-media-$slot',
            caption: caption,
            child: ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: card.isVideo
                ? _VideoPoster(url: url, tokens: tokens)
                : CachedNetworkImage(
                    imageUrl: url,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    placeholder: (_, __) =>
                        const SkeletonBox(height: 220, radius: 20),
                    // A broken link should not read as a broken app: the
                    // caption below still carries the point of the card.
                    errorWidget: (_, __, ___) =>
                        _MediaFallback(tokens: tokens, isVideo: false),
                  ),
          ),
          ),
          const SizedBox(height: Gap.lg),
        ],
        if (caption.isNotEmpty)
          Text(caption, style: Theme.of(context).textTheme.bodyLarge),
      ],
    );
  }
}

class _VideoPoster extends StatelessWidget {
  const _VideoPoster({required this.url, required this.tokens});

  final String url;
  final dynamic tokens;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        Haptics.tap();
        final uri = Uri.tryParse(url);
        if (uri == null) return;
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      },
      child: Container(
        height: 200,
        width: double.infinity,
        color: tokens.bg,
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.play_circle_fill_rounded,
                size: 56, color: tokens.muted),
            const SizedBox(height: Gap.sm),
            Text(
              StringsScope.of(context).t('lesson.playVideo'),
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: tokens.muted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MediaFallback extends StatelessWidget {
  const _MediaFallback({required this.tokens, required this.isVideo});

  final dynamic tokens;
  final bool isVideo;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 160,
      width: double.infinity,
      color: tokens.bg,
      alignment: Alignment.center,
      child: Icon(
        isVideo ? Icons.videocam_off_rounded : Icons.image_not_supported_rounded,
        size: 40,
        color: tokens.muted,
      ),
    );
  }
}

class _QuizCard extends StatelessWidget {
  const _QuizCard({
    required this.card,
    required this.locale,
    required this.slot,
    required this.selected,
    required this.checked,
    required this.onSelect,
  });

  final LessonCard card;
  final AppLocale locale;

  /// Position in the deck — see _ContentCard.slot.
  final int slot;
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
          ZoomableImage(
            imageUrl: card.imageUrl!,
            tag: 'lesson-quiz-$slot',
            caption: localizedContent(card.question, locale),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: CachedNetworkImage(
                imageUrl: card.imageUrl!,
                width: double.infinity,
                fit: BoxFit.cover,
                placeholder: (_, __) => const SkeletonBox(height: 180, radius: 20),
                errorWidget: (_, __, ___) => const SizedBox.shrink(),
              ),
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
    required this.graded,
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

  /// True for a card that can be got wrong — the button says "Check" until
  /// the answer is committed. Not "is a quiz": match and build grade too.
  final bool graded;
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
                  : graded && !checked
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
                      graded && !checked
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
    this.nextLessonId,
  });

  final LessonReward reward;
  final Lesson lesson;
  final int totalQuestions;
  final int correctCount;
  final List<Achievement> earnedAchievements;

  /// The lesson that follows this one, or null when the course ends here,
  /// this was a review, or there is no energy left to play another.
  final String? nextLessonId;

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
                      // Shown whenever anything was earned, not "unless this
                      // was a review": a review pays a flat XP rate now, and
                      // hiding the row made it look like it had paid nothing.
                      if (reward.xp > 0 || reward.coins > 0) ...[
                        const SizedBox(height: Gap.xxl),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if (reward.xp > 0)
                              _RewardTile(
                                icon: Icons.star_rounded,
                                color: AppColors.primary,
                                label: 'XP',
                                count: reward.xp,
                                delay: const Duration(milliseconds: 280),
                              ),
                            // A review pays XP but no coins, so a "+0" tile
                            // beside it would read as a failure rather than
                            // as the rule.
                            if (reward.xp > 0 && reward.coins > 0)
                              const SizedBox(width: Gap.lg),
                            if (reward.coins > 0)
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
              // Straight into the next lesson is what someone on a roll
              // actually wants; going back to the path is the second choice,
              // not the only one. Mirrors the web (LessonPage.jsx).
              if (nextLessonId != null) ...[
                FilledButton(
                  onPressed: () {
                    // The path's lock states come from user progress, which
                    // just moved — refresh before the next screen reads them.
                    ref.read(authProvider.notifier).refreshMe();
                    // Replace rather than push: otherwise a long session
                    // stacks one dead lesson route per lesson played, and
                    // Back walks the learner through every result screen
                    // they already dismissed.
                    Navigator.of(context).pushReplacement(
                      riseTransitionRoute(LessonScreen(lessonId: nextLessonId!)),
                    );
                  },
                  child: Text(s.t('lesson.nextLesson')),
                ),
                const SizedBox(height: Gap.sm),
                TextButton(
                  onPressed: () {
                    ref.read(authProvider.notifier).refreshMe();
                    Navigator.of(context).pop();
                  },
                  child: Text(s.t('lesson.backToPath')),
                ),
              ] else
                FilledButton(
                  onPressed: () {
                    // Content is unchanged by finishing a lesson, but the
                    // path's lock states come from user progress, which just
                    // moved.
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

/// The lesson's own coin / energy / XP readout. The chips carry GlobalKeys
/// so the reward burst can fly into their real positions, and each value
/// pops when it changes so a landing coin is visibly what moved it.
class _LessonHud extends StatelessWidget {
  const _LessonHud({
    required this.coins,
    required this.energy,
    required this.xp,
    required this.coinKey,
    required this.xpKey,
  });

  final int coins;
  final int energy;
  final int xp;
  final GlobalKey coinKey;
  final GlobalKey xpKey;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    Widget number(int value) => TweenAnimationBuilder<double>(
          key: ValueKey(value),
          tween: Tween(begin: 1.22, end: 1),
          duration: const Duration(milliseconds: 340),
          curve: Curves.easeOut,
          builder: (_, scale, child) =>
              Transform.scale(scale: scale, child: child),
          child: Text(
            formatGrouped(value),
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w900,
              height: 1,
              color: tokens.text,
            ),
          ),
        );

    // Coins and XP are rewards: they wait for the burst to land, then climb a
    // unit at a time, both finishing inside the reward clip. Energy only ever
    // goes down, so it snaps (TickingNumber ignores a decrease) — hence no
    // wrapper on that one.
    Widget chip(Key? key, Widget icon, int value, {bool tick = false}) =>
        Row(
          key: key,
          mainAxisSize: MainAxisSize.min,
          children: [
            icon,
            const SizedBox(width: 6),
            if (tick)
              TickingNumber(
                value: value,
                builder: (_, shown) => number(shown),
              )
            else
              number(value),
          ],
        );

    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.sm, Gap.xl, 0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          chip(coinKey, const CoinGlyph(size: 21), coins, tick: true),
          chip(null, const Icon(Icons.bolt_rounded, size: 19, color: Color(0xFF38BDF8)), energy),
          chip(xpKey, const XpGlyph(width: 23, height: 19), xp, tick: true),
        ],
      ),
    );
  }
}

/// [ZoomableImage] only when there is a still image behind it — a video
/// poster opens its own player instead.
class _MaybeZoom extends StatelessWidget {
  const _MaybeZoom({
    required this.enabled,
    required this.imageUrl,
    required this.tag,
    required this.child,
    this.caption,
  });

  final bool enabled;
  final String imageUrl;
  final String tag;
  final Widget child;
  final String? caption;

  @override
  Widget build(BuildContext context) => enabled
      ? ZoomableImage(
          imageUrl: imageUrl, tag: tag, caption: caption, child: child)
      : child;
}
