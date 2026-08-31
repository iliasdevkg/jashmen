/// Self-serve password change — the dialog behind Settings → Аккаунт.
/// Port of src/components/PasswordDialog.jsx.
///
/// Two shapes, one form: an email/password account proves its current
/// password first; a Google-only account (AppUser.hasPassword == false) has
/// none to prove and is setting its first one, which is what makes email
/// sign-in start working for it.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../state/providers.dart';

/// Matches admin-api/routes.js#/u/me/password and #/u/signup.
const int _minPasswordLength = 6;

Future<void> showPasswordDialog(BuildContext context, {required bool hasPassword}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => PasswordDialog(hasPassword: hasPassword),
  );
}

class PasswordDialog extends ConsumerStatefulWidget {
  const PasswordDialog({super.key, required this.hasPassword});

  final bool hasPassword;

  @override
  ConsumerState<PasswordDialog> createState() => _PasswordDialogState();
}

class _PasswordDialogState extends ConsumerState<PasswordDialog> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _repeat = TextEditingController();

  bool _saving = false;
  bool _reveal = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _repeat.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    final s = StringsScope.of(context);
    final next = _next.text;

    if (next.length < _minPasswordLength) {
      setState(() => _error = s.t('settings.passwordShort'));
      return;
    }
    if (next != _repeat.text) {
      setState(() => _error = s.t('settings.passwordMismatch'));
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final res = await ref.read(apiClientProvider).changePassword(
            currentPassword: widget.hasPassword ? _current.text : null,
            newPassword: next,
          );
      // Every other session was just revoked server-side; adopting the
      // returned token is what keeps THIS device signed in.
      await ref.read(authProvider.notifier).adoptSession(res.token, res.user);
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.t('settings.passwordSaved'))),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = switch (e.kind) {
            ApiErrorKind.offline => s.t('common.offline'),
            ApiErrorKind.timeout || ApiErrorKind.server => s.t('common.serverError'),
            _ => e.message,
          });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _field(String label, TextEditingController controller, {bool autofocus = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: Gap.md),
      child: TextField(
        controller: controller,
        autofocus: autofocus,
        obscureText: !_reveal,
        enabled: !_saving,
        textInputAction: TextInputAction.next,
        onSubmitted: (_) => _save(),
        decoration: InputDecoration(
          labelText: label,
          suffixIcon: IconButton(
            onPressed: _saving ? null : () => setState(() => _reveal = !_reveal),
            icon: Icon(
              _reveal ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              size: 19,
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;

    return AlertDialog(
      title: Text(
        widget.hasPassword ? s.t('settings.changePassword') : s.t('settings.setPassword'),
        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: Gap.lg),
              child: Text(
                widget.hasPassword
                    ? s.t('settings.changePasswordDesc')
                    : s.t('settings.setPasswordDesc'),
                style: TextStyle(fontSize: 12, height: 1.35, color: tokens.muted),
              ),
            ),
            if (widget.hasPassword)
              _field(s.t('settings.currentPassword'), _current, autofocus: true),
            _field(s.t('settings.newPassword'), _next, autofocus: !widget.hasPassword),
            _field(s.t('settings.repeatPassword'), _repeat),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: Gap.sm),
                child: Text(
                  _error!,
                  style: const TextStyle(
                    color: AppColors.danger,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(),
          child: Text(s.t('common.cancel')),
        ),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : Text(s.t('common.save')),
        ),
      ],
    );
  }
}
