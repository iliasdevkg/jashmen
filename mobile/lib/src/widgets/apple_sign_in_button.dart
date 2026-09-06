/// "Sign in with Apple".
///
/// Required by App Store Guideline 4.8 anywhere a third-party sign-in ships,
/// which for this app means anywhere the Google button does. It is also the
/// only social sign-in an iPhone user is guaranteed to already have — no app
/// to install, no password to remember, one Face ID.
///
/// Shown on iOS only, and only when the server says it can verify a token
/// (`appleSignIn` in GET /public/config). A visible control that cannot work
/// is what review calls a broken feature, so if the server is not configured
/// the button is simply not there and email/password carries on.
///
/// APPLE SENDS THE NAME ONCE. The `givenName`/`familyName` fields are
/// populated on the very first authorisation for this Apple ID and are empty
/// on every one after it — even after an uninstall and reinstall. So they go
/// straight to the server, which uses them only when creating the account.
/// There is no second chance to collect them.
library;

import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../api/api_client.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../state/providers.dart';

class AppleSignInButton extends ConsumerStatefulWidget {
  const AppleSignInButton({super.key, this.onError});

  /// Called with a message worth showing. The auth screen owns where errors
  /// appear, so this widget never puts a snackbar on screen itself.
  final void Function(String message)? onError;

  @override
  ConsumerState<AppleSignInButton> createState() => _AppleSignInButtonState();
}

class _AppleSignInButtonState extends ConsumerState<AppleSignInButton> {
  bool _busy = false;

  Future<void> _signIn() async {
    final s = StringsScope.of(context);
    setState(() => _busy = true);
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: const [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );

      final token = credential.identityToken;
      if (token == null || token.isEmpty) {
        widget.onError?.call(s.t('auth.appleFailed'));
        return;
      }

      // Present only on the first authorisation; empty afterwards, which is
      // normal and not an error.
      final name = [credential.givenName, credential.familyName]
          .where((part) => part != null && part.trim().isNotEmpty)
          .join(' ')
          .trim();

      await ref.read(authProvider.notifier).signInWithApple(
            token,
            name: name.isEmpty ? null : name,
          );
    } on SignInWithAppleAuthorizationException catch (e) {
      // Cancelling is not a failure — saying "sign-in failed" to someone who
      // deliberately backed out is noise.
      if (e.code != AuthorizationErrorCode.canceled) {
        widget.onError?.call(s.t('auth.appleFailed'));
      }
    } on ApiException catch (e) {
      // The server's message is the useful one here: the "no email" case
      // tells the person exactly which setting to change.
      widget.onError?.call(e.message);
    } catch (_) {
      widget.onError?.call(s.t('auth.appleFailed'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Android has no Apple sign-in to offer, and the plugin is a no-op there.
    if (!Platform.isIOS) return const SizedBox.shrink();

    final available = ref.watch(publicConfigProvider).valueOrNull?.appleSignIn ?? false;
    if (!available) return const SizedBox.shrink();

    final s = StringsScope.of(context);

    return Padding(
      padding: const EdgeInsets.only(top: Gap.md),
      child: GestureDetector(
        onTap: _busy ? null : _signIn,
        child: Container(
          height: 54,
          decoration: BoxDecoration(
            // Apple's own guidance: black on light, white on dark. The auth
            // screen is the brand blue, so black is the one that reads.
            color: Colors.black,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 54,
                child: Center(
                  child: _busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.apple, color: Colors.white, size: 26),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(right: 54),
                  child: Text(
                    s.t('auth.apple'),
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
    );
  }
}
