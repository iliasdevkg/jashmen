/// Coin shop + partner rewards — port of src/pages/ShopPage.jsx.
///
/// Two views in one screen, toggled by `_activePartnerId` rather than a
/// route push (same "drill down in place" pattern LessonPreviewSheet uses
/// on web): the main view is the coin-item grid plus a partner list (Task
/// 11); tapping a partner drills into that partner's redeemable-prize
/// catalog, with a back button returning to the main view.
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../core/haptics.dart';
import '../core/i18n.dart';
import '../core/lesson_icons.dart';
import '../core/theme.dart';
import '../models/content.dart';
import '../state/providers.dart';
import '../widgets/app_header.dart';
import '../widgets/confetti.dart';
import '../widgets/press_scale.dart';
import '../widgets/states.dart';
import '../widgets/zoomable_image.dart';

class ShopScreen extends ConsumerStatefulWidget {
  const ShopScreen({super.key});

  @override
  ConsumerState<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends ConsumerState<ShopScreen> {
  /// Id of the item whose purchase is in flight, so only that card shows a
  /// spinner rather than the whole grid locking up.
  String? _buying;
  String? _redeeming;

  /// null = main shop view; a partner's id = drilled into their prize list.
  String? _activePartnerId;

  /// The full-screen burst behind the redeemed-code dialog — a purchase is
  /// a small win (just a haptic tap); redeeming a real-world prize is the
  /// bigger one, so it's the one that gets confetti.
  final _confetti = ConfettiController();

  @override
  void dispose() {
    _confetti.dispose();
    super.dispose();
  }

  Future<void> _buy(ShopItem item) async {
    setState(() => _buying = item.id);
    final s = StringsScope.of(context);
    final messenger = ScaffoldMessenger.of(context);

    try {
      final state = await ref.read(apiClientProvider).buyItem(item.id);
      ref.read(authProvider.notifier).applyState(state);
      if (mounted) {
        Haptics.success();
        messenger.showSnackBar(SnackBar(content: Text(s.t('shop.owned'))));
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(
        content: Text(switch (e.kind) {
          ApiErrorKind.offline => s.t('common.offline'),
          ApiErrorKind.timeout || ApiErrorKind.server => s.t('common.serverError'),
          _ => e.message,
        }),
        backgroundColor: AppColors.danger,
      ));
    } finally {
      if (mounted) setState(() => _buying = null);
    }
  }

  Future<void> _redeem(Prize prize) async {
    setState(() => _redeeming = prize.id);
    final s = StringsScope.of(context);
    final messenger = ScaffoldMessenger.of(context);

    try {
      final api = ref.read(apiClientProvider);
      final result = await api.redeemPrize(prize.id);
      ref.read(authProvider.notifier).applyState(result.state);
      if (mounted) {
        Haptics.celebrate();
        _confetti.play();
        await showDialog<void>(
          context: context,
          builder: (_) => _RedeemedCodeDialog(
            code: result.code,
            promoCode: result.promoCode,
          ),
        );
      }
      // The sale took a code out of the pool, so the "3 left" on the card
      // behind this dialog is already wrong; the coupon list has a new row
      // too. Both are refetched rather than patched, because the server is
      // the one that knows what is left after everyone else's purchases.
      ref.invalidate(contentProvider);
      ref.invalidate(redemptionsProvider);
    } on ApiException catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(
        content: Text(switch (e.kind) {
          ApiErrorKind.offline => s.t('common.offline'),
          ApiErrorKind.timeout || ApiErrorKind.server => s.t('common.serverError'),
          _ => e.message,
        }),
        backgroundColor: AppColors.danger,
      ));
    } finally {
      if (mounted) setState(() => _redeeming = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final locale = ref.watch(localeProvider);
    final content = ref.watch(contentProvider);
    final userState = ref.watch(userStateProvider);
    final coins = userState?.coins ?? 0;
    final owned = userState?.ownedShop.toSet() ?? <String>{};

    return ConfettiOverlay(
      controller: _confetti,
      child: Scaffold(
      appBar: _activePartnerId != null
          ? AppBar(
              leading: IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
                tooltip: s.t('common.back'),
                onPressed: () => setState(() => _activePartnerId = null),
              ),
            )
          : const AppHeader(),
      body: RefreshIndicator(
        onRefresh: () async =>
            ref.read(refresherProvider).tab(HomeTab.shop, force: true),
        child: content.when(
        loading: () => ListView(
          padding: const EdgeInsets.all(Gap.lg),
          children: [
            for (var i = 0; i < 4; i++)
              const Padding(
                padding: EdgeInsets.only(bottom: Gap.md),
                child: SkeletonBox(height: 92, radius: 20),
              ),
          ],
        ),
        error: (err, _) =>
            ErrorView(error: err, onRetry: () => ref.invalidate(contentProvider)),
        data: (data) {
          final activePartner = _activePartnerId == null
              ? null
              : data.partnerById(_activePartnerId);

          if (activePartner != null) {
            final prizes = data.prizesFor(activePartner.id);
            return ListView(
              padding: const EdgeInsets.fromLTRB(Gap.lg, 0, Gap.lg, Gap.lg),
              children: [
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: context.tokens.cardAlt,
                        shape: BoxShape.circle,
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: activePartner.logoUrl == null
                          ? Icon(Icons.storefront_rounded, color: context.tokens.faint)
                          : ZoomableImage(
                              imageUrl: activePartner.logoUrl!,
                              tag: 'partner-head-${activePartner.id}',
                              caption: localizedContent(activePartner.name, locale),
                              child: CachedNetworkImage(
                                imageUrl: activePartner.logoUrl!,
                                fit: BoxFit.contain,
                                errorWidget: (_, __, ___) =>
                                    Icon(Icons.storefront_rounded, color: context.tokens.faint),
                              ),
                            ),
                    ),
                    const SizedBox(width: Gap.md),
                    Expanded(
                      child: Text(localizedContent(activePartner.name, locale),
                          style: Theme.of(context).textTheme.headlineSmall),
                    ),
                  ],
                ),
                const SizedBox(height: Gap.lg),
                if (prizes.isEmpty)
                  EmptyView(
                    icon: Icons.card_giftcard_rounded,
                    title: s.t('shop.noPrizesForPartner'),
                  )
                else
                  for (final prize in prizes)
                    Padding(
                      padding: const EdgeInsets.only(bottom: Gap.md),
                      child: _PrizeCard(
                        prize: prize,
                        affordable: coins >= prize.priceCoins,
                        busy: _redeeming == prize.id,
                        onRedeem: () => _redeem(prize),
                        locale: locale,
                      ),
                    ),
              ],
            );
          }

          if (data.shopItems.isEmpty && data.partners.isEmpty) {
            return EmptyView(
              icon: Icons.shopping_bag_rounded,
              title: s.t('shop.empty'),
            );
          }

          return ListView(
            padding: const EdgeInsets.only(bottom: Gap.lg),
            children: [
              PageTitle(s.t('shop.title')),
              const Padding(
                padding: EdgeInsets.fromLTRB(Gap.lg, 0, Gap.lg, Gap.md),
                child: _WhatIsCoinsCard(),
              ),
              for (final item in data.shopItems)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: Gap.lg),
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: Gap.md),
                    child: _ShopCard(
                      item: item,
                      owned: owned.contains(item.id),
                      affordable: coins >= item.price,
                      busy: _buying == item.id,
                      onBuy: () => _buy(item),
                    ),
                  ),
                ),
              if (data.partners.isNotEmpty) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(Gap.lg, Gap.md, Gap.lg, Gap.sm),
                  child: Text(s.t('shop.partnersTitle'),
                      style: Theme.of(context).textTheme.titleMedium),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: Gap.lg),
                  child: GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: Gap.md,
                    crossAxisSpacing: Gap.md,
                    childAspectRatio: 1.05,
                    children: [
                      for (final partner in data.partners)
                        _PartnerCard(
                          partner: partner,
                          prizeCount: data.prizesFor(partner.id).length,
                          locale: locale,
                          onTap: () =>
                              setState(() => _activePartnerId = partner.id),
                        ),
                    ],
                  ),
                ),
              ],
            ],
          );
        },
      ),
      ),
      ),
    );
  }
}

/// "Акчи деген эмне?" — one-card explainer of the in-app currency, shown
/// above the goods so a first-time visitor learns what the coin count means
/// before hitting a price tag. Set in San Francisco per the brand spec.
class _WhatIsCoinsCard extends StatelessWidget {
  const _WhatIsCoinsCard();

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;

    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: AppColors.gold.withValues(alpha: tokens.bright ? 0.10 : 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: 0.18),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.monetization_on_rounded,
                color: AppColors.gold, size: 22),
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  s.t('shop.whatIsCoinsTitle'),
                  style: TextStyle(
                    fontFamily: AppFonts.sanFrancisco,
                    fontFamilyFallback: AppFonts.sanFranciscoFallback,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.2,
                    color: tokens.text,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  s.t('shop.whatIsCoinsDesc'),
                  style: TextStyle(
                    fontFamily: AppFonts.sanFrancisco,
                    fontFamilyFallback: AppFonts.sanFranciscoFallback,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    height: 1.45,
                    color: tokens.muted,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ShopCard extends ConsumerWidget {
  const _ShopCard({
    required this.item,
    required this.owned,
    required this.affordable,
    required this.busy,
    required this.onBuy,
  });

  final ShopItem item;
  final bool owned;
  final bool affordable;
  final bool busy;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final locale = ref.watch(localeProvider);
    // "energy_refill" is the one repeatable effect (consumable, not a
    // permanent unlock) — see contentStore.js#SHOP_EFFECTS.
    final isRepeatable = item.effect == 'energy_refill';

    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: owned && !isRepeatable ? AppColors.success : tokens.border),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: tokens.cardAlt,
              borderRadius: BorderRadius.circular(16),
            ),
            clipBehavior: Clip.antiAlias,
            child: lessonGlyph(item.icon, color: AppColors.primary) ??
                (item.iconUrl == null
                ? Icon(Icons.card_giftcard_rounded, color: tokens.faint)
                : CachedNetworkImage(
                    imageUrl: item.iconUrl!,
                    fit: BoxFit.contain,
                    errorWidget: (_, __, ___) =>
                        Icon(Icons.card_giftcard_rounded, color: tokens.faint),
                  )),
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(localizedContent(item.title, locale), style: Theme.of(context).textTheme.titleSmall),
                if (localizedContent(item.description, locale).isNotEmpty)
                  Text(
                    localizedContent(item.description, locale),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ),
          ),
          const SizedBox(width: Gap.md),
          if (owned && !isRepeatable)
            const Icon(Icons.check_circle_rounded, color: AppColors.success)
          else
            FilledButton(
              onPressed: (affordable && !busy) ? onBuy : null,
              style: FilledButton.styleFrom(
                minimumSize: const Size(88, 44),
                padding: const EdgeInsets.symmetric(horizontal: Gap.md),
                backgroundColor: affordable ? AppColors.primary : tokens.cardAlt,
                foregroundColor: affordable ? Colors.white : tokens.faint,
              ),
              child: busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.monetization_on_rounded, size: 16),
                        const SizedBox(width: 4),
                        Text('${item.price}',
                            style: const TextStyle(fontWeight: FontWeight.w800)),
                      ],
                    ),
            ),
        ],
      ),
    );
  }
}

/// Task 11 — the shop's entry point into a partner's catalog: logo, name,
/// and how many redeemable prizes they currently have.
class _PartnerCard extends StatelessWidget {
  const _PartnerCard({
    required this.partner,
    required this.prizeCount,
    required this.locale,
    required this.onTap,
  });

  final Partner partner;
  final int prizeCount;
  final AppLocale locale;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;

    return PressScale(
      onTap: onTap,
      haptic: true,
      child: Container(
        padding: const EdgeInsets.all(Gap.md),
        decoration: BoxDecoration(
          color: tokens.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: tokens.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(color: tokens.cardAlt, shape: BoxShape.circle),
              clipBehavior: Clip.antiAlias,
              child: partner.logoUrl == null
                  ? Icon(Icons.storefront_rounded, color: tokens.faint)
                  : ZoomableImage(
                      imageUrl: partner.logoUrl!,
                      tag: 'partner-card-${partner.id}',
                      caption: localizedContent(partner.name, locale),
                      child: CachedNetworkImage(
                        imageUrl: partner.logoUrl!,
                        fit: BoxFit.contain,
                        errorWidget: (_, __, ___) =>
                            Icon(Icons.storefront_rounded, color: tokens.faint),
                      ),
                    ),
            ),
            const SizedBox(height: Gap.sm),
            Text(
              localizedContent(partner.name, locale),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 2),
            Text(
              s.t('shop.prizeCount', params: {'n': prizeCount}),
              style: Theme.of(context)
                  .textTheme
                  .labelSmall
                  ?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}

class _PrizeCard extends StatelessWidget {
  const _PrizeCard({
    required this.prize,
    required this.affordable,
    required this.busy,
    required this.onRedeem,
    required this.locale,
  });

  final Prize prize;
  final bool affordable;
  final bool busy;
  final VoidCallback onRedeem;
  final AppLocale locale;

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;
    final title = localizedContent(prize.title, locale);
    final description = localizedContent(prize.description, locale);
    // Two states, and no third: it is either on sale or it is gone. A
    // running count ("4 left") was a nudge nobody asked for — it rushes the
    // learner and tells anyone looking how much stock a partner has left.
    final soldOut = prize.soldOut;

    return Container(
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: tokens.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (prize.photoUrl != null)
            // `contain`, not `cover`: the photo IS the prize, and cropping it
            // hid the half of the product the learner is choosing by. The
            // letterboxing sits on the card's own alt surface, so the gap
            // reads as framing rather than as a hole.
            Opacity(
              opacity: soldOut ? 0.45 : 1,
              child: Container(
              height: 120,
              width: double.infinity,
              color: tokens.cardAlt,
              alignment: Alignment.center,
              child: ZoomableImage(
                imageUrl: prize.photoUrl!,
                tag: 'prize-${prize.id}',
                caption: localizedContent(prize.description, locale),
                child: CachedNetworkImage(
                  imageUrl: prize.photoUrl!,
                  fit: BoxFit.contain,
                  errorWidget: (_, __, ___) =>
                      Icon(Icons.card_giftcard_rounded, color: tokens.faint, size: 32),
                ),
              ),
              ),
            )
          else
            Container(
              height: 90,
              width: double.infinity,
              color: tokens.cardAlt,
              alignment: Alignment.center,
              child: Icon(Icons.card_giftcard_rounded, color: tokens.faint, size: 32),
            ),
          Padding(
            padding: const EdgeInsets.all(Gap.md),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: Theme.of(context).textTheme.titleSmall),
                      if (description.isNotEmpty)
                        Text(description,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
                const SizedBox(width: Gap.md),
                FilledButton(
                  onPressed: (affordable && !soldOut && !busy) ? onRedeem : null,
                  style: FilledButton.styleFrom(
                    // The theme's minimumSize is Size.fromHeight(52) —
                    // infinite WIDTH, which is fine in a stretch Column but
                    // crashes layout inside this Row ("BoxConstraints forces
                    // an infinite width"). Same bounded override _ShopCard's
                    // price button uses.
                    minimumSize: const Size(88, 44),
                    padding: const EdgeInsets.symmetric(horizontal: Gap.md),
                    // Sold out reads differently from can't-afford: one is
                    // a wait for the partner, the other for the learner's
                    // own coins, so a price they cannot spend is the wrong
                    // prompt to show.
                    backgroundColor: soldOut
                        ? const Color(0x1FEF4444)
                        : affordable
                            ? AppColors.success
                            : tokens.cardAlt,
                    foregroundColor: soldOut
                        ? const Color(0xFFF87171)
                        : affordable
                            ? Colors.white
                            : tokens.faint,
                  ),
                  child: busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              soldOut
                                  ? Icons.inventory_2_outlined
                                  : Icons.monetization_on_rounded,
                              size: 16,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              soldOut
                                  ? s.t('shop.soldOut')
                                  : '${prize.priceCoins}',
                              style: const TextStyle(fontWeight: FontWeight.w800),
                            ),
                          ],
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RedeemedCodeDialog extends StatefulWidget {
  const _RedeemedCodeDialog({required this.code, this.promoCode});

  /// Ours — the coupon id, for support and reconciliation.
  final String code;

  /// The partner's own, when the prize carries one. This is what the learner
  /// types at the till, so it is the one shown big and the one copied.
  final String? promoCode;

  String get shown => promoCode ?? code;

  @override
  State<_RedeemedCodeDialog> createState() => _RedeemedCodeDialogState();
}

class _RedeemedCodeDialogState extends State<_RedeemedCodeDialog> {
  Future<void> _copy() async {
    Haptics.tap();
    await Clipboard.setData(ClipboardData(text: widget.shown));
    if (!mounted) return;
    final s = StringsScope.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(s.t('common.copied'))),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;

    return Dialog(
      backgroundColor: tokens.card,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      child: Padding(
        padding: const EdgeInsets.all(Gap.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 450),
              curve: Curves.elasticOut,
              builder: (_, v, child) => Transform.scale(scale: v, child: child),
              child: Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.success,
                  boxShadow: [
                    BoxShadow(color: AppColors.success.withValues(alpha: 0.4), blurRadius: 24, spreadRadius: 1),
                  ],
                ),
                child: const Icon(Icons.celebration_rounded, color: Colors.white, size: 34),
              ),
            ),
            const SizedBox(height: Gap.md),
            Text(s.t('shop.redeemed'),
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center),
            const SizedBox(height: 4),
            Text(s.t('shop.redeemInstructions'),
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center),
            const SizedBox(height: Gap.lg),
            InkWell(
              onTap: _copy,
              borderRadius: BorderRadius.circular(16),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: Gap.lg),
                decoration: BoxDecoration(
                  color: tokens.cardAlt,
                  borderRadius: BorderRadius.circular(16),
                ),
                alignment: Alignment.center,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Flexible(
                      child: Text(
                        widget.shown,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                          letterSpacing: 1.2,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    const SizedBox(width: Gap.sm),
                    const Icon(Icons.copy_rounded, size: 16, color: AppColors.primary),
                  ],
                ),
              ),
            ),
            if (widget.promoCode != null) ...[
              const SizedBox(height: Gap.sm),
              Text(
                // Not JashMen's own number: the learner has no use for it,
                // and printing both under one big code only raised the
                // question of which to show at the till.
                s.t('shop.showAtTill'),
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: tokens.muted),
              ),
            ],
            const SizedBox(height: Gap.lg),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 48)),
              child: Text(s.t('common.confirm')),
            ),
          ],
        ),
      ),
    );
  }
}
