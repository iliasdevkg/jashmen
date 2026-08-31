/// Task 9 — first-launch intro carousel, shown before AuthScreen exactly
/// once per install (see providers.dart#onboardedProvider).
///
/// Redesigned to the brand-blue mockups in jashmen01/: three illustrated
/// slides (not four generic icon tiles), a language switcher built into the
/// carousel itself, and the same white-pill CTA the sign-in screen uses —
/// one continuous flow instead of a handoff between two looks.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/haptics.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../state/providers.dart';
import '../widgets/brand_pill_button.dart';

class _Slide {
  const _Slide(this.asset, this.aspectRatio, this.titleKey);
  final String asset;
  final double aspectRatio;
  final String titleKey;
}

// Aspect ratios come from the trimmed source art itself (see
// mobile/assets/images/onboarding_*.webp) so each illustration lays out at
// its native proportions rather than stretching.
const _slides = [
  _Slide('assets/images/onboarding_compete.webp', 1488 / 981, 'onboarding.slide1.title'),
  _Slide('assets/images/onboarding_confidence.webp', 1506 / 1024, 'onboarding.slide2.title'),
  _Slide('assets/images/onboarding_relax.webp', 1512 / 968, 'onboarding.slide3.title'),
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
      backgroundColor: AppColors.authBg,
      body: SafeArea(
        child: Column(
          children: [
            // Language picker (left) + skip (right) — first-launch visitor
            // reads the intro in their own language before ever touching a
            // settings screen.
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Row(
                children: [
                  for (final l in AppLocale.values) ...[
                    _LanguageChip(
                      locale: l,
                      active: l == locale,
                      onTap: () {
                        Haptics.tap();
                        ref.read(localeProvider.notifier).set(l);
                      },
                    ),
                    const SizedBox(width: 10),
                  ],
                  const Spacer(),
                  AnimatedOpacity(
                    opacity: _isLast ? 0 : 1,
                    duration: const Duration(milliseconds: 200),
                    child: IgnorePointer(
                      ignoring: _isLast,
                      child: TextButton(
                        onPressed: _done,
                        style: TextButton.styleFrom(foregroundColor: AppColors.authMuted),
                        child: Text(
                          s.t('onboarding.skip'),
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                        ),
                      ),
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
                            curve: Curves.easeOut,
                            width: i == _index ? 22 : 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: i == _index ? Colors.white : Colors.white.withValues(alpha: 0.3),
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: Gap.xl),
                  BrandPillButton(
                    label: _isLast ? s.t('onboarding.getStarted') : s.t('onboarding.next'),
                    onPressed: _next,
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

  static const _codes = {AppLocale.ky: 'KG', AppLocale.ru: 'RU', AppLocale.en: 'EN'};

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        width: 52,
        height: 36,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? Colors.white : AppColors.authTrack,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          _codes[locale] ?? '',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w800,
            color: active ? AppColors.authBg : AppColors.authMuted,
          ),
        ),
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
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          TweenAnimationBuilder<double>(
            key: ValueKey(slide.titleKey),
            tween: Tween(begin: 0, end: 1),
            duration: const Duration(milliseconds: 420),
            curve: Curves.easeOutCubic,
            builder: (_, v, child) => Opacity(
              opacity: v,
              child: Transform.scale(scale: 0.92 + 0.08 * v, child: child),
            ),
            child: AspectRatio(
              aspectRatio: slide.aspectRatio,
              child: Image.asset(slide.asset, fit: BoxFit.contain),
            ),
          ),
          const SizedBox(height: Gap.xxl),
          Text(
            s.t(slide.titleKey),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 26,
              height: 1.25,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -0.3,
            ),
          ),
        ],
      ),
    );
  }
}
