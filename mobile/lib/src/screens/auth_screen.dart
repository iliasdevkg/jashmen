/// Sign in / sign up — a direct port of the web app's mobile layout
/// (src/pages/AuthPage.jsx), down to the segmented login/signup control,
/// the 112px squircle logo above the wordmark, and the tagline.
///
/// Deliberately NOT the app's shared theme: the web auth page is dark on
/// every device (it renders before any user preference exists), so the
/// colours here are its literal values rather than bright-mode tokens.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../state/providers.dart';
import '../widgets/google_sign_in_button.dart';

// AuthPage.jsx's own palette.
const _bg = Color(0xFF0F172A);
const _field = Color(0xFF1E293B);
const _fieldBorder = Color(0xFF334155);
const _placeholder = Color(0xFF64748B);
const _inactiveTab = Color(0xFF64748B);
const _tagline = Color(0xFF94A3B8);

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
        border: _border(_fieldBorder),
        enabledBorder: _border(_fieldBorder),
        focusedBorder: _border(AppColors.primary, width: 2),
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
                          validator: (v) => (v == null || v.length < 8)
                              ? s.t('auth.passwordShort')
                              : null,
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
                        _PrimaryButton(
                          label: _busy
                              ? s.t('common.loading')
                              : isSignup
                                  ? s.t('auth.createAccount')
                                  : s.t('auth.login'),
                          busy: _busy,
                          onPressed: _busy ? null : _submit,
                        ),

                        // Renders nothing unless GOOGLE_SERVER_CLIENT_ID was
                        // provided at build time — see docs/GOOGLE_SIGNIN.md.
                        GoogleSignInButton(
                          enabled: !_busy,
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

/// The web's pill toggle: a #1e293b track with the active half filled blue.
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
              color: active ? AppColors.primary : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
            ),
            alignment: Alignment.center,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: active ? Colors.white : _inactiveTab,
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: _field,
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

/// Full-width blue submit, scaling to 0.97 on press like the web's
/// `whileTap`.
class _PrimaryButton extends ConsumerStatefulWidget {
  const _PrimaryButton({
    required this.label,
    required this.onPressed,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  ConsumerState<_PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends ConsumerState<_PrimaryButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null;

    return GestureDetector(
      onTapDown: enabled ? (_) => setState(() => _down = true) : null,
      onTapUp: enabled ? (_) => setState(() => _down = false) : null,
      onTapCancel: enabled ? () => setState(() => _down = false) : null,
      onTap: widget.onPressed,
      child: AnimatedScale(
        scale: _down ? 0.97 : 1,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: Opacity(
          opacity: enabled ? 1 : 0.6,
          child: Container(
            height: 52,
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(12),
            ),
            alignment: Alignment.center,
            child: widget.busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2.5, color: Colors.white),
                  )
                : Text(
                    widget.label,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}
