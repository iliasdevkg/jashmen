/// Short sound-effect playback — correct answer, wrong answer, lesson
/// complete. Mirrors haptics.dart's semantic-wrapper shape: a call site
/// says what *happened*, not which asset to play. Unlike haptics.dart this
/// can't gate itself on the user's "Үн" setting (that lives behind a
/// Riverpod provider, and this is a plain static utility) — callers check
/// `settings.sound` first, the same convention PressScale uses for the
/// animations toggle.
///
/// Web plays "correct"/"wrong"/"complete" as synthesized Web Audio
/// oscillator beeps (src/pages/LessonPage.jsx#playSound); mobile plays real
/// clips instead — recorded ones for correct/complete, and a synthesized
/// wrong.wav generated to match the web oscillator's exact sawtooth sweep
/// (see the file's own header) so a miss doesn't go silent on mobile.
library;

import 'package:audioplayers/audioplayers.dart';

class Sounds {
  const Sounds._();

  /// A quiz question answered correctly.
  static Future<void> correct() =>
      _playOnce('sounds/correct.mp3', mode: PlayerMode.lowLatency);

  /// A quiz question answered wrong.
  static Future<void> wrong() =>
      _playOnce('sounds/wrong.wav', mode: PlayerMode.lowLatency);

  /// The coin/XP clip that plays over the reward burst, layered just
  /// behind [correct] rather than replacing it — the two are meant to be
  /// heard together, which is why the caller staggers them.
  static Future<void> coinXp() =>
      _playOnce('sounds/coin_xp.mp3', mode: PlayerMode.lowLatency);

  /// A lesson finished — the same moment lesson_screen.dart fires
  /// Haptics.celebrate() and the confetti overlay (a review completion
  /// skips both, so this does too).
  static Future<void> lessonComplete() => _playOnce('sounds/lesson_complete.mp3');

  // A fresh AudioPlayer per call, released once playback finishes, rather
  // than one long-lived player reused across plays. Reusing a single
  // player worked for the *first* play but then went silent on every
  // question after that — a known audioplayers/SoundPool quirk on some
  // Android builds (reproduced on this project's own Samsung test device)
  // where a player's internal state doesn't cleanly reset for a second
  // .play() call. A short-lived player per sound sidesteps that class of
  // bug entirely; the extra allocation is immaterial for a one-shot SFX.
  static Future<void> _playOnce(String assetPath, {PlayerMode? mode}) async {
    final player = AudioPlayer();
    player.onPlayerComplete.first.then((_) => player.dispose()).ignore();
    try {
      await player.play(AssetSource(assetPath), mode: mode);
    } catch (_) {
      // A missing/corrupt asset or a platform hiccup should never crash a
      // lesson over a sound effect — release the player and move on.
      await player.dispose();
    }
  }
}
