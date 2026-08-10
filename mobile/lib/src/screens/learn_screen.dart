/// The learn path — a direct port of src/pages/LearnPage.jsx.
///
/// Geometry, node states and the checkpoint treatment all match the web
/// app; the numbers below are the same constants, so the two clients lay
/// out identically for the same content.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/i18n.dart';
import '../core/logic.dart';
import '../core/theme.dart';
import '../models/content.dart';
import '../screens/lesson_screen.dart';
import '../state/providers.dart';
import '../widgets/states.dart';

// LearnPage.jsx's path constants, unchanged. The canvas is a fixed width so
// the curve math never re-flows on rotation; 288 fits the narrowest phone
// inside the page gutters.
const double _node = 72;
const double _r = _node / 2;
const double _canvasW = 288;
const double _centerX = _canvasW / 2;
const double _amplitude = 56;
const double _rowGap = 128;
const double _topPad = 16;

Color _parseHex(String hex, {Color fallback = AppColors.primary}) {
  var value = hex.replaceFirst('#', '').trim();
  if (value.length == 6) value = 'FF$value';
  final parsed = int.tryParse(value, radix: 16);
  return parsed == null ? fallback : Color(parsed);
}

/// LearnPage.jsx#nodePositions — a sine zig-zag, except the last lesson of
/// each module (the checkpoint), which is pinned to the centre because it
/// renders as a wide card rather than a node.
List<Offset> _nodePositions(int count) => List.generate(count, (i) {
      final isLast = i == count - 1;
      return Offset(
        isLast ? _centerX : _centerX + _amplitude * math.sin(i * 1.4),
        _topPad + _r + i * _rowGap,
      );
    });

/// LearnPage.jsx#smoothPath — Catmull-Rom converted to cubic Béziers so the
/// road reads as one continuous line instead of straight segments.
Path _smoothPath(List<Offset> points) {
  final path = Path();
  if (points.length < 2) return path;

  path.moveTo(points.first.dx, points.first.dy);
  for (var i = 0; i < points.length - 1; i++) {
    final p0 = points[i == 0 ? i : i - 1];
    final p1 = points[i];
    final p2 = points[i + 1];
    final p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    path.cubicTo(
      p1.dx + (p2.dx - p0.dx) / 6,
      p1.dy + (p2.dy - p0.dy) / 6,
      p2.dx - (p3.dx - p1.dx) / 6,
      p2.dy - (p3.dy - p1.dy) / 6,
      p2.dx,
      p2.dy,
    );
  }
  return path;
}

class _PathPainter extends CustomPainter {
  const _PathPainter({required this.points, required this.color, required this.bright});

  final List<Offset> points;
  final Color color;
  final bool bright;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;
    final path = _smoothPath(points);

    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 14
        ..strokeCap = StrokeCap.round
        ..color = bright ? const Color(0xFFE2E8F0) : const Color(0xFF1E293B),
    );
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4
        ..strokeCap = StrokeCap.round
        ..color = color.withValues(alpha: 0.35),
    );
  }

  @override
  bool shouldRepaint(_PathPainter old) =>
      old.points != points || old.color != color || old.bright != bright;
}

/// Glossy sphere fill, ported from LearnPage.jsx#sphereStyle.
BoxDecoration _sphere(Color color, bool locked,
    {double radius = 999, bool bright = false}) {
  if (locked) {
    // A locked node should read as "not yet", i.e. recede into the page.
    // The dark slate sphere does that on a dark background but becomes the
    // heaviest thing on screen in bright mode, so light gets its own greys.
    return BoxDecoration(
      borderRadius: BorderRadius.circular(radius),
      gradient: RadialGradient(
        center: const Alignment(-0.4, -0.5),
        colors: bright
            ? const [Color(0xFFF1F5F9), Color(0xFFE2E8F0), Color(0xFFCBD5E1)]
            : const [Color(0xFF3A4459), Color(0xFF1B2436), Color(0xFF10161F)],
        stops: const [0, 0.62, 1],
      ),
    );
  }
  return BoxDecoration(
    borderRadius: BorderRadius.circular(radius),
    gradient: RadialGradient(
      center: const Alignment(-0.4, -0.5),
      colors: [
        Color.lerp(color, Colors.white, 0.55)!,
        color,
        Color.lerp(color, Colors.black, 0.25)!,
      ],
      stops: const [0, 0.55, 1],
    ),
    boxShadow: [
      BoxShadow(
        color: color.withValues(alpha: 0.45),
        blurRadius: 18,
        offset: const Offset(0, 6),
      ),
    ],
  );
}

/// LearnPage.jsx#LessonGlyph — an admin-uploaded icon wins; a broken one
/// falls back silently rather than leaving a torn-image box on the node.
class _LessonGlyph extends StatelessWidget {
  const _LessonGlyph({this.iconUrl, this.size = 26, this.fallback = Icons.fitness_center_rounded});

  final String? iconUrl;
  final double size;
  final IconData fallback;

  @override
  Widget build(BuildContext context) {
    if (iconUrl == null) {
      return Icon(fallback, size: size, color: Colors.white);
    }
    return CachedNetworkImage(
      imageUrl: iconUrl!,
      width: size,
      height: size,
      fit: BoxFit.contain,
      placeholder: (_, __) => Icon(fallback, size: size, color: Colors.white70),
      errorWidget: (_, __, ___) => Icon(fallback, size: size, color: Colors.white),
    );
  }
}

class LearnScreen extends ConsumerWidget {
  const LearnScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final content = ref.watch(contentProvider);
    final s = StringsScope.of(context);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: content.when(
          loading: () => const LearnSkeleton(),
          error: (err, _) => ErrorView(
            error: err,
            onRetry: () => ref.invalidate(contentProvider),
          ),
          data: (data) {
            if (data.modules.isEmpty) {
              return EmptyView(
                icon: Icons.menu_book_rounded,
                title: s.t('learn.empty'),
                description: s.t('learn.emptyDesc'),
              );
            }
            return _PathView(content: data);
          },
        ),
      ),
    );
  }
}

class _PathView extends ConsumerStatefulWidget {
  const _PathView({required this.content});
  final AppContent content;

  @override
  ConsumerState<_PathView> createState() => _PathViewState();
}

class _PathViewState extends ConsumerState<_PathView> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    // Drives the "energy resets in m:ss" countdown; only runs while the
    // screen is mounted.
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;
    final userState = ref.watch(userStateProvider);
    final content = widget.content;

    final order = getLessonOrder(content.modules);
    final completed = userState?.completedSet ?? <String>{};
    final energy = computeLiveEnergy(
      userState,
      dailyFreeLessons: content.limits.dailyFreeLessons,
    );

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(contentProvider);
        await ref.read(authProvider.notifier).refreshMe();
      },
      child: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            title: Text(s.t('learn.title')),
            actions: [
              _StatChip(
                icon: Icons.local_fire_department_rounded,
                color: AppColors.warning,
                value: '${userState?.streak ?? 0}',
              ),
              _StatChip(
                icon: Icons.monetization_on_rounded,
                color: AppColors.gold,
                value: '${userState?.coins ?? 0}',
              ),
              _StatChip(
                icon: Icons.bolt_rounded,
                color: AppColors.primary,
                value: '${energy.remaining}',
              ),
              const SizedBox(width: Gap.sm),
            ],
          ),

          if (energy.remaining <= 0)
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.fromLTRB(Gap.lg, 0, Gap.lg, Gap.lg),
                padding: const EdgeInsets.all(Gap.lg),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: tokens.bright ? 0.08 : 0.12),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.35)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.bolt_rounded, color: AppColors.primary),
                    const SizedBox(width: Gap.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(s.t('learn.noEnergyTitle'),
                              style: Theme.of(context).textTheme.titleSmall),
                          Text(
                            s.t('learn.noEnergyDesc',
                                params: {'time': formatCountdown(energy.resetMs)}),
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

          for (final module in content.modules)
            SliverToBoxAdapter(
              child: _ModuleSection(
                module: module,
                order: order,
                completed: completed,
                partner: content.partnerById(module.partnerId),
                energyEmpty: energy.remaining <= 0,
              ),
            ),

          const SliverToBoxAdapter(child: SizedBox(height: Gap.xxl)),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.icon, required this.color, required this.value});

  final IconData icon;
  final Color color;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 3),
          Text(
            value,
            style: Theme.of(context)
                .textTheme
                .labelSmall
                ?.copyWith(fontWeight: FontWeight.w800, color: context.tokens.text),
          ),
        ],
      ),
    );
  }
}

class _ModuleSection extends StatelessWidget {
  const _ModuleSection({
    required this.module,
    required this.order,
    required this.completed,
    required this.partner,
    required this.energyEmpty,
  });

  final Module module;
  final List<String> order;
  final Set<String> completed;
  final Partner? partner;
  final bool energyEmpty;

  @override
  Widget build(BuildContext context) {
    final color = _parseHex(module.color);
    final tokens = context.tokens;
    final positions = _nodePositions(module.lessons.length);
    final height = module.lessons.isEmpty
        ? 0.0
        : positions.last.dy + _r + Gap.xxl;

    return Column(
      children: [
        // Module header — icon + title, tinted with the module colour.
        Container(
          margin: const EdgeInsets.fromLTRB(Gap.lg, Gap.sm, Gap.lg, Gap.lg),
          padding: const EdgeInsets.all(Gap.lg),
          decoration: BoxDecoration(
            color: color.withValues(alpha: tokens.bright ? 0.08 : 0.14),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(14),
                ),
                clipBehavior: Clip.antiAlias,
                child: module.iconUrl == null
                    ? const Icon(Icons.school_rounded, color: Colors.white, size: 22)
                    : CachedNetworkImage(
                        imageUrl: module.iconUrl!,
                        fit: BoxFit.contain,
                        errorWidget: (_, __, ___) =>
                            const Icon(Icons.school_rounded, color: Colors.white, size: 22),
                      ),
              ),
              const SizedBox(width: Gap.md),
              Expanded(
                child: Text(module.title,
                    style: Theme.of(context).textTheme.headlineSmall),
              ),
            ],
          ),
        ),

        if (module.lessons.isNotEmpty)
          SizedBox(
            height: height,
            child: Center(
              child: SizedBox(
                width: _canvasW,
                height: height,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned.fill(
                      child: CustomPaint(
                        painter: _PathPainter(
                          points: positions,
                          color: color,
                          bright: tokens.bright,
                        ),
                      ),
                    ),
                    for (var i = 0; i < module.lessons.length; i++)
                      _positioned(
                        context,
                        lesson: module.lessons[i],
                        position: positions[i],
                        isCheckpoint: i == module.lessons.length - 1,
                        color: color,
                      ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _positioned(
    BuildContext context, {
    required Lesson lesson,
    required Offset position,
    required bool isCheckpoint,
    required Color color,
  }) {
    final status = getLessonStatus(lesson.id, order, completed);

    // The checkpoint is a wide card, so it needs the full canvas width
    // rather than a node-sized box centred on the sine curve.
    if (isCheckpoint) {
      return Positioned(
        left: 0,
        right: 0,
        top: position.dy - _r,
        child: _CheckpointNode(
          lesson: lesson,
          status: status,
          color: color,
          energyEmpty: energyEmpty,
        ),
      );
    }

    return Positioned(
      left: position.dx - _r,
      top: position.dy - _r,
      width: _node,
      child: _LessonNode(
        lesson: lesson,
        status: status,
        color: color,
        partnerLogoUrl: partner?.logoUrl,
        energyEmpty: energyEmpty,
      ),
    );
  }
}

class _LessonNode extends StatelessWidget {
  const _LessonNode({
    required this.lesson,
    required this.status,
    required this.color,
    required this.energyEmpty,
    this.partnerLogoUrl,
  });

  final Lesson lesson;
  final LessonStatus status;
  final Color color;
  final bool energyEmpty;
  final String? partnerLogoUrl;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final locked = status == LessonStatus.locked;
    final done = status == LessonStatus.completed;
    final isNext = status == LessonStatus.available;

    final tint = done ? Color.lerp(color, const Color(0xFF64748B), 0.22)! : color;

    final node = Container(
      width: _node,
      height: _node,
      decoration: _sphere(tint, locked, bright: tokens.bright),
      alignment: Alignment.center,
      child: locked
          ? Icon(Icons.lock_rounded,
              size: 26,
              color: tokens.bright ? const Color(0xFF94A3B8) : const Color(0xFF64748B))
          : _LessonGlyph(iconUrl: lesson.iconUrl),
    );

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          label: lesson.title,
          button: !locked,
          enabled: !locked,
          child: _PressScale(
            enabled: !locked,
            onTap: locked ? null : () => _open(context),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // The next lesson gets a slow bob — the path's strongest
                // anchor, matching NextLessonNode in the web app.
                if (isNext) _Bob(child: node) else node,
                if (done)
                  Positioned(
                    right: -2,
                    bottom: -2,
                    child: Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: tokens.bright ? Colors.white : const Color(0xFF0B1220),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.check_rounded,
                          size: 14, color: AppColors.success),
                    ),
                  ),
                if (partnerLogoUrl != null && !locked)
                  Positioned(
                    right: -4,
                    top: -4,
                    child: Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: tokens.bright ? Colors.white : const Color(0xFF0B1220),
                          width: 2,
                        ),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: CachedNetworkImage(
                        imageUrl: partnerLogoUrl!,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => const SizedBox.shrink(),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: Gap.sm),
        SizedBox(
          width: _node + 36,
          child: Text(
            lesson.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: locked ? tokens.faint : tokens.muted,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
      ],
    );
  }

  void _open(BuildContext context) {
    final s = StringsScope.of(context);
    // Re-doing a finished lesson is always allowed; only a fresh completion
    // costs energy, which mirrors the server's own rule.
    if (energyEmpty && status != LessonStatus.completed) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.t('lesson.noEnergy'))),
      );
      return;
    }
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => LessonScreen(lessonId: lesson.id),
    ));
  }
}

class _CheckpointNode extends StatelessWidget {
  const _CheckpointNode({
    required this.lesson,
    required this.status,
    required this.color,
    required this.energyEmpty,
  });

  final Lesson lesson;
  final LessonStatus status;
  final Color color;
  final bool energyEmpty;

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;
    final locked = status == LessonStatus.locked;
    final done = status == LessonStatus.completed;
    final tint = done ? Color.lerp(color, const Color(0xFF64748B), 0.22)! : color;

    return Semantics(
      label: lesson.title,
      button: !locked,
      enabled: !locked,
      child: _PressScale(
        enabled: !locked,
        onTap: locked
            ? null
            : () {
                if (energyEmpty && !done) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(s.t('lesson.noEnergy'))),
                  );
                  return;
                }
                Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => LessonScreen(lessonId: lesson.id),
    ));
              },
        child: Container(
          padding: const EdgeInsets.all(Gap.md),
          decoration: BoxDecoration(
            color: tokens.card,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: locked ? tokens.border : tint.withValues(alpha: 0.45),
              width: 1.5,
            ),
            boxShadow: locked
                ? null
                : [BoxShadow(color: tint.withValues(alpha: 0.25), blurRadius: 18, offset: const Offset(0, 8))],
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: locked
                    // Same reasoning as the path nodes: a locked checkpoint
                    // should recede, and the dark chip was the loudest thing
                    // on a light page.
                    ? BoxDecoration(
                        color: tokens.bright
                            ? const Color(0xFFE2E8F0)
                            : const Color(0xFF1B2436),
                        borderRadius: BorderRadius.circular(999),
                      )
                    : _sphere(tint, false, bright: tokens.bright),
                alignment: Alignment.center,
                child: locked
                    ? Icon(Icons.lock_rounded,
                        size: 20,
                        color: tokens.bright ? const Color(0xFF94A3B8) : const Color(0xFF64748B))
                    : _LessonGlyph(
                        iconUrl: lesson.iconUrl,
                        size: 22,
                        fallback: Icons.school_rounded,
                      ),
              ),
              const SizedBox(width: Gap.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      s.t('lesson.previewCheckpoint'),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: locked ? tokens.faint : tint,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.6,
                          ),
                    ),
                    Text(
                      lesson.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            color: locked ? tokens.muted : tokens.text,
                          ),
                    ),
                  ],
                ),
              ),
              if (done)
                const Icon(Icons.check_circle_rounded, color: AppColors.success),
            ],
          ),
        ),
      ),
    );
  }
}

/// Press feedback: scale to 0.9 on tap-down, spring back. Mirrors the web
/// app's `whileTap={{ scale: 0.9 }}`. Honours the user's animations setting.
class _PressScale extends ConsumerStatefulWidget {
  const _PressScale({required this.child, this.onTap, this.enabled = true});

  final Widget child;
  final VoidCallback? onTap;
  final bool enabled;

  @override
  ConsumerState<_PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends ConsumerState<_PressScale> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final animate = ref.watch(userStateProvider)?.settings.animations ?? true;

    return GestureDetector(
      onTapDown: widget.enabled ? (_) => setState(() => _down = true) : null,
      onTapUp: widget.enabled ? (_) => setState(() => _down = false) : null,
      onTapCancel: widget.enabled ? () => setState(() => _down = false) : null,
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: (_down && animate) ? 0.9 : 1,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}

/// The slow float on the next-up node.
class _Bob extends ConsumerStatefulWidget {
  const _Bob({required this.child});
  final Widget child;

  @override
  ConsumerState<_Bob> createState() => _BobState();
}

class _BobState extends ConsumerState<_Bob> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final animate = ref.watch(userStateProvider)?.settings.animations ?? true;
    if (!animate) return widget.child;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) => Transform.translate(
        offset: Offset(0, -5 * Curves.easeInOut.transform(_controller.value)),
        child: child,
      ),
      child: widget.child,
    );
  }
}
