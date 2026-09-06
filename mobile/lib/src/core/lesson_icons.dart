/// Slug → [IconData] for the lesson-node glyph set.
///
/// The set itself is defined once in `shared/lessonIcons.js` (the admin panel
/// renders it, the backend validates against it, the web app maps it to
/// lucide); this is its Flutter half. Adding an icon means touching all three
/// — a slug missing here falls back to the caller's default glyph, which is
/// safe but wrong, so keep the lists in step.
///
/// The glyphs themselves now come from lucide, the same source the web
/// bundles (core/lucide_svg.dart) — Material Rounded was the closest
/// available match and it still was not close: filled and chunky against
/// lucide's thin geometry, so the same lesson looked like two different
/// products side by side. The Material map below survives as the fallback
/// for a slug the generated set does not carry.
library;

import 'package:flutter/material.dart';

import '../widgets/lucide_icon.dart';

const Map<String, IconData> _lessonIcons = {
  // Акча жана төлөм
  'wallet': Icons.account_balance_wallet_rounded,
  'coins': Icons.monetization_on_rounded,
  'banknote': Icons.payments_rounded,
  'credit-card': Icons.credit_card_rounded,
  'hand-coins': Icons.volunteer_activism_rounded,
  'percent': Icons.percent_rounded,

  // Банк, үнөмдөө, инвестиция
  'piggy-bank': Icons.savings_rounded,
  'landmark': Icons.account_balance_rounded,
  'trending-up': Icons.trending_up_rounded,
  'chart-pie': Icons.pie_chart_rounded,
  'chart-bar': Icons.bar_chart_rounded,
  'sprout': Icons.eco_rounded,

  // Пландоо жана эсеп
  'calculator': Icons.calculate_rounded,
  'receipt': Icons.receipt_long_rounded,
  'calendar': Icons.calendar_month_rounded,
  'clock': Icons.schedule_rounded,
  'target': Icons.track_changes_rounded,
  'scale': Icons.balance_rounded,

  // Коопсуздук
  'shield-check': Icons.verified_user_rounded,
  'key': Icons.key_rounded,
  'umbrella': Icons.umbrella_rounded,

  // Турмуш
  'home': Icons.home_rounded,
  'car': Icons.directions_car_rounded,
  'shopping-cart': Icons.shopping_cart_rounded,
  'gift': Icons.card_giftcard_rounded,
  'smartphone': Icons.smartphone_rounded,

  // Иш жана билим
  'briefcase': Icons.work_rounded,
  'building': Icons.apartment_rounded,
  'handshake': Icons.handshake_rounded,
  'graduation-cap': Icons.school_rounded,
  'book-open': Icons.menu_book_rounded,
  'lightbulb': Icons.lightbulb_rounded,

  // Мотивация
  'rocket': Icons.rocket_launch_rounded,
  'star': Icons.star_rounded,
  'flame': Icons.local_fire_department_rounded,
  'users': Icons.groups_rounded,
  'globe': Icons.public_rounded,
  'dumbbell': Icons.fitness_center_rounded,
};

/// The icon for [slug], or null when the slug is absent/unknown — the caller
/// then draws whatever it was going to draw anyway.
///
/// Kept for the places that genuinely need an [IconData] (a fallback, an
/// [IconButton]); anything that just draws the glyph should use
/// [lessonGlyph], which prefers the lucide artwork.
IconData? lessonIconFor(String? slug) =>
    slug == null ? null : _lessonIcons[slug];

/// The glyph for [slug] as a widget — lucide where we have it, the Material
/// equivalent where we do not, and [fallback] when the slug means nothing.
///
/// Every screen that paints a lesson, module, league or achievement icon goes
/// through here, so the two clients can never drift into drawing different
/// pictures for the same slug again.
Widget? lessonGlyph(
  String? slug, {
  double size = 24,
  Color? color,
  IconData? fallback,
}) {
  if (LucideIcon.has(slug)) return LucideIcon(slug!, size: size, color: color);
  final data = lessonIconFor(slug) ?? fallback;
  return data == null ? null : Icon(data, size: size, color: color);
}
