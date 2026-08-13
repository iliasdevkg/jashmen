/// Shared custom route transitions — the app's default push (platform-
/// dependent slide) is fine for regular navigation, but the lesson player
/// is a distinct, focused "mode" (matching the web app's full-bleed lesson
/// route), so opening one gets its own deliberate motion: a soft rise +
/// fade instead of the generic horizontal slide, telling the player
/// "you've stepped into something" before the first card even renders.
library;

import 'package:flutter/material.dart';

/// Rises the new page in from slightly below with a fade — the same
/// spring-ish feel as this app's other entrances (_Bob, PressScale), just
/// once, at screen scale.
Route<T> riseTransitionRoute<T>(Widget page) {
  return PageRouteBuilder<T>(
    transitionDuration: const Duration(milliseconds: 380),
    reverseTransitionDuration: const Duration(milliseconds: 280),
    pageBuilder: (context, animation, secondaryAnimation) => page,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic, reverseCurve: Curves.easeInCubic);
      return FadeTransition(
        opacity: curved,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.06),
            end: Offset.zero,
          ).animate(curved),
          child: child,
        ),
      );
    },
  );
}
