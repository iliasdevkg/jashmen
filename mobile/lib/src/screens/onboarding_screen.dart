/// Task 9 — first-launch intro carousel, shown before AuthScreen exactly
/// once per install (see providers.dart#onboardedProvider). Port of
/// src/pages/OnboardingPage.jsx — same four slides, same copy.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/haptics.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../state/providers.dart';

class _Slide {
  const _Slide(this.icon, this.color, this.key);
  final IconData icon;
  final Color color;
  final String key;
}

const _slides = [
  _Slide(Icons.savings_rounded, AppColors.success, 'onboarding.slide1'),
  _Slide(Icons.menu_book_rounded, AppColors.primary, 'onboarding.slide2'),
  _Slide(Icons.emoji_events_rounded, AppColors.gold, 'onboarding.slide3'),
  _Slide(Icons.card_giftcard_rounded, AppColors.purple, 'onboarding.slide4'),
];

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _controller = PageController();
  int _index = 0;

  bool get _isLast => _index == _slides.length - 1;

  void _next() {
    if (_isLast) {
      Haptics.success();
      ref.read(onboardedProvider.notifier).markDone();
      return;
    }
    Haptics.tap();
    _controller.nextPage(
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  void _done() => ref.read(onboardedProvider.notifier).markDone();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    final locale = ref.watch(localeProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(
        child: Column(
          children: [
            // Language picker (left) + skip (right) — matching the web
            // onboarding page, so a first-launch visitor can read the intro
            // in their own language before ever touching a settings screen.
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 12, 0),
              child: Row(
                children: [
                  for (final l in AppLocale.values) ...[
                    _LanguageChip(
                      locale: l,
                      active: l == locale,
                      onTap: () => ref.read(localeProvider.notifier).set(l),
                    ),
                    const SizedBox(width: 6),
                  ],
                  const Spacer(),
                  if (!_isLast)
                    TextButton(
                      onPressed: _done,
                      child: Text(
                        s.t('onboarding.skip'),
                        style: const TextStyle(
                            color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                      ),
                    ),
                ],
              ),
            ),

            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _slides.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (context, i) => _SlideView(slide: _slides[i]),
              ),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (var i = 0; i < _slides.length; i++) ...[
                        if (i > 0) const SizedBox(width: 8),
                        GestureDetector(
                          onTap: () {
                            Haptics.tap();
                            _controller.animateToPage(i,
                                duration: const Duration(milliseconds: 280),
                                curve: Curves.easeOutCubic);
                          },
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 250),
                            width: i == _index ? 22 : 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: i == _index
                                  ? AppColors.primary
                                  : const Color(0xFF334155),
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: Gap.xl),
                  FilledButton(
                    onPressed: _next,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(double.infinity, 52),
                      backgroundColor: AppColors.success,
                    ),
                    child: Text(
                      _isLast ? s.t('onboarding.getStarted') : s.t('onboarding.next'),
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LanguageChip extends StatelessWidget {
  const _LanguageChip({required this.locale, required this.active, required this.onTap});
  final AppLocale locale;
  final bool active;
  final VoidCallback onTap;

  static const _flags = {AppLocale.ky: '🇰🇬', AppLocale.ru: '🇷🇺', AppLocale.en: '🇺🇸'};

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? AppColors.primary.withValues(alpha: 0.15) : const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: active ? AppColors.primary : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Text(_flags[locale] ?? '', style: const TextStyle(fontSize: 16)),
      ),
    );
  }
}

class _SlideView extends StatelessWidget {
  const _SlideView({required this.slide});
  final _Slide slide;

  @override
  Widget build(BuildContext context) {
    final s = StringsScope.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          TweenAnimationBuilder<double>(
            key: ValueKey(slide.key),
            tween: Tween(begin: 0, end: 1),
            duration: const Duration(milliseconds: 420),
            curve: Curves.elasticOut,
            builder: (_, v, child) => Transform.scale(scale: v, child: child),
            child: Container(
              width: 128,
              height: 128,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: slide.color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(32),
                border: Border.all(color: slide.color.withValues(alpha: 0.25), width: 1.5),
                boxShadow: [
                  BoxShadow(color: slide.color.withValues(alpha: 0.5), blurRadius: 60, spreadRadius: -8),
                ],
              ),
              child: Icon(slide.icon, size: 56, color: slide.color),
            ),
          ),
          const SizedBox(height: Gap.xl),
          Text(
            s.t('${slide.key}.title'),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: Gap.md),
          Text(
            s.t('${slide.key}.desc'),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 14,
              height: 1.5,
              color: Color(0xFF94A3B8),
            ),
          ),
        ],
      ),
    );
  }
}
