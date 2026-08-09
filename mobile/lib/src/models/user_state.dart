/// User + progress, from GET /admin/api/u/me.
/// Shape mirrors admin-api/routes.js#defaultState.
library;

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
  });

  final String id;
  final String name;
  final String email;
  final UserState state;

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        email: json['email']?.toString() ?? '',
        state: json['state'] is Map
            ? UserState.fromJson((json['state'] as Map).cast<String, dynamic>())
            : const UserState(),
      );
}

/// One row of GET /u/leaderboard.
class LeaderboardEntry {
  const LeaderboardEntry({
    required this.name,
    required this.xp,
    this.isMe = false,
  });

  final String name;
  final int xp;
  final bool isMe;

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) =>
      LeaderboardEntry(
        name: json['name']?.toString() ?? '',
        xp: _asInt(json['xp']),
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
