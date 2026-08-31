/// Full-width stadium CTA for the brand-blue surfaces — onboarding and
/// sign-in. White fill, bold blue label; the one primary-action shape those
/// screens share, so a user reads the flow as continuous rather than a
/// handoff between two different apps.
library;

import 'package:flutter/material.dart';

import '../core/theme.dart';
import 'press_scale.dart';

class BrandPillButton extends StatelessWidget {
  const BrandPillButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !busy;

    return PressScale(
      onTap: enabled ? onPressed : null,
      enabled: enabled,
      child: AnimatedOpacity(
        opacity: onPressed == null ? 0.6 : 1,
        duration: const Duration(milliseconds: 150),
        child: Container(
          height: 56,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(28),
          ),
          child: busy
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: AppColors.authBg,
                  ),
                )
              : Text(
                  label,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.authBg,
                  ),
                ),
        ),
      ),
    );
  }
}
