/// Coins fly to the coin counter and XP badges to the XP counter on a
/// correct answer — the mobile twin of src/pages/LessonPage.jsx's
/// BurstLayer, and the same idea Zogo uses.
///
/// Positions are resolved from the live chips at play() time rather than
/// guessed, so the arcs stay correct on any screen size. Follows
/// confetti.dart's shape: a controller the screen fires, an overlay that
/// wraps the content, and nothing at all when animations are off.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/providers.dart';

const int _coinCount = 9;
const int _xpCount = 8;
// The coins are in the air while the reward clip is still loud, and land as
// it settles into its tail. Matches BURST_MS in LessonPage.jsx exactly, so a
// coin takes the same time to arrive on both clients.
const Duration _burstDuration = Duration(milliseconds: 1100);

/// Fired by the lesson screen; the overlay listens.
class RewardBurstController extends ChangeNotifier {
  _BurstRequest? _request;

  /// All three points are in global (screen) coordinates — the overlay
  /// converts them into its own box.
  void play({
    required Offset origin,
    required Offset coinTarget,
    required Offset xpTarget,
  }) {
    _request = _BurstRequest(
      origin: origin,
      coinTarget: coinTarget,
      xpTarget: xpTarget,
      seq: (_request?.seq ?? 0) + 1,
    );
    notifyListeners();
  }
}

class _BurstRequest {
  const _BurstRequest({
    required this.origin,
    required this.coinTarget,
    required this.xpTarget,
    required this.seq,
  });
  final Offset origin;
  final Offset coinTarget;
  final Offset xpTarget;
  final int seq;
}

class _Particle {
  const _Particle({
    required this.isCoin,
    required this.from,
    required this.to,
    required this.delay,
  });
  final bool isCoin;
  final Offset from;
  final Offset to;
  final double delay;
}

class RewardBurstOverlay extends ConsumerStatefulWidget {
  const RewardBurstOverlay({
    super.key,
    required this.controller,
    required this.child,
  });

  final RewardBurstController controller;
  final Widget child;

  @override
  ConsumerState<RewardBurstOverlay> createState() => _RewardBurstOverlayState();
}

class _RewardBurstOverlayState extends ConsumerState<RewardBurstOverlay>
    with SingleTickerProviderStateMixin {
  // Built in initState, not lazily.
  //
  // As a `late final` initialiser this was only constructed the first time
  // something touched it — and on a lesson where no answer was ever right,
  // the first touch was dispose()'s own `_c.dispose()`. Creating a ticker
  // there means asking a already-deactivated element for its TickerMode
  // ancestor, which throws "Looking up a deactivated widget's ancestor is
  // unsafe" every time such a lesson is closed.
  late final AnimationController _c;
  final _boxKey = GlobalKey();
  List<_Particle> _particles = const [];
  int _lastSeq = 0;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: _burstDuration);
    widget.controller.addListener(_onPlay);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onPlay);
    _c.dispose();
    super.dispose();
  }

  void _onPlay() {
    final req = widget.controller._request;
    if (req == null || req.seq == _lastSeq || !mounted) return;
    _lastSeq = req.seq;

    if (!(ref.read(userStateProvider)?.settings.animations ?? true)) return;

    final box = _boxKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;
    final origin = box.globalToLocal(req.origin);
    final coin = box.globalToLocal(req.coinTarget);
    final xp = box.globalToLocal(req.xpTarget);

    final next = <_Particle>[];
    void add(bool isCoin, int i, int count, Offset target) {
      // Deterministic spread rather than a random one: the fan reads as
      // designed motion instead of noise, and never rebuilds differently.
      final spread = (i / (count - 1).clamp(1, count) - 0.5) * 2;
      next.add(_Particle(
        isCoin: isCoin,
        from: origin + Offset(spread * 46, spread.abs() * 26),
        to: target,
        delay: i * 0.045,
      ));
    }

    for (var i = 0; i < _coinCount; i++) {
      add(true, i, _coinCount, coin);
    }
    for (var i = 0; i < _xpCount; i++) {
      add(false, i, _xpCount, xp);
    }

    setState(() => _particles = next);
    _c.forward(from: 0).then((_) {
      if (mounted) setState(() => _particles = const []);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      key: _boxKey,
      children: [
        widget.child,
        if (_particles.isNotEmpty)
          Positioned.fill(
            child: IgnorePointer(
              child: AnimatedBuilder(
                animation: _c,
                builder: (_, __) => Stack(
                  children: [
                    for (final p in _particles) _build(p),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _build(_Particle p) {
    // Each particle runs over its own slice of the controller, which is what
    // staggers the fan without one timer per particle.
    final t = ((_c.value - p.delay) / (1 - p.delay)).clamp(0.0, 1.0);
    if (t <= 0) return const SizedBox.shrink();

    // x eases in-out while y eases in — the mismatch is what bends the
    // straight line into an arc, with no path maths.
    final x = p.from.dx + (p.to.dx - p.from.dx) * Curves.easeInOut.transform(t);
    final y = p.from.dy + (p.to.dy - p.from.dy) * Curves.easeIn.transform(t);

    final scale = t < 0.18
        ? 0.4 + (1.1 - 0.4) * (t / 0.18)
        : t < 0.7
            ? 1.1 - 0.1 * ((t - 0.18) / 0.52)
            : 1.0 - 0.45 * ((t - 0.7) / 0.3);
    final opacity = t < 0.12
        ? t / 0.12
        : t < 0.72
            ? 1.0
            : 1.0 - (t - 0.72) / 0.28;

    return Positioned(
      left: x - 13,
      top: y - 13,
      child: Opacity(
        opacity: opacity.clamp(0.0, 1.0),
        child: Transform.scale(
          scale: scale.clamp(0.1, 1.4),
          child: p.isCoin ? const CoinGlyph(size: 26) : const XpGlyph(width: 26, height: 22),
        ),
      ),
    );
  }
}

/// The gold disc, shared by the burst and the lesson's own coin counter so
/// the thing that lands is visibly the thing that was flying.
class CoinGlyph extends StatelessWidget {
  const CoinGlyph({super.key, this.size = 26});
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            center: Alignment(-0.3, -0.4),
            colors: [Color(0xFFFFE082), Color(0xFFFFC107), Color(0xFFE8A200)],
            stops: [0, 0.55, 1],
          ),
          boxShadow: [BoxShadow(color: Color(0x59000000), blurRadius: 6, offset: Offset(0, 2))],
        ),
        child: Icon(Icons.attach_money_rounded,
            size: size * 0.62, color: const Color(0xFF8A5A00)),
      );
}

class XpGlyph extends StatelessWidget {
  const XpGlyph({super.key, this.width = 26, this.height = 22});
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) => Container(
        width: width,
        height: height,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: const Color(0xFF1B6EF3),
          borderRadius: BorderRadius.circular(width * 0.27),
          boxShadow: const [
            BoxShadow(color: Color(0x59000000), blurRadius: 6, offset: Offset(0, 2)),
          ],
        ),
        child: Text(
          'XP',
          style: TextStyle(
            fontSize: height * 0.45,
            fontWeight: FontWeight.w900,
            color: Colors.white,
            height: 1,
          ),
        ),
      );
}
