/// User + progress, from GET /admin/api/u/me.
/// Shape mirrors admin-api/routes.js#defaultState.
library;

import '../core/config.dart';

int _asInt(dynamic v, [int fallback = 0]) => switch (v) {
      int i => i,
      num n => n.toInt(),
      String s => int.tryParse(s) ?? fallback,
      _ => fallback,
    };

bool _asBool(dynamic v, [bool fallback = false]) =>
    v is bool ? v : fallback;

List<String> _asStringList(dynamic v) => v is List
    ? v.map((e) => e.toString()).toList(growable: false)
    : const [];

class UserSettings {
  const UserSettings({this.sound = true, this.animations = true});
  final bool sound;
  final bool animations;

  factory UserSettings.fromJson(Map<String, dynamic> json) => UserSettings(
        sound: _asBool(json['sound'], true),
        animations: _asBool(json['animations'], true),
      );

  Map<String, dynamic> toJson() => {'sound': sound, 'animations': animations};

  UserSettings copyWith({bool? sound, bool? animations}) => UserSettings(
        sound: sound ?? this.sound,
        animations: animations ?? this.animations,
      );
}

class UserState {
  const UserState({
    this.xp = 0,
    this.coins = 0,
    this.streak = 0,
    this.lessonsToday = 0,
    this.energyDate,
    this.bonusEnergyToday = 0,
    this.completedLessons = const [],
    this.achievements = const [],
    this.ownedShop = const [],
    this.settings = const UserSettings(),
    this.lastActiveDate,
    this.hasStreakShield = false,
    this.hasXpBoost = false,
    this.vipBadge = false,
  });

  final int xp;
  final int coins;
  final int streak;
  final int lessonsToday;

  /// UTC date string ("YYYY-MM-DD") the daily counters belong to. Null until
  /// the first lesson. Compared against UTC today — see logic.dart.
  final String? energyDate;
  final int bonusEnergyToday;
  final List<String> completedLessons;
  final List<String> achievements;
  final List<String> ownedShop;
  final UserSettings settings;
  final String? lastActiveDate;
  final bool hasStreakShield;
  final bool hasXpBoost;
  final bool vipBadge;

  Set<String> get completedSet => completedLessons.toSet();

  factory UserState.fromJson(Map<String, dynamic> json) => UserState(
        xp: _asInt(json['xp']),
        coins: _asInt(json['coins']),
        streak: _asInt(json['streak']),
        lessonsToday: _asInt(json['lessonsToday']),
        energyDate: json['energyDate']?.toString(),
        bonusEnergyToday: _asInt(json['bonusEnergyToday']),
        completedLessons: _asStringList(json['completedLessons']),
        achievements: _asStringList(json['achievements']),
        ownedShop: _asStringList(json['ownedShop']),
        settings: json['settings'] is Map
            ? UserSettings.fromJson((json['settings'] as Map).cast<String, dynamic>())
            : const UserSettings(),
        lastActiveDate: json['lastActiveDate']?.toString(),
        hasStreakShield: _asBool(json['hasStreakShield']),
        hasXpBoost: _asBool(json['hasXpBoost']),
        vipBadge: _asBool(json['vipBadge']),
      );

  UserState copyWith({UserSettings? settings}) => UserState(
        xp: xp,
        coins: coins,
        streak: streak,
        lessonsToday: lessonsToday,
        energyDate: energyDate,
        bonusEnergyToday: bonusEnergyToday,
        completedLessons: completedLessons,
        achievements: achievements,
        ownedShop: ownedShop,
        settings: settings ?? this.settings,
        lastActiveDate: lastActiveDate,
        hasStreakShield: hasStreakShield,
        hasXpBoost: hasXpBoost,
        vipBadge: vipBadge,
      );
}

class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.state,
    this.avatar,
  });

  final String id;
  final String name;
  final String email;
  final UserState state;

  /// Task 6 — an uploaded photo (or a Google profile picture) as an
  /// absolute image URL, or null when the account still carries the
  /// legacy '🦅' emoji default. resolveMediaUrl rejects anything that
  /// isn't a real image reference, so null here reliably means "show the
  /// name-initial avatar," same convention as LeaderboardEntry.avatar.
  final String? avatar;

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        email: json['email']?.toString() ?? '',
        avatar: resolveMediaUrl(json['avatar']),
        state: json['state'] is Map
            ? UserState.fromJson((json['state'] as Map).cast<String, dynamic>())
            : const UserState(),
      );
}

/// One row of GET /u/leaderboard, already sorted by xp descending server-side.
class LeaderboardEntry {
  const LeaderboardEntry({
    required this.id,
    required this.name,
    required this.xp,
    this.avatar,
    this.streak = 0,
  });

  final String id;
  final String name;
  final int xp;

  /// An absolute image URL, or null when the account still carries the
  /// historical emoji avatar ('🦅') — resolveMediaUrl rejects anything that
  /// isn't a real image reference, so callers can treat non-null as
  /// "loadable" and fall back to the initial otherwise.
  final String? avatar;
  final int streak;

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) =>
      LeaderboardEntry(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        xp: _asInt(json['xp']),
        avatar: resolveMediaUrl(json['avatar']),
        streak: _asInt(json['streak']),
      );
}

/// Reward returned by POST /u/me/lesson. The server is the sole authority
/// on these numbers; the client only previews a ceiling beforehand.
class LessonReward {
  const LessonReward({
    required this.xp,
    required this.coins,
    required this.perfect,
    required this.isReview,
  });

  final int xp;
  final int coins;
  final bool perfect;
  final bool isReview;

  factory LessonReward.fromJson(Map<String, dynamic> json) => LessonReward(
        xp: _asInt(json['xp']),
        coins: _asInt(json['coins']),
        perfect: _asBool(json['perfect']),
        isReview: _asBool(json['isReview']),
      );
}

/// One claimed coupon from GET /u/me/redemptions — the learner's
/// proof-of-claim trail. The server joins prize/partner details at read
/// time, so [prizeTitle]/[partnerName] are null when the admin has since
/// deleted that prize; the code and date still stand on their own.
class Redemption {
  const Redemption({
    required this.id,
    required this.code,
    required this.date,
    this.ts,
    this.prizeTitle,
    this.prizePhotoUrl,
    this.priceCoins,
    this.partnerName,
    this.partnerLogoUrl,
  });

  final String id;
  final String code;

  /// YYYY-MM-DD (UTC) — the same string the daily cap is keyed on.
  final String date;
  final int? ts;

  /// {ky, ru, en} map or legacy bare string — render via localizedContent.
  final dynamic prizeTitle;
  final String? prizePhotoUrl;
  final int? priceCoins;
  final dynamic partnerName;
  final String? partnerLogoUrl;

  factory Redemption.fromJson(Map<String, dynamic> json) {
    final prize = (json['prize'] as Map?)?.cast<String, dynamic>();
    final partner = (json['partner'] as Map?)?.cast<String, dynamic>();
    return Redemption(
      id: json['id']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      date: json['date']?.toString() ?? '',
      ts: json['ts'] is num ? (json['ts'] as num).toInt() : null,
      prizeTitle: prize?['title'],
      prizePhotoUrl: resolveMediaUrl(prize?['photoUrl']),
      priceCoins: prize == null ? null : _asInt(prize['priceCoins']),
      partnerName: partner?['name'],
      partnerLogoUrl: resolveMediaUrl(partner?['logoUrl']),
    );
  }
}
