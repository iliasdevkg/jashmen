/// The `build` card — Duolingo's word bank.
///
/// The learner assembles a sentence by tapping word tiles in order; tapping
/// a tile that is already in the answer sends it back to the bank. Both rows
/// are [Wrap]s, so a long sentence stacks instead of overflowing a 320dp
/// phone.
///
/// Tiles are addressed by their index in the bank, never by their text: a
/// sentence that uses the same word twice ("акча ... акча") has to keep two
/// independently tappable tiles.
library;

import 'package:flutter/material.dart';

import '../core/haptics.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../models/content.dart';
import 'card_shuffle.dart';

/// Splits an authored string into word tiles on any run of whitespace,
/// dropping empties — a stray double space or a trailing newline in the
/// admin textarea must not become a blank tile.
List<String> splitWords(String raw) => raw
    .split(RegExp(r'\s+'))
    .where((w) => w.isNotEmpty)
    .toList(growable: false);

/// The words the answer is made of, in order. Empty when the card has no
/// sentence in this locale, which is what the player reads to decide the
/// card can't be graded.
List<String> answerWords(LessonCard card, AppLocale locale) =>
    splitWords(localizedContent(card.sentence, locale));

/// Whether an assembled attempt counts as the authored sentence.
///
/// Whitespace-normalised, case-insensitive, and blind to a trailing `.`, `!`
/// or `?` — the punctuation is welded to the last tile, so failing a learner
/// over a full stop they were never offered a choice about would be a bug,
/// not a grade.
bool matchesSentence(String attempt, String expected) =>
    _normalize(attempt) == _normalize(expected);

String _normalize(String value) => value
    .trim()
    .replaceAll(RegExp(r'\s+'), ' ')
    .replaceAll(RegExp(r'[.!?]+$'), '')
    .trim()
    .toLowerCase();

class WordBankCard extends StatefulWidget {
  const WordBankCard({
    super.key,
    required this.card,
    required this.locale,
    required this.checked,
    required this.correct,
    required this.onChanged,
  });

  final LessonCard card;
  final AppLocale locale;

  /// True once the verdict is committed — the tiles stop moving.
  final bool checked;

  /// The committed verdict, meaningful only once [checked]: it tints the
  /// assembled row so the sentence the learner actually built is the thing
  /// that turns green or red.
  final bool correct;

  /// Reported after every tap: whether the footer's Check button may fire,
  /// and the verdict it would commit. The player owns the commit so quiz,
  /// match and build all land in one mistake-counting path.
  final void Function(bool ready, bool correct) onChanged;

  @override
  State<WordBankCard> createState() => _WordBankCardState();
}

class _WordBankCardState extends State<WordBankCard> {
  /// The bank, in its shuffled running order. Shuffled once at mount, never
  /// on rebuild.
  late final List<String> _tiles;

  /// The authored sentence, kept raw so the comparison sees the punctuation
  /// it is meant to forgive.
  late final String _expected;

  /// Indices into [_tiles], in the order the learner tapped them.
  final List<int> _chosen = [];

  @override
  void initState() {
    super.initState();
    _expected = localizedContent(widget.card.sentence, widget.locale);
    final words = [
      ...splitWords(_expected),
      ...splitWords(localizedContent(widget.card.distractors, widget.locale)),
    ];
    _tiles = [for (final i in shuffledOrder(words.length)) words[i]];
  }

  void _pick(int tile) {
    Haptics.tap();
    setState(() => _chosen.add(tile));
    _report();
  }

  void _returnTile(int slot) {
    Haptics.tap();
    setState(() => _chosen.removeAt(slot));
    _report();
  }

  void _report() {
    final attempt = [for (final i in _chosen) _tiles[i]].join(' ');
    widget.onChanged(
      _chosen.isNotEmpty,
      matchesSentence(attempt, _expected),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final s = StringsScope.of(context);
    final prompt = localizedContent(widget.card.question, widget.locale).trim();

    final frame = !widget.checked
        ? tokens.border
        : (widget.correct ? AppColors.success : AppColors.danger);
    final chosenTone = !widget.checked
        ? _TileTone.chosen
        : (widget.correct ? _TileTone.correct : _TileTone.wrong);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          prompt.isEmpty ? s.t('lesson.buildPrompt') : prompt,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: Gap.xl),
        AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          width: double.infinity,
          constraints: const BoxConstraints(minHeight: 96),
          padding: const EdgeInsets.all(Gap.md),
          decoration: BoxDecoration(
            color: tokens.cardAlt,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: frame, width: 2),
          ),
          child: _chosen.isEmpty
              ? Center(
                  child: Text(
                    s.t('lesson.buildHint'),
                    textAlign: TextAlign.center,
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(color: tokens.muted),
                  ),
                )
              : Align(
                  alignment: Alignment.topLeft,
                  child: Wrap(
                    spacing: Gap.sm,
                    runSpacing: Gap.sm,
                    children: [
                      for (var slot = 0; slot < _chosen.length; slot++)
                        _WordTile(
                          text: _tiles[_chosen[slot]],
                          tone: chosenTone,
                          tokens: tokens,
                          onTap:
                              widget.checked ? null : () => _returnTile(slot),
                        ),
                    ],
                  ),
                ),
        ),
        const SizedBox(height: Gap.xl),
        Wrap(
          spacing: Gap.sm,
          runSpacing: Gap.sm,
          children: [
            for (var i = 0; i < _tiles.length; i++)
              // A used tile stays in the bank as a hollow slot of exactly
              // its own size. Removing it would reflow every tile after it
              // between taps, which at 320dp means the next word moves out
              // from under the finger already on its way down.
              _chosen.contains(i)
                  ? _WordTile(
                      text: _tiles[i],
                      tone: _TileTone.ghost,
                      tokens: tokens,
                      onTap: null,
                    )
                  : _WordTile(
                      text: _tiles[i],
                      tone: _TileTone.bank,
                      tokens: tokens,
                      onTap: widget.checked ? null : () => _pick(i),
                    ),
          ],
        ),
      ],
    );
  }
}

enum _TileTone { bank, chosen, correct, wrong, ghost }

class _WordTile extends StatelessWidget {
  const _WordTile({
    required this.text,
    required this.tone,
    required this.tokens,
    required this.onTap,
  });

  final String text;
  final _TileTone tone;
  final AppTokens tokens;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final (border, bg, fg) = switch (tone) {
      _TileTone.bank => (tokens.border, tokens.card, tokens.text),
      _TileTone.chosen => (AppColors.primary, tokens.card, tokens.text),
      _TileTone.correct => (
          AppColors.success,
          AppColors.success.withValues(alpha: 0.12),
          AppColors.success,
        ),
      _TileTone.wrong => (
          AppColors.danger,
          AppColors.danger.withValues(alpha: 0.12),
          AppColors.danger,
        ),
      _TileTone.ghost => (Colors.transparent, tokens.cardAlt, Colors.transparent),
    };

    return Semantics(
      button: onTap != null,
      // The hollow slot is scenery — it must not read out the word it is
      // holding a place for.
      excludeSemantics: tone == _TileTone.ghost,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOut,
          // A single unbreakable word can be wider than a 320dp row; cap it
          // so the Wrap always has something it can lay out.
          constraints: const BoxConstraints(minHeight: 44, maxWidth: 220),
          padding:
              const EdgeInsets.symmetric(horizontal: Gap.md, vertical: 10),
          // No `alignment` here on purpose. A Container with an alignment
          // grows to fill whatever width it is offered, which turned every
          // tile into a 220dp slab one per row instead of short words
          // flowing several to a line. The Text centres itself instead.
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: border, width: 2),
          ),
          child: Text(
            text,
            maxLines: 2,
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: fg,
                  fontWeight: FontWeight.w700,
                  height: 1.2,
                ),
          ),
        ),
      ),
    );
  }
}
