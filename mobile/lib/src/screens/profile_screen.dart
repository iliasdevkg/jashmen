/// Stats + achievements. Port of src/pages/ProfilePage.jsx.
library;

import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api_client.dart';
import '../core/i18n.dart';
import '../core/lesson_icons.dart';
import '../core/logic.dart';
import '../core/theme.dart';
import '../models/content.dart';
import '../models/user_state.dart';
import '../state/providers.dart';
import '../widgets/app_header.dart';
import '../widgets/count_up.dart';
import '../widgets/press_scale.dart';
import '../widgets/states.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;
    final locale = ref.watch(localeProvider);
    final session = ref.watch(authProvider);
    final content = ref.watch(contentProvider);

    if (session is! SessionSignedIn) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final user = session.user;
    final state = user.state;
    final league = content.hasValue
        ? getCurrentLeague(state.xp, content.value!.leagues)
        : null;

    return Scaffold(
      appBar: const AppHeader(),
      body: RefreshIndicator(
        onRefresh: () => ref.read(authProvider.notifier).refreshMe(),
        child: ListView(
          padding: const EdgeInsets.all(Gap.lg),
          children: [
            // Identity
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _EditableAvatar(user: user),
                const SizedBox(width: Gap.lg),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              user.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.headlineSmall,
                            ),
                          ),
                          if (state.vipBadge) ...[
                            const SizedBox(width: 6),
                            const Icon(Icons.workspace_premium_rounded,
                                size: 18, color: AppColors.gold),
                          ],
                          const SizedBox(width: 2),
                          // Task 6 — editable username, right on the
                          // profile (Settings keeps its own copy of this
                          // control too; both write through the same
                          // PATCH /u/me/state endpoint).
                          IconButton(
                            onPressed: () => showDialog<void>(
                              context: context,
                              builder: (_) => _EditNameDialog(user: user),
                            ),
                            icon: const Icon(Icons.edit_rounded, size: 15),
                            color: tokens.muted,
                            visualDensity: VisualDensity.compact,
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                            tooltip: s.t('settings.editName'),
                          ),
                        ],
                      ),
                      Text(user.email,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall),
                      if (league != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            localizedContent(league.name, locale),
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: Gap.xl),
            Text(s.t('profile.stats'),
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: Gap.md),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: Gap.md,
              crossAxisSpacing: Gap.md,
              childAspectRatio: 1.9,
              children: [
                _StatCard(
                  icon: Icons.star_rounded,
                  color: AppColors.primary,
                  label: s.t('profile.xp'),
                  // Lifetime, so the card keeps climbing while a campus
                  // board — not the general league — is the one filling up.
                  count: state.lifetimeXp,
                  delay: const Duration(milliseconds: 0),
                ),
                _StatCard(
                  icon: Icons.local_fire_department_rounded,
                  color: AppColors.warning,
                  label: s.t('profile.streak'),
                  count: state.streak,
                  delay: const Duration(milliseconds: 80),
                  pulse: state.streak > 0,
                ),
                _StatCard(
                  icon: Icons.monetization_on_rounded,
                  color: AppColors.gold,
                  label: s.t('profile.coins'),
                  count: state.coins,
                  delay: const Duration(milliseconds: 160),
                ),
                _StatCard(
                  icon: Icons.menu_book_rounded,
                  color: AppColors.success,
                  label: s.t('profile.lessons'),
                  count: state.completedLessons.length,
                  delay: const Duration(milliseconds: 240),
                ),
              ],
            ),

            const SizedBox(height: Gap.xl),
            Text(s.t('profile.achievements'),
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: Gap.md),

            content.when(
              loading: () => const SkeletonBox(height: 90, radius: 16),
              error: (_, __) => const SizedBox.shrink(),
              data: (data) {
                if (data.achievements.isEmpty) {
                  return EmptyView(
                    icon: Icons.military_tech_rounded,
                    title: s.t('profile.noAchievements'),
                  );
                }
                final earned = state.achievements.toSet();
                return Column(
                  children: [
                    for (final a in data.achievements)
                      _AchievementRow(
                        achievement: a,
                        earned: earned.contains(a.id),
                        tokens: tokens,
                        locale: locale,
                      ),
                  ],
                );
              },
            ),

            // Coupon history — the durable record behind the shop's
            // one-shot redeemed-code dialog, so "I did claim this" is
            // provable later.
            const SizedBox(height: Gap.xl),
            Text(s.t('profile.coupons'),
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: Gap.md),
            ref.watch(redemptionsProvider).when(
              loading: () => const SkeletonBox(height: 100, radius: 16),
              error: (err, _) => ErrorView(
                error: err,
                onRetry: () => ref.invalidate(redemptionsProvider),
              ),
              data: (items) {
                if (items.isEmpty) {
                  return Container(
                    padding: const EdgeInsets.all(Gap.lg),
                    decoration: BoxDecoration(
                      color: tokens.cardAlt,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.confirmation_number_outlined,
                            color: tokens.faint),
                        const SizedBox(width: Gap.md),
                        Expanded(
                          child: Text(s.t('profile.couponsEmpty'),
                              style: Theme.of(context).textTheme.bodySmall),
                        ),
                      ],
                    ),
                  );
                }
                return Column(
                  children: [
                    for (final r in items)
                      _CouponRow(redemption: r, locale: locale),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// One claimed coupon. Tapping anywhere on the card copies the code — the
/// row keeps standing even if the admin has since deleted the prize (title
/// falls back to the bare code, the proof that matters).
class _CouponRow extends StatelessWidget {
  const _CouponRow({required this.redemption, required this.locale});

  final Redemption redemption;
  final AppLocale locale;

  /// 2026-08-13 → 13.08.2026 — how dates are written locally.
  static String _dotDate(String iso) {
    final p = iso.split('-');
    return p.length == 3 ? '${p[2]}.${p[1]}.${p[0]}' : iso;
  }

  Future<void> _copy(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: redemption.code));
    if (!context.mounted) return;
    final s = StringsScope.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(s.t('common.copied'))),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;
    final title = localizedContent(redemption.prizeTitle, locale);
    final partner = localizedContent(redemption.partnerName, locale);
    final subtitle = [
      if (partner.isNotEmpty) partner,
      if (redemption.date.isNotEmpty) _dotDate(redemption.date),
    ].join(' · ');

    return Padding(
      padding: const EdgeInsets.only(bottom: Gap.md),
      child: Semantics(
        button: true,
        label: '${title.isEmpty ? redemption.code : title}. '
            '${s.t('profile.couponTapToCopy')}',
        child: PressScale(
          onTap: () => _copy(context),
          haptic: true,
          child: Container(
            padding: const EdgeInsets.all(Gap.md),
            decoration: BoxDecoration(
              color: tokens.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: tokens.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: tokens.cardAlt,
                        shape: BoxShape.circle,
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: redemption.partnerLogoUrl == null
                          ? Icon(Icons.confirmation_number_rounded,
                              size: 20, color: tokens.faint)
                          : ClipOval(
                              child: CachedNetworkImage(
                                imageUrl: redemption.partnerLogoUrl!,
                                fit: BoxFit.cover,
                                width: 40,
                                height: 40,
                                errorWidget: (_, __, ___) => Icon(
                                    Icons.confirmation_number_rounded,
                                    size: 20,
                                    color: tokens.faint),
                              ),
                            ),
                    ),
                    const SizedBox(width: Gap.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title.isEmpty ? redemption.code : title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                          if (subtitle.isNotEmpty)
                            Text(subtitle,
                                style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ),
                    ),
                    const SizedBox(width: Gap.sm),
                    Icon(Icons.copy_rounded, size: 16, color: tokens.faint),
                  ],
                ),
                const SizedBox(height: Gap.sm),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: Gap.sm + 2),
                  decoration: BoxDecoration(
                    color: tokens.cardAlt,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    redemption.code,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                      letterSpacing: 1.1,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.color,
    required this.label,
    required this.count,
    this.delay = Duration.zero,
    this.pulse = false,
  });

  final IconData icon;
  final Color color;
  final String label;
  final int count;
  final Duration delay;

  /// A lit streak gets a slow, subtle glow behind its icon — the one stat
  /// worth reminding the player is a live, ongoing thing, not just a number.
  final bool pulse;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          pulse ? _PulsingIcon(icon: icon, color: color) : Icon(icon, color: color, size: 26),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                CountUpNumber(
                  value: count,
                  delay: delay,
                  style: Theme.of(context)
                      .textTheme
                      .headlineSmall
                      ?.copyWith(color: tokens.text),
                ),
                Text(label, style: Theme.of(context).textTheme.labelSmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PulsingIcon extends ConsumerStatefulWidget {
  const _PulsingIcon({required this.icon, required this.color});
  final IconData icon;
  final Color color;

  @override
  ConsumerState<_PulsingIcon> createState() => _PulsingIconState();
}

class _PulsingIconState extends ConsumerState<_PulsingIcon>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final animate = ref.watch(userStateProvider)?.settings.animations ?? true;
    if (!animate) return Icon(widget.icon, color: widget.color, size: 26);

    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final t = Curves.easeInOut.transform(_c.value);
        return DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(color: widget.color.withValues(alpha: 0.25 + 0.25 * t), blurRadius: 10 + 6 * t),
            ],
          ),
          child: child,
        );
      },
      child: Icon(widget.icon, color: widget.color, size: 26),
    );
  }
}

class _AchievementRow extends StatelessWidget {
  const _AchievementRow({
    required this.achievement,
    required this.earned,
    required this.tokens,
    required this.locale,
  });

  final Achievement achievement;
  final bool earned;
  final dynamic tokens;
  final AppLocale locale;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: Gap.md),
      padding: const EdgeInsets.all(Gap.md),
      decoration: BoxDecoration(
        color: tokens.card as Color,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: earned ? AppColors.success : tokens.border as Color,
        ),
      ),
      child: Row(
        children: [
          Opacity(
            // Unearned achievements stay visible but dimmed — they're a goal,
            // not a secret.
            opacity: earned ? 1 : 0.35,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: tokens.cardAlt as Color,
                borderRadius: BorderRadius.circular(14),
              ),
              clipBehavior: Clip.antiAlias,
              child: lessonIconFor(achievement.icon) != null
                  ? Icon(lessonIconFor(achievement.icon),
                      color: earned ? AppColors.gold : tokens.faint as Color)
                  : achievement.iconUrl == null
                  ? Icon(Icons.military_tech_rounded, color: tokens.faint as Color)
                  : CachedNetworkImage(
                      imageUrl: achievement.iconUrl!,
                      fit: BoxFit.contain,
                      errorWidget: (_, __, ___) =>
                          Icon(Icons.military_tech_rounded, color: tokens.faint as Color),
                    ),
            ),
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(localizedContent(achievement.title, locale),
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: earned ? tokens.text as Color : tokens.muted as Color,
                        )),
                if (localizedContent(achievement.description, locale).isNotEmpty)
                  Text(localizedContent(achievement.description, locale),
                      style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          if (earned)
            const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 20)
          else
            Text('+${achievement.xp}',
                style: Theme.of(context)
                    .textTheme
                    .labelSmall
                    ?.copyWith(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

/// Task 6 — the profile photo, with a camera badge that picks a gallery
/// image and uploads it via POST /u/me/avatar. Falls back to the
/// name-initial circle both before any photo exists and if the upload
/// fails or the image URL 404s.
class _EditableAvatar extends ConsumerStatefulWidget {
  const _EditableAvatar({required this.user});
  final AppUser user;

  @override
  ConsumerState<_EditableAvatar> createState() => _EditableAvatarState();
}

class _EditableAvatarState extends ConsumerState<_EditableAvatar> {
  bool _uploading = false;
  String? _error;

  Future<void> _pickAndUpload() async {
    final picker = ImagePicker();
    XFile? picked;
    try {
      picked = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );
    } catch (_) {
      picked = null; // permission denied / picker unavailable — no-op, not an error state
    }
    if (picked == null || !mounted) return;

    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final updated = await api.uploadAvatar(File(picked.path));
      ref.read(authProvider.notifier).applyUser(updated);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;
    final user = widget.user;
    final initial = user.name.isEmpty ? '?' : user.name.characters.first.toUpperCase();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 68,
          height: 68,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                clipBehavior: Clip.antiAlias,
                alignment: Alignment.center,
                // ClipOval, not the Container's decoration clip: the
                // explicit oval is what guarantees the photo renders as a
                // true circle (the web's rounded-full + object-cover).
                child: user.avatar == null
                    ? Text(initial,
                        style: const TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                            color: Colors.white))
                    : ClipOval(
                        child: CachedNetworkImage(
                          imageUrl: user.avatar!,
                          fit: BoxFit.cover,
                          width: 64,
                          height: 64,
                          errorWidget: (_, __, ___) => Text(initial,
                              style: const TextStyle(
                                  fontSize: 26,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white)),
                        ),
                      ),
              ),
              Positioned(
                bottom: -2,
                right: -2,
                child: Semantics(
                  button: true,
                  label: s.t('profile.changePhoto'),
                  child: GestureDetector(
                    onTap: _uploading ? null : _pickAndUpload,
                    child: Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                        border: Border.all(color: tokens.bg, width: 2.5),
                      ),
                      alignment: Alignment.center,
                      child: _uploading
                          ? const SizedBox(
                              width: 12,
                              height: 12,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.camera_alt_rounded,
                              size: 12, color: Colors.white),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: SizedBox(
              width: 90,
              child: Text(_error!,
                  style: const TextStyle(color: AppColors.danger, fontSize: 10)),
            ),
          ),
      ],
    );
  }
}

/// Task 6 — the username editor, reachable from the pencil icon next to the
/// name. Writes through PATCH /u/me/state, same endpoint SettingsScreen's
/// own name field uses, so both stay consistent by construction.
class _EditNameDialog extends ConsumerStatefulWidget {
  const _EditNameDialog({required this.user});
  final AppUser user;

  @override
  ConsumerState<_EditNameDialog> createState() => _EditNameDialogState();
}

class _EditNameDialogState extends ConsumerState<_EditNameDialog> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.user.name);
  bool _saving = false;
  String? _error;

  Future<void> _save() async {
    final trimmed = _controller.text.trim();
    if (trimmed.isEmpty) {
      setState(() => _error = StringsScope.of(context).t('auth.nameRequired'));
      return;
    }
    if (trimmed == widget.user.name) {
      Navigator.of(context).pop();
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final updated = await api.updateName(trimmed);
      ref.read(authProvider.notifier).applyUser(updated);
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    return AlertDialog(
      title: Text(s.t('settings.editName')),
      content: TextField(
        controller: _controller,
        autofocus: true,
        maxLength: 60,
        enabled: !_saving,
        decoration: InputDecoration(
          hintText: s.t('auth.name'),
          errorText: _error,
        ),
        onSubmitted: (_) => _save(),
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
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : Text(s.t('common.confirm')),
        ),
      ],
    );
  }
}
