/// The one shuffle rule the graded card types share.
library;

import 'dart:math';

/// A permutation of `0..length-1` in which nothing keeps its own index — a
/// derangement.
///
/// For a `match` card the row a word sits in is the answer key: a right word
/// left on its own row sits directly beside its pair, which hands that row
/// over. Rejecting only the all-in-place deal was not enough, because a
/// single element can stay put while the rest move, and one giveaway row is
/// all it takes for the card to read as random.
///
/// Sattolo's algorithm — the Fisher-Yates loop with `j < i` rather than
/// `j <= i` — produces a uniformly random single cycle, and a cycle over two
/// or more elements has no fixed point by construction. At length 2 there is
/// exactly one derangement (`[1, 0]`); that is arithmetic, not a shortcoming.
///
/// Call this once per card mount and keep the result. Re-rolling it on every
/// rebuild would move the blocks under the learner's finger mid-tap.
List<int> shuffledOrder(int length, {Random? random}) {
  final order = [for (var i = 0; i < length; i++) i];
  if (length < 2) return order;

  final rng = random ?? Random();
  for (var i = length - 1; i > 0; i--) {
    final j = rng.nextInt(i); // 0 .. i-1, never i
    final tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order;
}
