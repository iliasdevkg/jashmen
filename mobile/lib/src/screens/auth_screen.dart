/// Sign in / sign up, matching the brand-blue mockups in jashmen01/: the
/// same vivid cobalt as the onboarding carousel, a light pill for the
/// active login/signup tab, and the white stadium CTA shared with
/// onboarding's "next"/"get started" button.
///
/// Deliberately NOT the app's shared theme: this screen is dark-on-blue on
/// every device (it renders before any user preference exists), so the
/// colours here are AppColors.auth* — literal brand values, not
/// bright-mode tokens.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../state/providers.dart';
import '../widgets/brand_pill_button.dart';
import '../widgets/apple_sign_in_button.dart';
import '../widgets/google_sign_in_button.dart';

const _bg = AppColors.authBg;
const _field = AppColors.authField;
const _placeholder = AppColors.authMuted;
const _inactiveTab = AppColors.authMuted;
const _tagline = AppColors.authMuted;

enum _Mode { login, signup }

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();

  _Mode _mode = _Mode.login;
  bool _obscure = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (!_formKey.currentState!.validate()) return;

    setState(() => _busy = true);
    try {
      final auth = ref.read(authProvider.notifier);
      if (_mode == _Mode.signup) {
        await auth.signup(_name.text.trim(), _email.text.trim(), _password.text);
      } else {
        await auth.login(_email.text.trim(), _password.text);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      final s = StringsScope.of(context);
      setState(() => _error = switch (e.kind) {
            ApiErrorKind.offline => s.t('common.offline'),
            ApiErrorKind.timeout || ApiErrorKind.server => s.t('common.serverError'),
            // The server's own message is the useful one — "email taken",
            // "wrong password" — and it is already localized server-side.
            _ => e.message,
          });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  InputDecoration _field$(String hint, {Widget? suffix}) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(
            color: _placeholder, fontSize: 14, fontWeight: FontWeight.w400),
        filled: true,
        fillColor: _field,
        suffixIcon: suffix,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: _border(Colors.transparent),
        enabledBorder: _border(Colors.transparent),
        focusedBorder: _border(Colors.white, width: 2),
        errorBorder: _border(AppColors.danger),
        focusedErrorBorder: _border(AppColors.danger, width: 2),
        errorStyle: const TextStyle(fontSize: 11, color: Color(0xFFF87171)),
      );

  OutlineInputBorder _border(Color c, {double width = 1.5}) =>
      OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: c, width: width),
      );

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final isSignup = _mode == _Mode.signup;

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
            child: ConstrainedBox(
              // Tailwind's max-w-sm, the width the web form uses on a phone.
              constraints: const BoxConstraints(maxWidth: 384),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // ── Brand block ──────────────────────────────────────
                  Center(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(24), // rounded-3xl
                      child: Image.asset(
                        'assets/images/logo.png',
                        width: 112,
                        height: 112,
                        fit: BoxFit.cover,
                        excludeFromSemantics: true,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Center(
                    child: Image.asset(
                      'assets/images/wordmark_white.png',
                      height: 32,
                      fit: BoxFit.contain,
                      semanticLabel: 'JashMen',
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    s.t('auth.tagline'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 14, color: _tagline, fontWeight: FontWeight.w400),
                  ),
                  const SizedBox(height: 40),

                  // ── Segmented login / signup ─────────────────────────
                  _Segmented(
                    mode: _mode,
                    enabled: !_busy,
                    onChanged: (m) => setState(() {
                      _mode = m;
                      _error = null;
                      _formKey.currentState?.reset();
                    }),
                  ),
                  const SizedBox(height: 24),

                  Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // The web animates this field's height in and out;
                        // AnimatedSize reproduces that without a plugin.
                        AnimatedSize(
                          duration: const Duration(milliseconds: 200),
                          curve: Curves.easeOut,
                          child: isSignup
                              ? Column(
                                  children: [
                                    TextFormField(
                                      controller: _name,
                                      textInputAction: TextInputAction.next,
                                      textCapitalization: TextCapitalization.words,
                                      style: const TextStyle(
                                          color: Colors.white, fontSize: 14),
                                      decoration: _field$(s.t('auth.name')),
                                      validator: (v) => (v == null || v.trim().isEmpty)
                                          ? s.t('auth.nameRequired')
                                          : null,
                                    ),
                                    const SizedBox(height: 12),
                                  ],
                                )
                              : const SizedBox(width: double.infinity),
                        ),

                        TextFormField(
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          autocorrect: false,
                          style: const TextStyle(color: Colors.white, fontSize: 14),
                          decoration: _field$('Email'),
                          validator: (v) {
                            final value = v?.trim() ?? '';
                            if (value.isEmpty) return s.t('auth.emailRequired');
                            if (!value.contains('@') || !value.contains('.')) {
                              return s.t('auth.emailInvalid');
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 12),

                        TextFormField(
                          controller: _password,
                          obscureText: _obscure,
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => _busy ? null : _submit(),
                          style: const TextStyle(color: Colors.white, fontSize: 14),
                          decoration: _field$(
                            s.t('auth.password'),
                            suffix: IconButton(
                              onPressed: () => setState(() => _obscure = !_obscure),
                              icon: Icon(
                                _obscure
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                                size: 18,
                                color: _placeholder,
                              ),
                            ),
                          ),
                          // Signup enforces the server's own minimum (6 —
                          // routes.js#/u/signup); login enforces nothing but
                          // "not empty". A stricter client rule on login is
                          // not a safety net, it is a lockout: accounts made
                          // on the web with a 6- or 7-character password
                          // could not get past this form at all.
                          validator: (v) {
                            final value = v ?? '';
                            if (value.isEmpty) return s.t('auth.passwordShort');
                            if (isSignup && value.length < 6) {
                              return s.t('auth.passwordShort');
                            }
                            return null;
                          },
                        ),

                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          Text(
                            _error!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 12, color: Color(0xFFF87171)),
                          ),
                        ],

                        const SizedBox(height: 16),
                        BrandPillButton(
                          label: _busy
                              ? s.t('common.loading')
                              : isSignup
                                  ? s.t('auth.createAccount')
                                  : s.t('auth.login'),
                          busy: _busy,
                          onPressed: _busy ? null : _submit,
                        ),

                        // Both render nothing unless their provider is
                        // actually configured — a sign-in button that cannot
                        // work is what App Store review calls a broken
                        // feature (Guideline 2.1).
                        GoogleSignInButton(
                          enabled: !_busy,
                          onError: (msg) => setState(() => _error = msg),
                        ),

                        // iOS only, and required there by Guideline 4.8
                        // wherever Google ships.
                        AppleSignInButton(
                          onError: (msg) => setState(() => _error = msg),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The mockup's pill toggle: a dark navy track with the active tab filled
/// as a light lavender pill and blue-on-light text — the inverse of a
/// typical "active = brand colour" tab, which is exactly what makes it read
/// as a control sitting *inside* the darker brand-blue page.
class _Segmented extends StatelessWidget {
  const _Segmented({
    required this.mode,
    required this.onChanged,
    this.enabled = true,
  });

  final _Mode mode;
  final ValueChanged<_Mode> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);

    Widget tab(_Mode m, String label) {
      final active = mode == m;
      return Expanded(
        child: GestureDetector(
          onTap: enabled ? () => onChanged(m) : null,
          behavior: HitTestBehavior.opaque,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: active ? AppColors.authChipActive : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
            ),
            alignment: Alignment.center,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: active ? AppColors.authBg : _inactiveTab,
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.authTrack,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          tab(_Mode.login, s.t('auth.login')),
          tab(_Mode.signup, s.t('auth.signup')),
        ],
      ),
    );
  }
}
