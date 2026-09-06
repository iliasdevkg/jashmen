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
    this.uniXp = 0,
    this.lifetimeXp = 0,
    this.coins = 0,
    this.streak = 0,
    this.lessonsToday = 0,
    this.energyDate,
    this.energyPeriod,
    this.bonusEnergyToday = 0,
    this.energyGivenToday = 0,
    this.supportEnergyToday = 0,
    this.energySpentToday = 0,
    this.uniId,
    this.uniRole,
    this.completedLessons = const [],
    this.achievements = const [],
    this.ownedShop = const [],
    this.settings = const UserSettings(),
    this.lastActiveDate,
    this.activeDays = const [],
    this.hasStreakShield = false,
    this.hasXpBoost = false,
    this.vipBadge = false,
    this.streakLost,
    this.streakLostAt,
  });

  /// The general league's score. Frozen while the learner is competing as
  /// a university student — see [uniXp].
  final int xp;

  /// The current university league's score, reset to 0 by the server on
  /// every enrolment (join, re-join, campus or role change). XP never
  /// crosses between the two boards: whichever league you are competing in
  /// is the one that grows (admin-api/routes.js#awardXp).
  final int uniXp;

  /// Every point ever earned, in either league, never reset. This is the
  /// figure the app's own "XP" counters show, so none of them can look
  /// stuck while the other board is the one filling up.
  final int lifetimeXp;
  final int coins;
  final int streak;
  final int lessonsToday;

  /// UTC date string ("YYYY-MM-DD") the daily counters belong to. Null until
  /// the first lesson. Compared against UTC today — see logic.dart.
  final String? energyDate;

  /// Absolute index of the refill period the counters belong to
  /// (floor(nowMs / periodMs) — see logic.dart). Null on states written
  /// before the interval model, where energyDate is the only marker.
  final int? energyPeriod;
  final int bonusEnergyToday;

  /// University league: energy this user gifted away, and energy viewers
  /// gifted them. Both roll over with the refill period.
  final int energyGivenToday;
  final int supportEnergyToday;

  /// Energy spent on something that is not a lesson and not a gift — today,
  /// only a streak repair. Tracked apart from [lessonsToday] so that number
  /// stays an honest count of finished lessons.
  final int energySpentToday;

  /// University-league enrolment, server-owned so a viewer's gift and a
  /// student's supporter list can be resolved across two accounts.
  final String? uniId;
  final String? uniRole;
  final List<String> completedLessons;
  final List<String> achievements;
  final List<String> ownedShop;
  final UserSettings settings;
  final String? lastActiveDate;

  /// Trailing window of UTC dates the learner showed up, newest last — what
  /// the streak screen's Su–Sa strip is drawn from.
  final List<String> activeDays;
  final bool hasStreakShield;
  final bool hasXpBoost;
  final bool vipBadge;

  /// What a run was worth when a missed day ended it, and the UTC day that
  /// happened on. Both null unless a repair is pending — see
  /// logic.dart#streakRepairOffer.
  final int? streakLost;
  final String? streakLostAt;

  Set<String> get completedSet => completedLessons.toSet();

  factory UserState.fromJson(Map<String, dynamic> json) => UserState(
        xp: _asInt(json['xp']),
        uniXp: _asInt(json['uniXp']),
        lifetimeXp: _asInt(json['lifetimeXp']),
        coins: _asInt(json['coins']),
        streak: _asInt(json['streak']),
        lessonsToday: _asInt(json['lessonsToday']),
        energyDate: json['energyDate']?.toString(),
        energyPeriod: json['energyPeriod'] is num ? (json['energyPeriod'] as num).toInt() : null,
        bonusEnergyToday: _asInt(json['bonusEnergyToday']),
        energyGivenToday: _asInt(json['energyGivenToday']),
        supportEnergyToday: _asInt(json['supportEnergyToday']),
        energySpentToday: _asInt(json['energySpentToday']),
        uniId: json['uniId']?.toString(),
        uniRole: json['uniRole']?.toString(),
        completedLessons: _asStringList(json['completedLessons']),
        achievements: _asStringList(json['achievements']),
        ownedShop: _asStringList(json['ownedShop']),
        settings: json['settings'] is Map
            ? UserSettings.fromJson((json['settings'] as Map).cast<String, dynamic>())
            : const UserSettings(),
        lastActiveDate: json['lastActiveDate']?.toString(),
        activeDays: _asStringList(json['activeDays']),
        hasStreakShield: _asBool(json['hasStreakShield']),
        hasXpBoost: _asBool(json['hasXpBoost']),
        vipBadge: _asBool(json['vipBadge']),
        streakLost: json['streakLost'] is num ? (json['streakLost'] as num).toInt() : null,
        streakLostAt: json['streakLostAt']?.toString(),
      );

  UserState copyWith({UserSettings? settings}) => UserState(
        xp: xp,
        uniXp: uniXp,
        lifetimeXp: lifetimeXp,
        coins: coins,
        streak: streak,
        lessonsToday: lessonsToday,
        energyDate: energyDate,
        energyPeriod: energyPeriod,
        bonusEnergyToday: bonusEnergyToday,
        energyGivenToday: energyGivenToday,
        supportEnergyToday: supportEnergyToday,
        energySpentToday: energySpentToday,
        uniId: uniId,
        uniRole: uniRole,
        completedLessons: completedLessons,
        achievements: achievements,
        ownedShop: ownedShop,
        settings: settings ?? this.settings,
        lastActiveDate: lastActiveDate,
        activeDays: activeDays,
        hasStreakShield: hasStreakShield,
        hasXpBoost: hasXpBoost,
        vipBadge: vipBadge,
        streakLost: streakLost,
        streakLostAt: streakLostAt,
      );
}

class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.state,
    this.avatar,
    this.hasPassword = true,
  });

  final String id;
  final String name;
  final String email;
  final UserState state;

  /// Whether the account has a password at all. False for a Google-only
  /// account, which is what makes Settings offer "set a password" instead
  /// of asking for a current one it never had.
  final bool hasPassword;

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
        hasPassword: json['hasPassword'] != false,
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
    this.promoCode,
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

  /// The partner's own code — the string the learner hands over at the till,
  /// snapshotted onto the record the day it was issued. Null on a prize with
  /// no code programme. [code] is JashMen's own number, for reconciling.
  final String? promoCode;

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
      promoCode: json['promoCode']?.toString(),
      prizeTitle: prize?['title'],
      prizePhotoUrl: resolveMediaUrl(prize?['photoUrl']),
      priceCoins: prize == null ? null : _asInt(prize['priceCoins']),
      partnerName: partner?['name'],
      partnerLogoUrl: resolveMediaUrl(partner?['logoUrl']),
    );
  }
}

/// The response of POST /u/me/daily. `claimed` is true only on the one call
/// per day that actually rolled the streak forward — the daily claim fires
/// on every session start, so it is what keeps the streak celebration to
/// once a day instead of once a launch.
class DailyClaim {
  const DailyClaim({
    required this.user,
    this.claimed = false,
    this.streak = 0,
    this.streakIncreased = false,
    this.activeDays = const [],
  });

  final AppUser user;
  final bool claimed;
  final int streak;
  final bool streakIncreased;

  /// Trailing window of UTC dates the learner showed up — the streak
  /// screen's Su–Sa strip is drawn from this.
  final List<String> activeDays;

  factory DailyClaim.fromJson(Map<String, dynamic> json) => DailyClaim(
        user: AppUser.fromJson(
            (json['user'] as Map?)?.cast<String, dynamic>() ?? const {}),
        claimed: json['claimed'] == true,
        streak: _asInt(json['streak']),
        streakIncreased: json['streakIncreased'] == true,
        activeDays: _asStringList(json['activeDays']),
      );
}
