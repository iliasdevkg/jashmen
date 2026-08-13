/// A lightweight, brand-colored confetti burst — the one deliberately
/// showy moment in the app, reserved for genuine wins (a perfect lesson,
/// an unlocked achievement, a redeemed prize). Everywhere else stays calm
/// on purpose; this is what makes those few moments land.
///
/// Single CustomPainter draw call for every particle (not N widgets), so a
/// 70-particle burst costs nothing on a mid-range phone. Honours the
/// user's animations setting — off means no burst, not a static one, since
/// a frozen confetti frame reads as a bug, not a celebration.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/providers.dart';

/// Call [play] to fire a burst. One controller can back multiple
/// [ConfettiOverlay]s if ever needed, but the normal shape is one per
/// screen that wants the effect.
class ConfettiController extends ChangeNotifier {
  void play() => notifyListeners();
}

class ConfettiOverlay extends ConsumerStatefulWidget {
  const ConfettiOverlay({super.key, required this.controller, required this.child});

  final ConfettiController controller;
  final Widget child;

  @override
  ConsumerState<ConfettiOverlay> createState() => _ConfettiOverlayState();
}

class _Particle {
  _Particle({
    required this.x0,
    required this.y0,
    required this.vx,
    required this.vy,
    required this.rotation0,
    required this.rotationSpeed,
    required this.color,
    required this.size,
    required this.isCircle,
  });

  final double x0, y0, vx, vy, rotation0, rotationSpeed, size;
  final Color color;
  final bool isCircle;
}

const _palette = [
  Color(0xFF1CB0F6), // primary
  Color(0xFF58CC02), // success
  Color(0xFFFFD700), // gold
  Color(0xFFCE82FF), // purple
  Color(0xFFFF9600), // warning/streak
];

class _ConfettiOverlayState extends ConsumerState<ConfettiOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _anim = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  );
  List<_Particle> _particles = const [];
  final _rand = math.Random();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onPlay);
  }

  void _onPlay() {
    final animate = ref.read(userStateProvider)?.settings.animations ?? true;
    if (!animate || !mounted) return;

    // A wide upward fountain (centered straight up, ±80° spread) that then
    // falls under gravity — reads as a burst, not a shower.
    _particles = List.generate(70, (_) {
      final angle = -math.pi / 2 + (_rand.nextDouble() - 0.5) * math.pi * 0.9;
      final speed = 0.5 + _rand.nextDouble() * 0.9;
      return _Particle(
        x0: 0.5 + (_rand.nextDouble() - 0.5) * 0.3,
        y0: 0.4,
        vx: math.cos(angle) * speed,
        vy: math.sin(angle) * speed,
        rotation0: _rand.nextDouble() * math.pi * 2,
        rotationSpeed: (_rand.nextDouble() - 0.5) * 10,
        color: _palette[_rand.nextInt(_palette.length)],
        size: 6 + _rand.nextDouble() * 6,
        isCircle: _rand.nextBool(),
      );
    });
    _anim.forward(from: 0);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onPlay);
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        IgnorePointer(
          child: AnimatedBuilder(
            animation: _anim,
            builder: (context, _) => CustomPaint(
              size: Size.infinite,
              painter: _ConfettiPainter(particles: _particles, t: _anim.value),
            ),
          ),
        ),
      ],
    );
  }
}

class _ConfettiPainter extends CustomPainter {
  _ConfettiPainter({required this.particles, required this.t});

  final List<_Particle> particles;
  final double t;

  static const _gravity = 2.6;

  @override
  void paint(Canvas canvas, Size size) {
    if (t <= 0 || t >= 1 || particles.isEmpty) return;
    final fade = t > 0.7 ? (1 - (t - 0.7) / 0.3).clamp(0.0, 1.0) : 1.0;

    for (final p in particles) {
      final x = (p.x0 + p.vx * t) * size.width;
      final y = (p.y0 + p.vy * t + 0.5 * _gravity * t * t) * size.height;
      if (y < -20 || y > size.height + 20) continue;

      final paint = Paint()..color = p.color.withValues(alpha: fade);
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(p.rotation0 + p.rotationSpeed * t);
      if (p.isCircle) {
        canvas.drawCircle(Offset.zero, p.size / 2, paint);
      } else {
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(center: Offset.zero, width: p.size, height: p.size * 0.55),
            const Radius.circular(1.5),
          ),
          paint,
        );
      }
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter old) =>
      old.t != t || !identical(old.particles, particles);
}
