/// Typed models for GET /admin/api/public/content.
///
/// Everything is parsed defensively: this content is authored in an admin
/// panel, so a field can be absent (older records predate it), null, or the
/// wrong primitive type. A malformed record must degrade — never throw and
/// blank the whole learn path.
library;

import '../core/config.dart';

enum CardType { theory, media, quiz, unknown }

CardType _cardType(String? raw) => switch (raw) {
      'theory' => CardType.theory,
      'media' => CardType.media,
      'quiz' => CardType.quiz,
      _ => CardType.unknown,
    };

int _asInt(dynamic v, [int fallback = 0]) => switch (v) {
      int i => i,
      num n => n.toInt(),
      String s => int.tryParse(s) ?? fallback,
      _ => fallback,
    };

String _asString(dynamic v, [String fallback = '']) =>
    v == null ? fallback : v.toString();

/// Uploads arrive as site-relative paths; config.dart resolves them against
/// the API origin and rejects anything that shouldn't become an image src.
String? _asIconUrl(dynamic v) => resolveMediaUrl(v);

List<T> _asList<T>(dynamic v, T Function(Map<String, dynamic>) fromJson) {
  if (v is! List) return const [];
  return v
      .whereType<Map>()
      .map((e) => fromJson(e.cast<String, dynamic>()))
      .toList(growable: false);
}

/// A lesson card. Text fields stay `dynamic` on purpose — they are either a
/// `{ky, ru}` map or a legacy bare string, resolved at render time by
/// i18n.dart#localizedContent against the user's chosen locale.
class LessonCard {
  const LessonCard({
    required this.type,
    this.title,
    this.body,
    this.question,
    this.options = const [],
    this.answerIndex = 0,
    this.explanation,
    this.imageUrl,
  });

  final CardType type;
  final dynamic title;
  final dynamic body;
  final dynamic question;
  final List<dynamic> options;
  final int answerIndex;

  /// Optional `{ky, ru}` (or legacy bare-string) note authored per quiz
  /// question in the admin panel, revealed under the correct/wrong banner
  /// after the learner commits — the "why". Resolved with localizedContent.
  final dynamic explanation;
  final String? imageUrl;

  factory LessonCard.fromJson(Map<String, dynamic> json) => LessonCard(
        type: _cardType(json['type'] as String?),
        title: json['title'],
        body: json['body'],
        question: json['q'],
        options: (json['opts'] is List) ? json['opts'] as List : const [],
        answerIndex: _asInt(json['a']),
        explanation: json['explanation'],
        imageUrl: _asIconUrl(json['imageUrl']),
      );
}

class Lesson {
  const Lesson({
    required this.id,
    required this.title,
    required this.cards,
    this.iconUrl,
  });

  final String id;

  /// {ky, ru, en} (or legacy bare string) since Task 13 — resolve with
  /// localizedContent() at render time, same as every other content field.
  final dynamic title;
  final List<LessonCard> cards;
  final String? iconUrl;

  factory Lesson.fromJson(Map<String, dynamic> json) {
    // utils.js#cardsOf: `cards` is authoritative; seed/legacy lessons only
    // carry a flat `questions` array, which is treated as an all-quiz deck
    // so content written before cards existed still plays.
    var cards = _asList(json['cards'], LessonCard.fromJson);
    if (cards.isEmpty && json['questions'] is List) {
      cards = (json['questions'] as List)
          .whereType<Map>()
          .map((q) => LessonCard.fromJson({
                ...q.cast<String, dynamic>(),
                'type': 'quiz',
              }))
          .toList(growable: false);
    }

    return Lesson(
      id: _asString(json['id']),
      title: json['title'],
      cards: cards,
      iconUrl: _asIconUrl(json['iconUrl']),
    );
  }
}

class Module {
  const Module({
    required this.id,
    required this.title,
    required this.color,
    required this.lessons,
    this.iconUrl,
    this.partnerId,
  });

  final String id;

  /// {ky, ru, en} (or legacy bare string) since Task 13.
  final dynamic title;

  /// Hex string like "#1CB0F6"; the learn path tints its nodes and the
  /// connecting curve with it.
  final String color;
  final List<Lesson> lessons;
  final String? iconUrl;
  final String? partnerId;

  factory Module.fromJson(Map<String, dynamic> json) => Module(
        id: _asString(json['id']),
        title: json['title'],
        color: _asString(json['color'], '#1CB0F6'),
        lessons: _asList(json['lessons'], Lesson.fromJson),
        iconUrl: _asIconUrl(json['iconUrl']),
        partnerId: json['partnerId']?.toString(),
      );
}

class League {
  const League({
    required this.id,
    required this.name,
    required this.color,
    required this.minXp,
    this.iconUrl,
  });

  final String id;

  /// {ky, ru, en} (or legacy bare string) since Task 13.
  final dynamic name;
  final String color;
  final int minXp;

  /// Task 10 — optional admin-uploaded icon; when null the app falls back
  /// to its own bespoke per-league art (see LeagueBadges.jsx on web / the
  /// _RankCard hexagon glyph set on mobile).
  final String? iconUrl;

  factory League.fromJson(Map<String, dynamic> json) => League(
        id: _asString(json['id']),
        name: json['name'],
        color: _asString(json['color'], '#1CB0F6'),
        minXp: _asInt(json['minXp']),
        iconUrl: _asIconUrl(json['iconUrl']),
      );
}

class AchievementRule {
  const AchievementRule({required this.type, required this.value});
  final String type;
  final int value;

  factory AchievementRule.fromJson(Map<String, dynamic> json) =>
      AchievementRule(type: _asString(json['type']), value: _asInt(json['value']));
}

class Achievement {
  const Achievement({
    required this.id,
    required this.title,
    required this.description,
    required this.xp,
    this.iconUrl,
    this.rule,
  });

  final String id;

  /// {ky, ru, en} (or legacy bare string) since Task 13.
  final dynamic title;
  final dynamic description;
  final int xp;
  final String? iconUrl;
  final AchievementRule? rule;

  factory Achievement.fromJson(Map<String, dynamic> json) => Achievement(
        id: _asString(json['id']),
        title: json['title'],
        description: json['desc'],
        xp: _asInt(json['xp']),
        iconUrl: _asIconUrl(json['iconUrl']),
        rule: json['rule'] is Map
            ? AchievementRule.fromJson((json['rule'] as Map).cast<String, dynamic>())
            : null,
      );
}

class ShopItem {
  const ShopItem({
    required this.id,
    required this.title,
    required this.description,
    required this.price,
    required this.effect,
    this.iconUrl,
  });

  final String id;

  /// {ky, ru, en} (or legacy bare string) since Task 13.
  final dynamic title;
  final dynamic description;
  final int price;

  /// One of the effects routes.js#/u/me/buy knows how to apply
  /// (energy_refill, streak_shield, xp_boost, vip_badge — Task 12 made this
  /// data-driven rather than id-hardcoded, mirroring the achievement rule
  /// engine). Unknown values still render; the server decides validity.
  final String effect;
  final String? iconUrl;

  factory ShopItem.fromJson(Map<String, dynamic> json) => ShopItem(
        id: _asString(json['id']),
        title: json['title'],
        description: json['desc'],
        price: _asInt(json['price']),
        effect: _asString(json['effect']),
        iconUrl: _asIconUrl(json['iconUrl']),
      );
}

class Partner {
  const Partner({required this.id, required this.name, this.logoUrl});
  final String id;

  /// {ky, ru, en} (or legacy bare string) since Task 13.
  final dynamic name;
  final String? logoUrl;

  factory Partner.fromJson(Map<String, dynamic> json) => Partner(
        id: _asString(json['id']),
        name: json['name'],
        logoUrl: _asIconUrl(json['logoUrl']),
      );
}

/// A partner-sponsored redeemable reward (Task 11's "coupon"). Title and
/// description are trilingual ({ky, ru, en}, or a legacy bare string).
class Prize {
  const Prize({
    required this.id,
    required this.partnerId,
    required this.title,
    required this.description,
    required this.priceCoins,
    this.photoUrl,
  });

  final String id;
  final String partnerId;
  final dynamic title;
  final dynamic description;
  final int priceCoins;
  final String? photoUrl;

  factory Prize.fromJson(Map<String, dynamic> json) => Prize(
        id: _asString(json['id']),
        partnerId: _asString(json['partnerId']),
        title: json['title'],
        description: json['description'],
        priceCoins: _asInt(json['priceCoins']),
        photoUrl: _asIconUrl(json['photoUrl']),
      );
}

class ContentLimits {
  const ContentLimits({this.dailyFreeLessons = 3, this.dailyPrizeCap = 5});
  final int dailyFreeLessons;
  final int dailyPrizeCap;

  factory ContentLimits.fromJson(Map<String, dynamic> json) => ContentLimits(
        dailyFreeLessons: _asInt(json['dailyFreeLessons'], 3),
        dailyPrizeCap: _asInt(json['dailyPrizeCap'], 5),
      );
}

class AppContent {
  const AppContent({
    required this.modules,
    required this.leagues,
    required this.achievements,
    required this.shopItems,
    required this.partners,
    required this.prizes,
    required this.limits,
  });

  final List<Module> modules;
  final List<League> leagues;
  final List<Achievement> achievements;
  final List<ShopItem> shopItems;
  final List<Partner> partners;
  final List<Prize> prizes;
  final ContentLimits limits;

  factory AppContent.fromJson(Map<String, dynamic> json) => AppContent(
        modules: _asList(json['modules'], Module.fromJson),
        leagues: _asList(json['leagues'], League.fromJson),
        achievements: _asList(json['achievements'], Achievement.fromJson),
        shopItems: _asList(json['shop_items'], ShopItem.fromJson),
        partners: _asList(json['partners'], Partner.fromJson),
        prizes: _asList(json['prizes'], Prize.fromJson),
        limits: json['limits'] is Map
            ? ContentLimits.fromJson((json['limits'] as Map).cast<String, dynamic>())
            : const ContentLimits(),
      );

  Partner? partnerById(String? id) {
    if (id == null) return null;
    for (final p in partners) {
      if (p.id == id) return p;
    }
    return null;
  }

  List<Prize> prizesFor(String partnerId) =>
      prizes.where((p) => p.partnerId == partnerId).toList(growable: false);

  int get totalLessons =>
      modules.fold(0, (sum, m) => sum + m.lessons.length);
}
