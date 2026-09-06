/// The web's icons, in the app.
///
/// The two clients used to draw different pictures for the same idea: the web
/// renders lucide (thin, geometric, 2px stroke) and Flutter rendered Material
/// Rounded (filled, chunky). Same concept, visibly different product — the
/// bottom bar and the lesson path made it obvious side by side.
///
/// The glyphs come from the same lucide source the web bundles, extracted
/// into lib/src/core/lucide_svg.dart, so a slug can never mean one drawing
/// here and another there.
library;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../core/lucide_svg.dart';

/// One lucide glyph, tinted and sized like an [Icon].
///
/// [name] is a key of `kLucideSvg` — a lesson-icon slug ('wallet', 'rocket')
/// or one of the 'nav-*' entries. An unknown name renders nothing rather than
/// throwing: an admin can save a slug this build has never heard of, and a
/// missing icon must not take the screen down with it.
class LucideIcon extends StatelessWidget {
  const LucideIcon(
    this.name, {
    super.key,
    this.size = 24,
    this.color,
    this.strokeWidth,
  });

  final String name;
  final double size;
  final Color? color;

  /// Lucide draws at 2px on a 24 box. A glyph shown much larger or much
  /// smaller than that wants the stroke scaled with it, which is what the web
  /// gets for free from SVG's own scaling — pass a value to match.
  final double? strokeWidth;

  static bool has(String? name) => name != null && kLucideSvg.containsKey(name);

  @override
  Widget build(BuildContext context) {
    var svg = kLucideSvg[name];
    if (svg == null) return SizedBox(width: size, height: size);

    if (strokeWidth != null) {
      svg = svg.replaceFirst('stroke-width="2"', 'stroke-width="$strokeWidth"');
    }

    final tint = color ?? IconTheme.of(context).color ?? Theme.of(context).colorScheme.onSurface;

    return SvgPicture.string(
      svg,
      width: size,
      height: size,
      // The glyphs keep `currentColor`; this is what resolves it, the same
      // way the web inherits `color` from CSS.
      colorFilter: ColorFilter.mode(tint, BlendMode.srcIn),
    );
  }
}
