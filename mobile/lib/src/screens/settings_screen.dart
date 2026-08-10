/// Language, theme, sound, animations, sign-out. Port of
/// src/pages/SettingsPage.jsx.
///
/// Language and theme are device preferences (SharedPreferences); sound and
/// animations live on the user record, so they follow the account across
/// devices — same split as the web app.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_client.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../state/providers.dart';
import '../widgets/app_header.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _savingSettings = false;
  String _appVersion = '';

  @override
  void initState() {
    super.initState();
    // Shown in the About row; both stores expect the build to be
    // identifiable from inside the app.
    PackageInfo.fromPlatform().then((info) {
      if (mounted) setState(() => _appVersion = '${info.version} (${info.buildNumber})');
    });
  }

  Future<void> _openPrivacyPolicy() async {
    final uri = Uri.parse('https://jashmenstudio.com/privacy');
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      final s = StringsScope.of(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.t('common.error'))),
      );
    }
  }

  Future<void> _patchSettings({bool? sound, bool? animations}) async {
    final current = ref.read(userStateProvider);
    if (current == null) return;

    final next = current.settings.copyWith(sound: sound, animations: animations);

    // Optimistic: the toggle has to feel instant. A failed write reverts and
    // says so rather than leaving the switch lying about the saved value.
    ref.read(authProvider.notifier).applyState(current.copyWith(settings: next));
    setState(() => _savingSettings = true);

    try {
      final saved = await ref
          .read(apiClientProvider)
          .patchState({'settings': next.toJson()});
      ref.read(authProvider.notifier).applyState(saved);
    } on ApiException catch (e) {
      if (!mounted) return;
      ref.read(authProvider.notifier).applyState(current);
      final s = StringsScope.of(context);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(switch (e.kind) {
          ApiErrorKind.offline => s.t('common.offline'),
          _ => s.t('common.serverError'),
        }),
        backgroundColor: AppColors.danger,
      ));
    } finally {
      if (mounted) setState(() => _savingSettings = false);
    }
  }

  Future<void> _confirmSignOut() async {
    final s = StringsScope.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: Text(s.t('settings.logoutConfirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(s.t('common.cancel')),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(s.t('settings.logout'),
                style: const TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (ok == true) await ref.read(authProvider.notifier).signOut();
  }

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;
    final locale = ref.watch(localeProvider);
    final bright = ref.watch(brightModeProvider);
    final settings = ref.watch(userStateProvider)?.settings;

    return Scaffold(
      appBar: const AppHeader(),
      body: ListView(
        padding: const EdgeInsets.only(bottom: Gap.lg),
        children: [
          PageTitle(s.t('settings.title')),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.lg),
            child: _SectionLabel(s.t('settings.language')),
          ),
          // Material, not a coloured Container: RadioListTile paints its ink
          // splash on the nearest Material ancestor, and a decorated box in
          // between would swallow the tap feedback.
          Material(
            color: tokens.card,
            borderRadius: BorderRadius.circular(18),
            clipBehavior: Clip.antiAlias,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: tokens.border),
              ),
              // Flutter 3.32 moved group ownership from the individual tiles
              // to a RadioGroup ancestor; the per-tile groupValue/onChanged
              // pair is deprecated.
              child: RadioGroup<AppLocale>(
                groupValue: locale,
                onChanged: (v) =>
                    v == null ? null : ref.read(localeProvider.notifier).set(v),
                child: Column(
                  children: [
                    for (final l in AppLocale.values)
                      RadioListTile<AppLocale>(
                        value: l,
                        title: Text(l.label),
                        activeColor: AppColors.primary,
                      ),
                  ],
                ),
              ),
            ),
          ),

          const SizedBox(height: Gap.xl),
          _SectionLabel(s.t('settings.theme')),
          _Tile(
            icon: bright ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
            title: bright ? s.t('settings.themeBright') : s.t('settings.themeDark'),
            trailing: Switch(
              value: bright,
              activeThumbColor: AppColors.primary,
              onChanged: (_) => ref.read(brightModeProvider.notifier).toggle(),
            ),
          ),

          if (settings != null) ...[
            const SizedBox(height: Gap.xl),
            _Tile(
              icon: Icons.volume_up_rounded,
              title: s.t('settings.sound'),
              trailing: Switch(
                value: settings.sound,
                activeThumbColor: AppColors.primary,
                onChanged:
                    _savingSettings ? null : (v) => _patchSettings(sound: v),
              ),
            ),
            const SizedBox(height: Gap.md),
            _Tile(
              icon: Icons.auto_awesome_rounded,
              title: s.t('settings.animations'),
              trailing: Switch(
                value: settings.animations,
                activeThumbColor: AppColors.primary,
                onChanged:
                    _savingSettings ? null : (v) => _patchSettings(animations: v),
              ),
            ),
          ],

          const SizedBox(height: Gap.xl),
          _SectionLabel(s.t('settings.about')),
          _Tile(
            icon: Icons.privacy_tip_rounded,
            title: s.t('settings.privacy'),
            trailing: Icon(Icons.open_in_new_rounded, size: 18, color: tokens.faint),
            onTap: _openPrivacyPolicy,
          ),
          const SizedBox(height: Gap.md),
          _Tile(
            icon: Icons.info_outline_rounded,
            title: s.t('settings.version'),
            trailing: Text(_appVersion, style: Theme.of(context).textTheme.bodySmall),
          ),

          const SizedBox(height: Gap.xxl),
          OutlinedButton.icon(
            onPressed: _confirmSignOut,
            icon: const Icon(Icons.logout_rounded, color: AppColors.danger),
            label: Text(s.t('settings.logout'),
                style: const TextStyle(color: AppColors.danger)),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              side: const BorderSide(color: AppColors.danger, width: 1.5),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: Gap.md, left: 4),
        child: Text(text, style: Theme.of(context).textTheme.labelSmall),
      );
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.icon,
    required this.title,
    this.trailing,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final radius = BorderRadius.circular(18);

    // The background has to live on a Material, not a DecoratedBox wrapper:
    // ListTile paints its ink splash on the nearest Material ancestor, so a
    // coloured box in between hides the tap feedback entirely.
    return Material(
      color: tokens.card,
      borderRadius: radius,
      clipBehavior: Clip.antiAlias,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: radius,
          border: Border.all(color: tokens.border),
        ),
        child: ListTile(
          leading: Icon(icon, color: tokens.muted),
          title: Text(title, style: Theme.of(context).textTheme.titleSmall),
          trailing: trailing,
          onTap: onTap,
          shape: RoundedRectangleBorder(borderRadius: radius),
        ),
      ),
    );
  }
}
