/// Riverpod wiring: API client, session, content, and user preferences.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../core/i18n.dart';
import '../models/content.dart';
import '../models/university.dart';
import '../models/user_state.dart';

/// Overridden in main() with the instance created during startup, so no
/// widget ever awaits client construction mid-build.
final apiClientProvider = Provider<ApiClient>(
  (ref) => throw UnimplementedError('apiClientProvider must be overridden'),
);

final prefsProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError('prefsProvider must be overridden'),
);

// ── Preferences (locale + bright mode) ─────────────────────────────────────

class LocaleController extends StateNotifier<AppLocale> {
  LocaleController(this._prefs)
      : super(AppLocale.fromCode(_prefs.getString(_key)));

  static const _key = 'jashmen.locale';
  final SharedPreferences _prefs;

  void set(AppLocale locale) {
    state = locale;
    _prefs.setString(_key, locale.code);
  }
}

final localeProvider = StateNotifierProvider<LocaleController, AppLocale>(
  (ref) => LocaleController(ref.watch(prefsProvider)),
);

/// The web app calls its light theme "bright mode"; dark is the default on
/// both clients.
class BrightModeController extends StateNotifier<bool> {
  BrightModeController(this._prefs) : super(_prefs.getBool(_key) ?? false);

  static const _key = 'jashmen.bright';
  final SharedPreferences _prefs;

  void toggle() => set(!state);

  void set(bool value) {
    state = value;
    _prefs.setBool(_key, value);
  }
}

final brightModeProvider = StateNotifierProvider<BrightModeController, bool>(
  (ref) => BrightModeController(ref.watch(prefsProvider)),
);

/// Task 9 — true once the first-launch onboarding carousel has been shown
/// and dismissed (skip or "get started"), persisted so it's shown exactly
/// once per install. Same persisted-bool shape as [BrightModeController].
class OnboardedController extends StateNotifier<bool> {
  OnboardedController(this._prefs) : super(_prefs.getBool(_key) ?? false);

  static const _key = 'jashmen.onboarded';
  final SharedPreferences _prefs;

  void markDone() {
    state = true;
    _prefs.setBool(_key, true);
  }
}

final onboardedProvider = StateNotifierProvider<OnboardedController, bool>(
  (ref) => OnboardedController(ref.watch(prefsProvider)),
);

/// The player's enrolment in the university league: which side of it they
/// are on, and which campus they picked. Both are needed before the tab can
/// show anything — a viewer still has to say whose standings to open.
class UniLeagueEnrolment {
  const UniLeagueEnrolment({this.role, this.universityId});

  final UniLeagueRole? role;
  final String? universityId;

  bool get isComplete => role != null && universityId != null;
}

/// Derived from the signed-in account, not from disk. Both answers moved to
/// the server (state.uniId / state.uniRole) because a viewer's gift and a
/// student's supporter list are facts about two people — a per-device answer
/// could never resolve either. Writes go through
/// AuthController.setUniversity.
final uniLeagueProvider = Provider<UniLeagueEnrolment>((ref) {
  final st = ref.watch(userStateProvider);
  return UniLeagueEnrolment(
    role: UniLeagueRole.fromCode(st?.uniRole),
    universityId: st?.uniId,
  );
});

/// The campus catalogue, straight off the content payload. Empty while the
/// content is still loading, which the picker renders as its empty state
/// rather than as an error.
final universitiesProvider = Provider<List<University>>(
  (ref) => ref.watch(contentProvider).valueOrNull?.universities ?? const [],
);

/// The live board for a campus. autoDispose so leaving the tab and coming
/// back refetches — a gift sent from another device should show up without
/// a manual refresh.
final uniBoardProvider =
    FutureProvider.autoDispose.family<UniBoard, String>((ref, universityId) {
  return ref.watch(apiClientProvider).fetchUniBoard(universityId);
});

/// Everyone who has backed the signed-in student.
final supportersProvider = FutureProvider.autoDispose<List<Supporter>>(
  (ref) => ref.watch(apiClientProvider).fetchSupporters(),
);

/// Set by the one daily claim per day that actually moved the streak —
/// app.dart turns this into the streak screen, then clears it.
class StreakEvent {
  const StreakEvent({required this.streak, this.activeDays = const []});
  final int streak;
  final List<String> activeDays;
}

final streakEventProvider = StateProvider<StreakEvent?>((ref) => null);

final stringsProvider = Provider<Strings>(
  (ref) => Strings(ref.watch(localeProvider)),
);

/// Which bottom-nav tab is showing (0=Learn, 1=League, 2=Shop, 3=Profile,
/// 4=Settings) — a plain StateProvider so any screen can switch tabs (e.g.
/// LessonPreviewSheet's "Go to shop" CTA when energy is gated) without
/// threading a callback all the way down from _HomeShell.
final homeTabIndexProvider = StateProvider<int>((ref) => 0);

// ── Session ────────────────────────────────────────────────────────────────

sealed class SessionState {
  const SessionState();
}

/// Startup: a token may exist on disk, so we can't decide auth yet.
class SessionLoading extends SessionState {
  const SessionLoading();
}

class SessionSignedOut extends SessionState {
  const SessionSignedOut();
}

class SessionSignedIn extends SessionState {
  const SessionSignedIn(this.user);
  final AppUser user;
}

class AuthController extends StateNotifier<SessionState> {
  AuthController(this._api, this._prefs, this._ref) : super(const SessionLoading()) {
    _api.onSessionExpired = signOutLocally;
    _restore();
  }

  final ApiClient _api;
  final SharedPreferences _prefs;
  final Ref _ref;

  // Pre-server builds answered the two enrolment questions into these two
  // keys. They survive only long enough to migrate an existing install once.
  static const _legacyRoleKey = 'jashmen.uniRole';
  static const _legacyUniKey = 'jashmen.uniId';

  /// A stored access token may be expired; the client's 401 interceptor
  /// refreshes it transparently, so one /u/me call is the whole probe.
  Future<void> _restore() async {
    if (!await _api.hasToken) {
      state = const SessionSignedOut();
      return;
    }
    try {
      _onSignedIn(await _api.fetchMe());
    } on ApiException catch (e) {
      // Offline at launch must NOT log the user out — only an actual
      // rejection from the server does.
      state = e.kind == ApiErrorKind.unauthorized
          ? const SessionSignedOut()
          : const SessionSignedOut();
    }
  }

  /// The one place a session starts. Everything that must happen exactly
  /// once per sign-in — the daily streak claim, the one-shot enrolment
  /// migration — hangs off here rather than being repeated at four call
  /// sites (which is how the web version's claimDaily got missed on mobile
  /// entirely: the endpoint existed and nothing ever called it).
  void _onSignedIn(AppUser user) {
    state = SessionSignedIn(user);
    unawaited(_claimDaily());
    unawaited(_migrateLegacyEnrolment(user));
  }

  Future<void> _claimDaily() async {
    try {
      final res = await _api.claimDaily();
      applyUser(res.user);
      if (res.claimed && res.streak > 0) {
        _ref.read(streakEventProvider.notifier).state =
            StreakEvent(streak: res.streak, activeDays: res.activeDays);
      }
    } on ApiException {
      // A missed daily claim is recoverable on the next launch — never let
      // it block the app from opening.
    }
  }

  Future<void> _migrateLegacyEnrolment(AppUser user) async {
    final role = UniLeagueRole.fromCode(_prefs.getString(_legacyRoleKey));
    final uni = _prefs.getString(_legacyUniKey);
    if (role == null && uni == null) return;
    await _prefs.remove(_legacyRoleKey);
    await _prefs.remove(_legacyUniKey);
    // Never overwrite a newer answer already made on another device.
    if (user.state.uniId != null || user.state.uniRole != null) return;
    if (role == null || uni == null) return;
    try {
      await setUniversity(role: role, universityId: uni);
    } on ApiException {
      // The player just re-answers the two questions — not worth a dialog.
    }
  }

  Future<void> login(String email, String password) async {
    _onSignedIn(await _api.login(email: email, password: password));
  }

  Future<void> signup(String name, String email, String password) async {
    _onSignedIn(await _api.signup(name: name, email: email, password: password));
  }

  /// Google sign-in: the server turns the id_token into the same session
  /// login/signup produce, so nothing downstream changes.
  Future<void> signInWithGoogle(String idToken) async {
    _onSignedIn(await _api.loginWithGoogle(idToken));
  }

  /// University-league enrolment. Pass both null to leave the league.
  Future<void> setUniversity({UniLeagueRole? role, String? universityId}) async {
    applyUser(await _api.setUniversity(
      universityId: universityId,
      role: role?.code,
    ));
  }

  /// A password change revokes every session server-side and returns a
  /// fresh access token — storing it is what keeps THIS device signed in.
  Future<void> adoptSession(String token, AppUser user) async {
    await _api.saveAccessToken(token);
    applyUser(user);
  }

  Future<void> signOut() async {
    await _api.logout();
    _ref.read(streakEventProvider.notifier).state = null;
    state = const SessionSignedOut();
  }

  void signOutLocally() {
    _api.clearToken();
    _ref.read(streakEventProvider.notifier).state = null;
    state = const SessionSignedOut();
  }

  /// Replaces the cached progress after any server write.
  void applyState(UserState next) {
    final current = state;
    if (current is! SessionSignedIn) return;
    state = SessionSignedIn(AppUser(
      id: current.user.id,
      name: current.user.name,
      email: current.user.email,
      avatar: current.user.avatar,
      hasPassword: current.user.hasPassword,
      state: next,
    ));
  }

  /// Task 6 — replaces the whole cached user (name/avatar changed, not just
  /// progress) after a profile write like PATCH /u/me/state{name:...} or
  /// POST /u/me/avatar, both of which return the full user object.
  void applyUser(AppUser next) {
    if (state is! SessionSignedIn) return;
    state = SessionSignedIn(next);
  }

  Future<void> refreshMe() async {
    try {
      state = SessionSignedIn(await _api.fetchMe());
    } on ApiException {
      // Keep showing the last-known state rather than blanking the UI.
    }
  }
}

final authProvider = StateNotifierProvider<AuthController, SessionState>(
  (ref) => AuthController(ref.watch(apiClientProvider), ref.watch(prefsProvider), ref),
);

/// Convenience: the signed-in user, or null. A plain Provider on purpose —
/// widgets that only need identity (the league board asking "which row is
/// mine?") depend on this instead of on authProvider, which keeps them
/// overridable in a widget test without standing up an ApiClient.
final currentUserProvider = Provider<AppUser?>((ref) {
  final session = ref.watch(authProvider);
  return session is SessionSignedIn ? session.user : null;
});

/// Convenience: the signed-in user's progress, or null.
final userStateProvider = Provider<UserState?>(
  (ref) => ref.watch(currentUserProvider)?.state,
);

// ── Content ────────────────────────────────────────────────────────────────

/// Server-side client config (Google's client ids). Read once per launch —
/// the sign-in button waits on it rather than on a compile-time constant,
/// so enabling Google is a server change, not a new build.
/// autoDispose so a launch that raced the network (or a server that was
/// briefly down) refetches the next time the sign-in screen is shown,
/// instead of caching the failure for the whole session and leaving the
/// Google button permanently hidden.
final publicConfigProvider = FutureProvider.autoDispose<PublicConfig>(
  (ref) => ref.watch(apiClientProvider).fetchPublicConfig(),
);

final contentProvider = FutureProvider<AppContent>(
  (ref) => ref.watch(apiClientProvider).fetchContent(),
);

final leaderboardProvider = FutureProvider<List<LeaderboardEntry>>(
  (ref) => ref.watch(apiClientProvider).fetchLeaderboard(),
);

/// The signed-in user's coupon history. autoDispose so reopening the
/// profile refetches — a coupon redeemed in the shop must show up here
/// without a manual refresh.
final redemptionsProvider = FutureProvider.autoDispose<List<Redemption>>(
  (ref) => ref.watch(apiClientProvider).fetchMyRedemptions(),
);
