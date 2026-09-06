/// "Continue with Google" for the mobile clients.
///
/// The native flow yields an id_token, which goes to the very same
/// POST /u/auth/google the web client calls — one server-side auth path, not
/// two. The token is passed straight through and never stored on the device.
///
/// The button is ALWAYS on screen — it is part of the sign-in design, not
/// an optional extra that appears once a server variable happens to be set.
/// (It used to hide itself when no client id was configured, which made
/// "sign in with Google" look like a missing feature rather than a missing
/// setting.) Tapping it before Google is configured says so plainly instead
/// of throwing a plugin error; email/password sits right above and works
/// either way.
///
/// The ids come from GET /public/config at runtime rather than from a
/// --dart-define, so switching Google on is a server change and not a store
/// release — an already-installed build picks it up on its next launch.
library;

import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../api/api_client.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../state/providers.dart';

/// Build-time override, kept for a build that has to work against a server
/// that doesn't serve the id yet. Normally empty: the value comes from
/// GET /public/config instead.
const String kGoogleServerClientId =
    String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');

/// Same, for the iOS client id.
const String kGoogleIosClientId =
    String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');

String? _orNull(String v) => v.isEmpty ? null : v;

class GoogleSignInButton extends ConsumerStatefulWidget {
  const GoogleSignInButton({super.key, this.onError, this.enabled = true});

  final ValueChanged<String>? onError;
  final bool enabled;

  @override
  ConsumerState<GoogleSignInButton> createState() => _GoogleSignInButtonState();
}

class _GoogleSignInButtonState extends ConsumerState<GoogleSignInButton> {
  bool _busy = false;

  /// The WEB client id — the audience the backend verifies, so every
  /// platform sends it. A --dart-define wins over the server's answer.
  String? get _serverClientId =>
      _orNull(kGoogleServerClientId) ??
      ref.read(publicConfigProvider).valueOrNull?.googleClientId;

  /// iOS needs its own id at sign-in time; Android resolves itself from the
  /// package name + signing certificate and passes none.
  String? get _iosClientId => Platform.isIOS
      ? (_orNull(kGoogleIosClientId) ??
          ref.read(publicConfigProvider).valueOrNull?.googleClientIdIos)
      : null;

  /// Whether the SDK can safely be started on this platform.
  ///
  /// On iOS the Google SDK reads its configuration from GIDClientID in
  /// Info.plist or from the clientId handed to it here. This app ships
  /// neither yet — ios/Runner/Info.plist still carries the placeholder URL
  /// scheme, and the server answers googleClientIdIos: null. Calling the
  /// SDK in that state raises an Objective-C exception ("No active
  /// configuration") that NO Dart catch can hold: the process dies.
  ///
  /// So the button stays on screen — taking a sign-in method away is worse
  /// than one that is not ready yet — and this is the check that keeps the
  /// tap from reaching the SDK. Set GOOGLE_CLIENT_ID_IOS on the server and
  /// the id arrives through /public/config at runtime: the flow starts
  /// working with no new build.
  ///
  /// Android is unaffected: it resolves itself from the package name and
  /// signing certificate and needs no id from us.
  bool get _canStartSdk =>
      _serverClientId != null && (!Platform.isIOS || _iosClientId != null);

  Future<void> _signIn() async {
    final s = StringsScope.of(context);
    final serverClientId = _serverClientId;
    if (!_canStartSdk || serverClientId == null) {
      // No client id yet: say why rather than letting the plugin throw a
      // generic failure the user can do nothing about.
      widget.onError?.call(s.t('auth.googleUnavailable'));
      return;
    }
    setState(() => _busy = true);

    try {
      final google = GoogleSignIn(
        scopes: const ['email', 'profile'],
        clientId: _iosClientId,
        serverClientId: serverClientId,
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
    // Watched so the button switches from "not configured" to the live
    // flow the moment the config lands, with no rebuild of the screen.
    ref.watch(publicConfigProvider);

    final s = StringsScope.of(context);

    final disabled = _busy || !widget.enabled;

    return Column(
      children: [
        const SizedBox(height: Gap.xl),
        Row(
          children: [
            Expanded(child: Divider(color: AppColors.authMuted.withValues(alpha: 0.25))),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.md),
              child: Text(
                s.t('auth.or'),
                style: const TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.authMuted),
              ),
            ),
            Expanded(child: Divider(color: AppColors.authMuted.withValues(alpha: 0.25))),
          ],
        ),
        const SizedBox(height: Gap.lg),
        // Matches the mockups' near-black pill: dark track, white circular
        // "G" badge on the left, label centred. Google's brand guidelines
        // require the mark to sit on white, hence the badge rather than a
        // bare glyph.
        Opacity(
          opacity: disabled ? 0.6 : 1,
          child: GestureDetector(
            onTap: disabled ? null : _signIn,
            behavior: HitTestBehavior.opaque,
            child: Container(
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.authGoogleBtn,
                borderRadius: BorderRadius.circular(28),
              ),
              // A Row, not a Stack with a centred label — "Google" reads much
              // longer in Kyrgyz ("Google менен улантуу") than in Russian or
              // English, and a stack-centred label collides with the badge
              // at that length. The trailing spacer mirrors the badge's own
              // footprint so the label still optically centres in the pill
              // rather than in "whatever space is left of the badge".
              child: Row(
                children: [
                  const SizedBox(width: 6),
                  Container(
                    width: 44,
                    height: 44,
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
                        : const _GoogleGlyph(size: 26),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 50),
                      child: Text(
                        s.t('auth.google'),
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
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

/// Google's mark, as the real artwork (assets/medals/googlelogo.png) rather
/// than the four arcs this used to draw by hand. A brand mark should be the
/// brand's own file; the drawn version was close but not Google's geometry,
/// and it is the one image on the sign-in screen a person recognises before
/// they read anything.
///
/// The painted version stays as the fallback: a bundle that somehow ships
/// without the asset shows a G rather than a broken-image box on the button
/// people use to get into the app.
class _GoogleGlyph extends StatelessWidget {
  const _GoogleGlyph({this.size = 20});
  final double size;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: size,
        height: size,
        child: Image.asset(
          'assets/medals/googlelogo.png',
          width: size,
          height: size,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.medium,
          errorBuilder: (_, __, ___) =>
              CustomPaint(painter: _GoogleGlyphPainter()),
        ),
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
