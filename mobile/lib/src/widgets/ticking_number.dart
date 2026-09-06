import 'dart:async';

import 'package:flutter/widgets.dart';

/// Walks a counter to its new value one unit at a time, starting only once
/// the reward burst has actually landed.
///
/// Before this, the number changed the instant the answer was judged — so the
/// coins spent a second flying into a total that had already moved, which made
/// the whole animation read as decoration. Now the coin arrives and *then* the
/// number climbs: 1, 2, 3, 4, 5.
///
/// A decrease (spending energy) or a jump too large to be a reward (the
/// account's own totals loading in) snaps instead of crawling — nobody wants
/// to watch a hundred XP count itself in.
class TickingNumber extends StatefulWidget {
  const TickingNumber({
    super.key,
    required this.value,
    required this.builder,
    this.delay = const Duration(milliseconds: 950),
    this.window = const Duration(milliseconds: 1730),
    this.minStep = const Duration(milliseconds: 70),
    this.maxStep = const Duration(milliseconds: 240),
    this.enabled = true,
  });

  final int value;
  final Widget Function(BuildContext context, int shown) builder;

  /// How long after the value changes the climb begins — the burst's flight
  /// time, so the first step lands with the first coin.
  final Duration delay;

  /// How long the whole climb may take. One unit per step, spread across
  /// this — so a +1 coin and a +10 XP run finish at the same moment instead
  /// of the short one being over while the long one is still counting.
  final Duration window;

  /// Floor and ceiling on a single step: too fast is a blur, too slow
  /// outlives the sound.
  final Duration minStep;
  final Duration maxStep;

  /// False (animations switched off) snaps straight to the value.
  final bool enabled;

  /// Above this the change is treated as a data load, not a reward.
  static const int maxAnimatedDelta = 200;

  @override
  State<TickingNumber> createState() => _TickingNumberState();
}

class _TickingNumberState extends State<TickingNumber> {
  late int _shown = widget.value;
  Timer? _start;
  Timer? _ticker;

  @override
  void didUpdateWidget(covariant TickingNumber old) {
    super.didUpdateWidget(old);
    if (widget.value == old.value) return;

    final from = _shown;
    final delta = widget.value - from;
    _cancel();

    if (!widget.enabled || delta <= 0 || delta > TickingNumber.maxAnimatedDelta) {
      setState(() => _shown = widget.value);
      return;
    }

    final stepMs = (widget.window.inMilliseconds / delta)
        .clamp(widget.minStep.inMilliseconds.toDouble(),
            widget.maxStep.inMilliseconds.toDouble())
        .round();

    var i = 0;
    _start = Timer(widget.delay, () {
      _ticker = Timer.periodic(Duration(milliseconds: stepMs), (t) {
        i += 1;
        if (!mounted) {
          t.cancel();
          return;
        }
        setState(() => _shown = from + i);
        if (i >= delta) t.cancel();
      });
    });
  }

  void _cancel() {
    _start?.cancel();
    _ticker?.cancel();
    _start = null;
    _ticker = null;
  }

  @override
  void dispose() {
    _cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, _shown);
}
