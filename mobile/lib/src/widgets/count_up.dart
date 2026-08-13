/// Animates a number counting up from a start value to an end value —
/// the "slot machine" tick that makes a reward feel earned rather than
/// just printed. Used for XP/coin gains and stat-card entrances.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/providers.dart';

class CountUpNumber extends ConsumerWidget {
  const CountUpNumber({
    super.key,
    required this.value,
    this.from = 0,
    this.prefix = '',
    this.suffix = '',
    this.style,
    this.duration = const Duration(milliseconds: 900),
    this.curve = Curves.easeOutCubic,
    this.delay = Duration.zero,
  });

  final int value;
  final int from;
  final String prefix;
  final String suffix;
  final TextStyle? style;
  final Duration duration;
  final Curve curve;

  /// Staggers a group of counters (e.g. XP then coins) so they don't all
  /// land in the same instant — a small thing that reads as "designed".
  final Duration delay;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final animate = ref.watch(userStateProvider)?.settings.animations ?? true;

    if (!animate) {
      return Text('$prefix$value$suffix', style: style);
    }

    return _DelayedTween(
      delay: delay,
      tween: IntTween(begin: from, end: value),
      duration: duration,
      curve: curve,
      builder: (context, v) => Text('$prefix$v$suffix', style: style),
    );
  }
}

/// TweenAnimationBuilder doesn't support a start delay on its own — this
/// wraps it with one so a whole row of counters can stagger their landings.
class _DelayedTween extends StatefulWidget {
  const _DelayedTween({
    required this.delay,
    required this.tween,
    required this.duration,
    required this.curve,
    required this.builder,
  });

  final Duration delay;
  final IntTween tween;
  final Duration duration;
  final Curve curve;
  final Widget Function(BuildContext, int) builder;

  @override
  State<_DelayedTween> createState() => _DelayedTweenState();
}

class _DelayedTweenState extends State<_DelayedTween> {
  bool _started = false;

  @override
  void initState() {
    super.initState();
    if (widget.delay == Duration.zero) {
      _started = true;
    } else {
      Future.delayed(widget.delay, () {
        if (mounted) setState(() => _started = true);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<int>(
      tween: IntTween(
        begin: widget.tween.begin,
        end: _started ? widget.tween.end : widget.tween.begin,
      ),
      duration: widget.duration,
      curve: widget.curve,
      builder: (context, v, _) => widget.builder(context, v),
    );
  }
}
