/// Typed models for GET /admin/api/public/content.
///
/// Everything is parsed defensively: this content is authored in an admin
/// panel, so a field can be absent (older records predate it), null, or the
/// wrong primitive type. A malformed record must degrade — never throw and
/// blank the whole learn path.
library;

import '../core/config.dart';
import 'university.dart';

enum CardType { theory, media, quiz, match, build, unknown }

/// The card types the server grades and pays XP for — the mirror of
/// admin-api/contentStore.js#GRADED_CARD_TYPES. Kept as one set so the
/// player's re-queue rule, the mistake count and logic.dart's XP preview can
/// never drift from what the server actually counts.
const gradedCardTypes = <CardType>{
  CardType.quiz,
  CardType.match,
  CardType.build,
};

CardType _cardType(String? raw) => switch (raw) {
      'theory' => CardType.theory,
      'media' => CardType.media,
      'quiz' => CardType.quiz,
      'match' => CardType.match,
      'build' => CardType.build,
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

/// One row of a `match` card: a block for the left column and the block on
/// the right it belongs with. Both sides are `{ky, ru, en}` maps (or a
/// legacy bare string), so they stay `dynamic` and resolve at render time
/// like every other authored text.
///
/// The authored order is the answer key — widgets/match_pairs_card.dart
/// shuffles the right column before drawing it.
class MatchPair {
  const MatchPair({this.left, this.right});

  final dynamic left;
  final dynamic right;

  factory MatchPair.fromJson(Map<String, dynamic> json) =>
      MatchPair(left: json['left'], right: json['right']);
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
    this.mediaType,
    this.url,
    this.caption,
    this.pairs = const [],
    this.sentence,
    this.distractors,
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

  /// The three fields a `media` card carries, authored in the admin panel's
  /// "Медиа" card (admin-src/pages/LessonsModule.jsx). They used to be
  /// dropped here, which left every media card blank in the app while the
  /// web rendered it fine.
  ///
  /// [mediaType] is 'image' or 'video'; [caption] is `{ky, ru, en}` (or a
  /// legacy bare string) and resolves with localizedContent like every other
  /// authored text.
  final String? mediaType;
  final String? url;
  final dynamic caption;

  /// `match` — the two-column pairs the learner taps together. Empty for
  /// every other card type, and empty too for a `match` card whose pairs are
  /// still being authored: the player treats a card with nothing playable as
  /// read-through rather than trapping the learner on it.
  final List<MatchPair> pairs;

  /// `build` — the sentence to assemble, `{ky, ru, en}` or a legacy bare
  /// string. The word tiles for a locale are this string split on
  /// whitespace, plus [distractors].
  final dynamic sentence;

  /// `build` — the extra words mixed into the word bank. One
  /// whitespace-separated string per locale, not a list, exactly as the
  /// admin authors it.
  final dynamic distractors;

  bool get isVideo => mediaType == 'video';

  /// Whether a wrong answer is possible here — the client-side mirror of the
  /// server's GRADED_CARD_TYPES. Theory and media are read-through.
  bool get isGraded => gradedCardTypes.contains(type);

  factory LessonCard.fromJson(Map<String, dynamic> json) => LessonCard(
        type: _cardType(json['type'] as String?),
        title: json['title'],
        body: json['body'],
        question: json['q'],
        options: (json['opts'] is List) ? json['opts'] as List : const [],
        answerIndex: _asInt(json['a']),
        explanation: json['explanation'],
        imageUrl: _asIconUrl(json['imageUrl']),
        mediaType: json['mediaType'] as String?,
        url: _asIconUrl(json['url']),
        caption: json['caption'],
        pairs: _asList(json['pairs'], MatchPair.fromJson),
        sentence: json['sentence'],
        distractors: json['distractors'],
      );
}

class Lesson {
  const Lesson({
    required this.id,
    required this.title,
    required this.cards,
    this.iconUrl,
    this.icon,
  });

  final String id;

  /// {ky, ru, en} (or legacy bare string) since Task 13 — resolve with
  /// localizedContent() at render time, same as every other content field.
  final dynamic title;
  final List<LessonCard> cards;
  final String? iconUrl;

  /// Slug from the built-in glyph set (core/lesson_icons.dart), chosen in the
  /// admin panel. Takes precedence over [iconUrl] — the server treats the two
  /// as mutually exclusive, but an older content.json may still carry both.
  final String? icon;

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
      icon: _asIconSlug(json['icon']),
    );
  }
}

/// A built-in glyph slug (core/lesson_icons.dart), or null when unset or
/// blank. Every icon-bearing entity stores it under the same `icon` key.
String? _asIconSlug(dynamic value) {
  final s = value?.toString().trim() ?? '';
  return s.isEmpty ? null : s;
}

class Module {
  const Module({
    required this.id,
    required this.title,
    required this.color,
    required this.lessons,
    this.iconUrl,
    this.icon,
    this.partnerId,
    this.artSide = 'left',
  });

  final String id;

  /// {ky, ru, en} (or legacy bare string) since Task 13.
  final dynamic title;

  /// Hex string like "#1CB0F6"; the learn path tints its nodes and the
  /// connecting curve with it.
  final String color;
  final List<Lesson> lessons;
  final String? iconUrl;

  /// The small badge beside the module title. Independent of [iconUrl],
  /// which is the large framed artwork above the path — a module can carry
  /// both, and the badge only surfaces when the artwork is absent.
  final String? icon;
  final String? partnerId;

  /// Which edge of the lesson path [iconUrl] stands on: 'left' or 'right',
  /// chosen per module in the admin panel. Defaults to 'left', which is
  /// where every tile sat before the field existed.
  final String artSide;

  factory Module.fromJson(Map<String, dynamic> json) => Module(
        id: _asString(json['id']),
        title: json['title'],
        color: _asString(json['color'], '#1CB0F6'),
        lessons: _asList(json['lessons'], Lesson.fromJson),
        iconUrl: _asIconUrl(json['iconUrl']),
        icon: _asIconSlug(json['icon']),
        partnerId: json['partnerId']?.toString(),
        // Anything the server has not backfilled, or a value from a newer
        // panel this build does not know, falls back to the side every tile
        // used to sit on rather than to an empty string nothing can place.
        artSide: json['artSide'] == 'right' ? 'right' : 'left',
      );
}

class League {
  const League({
    required this.id,
    required this.name,
    required this.color,
    required this.minXp,
    this.iconUrl,
    this.icon,
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

  /// Built-in glyph slug — takes precedence over [iconUrl].
  final String? icon;

  factory League.fromJson(Map<String, dynamic> json) => League(
        id: _asString(json['id']),
        name: json['name'],
        color: _asString(json['color'], '#1CB0F6'),
        minXp: _asInt(json['minXp']),
        iconUrl: _asIconUrl(json['iconUrl']),
        icon: _asIconSlug(json['icon']),
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
    this.icon,
    this.rule,
  });

  final String id;

  /// {ky, ru, en} (or legacy bare string) since Task 13.
  final dynamic title;
  final dynamic description;
  final int xp;
  final String? iconUrl;

  /// Built-in glyph slug — takes precedence over [iconUrl].
  final String? icon;
  final AchievementRule? rule;

  factory Achievement.fromJson(Map<String, dynamic> json) => Achievement(
        id: _asString(json['id']),
        title: json['title'],
        description: json['desc'],
        xp: _asInt(json['xp']),
        iconUrl: _asIconUrl(json['iconUrl']),
        icon: _asIconSlug(json['icon']),
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
    this.icon,
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

  /// Built-in glyph slug — takes precedence over [iconUrl].
  final String? icon;

  factory ShopItem.fromJson(Map<String, dynamic> json) => ShopItem(
        id: _asString(json['id']),
        title: json['title'],
        description: json['desc'],
        price: _asInt(json['price']),
        effect: _asString(json['effect']),
        iconUrl: _asIconUrl(json['iconUrl']),
        icon: _asIconSlug(json['icon']),
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
    this.stockLeft,
    this.soldOut = false,
  });

  final String id;
  final String partnerId;
  final dynamic title;
  final dynamic description;
  final int priceCoins;
  final String? photoUrl;

  /// Promo codes still unsold, or null when this prize has no code
  /// programme at all and so nothing to run out of. The codes themselves
  /// never leave the admin (admin-api/routes.js#/public/content).
  final int? stockLeft;

  /// The stock existed and is now empty. Not the same as [stockLeft] == 0
  /// on a prize that never had codes — that one is still on sale.
  final bool soldOut;

  factory Prize.fromJson(Map<String, dynamic> json) => Prize(
        id: _asString(json['id']),
        partnerId: _asString(json['partnerId']),
        title: json['title'],
        description: json['description'],
        priceCoins: _asInt(json['priceCoins']),
        photoUrl: _asIconUrl(json['photoUrl']),
        stockLeft:
            json['stockLeft'] is num ? (json['stockLeft'] as num).toInt() : null,
        soldOut: json['soldOut'] == true,
      );
}

class ContentLimits {
  const ContentLimits({
    this.dailyFreeLessons = 3,
    this.energyRefillHours = 24,
    this.supportEnergyAmount = 5,
    this.xpPerQuestion = 10,
    this.xpMistakePenalty = 3,
    this.xpMinFloorPct = 40,
    this.xpPerfectBonusPct = 20,
    this.xpBoostMultiplierPct = 125,
    this.maxBonusEnergyPerDay = 0,
    this.coinsPerfectLesson = 10,
    this.coinsNormalLesson = 5,
    this.streakRepairEnergy = 1,
  });
  final int dailyFreeLessons;

  /// How often the energy allowance refills, in hours. Admin-editable
  /// (Module В); 24 means the original UTC-midnight behaviour. See
  /// logic.dart#computeLiveEnergy and admin-api/energy.js.
  final int energyRefillHours;

  /// University league: how much energy one viewer hands a student.
  final int supportEnergyAmount;

  /// The reward formula, every term of it, exactly as the Лимиттер tab
  /// defines it (admin-api/adminRoutes.js#LIMIT_FIELDS). Five of these used
  /// to be dropped on parse, so raising the XP per question in the admin
  /// panel changed what the server paid but not what the app promised.
  ///
  /// These drive the optimistic HUD counters and the "up to +N XP" preview
  /// only — the server stays the authority on what is actually awarded
  /// (admin-api/routes.js#completeLesson).
  final int xpPerQuestion;
  final int xpMistakePenalty;
  final int xpMinFloorPct;
  final int xpPerfectBonusPct;
  final int xpBoostMultiplierPct;

  /// Ceiling on energy a student may receive as gifts in one day.
  final int maxBonusEnergyPerDay;

  final int coinsPerfectLesson;
  final int coinsNormalLesson;

  /// Energy it costs to buy a broken streak back on the day it breaks
  /// (admin-api/routes.js#/u/me/streak/repair). 0 means the admin has
  /// switched the offer off and a missed day simply ends the run.
  final int streakRepairEnergy;

  factory ContentLimits.fromJson(Map<String, dynamic> json) => ContentLimits(
        dailyFreeLessons: _asInt(json['dailyFreeLessons'], 3),
        energyRefillHours: _asInt(json['energyRefillHours'], 24),
        supportEnergyAmount: _asInt(json['supportEnergyAmount'], 5),
        xpPerQuestion: _asInt(json['xpPerQuestion'], 10),
        xpMistakePenalty: _asInt(json['xpMistakePenalty'], 3),
        xpMinFloorPct: _asInt(json['xpMinFloorPct'], 40),
        xpPerfectBonusPct: _asInt(json['xpPerfectBonusPct'], 20),
        xpBoostMultiplierPct: _asInt(json['xpBoostMultiplierPct'], 125),
        maxBonusEnergyPerDay: _asInt(json['maxBonusEnergyPerDay'], 0),
        coinsPerfectLesson: _asInt(json['coinsPerfectLesson'], 10),
        coinsNormalLesson: _asInt(json['coinsNormalLesson'], 5),
        streakRepairEnergy: _asInt(json['streakRepairEnergy'], 1),
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
    this.universities = const [],
  });

  final List<Module> modules;
  final List<League> leagues;
  final List<Achievement> achievements;
  final List<ShopItem> shopItems;
  final List<Partner> partners;
  final List<Prize> prizes;
  final ContentLimits limits;

  /// Module Г — the campuses and their contests. Server content since the
  /// admin took ownership of it; the league screen reads this instead of a
  /// hardcoded list.
  final List<University> universities;

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
        universities: _asList(json['universities'], University.fromJson),
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

  /// Null for an id that is no longer in the catalogue — a campus can be
  /// deleted in the admin while a learner still has it on their account.
  University? universityById(String? id) {
    if (id == null) return null;
    for (final u in universities) {
      if (u.id == id) return u;
    }
    return null;
  }
}


/// GET /public/config — the handful of settings the app has to learn from
/// the server rather than from its own build.
///
/// Google's client ids live here rather than in a --dart-define so that
/// turning sign-in on is a server change, not a store release: an
/// already-installed build starts showing the button as soon as the backend
/// is configured.
class PublicConfig {
  const PublicConfig({
    this.googleClientId,
    this.googleClientIdIos,
    this.googleClientIdAndroid,
    this.appleSignIn = false,
  });

  /// The WEB client id — sent as Google's `serverClientId` on every
  /// platform, because it is the audience the backend verifies against.
  final String? googleClientId;

  /// iOS needs its own client id at sign-in time. Android resolves itself
  /// from the package name + signing certificate, so it sends none.
  final String? googleClientIdIos;
  final String? googleClientIdAndroid;

  /// Whether the server can verify an Apple token at all — it answers false
  /// until APPLE_BUNDLE_ID is set. The button is shown only when this is
  /// true, for the same reason the Google one is: App Store review treats a
  /// visible control that cannot work as a broken feature (Guideline 2.1).
  final bool appleSignIn;

  static String? _str(dynamic v) {
    final s = v?.toString().trim();
    return (s == null || s.isEmpty) ? null : s;
  }

  factory PublicConfig.fromJson(Map<String, dynamic> json) => PublicConfig(
        googleClientId: _str(json['googleClientId']),
        googleClientIdIos: _str(json['googleClientIdIos']),
        googleClientIdAndroid: _str(json['googleClientIdAndroid']),
        appleSignIn: json['appleSignIn'] == true,
      );
}
