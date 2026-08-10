/// "Continue with Google" for the mobile clients.
///
/// The native flow yields an id_token, which goes to the very same
/// POST /u/auth/google the web client calls — one server-side auth path, not
/// two. The token is passed straight through and never stored on the device.
///
/// Rendered only when the platform is actually configured (see
/// docs/GOOGLE_SIGNIN.md): without an iOS URL scheme / Android SHA-1 the
/// plugin throws at sign-in time, so a permanently broken button would be
/// worse than none at all.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../api/api_client.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../state/providers.dart';

/// iOS reads its client ID from Info.plist; Android resolves it from the
/// package name + signing certificate registered in Google Cloud Console.
/// `serverClientId` is the WEB client ID — it is what makes Google mint an
/// id_token whose audience the backend recognises.
const String kGoogleServerClientId =
    String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');

bool get isGoogleSignInConfigured => kGoogleServerClientId.isNotEmpty;

class GoogleSignInButton extends ConsumerStatefulWidget {
  const GoogleSignInButton({super.key, this.onError, this.enabled = true});

  final ValueChanged<String>? onError;
  final bool enabled;

  @override
  ConsumerState<GoogleSignInButton> createState() => _GoogleSignInButtonState();
}

class _GoogleSignInButtonState extends ConsumerState<GoogleSignInButton> {
  bool _busy = false;

  Future<void> _signIn() async {
    final s = StringsScope.of(context);
    setState(() => _busy = true);

    try {
      final google = GoogleSignIn(
        scopes: const ['email', 'profile'],
        serverClientId: kGoogleServerClientId,
      );

      // Sign out first so the account chooser always appears; otherwise the
      // plugin silently reuses the last account, which is confusing on a
      // shared device.
      await google.signOut();

      final account = await google.signIn();
      if (account == null) {
        // User dismissed the chooser — not an error worth shouting about.
        if (mounted) setState(() => _busy = false);
        return;
      }

      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) {
        widget.onError?.call(s.t('auth.googleFailed'));
        if (mounted) setState(() => _busy = false);
        return;
      }

      await ref.read(authProvider.notifier).signInWithGoogle(idToken);
      // Success flips the session and the app swaps this screen out, so
      // there is no state to reset.
    } on ApiException catch (e) {
      widget.onError?.call(switch (e.kind) {
        ApiErrorKind.offline => s.t('common.offline'),
        ApiErrorKind.timeout || ApiErrorKind.server => s.t('common.serverError'),
        _ => e.message,
      });
      if (mounted) setState(() => _busy = false);
    } catch (_) {
      // Plugin-level failures (missing URL scheme, cancelled by the OS,
      // Play Services unavailable) all land here; the user can only retry.
      widget.onError?.call(s.t('auth.googleFailed'));
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!isGoogleSignInConfigured) return const SizedBox.shrink();

    final s = StringsScope.of(context);
    final tokens = context.tokens;
    final disabled = _busy || !widget.enabled;

    return Column(
      children: [
        const SizedBox(height: Gap.xl),
        Row(
          children: [
            Expanded(child: Divider(color: tokens.border)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.md),
              child: Text(s.t('auth.or'),
                  style: Theme.of(context).textTheme.labelSmall),
            ),
            Expanded(child: Divider(color: tokens.border)),
          ],
        ),
        const SizedBox(height: Gap.lg),
        // Matches the web, which renders Google's own filled_black pill
        // button: dark track, white circular "G" badge on the left, label
        // centred. Google's brand guidelines require the mark to sit on
        // white, hence the badge rather than a bare glyph.
        Opacity(
          opacity: disabled ? 0.6 : 1,
          child: GestureDetector(
            onTap: disabled ? null : _signIn,
            behavior: HitTestBehavior.opaque,
            child: Container(
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFF202124),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Text(
                    s.t('auth.google'),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFFE8EAED),
                    ),
                  ),
                  Positioned(
                    left: 4,
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: _busy
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const _GoogleGlyph(size: 20),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Google's four-colour "G", drawn rather than shipped as an asset so the
/// button has no network or bundle dependency.
class _GoogleGlyph extends StatelessWidget {
  const _GoogleGlyph({this.size = 20});
  final double size;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: size,
        height: size,
        child: CustomPaint(painter: _GoogleGlyphPainter()),
      );
}

class _GoogleGlyphPainter extends CustomPainter {
  static const _blue = Color(0xFF4285F4);
  static const _green = Color(0xFF34A853);
  static const _yellow = Color(0xFFFBBC05);
  static const _red = Color(0xFFEA4335);

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(0, 0, size.width, size.height).deflate(size.width * 0.08);
    final stroke = size.width * 0.22;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.butt;

    // Four arcs, one per brand colour, then the horizontal bar of the "G".
    canvas.drawArc(rect, -0.5, 1.2, false, paint..color = _blue);
    canvas.drawArc(rect, 0.75, 1.3, false, paint..color = _green);
    canvas.drawArc(rect, 2.1, 1.4, false, paint..color = _yellow);
    canvas.drawArc(rect, 3.6, 1.4, false, paint..color = _red);

    canvas.drawRect(
      Rect.fromLTWH(size.width * 0.5, size.height * 0.42, size.width * 0.42, stroke),
      Paint()..color = _blue,
    );
  }

  @override
  bool shouldRepaint(_GoogleGlyphPainter oldDelegate) => false;
}
