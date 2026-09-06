/// The `match` card — Duolingo's "tap the pairs".
///
/// Two columns of word blocks. The learner taps a block in one column and
/// then its partner in the other; a correct pair locks out of play, a wrong
/// one flashes red and drops the selection.
///
/// The card grades itself the moment the last pair locks, so the lesson
/// footer has no Check button to press here — a single mis-pair is what
/// makes the card wrong, the same rule Duolingo scores this exercise by.
/// Per-tap feedback is haptic only: the chime belongs to the committed
/// verdict (lesson_screen.dart#_commit), and firing it on a wrong pair as
/// well would stack two "wrong" sounds on the one answer.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../core/haptics.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../models/content.dart';
import 'card_shuffle.dart';

/// The pairs of [card] that can actually be played in [locale] — both sides
/// have to resolve to text, or the learner would be aiming at a blank block.
/// A half-authored card degrades to the rows that do work instead of
/// blocking the lesson; a card with none left is read-through (the player
/// checks this before treating the card as graded).
List<MatchPair> playablePairs(LessonCard card, AppLocale locale) => [
      for (final pair in card.pairs)
        if (localizedContent(pair.left, locale).trim().isNotEmpty &&
            localizedContent(pair.right, locale).trim().isNotEmpty)
          pair,
    ];

class MatchPairsCard extends StatefulWidget {
  const MatchPairsCard({
    super.key,
    required this.card,
    required this.locale,
    required this.checked,
    required this.onComplete,
  });

  final LessonCard card;
  final AppLocale locale;

  /// True once the verdict is committed — the grid stops taking taps.
  final bool checked;

  /// Fired exactly once, when the last pair locks: `true` when the learner
  /// never mis-paired. The player commits it through the same path a quiz
  /// answer takes, so the mistake count, the re-queue and the analytics
  /// event stay identical across card types.
  final ValueChanged<bool> onComplete;

  @override
  State<MatchPairsCard> createState() => _MatchPairsCardState();
}

class _MatchPairsCardState extends State<MatchPairsCard> {
  late final List<MatchPair> _pairs;

  /// The right column's running order: indices into [_pairs], shuffled once
  /// at mount. Rendering it in pair order would hand over the answer.
  late final List<int> _rightOrder;

  /// Pair indices already solved.
  final Set<int> _locked = {};

  /// The current selection: a pair index on the left, a column slot on the
  /// right. Either column may be tapped first.
  int? _pickedLeft;
  int? _pickedRight;

  /// The blocks currently flashing red, cleared by [_flashTimer].
  int? _wrongLeft;
  int? _wrongRight;

  bool _hadWrong = false;
  bool _completed = false;
  Timer? _flashTimer;
  Timer? _completeTimer;

  @override
  void initState() {
    super.initState();
    _pairs = playablePairs(widget.card, widget.locale);
    _rightOrder = shuffledOrder(_pairs.length);
  }

  @override
  void dispose() {
    _flashTimer?.cancel();
    _completeTimer?.cancel();
    super.dispose();
  }

  /// A block stays tappable until its pair is solved, the grid is finished
  /// or the verdict is committed.
  bool _canTap(int pairIndex) =>
      !widget.checked && !_completed && !_locked.contains(pairIndex);

  /// Ends the red flash early. A block the learner has just picked must
  /// never still be wearing the previous miss.
  void _clearFlash() {
    if (_wrongLeft == null && _wrongRight == null) return;
    _flashTimer?.cancel();
    setState(() {
      _wrongLeft = null;
      _wrongRight = null;
    });
  }

  void _tapLeft(int pairIndex) {
    _clearFlash();
    if (_pickedRight == null) {
      // The selection tick fires only when the tap IS just a selection.
      // Firing it up front stacked a light click on top of _resolve's own
      // error buzz, so a mis-pair went off twice in the same frame.
      Haptics.tap();
      setState(() => _pickedLeft = _pickedLeft == pairIndex ? null : pairIndex);
      return;
    }
    _resolve(pairIndex, _pickedRight!);
  }

  void _tapRight(int slot) {
    _clearFlash();
    if (_pickedLeft == null) {
      Haptics.tap();
      setState(() => _pickedRight = _pickedRight == slot ? null : slot);
      return;
    }
    _resolve(_pickedLeft!, slot);
  }

  void _resolve(int leftPair, int rightSlot) {
    if (leftPair == _rightOrder[rightSlot]) {
      setState(() {
        _locked.add(leftPair);
        _pickedLeft = null;
        _pickedRight = null;
      });
      if (_locked.length >= _pairs.length) _finish();
      return;
    }

    Haptics.error();
    setState(() {
      _hadWrong = true;
      _wrongLeft = leftPair;
      _wrongRight = rightSlot;
      _pickedLeft = null;
      _pickedRight = null;
    });
    _flashTimer?.cancel();
    _flashTimer = Timer(const Duration(milliseconds: 520), () {
      if (!mounted) return;
      setState(() {
        _wrongLeft = null;
        _wrongRight = null;
      });
    });
  }

  void _finish() {
    if (_completed) return;
    _completed = true;
    // A beat before the footer flips to the banner, so the last pair is
    // visibly locked first — committing on the same frame reads as the tap
    // having been eaten.
    _completeTimer = Timer(const Duration(milliseconds: 260), () {
      if (!mounted) return;
      widget.onComplete(!_hadWrong);
    });
  }

  _BlockState _leftState(int pairIndex) {
    if (_locked.contains(pairIndex)) return _BlockState.locked;
    if (_wrongLeft == pairIndex) return _BlockState.wrong;
    if (_pickedLeft == pairIndex) return _BlockState.picked;
    return _BlockState.idle;
  }

  _BlockState _rightState(int slot) {
    if (_locked.contains(_rightOrder[slot])) return _BlockState.locked;
    if (_wrongRight == slot) return _BlockState.wrong;
    if (_pickedRight == slot) return _BlockState.picked;
    return _BlockState.idle;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final s = StringsScope.of(context);
    final prompt = localizedContent(widget.card.title, widget.locale).trim();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          prompt.isEmpty ? s.t('lesson.matchPrompt') : prompt,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: Gap.xl),
        // Two Expanded columns: at 320dp each block gets ~130dp, which is
        // why the text inside wraps and the columns never carry a fixed
        // width.
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < _pairs.length; i++)
                    Padding(
                      padding: EdgeInsets.only(
                          bottom: i == _pairs.length - 1 ? 0 : Gap.md),
                      child: _MatchBlock(
                        text: localizedContent(_pairs[i].left, widget.locale),
                        state: _leftState(i),
                        onTap: _canTap(i) ? () => _tapLeft(i) : null,
                        tokens: tokens,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var slot = 0; slot < _rightOrder.length; slot++)
                    Padding(
                      padding: EdgeInsets.only(
                          bottom: slot == _rightOrder.length - 1 ? 0 : Gap.md),
                      child: _MatchBlock(
                        text: localizedContent(
                            _pairs[_rightOrder[slot]].right, widget.locale),
                        state: _rightState(slot),
                        onTap: _canTap(_rightOrder[slot])
                            ? () => _tapRight(slot)
                            : null,
                        tokens: tokens,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}

enum _BlockState { idle, picked, wrong, locked }

class _MatchBlock extends StatelessWidget {
  const _MatchBlock({
    required this.text,
    required this.state,
    required this.onTap,
    required this.tokens,
  });

  final String text;
  final _BlockState state;
  final VoidCallback? onTap;
  final AppTokens tokens;

  @override
  Widget build(BuildContext context) {
    final (border, bg, fg) = switch (state) {
      _BlockState.idle => (tokens.border, Colors.transparent, tokens.text),
      _BlockState.picked => (
          AppColors.primary,
          AppColors.primary.withValues(alpha: 0.12),
          AppColors.primary,
        ),
      _BlockState.wrong => (
          AppColors.danger,
          AppColors.danger.withValues(alpha: 0.14),
          AppColors.danger,
        ),
      _BlockState.locked => (
          AppColors.success,
          AppColors.success.withValues(alpha: 0.12),
          AppColors.success,
        ),
    };

    return Semantics(
      button: onTap != null,
      selected: state == _BlockState.picked,
      child: AnimatedOpacity(
        // A solved pair fades rather than disappearing: pulling it out of
        // the column would slide every block below it up under the finger
        // that is already reaching for the next one.
        opacity: state == _BlockState.locked ? 0.4 : 1,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            curve: Curves.easeOut,
            constraints: const BoxConstraints(minHeight: 56),
            padding: const EdgeInsets.symmetric(
                horizontal: Gap.md, vertical: Gap.md),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: border, width: 2),
            ),
            child: Text(
              text,
              textAlign: TextAlign.center,
              // Wraps to four lines in a ~130dp column; the ellipsis is the
              // last resort for a single unbreakable word, and only ever
              // trims rather than overflowing the 320dp layout.
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: fg,
                    fontWeight: FontWeight.w700,
                    height: 1.25,
                  ),
            ),
          ),
        ),
      ),
    );
  }
}
