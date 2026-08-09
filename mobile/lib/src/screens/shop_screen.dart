/// Coin shop — port of src/pages/ShopPage.jsx.
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../models/content.dart';
import '../state/providers.dart';
import '../widgets/states.dart';

class ShopScreen extends ConsumerStatefulWidget {
  const ShopScreen({super.key});

  @override
  ConsumerState<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends ConsumerState<ShopScreen> {
  /// Id of the item whose purchase is in flight, so only that card shows a
  /// spinner rather than the whole grid locking up.
  String? _buying;

  Future<void> _buy(ShopItem item) async {
    setState(() => _buying = item.id);
    final s = StringsScope.of(context);
    final messenger = ScaffoldMessenger.of(context);

    try {
      final state = await ref.read(apiClientProvider).buyItem(item.id);
      ref.read(authProvider.notifier).applyState(state);
      if (mounted) {
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

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final content = ref.watch(contentProvider);
    final userState = ref.watch(userStateProvider);
    final coins = userState?.coins ?? 0;
    final owned = userState?.ownedShop.toSet() ?? <String>{};

    return Scaffold(
      appBar: AppBar(
        title: Text(s.t('shop.title')),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: Gap.lg),
            child: Row(
              children: [
                const Icon(Icons.monetization_on_rounded, color: AppColors.gold, size: 20),
                const SizedBox(width: 4),
                Text('$coins',
                    style: Theme.of(context)
                        .textTheme
                        .titleSmall
                        ?.copyWith(fontWeight: FontWeight.w800)),
              ],
            ),
          ),
        ],
      ),
      body: content.when(
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
          if (data.shopItems.isEmpty) {
            return EmptyView(
              icon: Icons.shopping_bag_rounded,
              title: s.t('shop.empty'),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(Gap.lg),
            itemCount: data.shopItems.length,
            itemBuilder: (context, i) {
              final item = data.shopItems[i];
              return _ShopCard(
                item: item,
                owned: owned.contains(item.id),
                affordable: coins >= item.price,
                busy: _buying == item.id,
                onBuy: () => _buy(item),
              );
            },
          );
        },
      ),
    );
  }
}

class _ShopCard extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Container(
      margin: const EdgeInsets.only(bottom: Gap.md),
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: owned ? AppColors.success : tokens.border),
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
            child: item.iconUrl == null
                ? Icon(Icons.card_giftcard_rounded, color: tokens.faint)
                : CachedNetworkImage(
                    imageUrl: item.iconUrl!,
                    fit: BoxFit.contain,
                    errorWidget: (_, __, ___) =>
                        Icon(Icons.card_giftcard_rounded, color: tokens.faint),
                  ),
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.title, style: Theme.of(context).textTheme.titleSmall),
                if (item.description.isNotEmpty)
                  Text(
                    item.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ),
          ),
          const SizedBox(width: Gap.md),
          if (owned)
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
