/// The streak screen — shown once on the day the streak actually moves.
/// Port of src/components/StreakCelebration.jsx.
///
/// providers.dart gates it on the daily claim's `claimed` flag, so a relaunch
/// doesn't replay it. The Su–Sa strip is the part `streak` alone can't
/// answer — which days of THIS week were studied — and comes from
/// state.activeDays, the trailing window the daily claim appends to.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/haptics.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../state/providers.dart';

const int _daysInWeek = 7;
const Color _flameTop = Color(0xFFFFA000);
const Color _flameBottom = Color(0xFFFF8A00);
const Color _coreTop = Color(0xFFFFE083);
const Color _coreBottom = Color(0xFFFFC400);
const Color _streakOrange = Color(0xFFFF9600);
const Color _trackOn = Color(0xFFFFC800);

/// activeDays are UTC calendar dates (the server's own day boundary), so the
/// week is built in UTC too — a local-time week would shift the strip by a
/// day for anyone east of Greenwich.
String _isoUtc(DateTime d) => d.toUtc().toIso8601String().substring(0, 10);

List<String> _weekDates() {
  final now = DateTime.now().toUtc();
  final today = DateTime.utc(now.year, now.month, now.day);
  final sunday = today.subtract(Duration(days: today.weekday % 7));
  return List.generate(_daysInWeek, (i) => _isoUtc(sunday.add(Duration(days: i))));
}

/// Contiguous runs of studied days, so the strip draws one continuous bar
/// per run instead of seven disconnected pills.
List<List<int>> _runs(List<bool> active) {
  final out = <List<int>>[];
  var start = -1;
  for (var i = 0; i < active.length; i++) {
    if (active[i] && start == -1) start = i;
    final last = i == active.length - 1;
    if ((!active[i] || last) && start != -1) {
      out.add([start, active[i] ? i : i - 1]);
      start = -1;
    }
  }
  return out;
}

class StreakScreen extends ConsumerStatefulWidget {
  const StreakScreen({super.key, required this.event, required this.onDismiss});

  final StreakEvent event;
  final VoidCallback onDismiss;

  @override
  ConsumerState<StreakScreen> createState() => _StreakScreenState();
}

class _StreakScreenState extends ConsumerState<StreakScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    final animate =
        ref.read(userStateProvider)?.settings.animations ?? true;
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 780),
      // With animations off the screen still shows — it just arrives
      // finished, the same convention every other motion helper uses.
      value: animate ? 0 : 1,
    );
    if (animate) _c.forward();
    Haptics.celebrate();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  /// Staggered entrance: each element eases in over its own slice of the
  /// controller rather than all at once.
  Animation<double> _step(double begin, double end) => CurvedAnimation(
        parent: _c,
        curve: Interval(begin, end, curve: Curves.easeOutBack),
      );

  Widget _fadeUp(Animation<double> a, Widget child) => AnimatedBuilder(
        animation: a,
        builder: (_, c) => Opacity(
          opacity: a.value.clamp(0.0, 1.0),
          child: Transform.translate(offset: Offset(0, 16 * (1 - a.value)), child: c),
        ),
        child: child,
      );

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;

    final week = _weekDates();
    final activeSet = widget.event.activeDays.toSet();
    final active = [for (final d in week) activeSet.contains(d)];
    final todayIndex = week.indexOf(_isoUtc(DateTime.now()));
    final studied = active.where((e) => e).length;

    final message = studied >= _daysInWeek
        ? s.t('streak.perfectWeekDone')
        : studied >= 5
            ? s.t('streak.perfectWeekClose')
            : studied >= 3
                ? s.t('streak.perfectWeekHalf')
                : s.t('streak.perfectWeekStart');

    return Material(
      color: tokens.bg,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
          child: Column(
            children: [
              Expanded(
                child: Center(
                  child: SingleChildScrollView(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          ScaleTransition(
                            scale: _step(0.0, 0.5),
                            child: const SizedBox(
                              width: 152,
                              height: 167,
                              child: CustomPaint(painter: _FlamePainter()),
                            ),
                          ),
                          Transform.translate(
                            offset: const Offset(0, -8),
                            child: Column(
                              children: [
                                ScaleTransition(
                                  scale: _step(0.12, 0.62),
                                  child: Text(
                                    '${widget.event.streak}',
                                    style: TextStyle(
                                      fontSize: 76,
                                      height: 1,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: -1.5,
                                      color: tokens.text,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                _fadeUp(
                                  _step(0.24, 0.74),
                                  Text(
                                    s.t('streak.dayStreak'),
                                    style: const TextStyle(
                                      fontSize: 22,
                                      fontWeight: FontWeight.w900,
                                      color: _streakOrange,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 28),
                                _fadeUp(
                                  _step(0.34, 0.86),
                                  _WeekCard(
                                    week: week,
                                    active: active,
                                    todayIndex: todayIndex,
                                    message: message,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              _fadeUp(
                _step(0.45, 1.0),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: widget.onDismiss,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(56),
                        backgroundColor: AppColors.primary,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16)),
                      ),
                      child: Text(
                        s.t('streak.continue'),
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WeekCard extends StatelessWidget {
  const _WeekCard({
    required this.week,
    required this.active,
    required this.todayIndex,
    required this.message,
  });

  final List<String> week;
  final List<bool> active;
  final int todayIndex;
  final String message;

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;
    final runs = _runs(active);

    return Container(
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.border, width: 2),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
            child: Column(
              children: [
                Row(
                  children: [
                    for (var i = 0; i < week.length; i++)
                      Expanded(
                        child: Text(
                          s.t('streak.dow$i'),
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: i == todayIndex ? _streakOrange : tokens.muted,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                LayoutBuilder(
                  builder: (context, box) {
                    final slot = box.maxWidth / _daysInWeek;
                    return SizedBox(
                      height: 34,
                      child: Stack(
                        children: [
                          // One continuous bar per run of studied days — the
                          // visual the design uses to say "these connect".
                          for (final r in runs)
                            Positioned(
                              left: r[0] * slot,
                              width: (r[1] - r[0] + 1) * slot,
                              top: 0,
                              bottom: 0,
                              child: Container(
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(999),
                                  gradient: const LinearGradient(
                                    colors: [_trackOn, Color(0xFFFFD84D)],
                                  ),
                                ),
                              ),
                            ),
                          Row(
                            children: [
                              for (var i = 0; i < week.length; i++)
                                Expanded(
                                  child: Center(
                                    child: active[i]
                                        ? Icon(
                                            Icons.check_rounded,
                                            size: 19,
                                            weight: 900,
                                            color: tokens.bright
                                                ? const Color(0xFF8A6400)
                                                : const Color(0xFF3B2C00),
                                          )
                                        : i == week.length - 1
                                            ? const Icon(Icons.star_border_rounded,
                                                size: 24, color: _trackOn)
                                            : Container(
                                                width: 22,
                                                height: 22,
                                                decoration: BoxDecoration(
                                                  shape: BoxShape.circle,
                                                  color: tokens.border,
                                                ),
                                              ),
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: tokens.border, width: 2)),
            ),
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: tokens.text,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Drawn rather than shipped as an image: it has to sit on both themes and
/// scale cleanly, and it is two paths.
class _FlamePainter extends CustomPainter {
  const _FlamePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / 100, sy = size.height / 110;

    final outer = Path()
      ..moveTo(50 * sx, 34 * sy)
      ..cubicTo(44 * sx, 20 * sy, 36 * sx, 10 * sy, 30 * sx, 2 * sy)
      ..cubicTo(28 * sx, 20 * sy, 20 * sx, 28 * sy, 14 * sx, 42 * sy)
      ..cubicTo(6 * sx, 60 * sy, 10 * sx, 86 * sy, 28 * sx, 98 * sy)
      ..cubicTo(40 * sx, 106 * sy, 60 * sx, 106 * sy, 72 * sx, 98 * sy)
      ..cubicTo(90 * sx, 86 * sy, 94 * sx, 60 * sy, 86 * sx, 42 * sy)
      ..cubicTo(80 * sx, 28 * sy, 72 * sx, 20 * sy, 70 * sx, 2 * sy)
      ..cubicTo(64 * sx, 10 * sy, 56 * sx, 20 * sy, 50 * sx, 34 * sy)
      ..close();

    final core = Path()
      ..moveTo(50 * sx, 50 * sy)
      ..cubicTo(43 * sx, 62 * sy, 37 * sx, 70 * sy, 37 * sx, 80 * sy)
      ..cubicTo(37 * sx, 92 * sy, 43 * sx, 100 * sy, 50 * sx, 105 * sy)
      ..cubicTo(57 * sx, 100 * sy, 63 * sx, 92 * sy, 63 * sx, 80 * sy)
      ..cubicTo(63 * sx, 70 * sy, 57 * sx, 62 * sy, 50 * sx, 50 * sy)
      ..close();

    final rect = Offset.zero & size;
    canvas.drawPath(
      outer,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_flameTop, _flameBottom],
        ).createShader(rect),
    );
    canvas.drawPath(
      core,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_coreTop, _coreBottom],
        ).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(covariant _FlamePainter oldDelegate) => false;
}
