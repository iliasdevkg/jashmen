import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../state/providers.dart';
import '../widgets/google_sign_in_button.dart';

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

  bool _isSignup = false;
  bool _obscure = true;
  bool _busy = false;
  String? _serverError;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _serverError = null);
    if (!_formKey.currentState!.validate()) return;

    setState(() => _busy = true);
    try {
      final auth = ref.read(authProvider.notifier);
      if (_isSignup) {
        await auth.signup(_name.text.trim(), _email.text.trim(), _password.text);
      } else {
        await auth.login(_email.text.trim(), _password.text);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      final s = StringsScope.of(context);
      setState(() => _serverError = switch (e.kind) {
            ApiErrorKind.offline => s.t('common.offline'),
            ApiErrorKind.timeout || ApiErrorKind.server => s.t('common.serverError'),
            // The server's own message is the useful one here — "email taken",
            // "wrong password" — and it is already localized server-side.
            _ => e.message,
          });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;
    final text = Theme.of(context).textTheme;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: Gap.xl, vertical: Gap.xxl),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Image.asset(
                        'assets/images/logo.png',
                        width: 88,
                        height: 88,
                        // Decorative: the wordmark below carries the name.
                        excludeFromSemantics: true,
                      ),
                    ),
                    const SizedBox(height: Gap.xl),
                    Text(
                      _isSignup ? s.t('auth.signupTitle') : s.t('auth.loginTitle'),
                      textAlign: TextAlign.center,
                      style: text.displaySmall,
                    ),
                    const SizedBox(height: Gap.sm),
                    Text(
                      _isSignup ? s.t('auth.signupSubtitle') : s.t('auth.loginSubtitle'),
                      textAlign: TextAlign.center,
                      style: text.bodyMedium?.copyWith(color: tokens.muted),
                    ),
                    const SizedBox(height: Gap.xxl),

                    if (_isSignup) ...[
                      TextFormField(
                        controller: _name,
                        textInputAction: TextInputAction.next,
                        textCapitalization: TextCapitalization.words,
                        decoration: InputDecoration(hintText: s.t('auth.name')),
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? s.t('auth.nameRequired') : null,
                      ),
                      const SizedBox(height: Gap.md),
                    ],

                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autocorrect: false,
                      decoration: InputDecoration(hintText: s.t('auth.email')),
                      validator: (v) {
                        final value = v?.trim() ?? '';
                        if (value.isEmpty) return s.t('auth.emailRequired');
                        if (!value.contains('@') || !value.contains('.')) {
                          return s.t('auth.emailInvalid');
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: Gap.md),

                    TextFormField(
                      controller: _password,
                      obscureText: _obscure,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _busy ? null : _submit(),
                      decoration: InputDecoration(
                        hintText: s.t('auth.password'),
                        suffixIcon: IconButton(
                          onPressed: () => setState(() => _obscure = !_obscure),
                          icon: Icon(
                            _obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                            color: tokens.muted,
                          ),
                        ),
                      ),
                      validator: (v) =>
                          (v == null || v.length < 8) ? s.t('auth.passwordShort') : null,
                    ),

                    if (_serverError != null) ...[
                      const SizedBox(height: Gap.lg),
                      Container(
                        padding: const EdgeInsets.all(Gap.md),
                        decoration: BoxDecoration(
                          color: AppColors.danger.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.danger.withValues(alpha: 0.35)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded,
                                size: 18, color: AppColors.danger),
                            const SizedBox(width: Gap.sm),
                            Expanded(
                              child: Text(
                                _serverError!,
                                style: text.bodySmall?.copyWith(color: AppColors.danger),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: Gap.xl),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2.5, color: Colors.white),
                            )
                          : Text(_isSignup ? s.t('auth.signup') : s.t('auth.login')),
                    ),

                    // Renders nothing unless GOOGLE_SERVER_CLIENT_ID was
                    // provided at build time — see docs/GOOGLE_SIGNIN.md.
                    GoogleSignInButton(
                      enabled: !_busy,
                      onError: (msg) => setState(() => _serverError = msg),
                    ),

                    const SizedBox(height: Gap.lg),
                    TextButton(
                      onPressed: _busy
                          ? null
                          : () => setState(() {
                                _isSignup = !_isSignup;
                                _serverError = null;
                                _formKey.currentState?.reset();
                              }),
                      child: Text.rich(
                        TextSpan(
                          text: _isSignup ? s.t('auth.haveAccount') : s.t('auth.noAccount'),
                          style: text.bodySmall?.copyWith(color: tokens.muted),
                          children: [
                            const TextSpan(text: '  '),
                            TextSpan(
                              text: _isSignup ? s.t('auth.login') : s.t('auth.signup'),
                              style: text.bodySmall?.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
