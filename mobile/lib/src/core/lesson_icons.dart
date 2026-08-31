/// Slug → [IconData] for the lesson-node glyph set.
///
/// The set itself is defined once in `shared/lessonIcons.js` (the admin panel
/// renders it, the backend validates against it, the web app maps it to
/// lucide); this is its Flutter half. Adding an icon means touching all three
/// — a slug missing here falls back to the caller's default glyph, which is
/// safe but wrong, so keep the lists in step.
///
/// Material's rounded set is the closest match to lucide's geometry, which is
/// what keeps a lesson looking like the same lesson on both clients.
library;

import 'package:flutter/material.dart';

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
IconData? lessonIconFor(String? slug) =>
    slug == null ? null : _lessonIcons[slug];
