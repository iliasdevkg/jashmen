/// The dialog behind "delete my account".
///
/// Both stores require an app that can create an account to be able to
/// destroy one from inside the app — App Store 5.1.1(v), Play's "Data
/// deletion". This is that screen, and it is designed around the one way it
/// goes badly wrong: a borrowed or unlocked phone.
///
/// So it is never one tap. An account with a password retypes it, because a
/// password is the one thing the phone's owner has that a borrower does not.
/// An account made through Google or Apple has no password to ask for, so it
/// types a word instead — deliberate friction standing in for a check we
/// cannot make.
///
/// It also says plainly what survives, because "your data is deleted" is a
/// promise, and the honest version of it here is that the points stay in the
/// campus total with nothing attached to them.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../state/providers.dart';

/// What a passwordless account types. Matches the server
/// (admin-api/routes.js#DELETE_CONFIRM_WORD) — the two must agree or the
/// dialog would refuse a correct answer.
const kDeleteConfirmWord = 'ӨЧҮР';

Future<void> showDeleteAccountDialog(
  BuildContext context, {
  required bool hasPassword,
}) =>
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _DeleteAccountDialog(hasPassword: hasPassword),
    );

class _DeleteAccountDialog extends ConsumerStatefulWidget {
  const _DeleteAccountDialog({required this.hasPassword});
  final bool hasPassword;

  @override
  ConsumerState<_DeleteAccountDialog> createState() => _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends ConsumerState<_DeleteAccountDialog> {
  final _controller = TextEditingController();
  bool _busy = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _ready => widget.hasPassword
      ? _controller.text.isNotEmpty
      : _controller.text.trim().toUpperCase() == kDeleteConfirmWord;

  Future<void> _submit() async {
    if (!_ready || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authProvider.notifier).deleteAccount(
            password: widget.hasPassword ? _controller.text : null,
            confirm: widget.hasPassword ? null : _controller.text.trim().toUpperCase(),
          );
      // Signing out rebuilds the app at the auth screen, so this dialog goes
      // with it — but pop anyway for the frame in between.
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e is ApiException ? e.message : '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;

    return AlertDialog(
      icon: const Icon(Icons.warning_amber_rounded, color: AppColors.danger, size: 32),
      title: Text(s.t('settings.deleteAccount')),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              s.t('settings.deleteWarning'),
              style: TextStyle(fontSize: 13.5, height: 1.5, color: tokens.muted),
            ),
            const SizedBox(height: Gap.lg),
            TextField(
              controller: _controller,
              autofocus: true,
              obscureText: widget.hasPassword && _obscure,
              enabled: !_busy,
              textCapitalization: widget.hasPassword
                  ? TextCapitalization.none
                  : TextCapitalization.characters,
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                labelText: widget.hasPassword
                    ? s.t('settings.deleteTypePassword')
                    : s.t('settings.deleteTypeWord', params: {'word': kDeleteConfirmWord}),
                errorText: _error,
                suffixIcon: widget.hasPassword
                    ? IconButton(
                        icon: Icon(_obscure
                            ? Icons.visibility_off_rounded
                            : Icons.visibility_rounded),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      )
                    : null,
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(),
          child: Text(s.t('common.cancel')),
        ),
        FilledButton(
          onPressed: _ready && !_busy ? _submit : null,
          style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
          child: _busy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : Text(s.t('settings.deleteConfirm')),
        ),
      ],
    );
  }
}
