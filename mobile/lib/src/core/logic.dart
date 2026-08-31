/// Direct port of the web app's src/utils.js. Every function here has a
/// counterpart there and must stay in lockstep — the server is the authority
/// on rewards, but these decide what the UI shows *before* a request, so a
/// drift shows up as a lesson that looks unlocked and then 403s.
library;

import '../models/content.dart';
import '../models/user_state.dart';

class EnergyState {
  const EnergyState({required this.remaining, this.resetMs});
  final int remaining;

  /// Milliseconds until the current refill period ends, or null while
  /// energy remains.
  final int? resetMs;
}

const int kDefaultRefillHours = 24;

/// Clamps the admin-editable refill period to the same guard rails
/// admin-api/energy.js uses, so a junk value can never divide by zero here.
int normalizeRefillHours(int hours) {
  if (hours <= 0) return kDefaultRefillHours;
  return hours.clamp(1, 168);
}

/// Mirrors utils.js#computeLiveEnergy, which itself mirrors
/// admin-api/energy.js. Users get `dailyFreeLessons` completions per refill
/// period, and the period length is admin-editable
/// (content.limits.energyRefillHours). Periods are absolute slices of epoch
/// time — floor(nowMs / periodMs) — so at the default 24 h a boundary is
/// exactly UTC midnight, NOT device midnight: using local time here would
/// let a user in +06:00 reset six hours early and then get 403'd.
EnergyState computeLiveEnergy(
  UserState? state, {
  int dailyFreeLessons = 3,
  int energyRefillHours = kDefaultRefillHours,
}) {
  if (state == null) return EnergyState(remaining: dailyFreeLessons);

  final periodMs = normalizeRefillHours(energyRefillHours) * 3600 * 1000;
  final nowMs = DateTime.now().toUtc().millisecondsSinceEpoch;
  final period = nowMs ~/ periodMs;

  // States written before the interval model carry only energyDate; for
  // those "still today" is the best reading of "still in this period" —
  // and at 24 h it is the same thing.
  final today = DateTime.now().toUtc().toIso8601String().substring(0, 10);
  final samePeriod = state.energyPeriod != null
      ? state.energyPeriod == period
      : state.energyDate == today;

  final lessonsToday = samePeriod ? state.lessonsToday : 0;
  final bonusToday = samePeriod ? state.bonusEnergyToday : 0;
  // Energy gifted by university-league viewers stacks on the allowance;
  // energy this user gifted away is spent from it.
  final supportToday = samePeriod ? state.supportEnergyToday : 0;
  final givenToday = samePeriod ? state.energyGivenToday : 0;

  final cap = dailyFreeLessons + bonusToday + supportToday;
  final remaining = (cap - lessonsToday - givenToday).clamp(0, cap);

  if (remaining > 0) return EnergyState(remaining: remaining);

  return EnergyState(
    remaining: 0,
    resetMs: (period + 1) * periodMs - nowMs,
  );
}

/// utils.js#formatCountdown — "m:ss", or "h:mm:ss" once the countdown
/// crosses an hour. Every call site feeds this the time until the refill
/// period ends (up to ~168h), so a bare "m:ss" used to print nonsense like
/// "548:47" instead of a readable "9:08:47".
String formatCountdown(int? ms) {
  if (ms == null || ms <= 0) return '0:00';
  final totalSeconds = ms ~/ 1000;
  final h = totalSeconds ~/ 3600;
  final m = (totalSeconds % 3600) ~/ 60;
  final s = totalSeconds % 60;
  return h > 0
      ? '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}'
      : '$m:${s.toString().padLeft(2, '0')}';
}

/// utils.js#getCurrentLeague — highest league whose minXp the user has met.
League? getCurrentLeague(int xp, List<League> leagues) {
  if (leagues.isEmpty) return null;
  final sorted = [...leagues]..sort((a, b) => b.minXp.compareTo(a.minXp));
  for (final l in sorted) {
    if (xp >= l.minXp) return l;
  }
  return sorted.last;
}

/// utils.js#getLessonOrder — flattens modules into one ordered id list.
List<String> getLessonOrder(List<Module> modules) => [
      for (final m in modules)
        for (final l in m.lessons) l.id,
    ];

enum LessonStatus { locked, available, completed }

/// utils.js#getLessonStatus.
///
/// Completed is checked BEFORE the previous-lesson gate, and that order is
/// load-bearing: content is admin-editable, so a new lesson can be spliced
/// in ahead of one the user already finished. Gating first would re-lock
/// finished lessons the moment a new predecessor appears.
LessonStatus getLessonStatus(
  String lessonId,
  List<String> lessonOrder,
  Set<String> completedLessons,
) {
  if (completedLessons.contains(lessonId)) return LessonStatus.completed;

  final idx = lessonOrder.indexOf(lessonId);
  if (idx < 0) return LessonStatus.locked;
  if (idx == 0) return LessonStatus.available;

  return completedLessons.contains(lessonOrder[idx - 1])
      ? LessonStatus.available
      : LessonStatus.locked;
}

/// utils.js#quizCountOf — how many of a lesson's cards are quizzes.
int quizCountOf(Lesson lesson) =>
    lesson.cards.where((c) => c.type == CardType.quiz).length;

/// utils.js#maxLessonXp — the ceiling reward (zero mistakes, perfect bonus),
/// shown as "up to +N XP" before a lesson starts. The server stays the sole
/// authority on the actual reward.
int maxLessonXp(Lesson lesson) => (quizCountOf(lesson) * 10 * 1.2).round();

/// utils.js#evaluateAchievementRule — mirrors
/// admin-api/contentStore.js#evaluateAchievementRule. Unlock conditions are
/// data, not hardcoded ids, so the admin panel can add achievements with no
/// app release.
bool evaluateAchievementRule(AchievementRule? rule, AchievementContext ctx) {
  switch (rule?.type) {
    case 'lessons_completed':
      return ctx.completedCount >= (rule?.value ?? 0);
    case 'streak_days':
      return ctx.streak >= (rule?.value ?? 0);
    case 'xp_total':
      return ctx.xp >= (rule?.value ?? 0);
    case 'perfect_lesson':
      return ctx.rewardPerfect && !ctx.rewardIsReview;
    case 'all_lessons_completed':
      return ctx.totalLessons > 0 && ctx.completedCount >= ctx.totalLessons;
    default:
      return false;
  }
}

class AchievementContext {
  const AchievementContext({
    required this.xp,
    required this.streak,
    required this.completedCount,
    required this.totalLessons,
    this.rewardPerfect = false,
    this.rewardIsReview = false,
  });

  final int xp;
  final int streak;
  final int completedCount;
  final int totalLessons;
  final bool rewardPerfect;
  final bool rewardIsReview;
}

/// utils.js#checkNewAchievements — ids earned by this action that the user
/// did not already hold.
List<String> checkNewAchievements({
  required UserState state,
  required List<Achievement> all,
  required int totalLessons,
  bool rewardPerfect = false,
  bool rewardIsReview = false,
}) {
  if (all.isEmpty) return const [];

  final earned = state.achievements.toSet();
  final ctx = AchievementContext(
    // Lifetime total, mirroring the server's rule engine — an xp_total
    // achievement must not stall because the learner joined a campus board.
    xp: state.lifetimeXp,
    streak: state.streak,
    completedCount: state.completedLessons.length,
    totalLessons: totalLessons,
    rewardPerfect: rewardPerfect,
    rewardIsReview: rewardIsReview,
  );

  return [
    for (final a in all)
      if (!earned.contains(a.id) && evaluateAchievementRule(a.rule, ctx)) a.id,
  ];
}
