import 'dart:math' as math;

import 'package:flutter/material.dart';

/// The 1st / 2nd / 3rd place medal: a laurel wreath with a star above it and a
/// numbered disc between the branches, in gold, silver and bronze.
///
/// The twin of `src/components/icons/MedalWreath.jsx` on the web, so the same
/// award looks the same on both clients. Built from widgets rather than an
/// asset: it stays sharp at any size, weighs nothing, recolours from one
/// table, and needs no image pipeline.
///
/// Leaves are placed on a polar sweep instead of being positioned by hand —
/// twenty-two hand-tuned offsets is how a wreath ends up subtly lopsided and
/// impossible to adjust later.
class MedalTone {
  const MedalTone({
    required this.leafA,
    required this.leafB,
    required this.stem,
    required this.discA,
    required this.discB,
    required this.ring,
    required this.star,
    required this.ink,
  });

  final Color leafA;
  final Color leafB;
  final Color stem;
  final Color discA;
  final Color discB;
  final Color ring;
  final Color star;
  final Color ink;

  static const gold = MedalTone(
    leafA: Color(0xFFFFD54A),
    leafB: Color(0xFFE8A200),
    stem: Color(0xFFC98A00),
    discA: Color(0xFFFFDF6B),
    discB: Color(0xFFF0A800),
    ring: Color(0xFFC98A00),
    star: Color(0xFFFFD54A),
    ink: Color(0xFF5A3D00),
  );

  static const silver = MedalTone(
    leafA: Color(0xFFF4F6F8),
    leafB: Color(0xFFB9C1CA),
    stem: Color(0xFF9AA3AD),
    discA: Color(0xFFFFFFFF),
    discB: Color(0xFFC6CDD5),
    ring: Color(0xFF9AA3AD),
    star: Color(0xFFEEF2F6),
    ink: Color(0xFF2E3540),
  );

  static const bronze = MedalTone(
    leafA: Color(0xFFF0A868),
    leafB: Color(0xFFC4702F),
    stem: Color(0xFFA85C22),
    discA: Color(0xFFF2AF72),
    discB: Color(0xFFC06C29),
    ring: Color(0xFFA85C22),
    star: Color(0xFFEEF2F6),
    ink: Color(0xFF4A2409),
  );

  static MedalTone forPlace(int place) => switch (place) {
        1 => gold,
        2 => silver,
        _ => bronze,
      };
}

class _LeafSpec {
  const _LeafSpec(this.dx, this.dy, this.angle, this.length, this.width);
  final double dx;
  final double dy;
  final double angle;
  final double length;
  final double width;
}

/// Both branches, laid out on the design's 120×110 grid and then scaled.
List<_LeafSpec> _branch() {
  const cx = 60.0;
  const cy = 63.0;
  const rows = [
    (r: 45.0, n: 6, a0: 108.0, a1: 196.0, len: 15.0, wid: 6.4, lead: 26.0),
    (r: 32.0, n: 5, a0: 116.0, a1: 190.0, len: 12.5, wid: 5.4, lead: 8.0),
  ];

  final out = <_LeafSpec>[];
  for (final row in rows) {
    for (var i = 0; i < row.n; i++) {
      final t = row.n == 1 ? 0.0 : i / (row.n - 1);
      final deg = row.a0 + (row.a1 - row.a0) * t;
      final rad = deg * math.pi / 180;
      out.add(_LeafSpec(
        cx + row.r * math.cos(rad),
        cy - row.r * math.sin(rad),
        (-deg + row.lead + 180) * math.pi / 180,
        row.len,
        row.wid,
      ));
    }
  }
  return out;
}

final List<_LeafSpec> _leaves = _branch();

class MedalWreath extends StatelessWidget {
  const MedalWreath({super.key, required this.place, this.size = 52});

  final int place;
  final double size;

  @override
  Widget build(BuildContext context) {
    final tone = MedalTone.forPlace(place);
    // Everything below is authored on a 120-wide grid; k maps it to `size`.
    final k = size / 120;
    final h = size * (110 / 120);

    Widget leaf(_LeafSpec l, {bool mirrored = false}) {
      final x = mirrored ? 120 - l.dx : l.dx;
      final angle = mirrored ? math.pi - l.angle : l.angle;
      return Positioned(
        left: x * k,
        top: l.dy * k,
        child: Transform.rotate(
          angle: angle,
          alignment: Alignment.centerLeft,
          child: Container(
            width: l.length * k,
            height: l.width * 2 * k,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [tone.leafA, tone.leafB],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              border: Border.all(color: tone.stem, width: 0.6 * k.clamp(0.6, 1.4)),
              // A rounded corner on one diagonal is what turns a rectangle
              // into a leaf — cheaper and crisper than a custom path.
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(l.width * 2 * k),
                bottomRight: Radius.circular(l.width * 2 * k),
              ),
            ),
          ),
        ),
      );
    }

    return SizedBox(
      width: size,
      height: h,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          for (final l in _leaves) leaf(l),
          for (final l in _leaves) leaf(l, mirrored: true),

          // Star
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            child: Icon(Icons.star_rounded, size: 34 * k, color: tone.star),
          ),

          // Disc
          Positioned(
            left: 34 * k,
            top: 37 * k,
            child: Container(
              width: 52 * k,
              height: 52 * k,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [tone.discA, tone.discB],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                border: Border.all(color: tone.ring, width: 2 * k.clamp(0.7, 1.6)),
              ),
              child: Text(
                '$place',
                style: TextStyle(
                  fontSize: 26 * k,
                  height: 1,
                  fontWeight: FontWeight.w900,
                  color: tone.ink,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
