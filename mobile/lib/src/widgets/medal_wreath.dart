/// The 1st / 2nd / 3rd place medal.
///
/// The supplied artwork, shipped as three PNGs in assets/medals/ and used
/// unmodified. It replaced a hand-drawn widget: drawing it scaled for free
/// and weighed nothing, but the two clients have to show the SAME medal, and
/// the only way to guarantee that with artwork somebody else authored is to
/// ship the file itself rather than a rendering of it. public/medals/ holds
/// byte-identical copies for the web.
///
/// The source images are trimmed to their visible bounds and padded to a
/// square, so a medal is always centred in whatever box the caller gives it
/// and the three line up at the same optical size.
library;

import 'package:flutter/material.dart';

class MedalWreath extends StatelessWidget {
  const MedalWreath({
    super.key,
    required this.place,
    this.size = 52,
    this.bright = false,
  });

  /// 1, 2 or 3. Anything else draws nothing rather than a broken asset.
  final int place;
  final double size;

  /// Kept because callers pass it and the light theme may yet need the medals
  /// treated differently. Nothing is drawn behind them either way: the drop
  /// shadow this used to add in the light theme read as a grey smudge under
  /// each place and was asked for twice to be removed. If silver ever needs
  /// separating from a white background again, give it an outline in the
  /// artwork rather than a shadow under the widget.
  final bool bright;

  @override
  Widget build(BuildContext context) {
    if (place < 1 || place > 3) return SizedBox(width: size, height: size);

    final image = Image.asset(
      'assets/medals/$place.png',
      width: size,
      height: size,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.medium,
      // A missing asset must not take the leaderboard down with it.
      errorBuilder: (_, __, ___) => SizedBox(width: size, height: size),
    );

    return SizedBox(width: size, height: size, child: image);
  }
}
