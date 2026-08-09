/// Loading / error / empty presentation, shared by every screen.
///
/// Loading is a skeleton rather than a bare spinner: the layout is known
/// ahead of the data, so showing its shape reads as faster than a centred
/// circle on an empty page.
library;

import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../core/i18n.dart';
import '../core/theme.dart';

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, this.onRetry});

  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final tokens = context.tokens;

    final (icon, message) = switch (error) {
      ApiException(kind: ApiErrorKind.offline) => (
          Icons.wifi_off_rounded,
          s.t('common.offline'),
        ),
      ApiException(kind: ApiErrorKind.timeout) => (
          Icons.schedule_rounded,
          s.t('common.serverError'),
        ),
      ApiException(kind: ApiErrorKind.server) => (
          Icons.cloud_off_rounded,
          s.t('common.serverError'),
        ),
      ApiException(:final message) => (Icons.error_outline_rounded, message),
      _ => (Icons.error_outline_rounded, s.t('common.error')),
    };

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Gap.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: tokens.faint),
            const SizedBox(height: Gap.lg),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: tokens.muted),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: Gap.xl),
              FilledButton(
                onPressed: onRetry,
                style: FilledButton.styleFrom(minimumSize: const Size(160, 48)),
                child: Text(s.t('common.retry')),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class EmptyView extends StatelessWidget {
  const EmptyView({
    super.key,
    required this.icon,
    required this.title,
    this.description,
  });

  final IconData icon;
  final String title;
  final String? description;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Gap.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: tokens.cardAlt,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(icon, size: 32, color: tokens.faint),
            ),
            const SizedBox(height: Gap.lg),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            if (description != null) ...[
              const SizedBox(height: Gap.sm),
              Text(
                description!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// A shimmering placeholder block. Composed into per-screen skeletons.
class SkeletonBox extends StatefulWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height = 16,
    this.radius = 8,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: Color.lerp(tokens.cardAlt, tokens.border, _controller.value * 0.6),
          borderRadius: BorderRadius.circular(widget.radius),
        ),
      ),
    );
  }
}

/// Skeleton for the learn path: module header + a few path nodes.
class LearnSkeleton extends StatelessWidget {
  const LearnSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(Gap.lg),
      children: [
        Row(
          children: [
            const SkeletonBox(width: 48, height: 48, radius: 14),
            const SizedBox(width: Gap.md),
            Expanded(child: SkeletonBox(width: double.infinity, height: 20)),
          ],
        ),
        const SizedBox(height: Gap.xxl),
        for (var i = 0; i < 5; i++)
          Padding(
            padding: EdgeInsets.only(
              bottom: Gap.xxl,
              left: i.isEven ? 0 : 90,
              right: i.isEven ? 90 : 0,
            ),
            child: const Center(
              child: SkeletonBox(width: 72, height: 72, radius: 36),
            ),
          ),
      ],
    );
  }
}
