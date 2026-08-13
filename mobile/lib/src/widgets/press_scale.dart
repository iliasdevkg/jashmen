/// Press feedback: scale down on tap-down, spring back on release. Mirrors
/// the web app's `whileTap={{ scale: 0.97 }}` (framer-motion) — every
/// primary CTA on web gives this same tactile acknowledgement, so mobile's
/// Material ripple-only default buttons were the one place the two clients
/// visibly diverged in "feel". Honours the user's animations setting, same
/// convention as _Bob/_Glow (learn_screen.dart / league_screen.dart).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/haptics.dart';
import '../state/providers.dart';

class PressScale extends ConsumerStatefulWidget {
  const PressScale({
    super.key,
    required this.child,
    this.onTap,
    this.enabled = true,
    this.scale = 0.96,
    this.haptic = false,
  });

  final Widget child;
  final VoidCallback? onTap;
  final bool enabled;

  /// How far to shrink on press — 0.9 for small tappable nodes/icons, the
  /// default 0.96 for full-width buttons (a big CTA shrinking 10% reads as
  /// jumpy; a subtle press is more premium at that size).
  final double scale;

  /// Fires [Haptics.tap] on press-down. Off by default — call sites that
  /// already fire their own semantic haptic (success/error/celebrate) on
  /// the tap's outcome shouldn't double up.
  final bool haptic;

  @override
  ConsumerState<PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends ConsumerState<PressScale> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final animate = ref.watch(userStateProvider)?.settings.animations ?? true;
    final canTap = widget.enabled && widget.onTap != null;

    return GestureDetector(
      onTapDown: canTap
          ? (_) {
              setState(() => _down = true);
              if (widget.haptic) Haptics.tap();
            }
          : null,
      onTapUp: canTap ? (_) => setState(() => _down = false) : null,
      onTapCancel: canTap ? () => setState(() => _down = false) : null,
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: (_down && animate) ? widget.scale : 1,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}
