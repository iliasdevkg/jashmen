/// Riverpod wiring: API client, session, content, and user preferences.
library;

import 'dart:async';
import 'dart:convert';

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

  /// The last account /u/me described, verbatim. Launching with no signal
  /// used to mean the login screen even though the token on disk was fine;
  /// with this the app opens on the learner's own numbers, slightly stale,
  /// and corrects itself the moment a request gets through. Cleared on a
  /// real sign-out so the next person on the device sees nothing of theirs.
  static const _cachedUserKey = 'jashmen.cachedUser';

  /// How long to wait between attempts at the launch probe. Short, because
  /// the splash screen is on display the whole time, and only three of them
  /// because a launch cannot hang forever waiting for a dead network.
  static const _restoreBackoff = [
    Duration(milliseconds: 400),
    Duration(seconds: 1),
    Duration(seconds: 2),
  ];

  /// A stored access token may be expired; the client's 401 interceptor
  /// refreshes it transparently, so one /u/me call is the whole probe.
  Future<void> _restore() async {
    if (!await _api.hasToken) {
      state = const SessionSignedOut();
      return;
    }
    // A rejection from the server is the only thing that ends a session.
    // Anything else — no signal, a timeout, a container still starting — is
    // the network's problem, not the learner's, so the probe is simply
    // asked again. This block used to be a ternary whose two branches were
    // both SessionSignedOut(), which meant one blip at launch threw someone
    // onto the login screen with a perfectly valid session still on disk.
    for (var attempt = 0; ; attempt++) {
      try {
        _onSignedIn(await _api.fetchMe());
        return;
      } on ApiException catch (e) {
        if (e.kind == ApiErrorKind.unauthorized) {
          state = const SessionSignedOut();
          return;
        }
        if (attempt >= _restoreBackoff.length) {
          // Out of patience with the network. If this device has seen the
          // account before, open on that rather than on a login screen: the
          // token is still on disk, every screen refreshes itself as soon as
          // a request gets through, and the alternative is asking someone
          // to re-type a password for a session that never expired.
          final cached = _cachedUser();
          state = cached == null
              ? const SessionSignedOut()
              : SessionSignedIn(cached);
          return;
        }
        await Future<void>.delayed(_restoreBackoff[attempt]);
      }
    }
  }

  /// The one place a session starts. Everything that must happen exactly
  /// once per sign-in — the daily streak claim, the one-shot enrolment
  /// migration — hangs off here rather than being repeated at four call
  /// sites (which is how the web version's claimDaily got missed on mobile
  /// entirely: the endpoint existed and nothing ever called it).
  void _cacheUser() {
    final body = _api.lastMeBody;
    if (body == null) return;
    unawaited(_prefs.setString(_cachedUserKey, jsonEncode(body)));
  }

  /// The cached account, or null when there is none or it will not parse.
  AppUser? _cachedUser() {
    final raw = _prefs.getString(_cachedUserKey);
    if (raw == null) return null;
    try {
      return AppUser.fromJson((jsonDecode(raw) as Map).cast<String, dynamic>());
    } catch (_) {
      return null; // written by an older build — not worth keeping
    }
  }

  void _onSignedIn(AppUser user) {
    _cacheUser();
    state = SessionSignedIn(user);
    // The previous account's refresh clocks say nothing about this one, and
    // the content is per-account in places (a campus board, a shop the
    // learner has already bought from).
    _ref.read(refresherProvider).reset();
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

  /// Buys back the run a missed day ended. Throws [ApiException] straight
  /// through: the caller is a button that has to say why it failed.
  Future<void> repairStreak() async {
    applyUser(await _api.repairStreak());
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
  /// Apple sends the display name only on the first authorisation, so
  /// [name] is whatever the plugin was given this once — the server keeps it
  /// only when it creates the account.
  Future<void> signInWithApple(String identityToken, {String? name}) async {
    _onSignedIn(await _api.loginWithApple(identityToken, name: name));
  }

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
    await _prefs.remove(_cachedUserKey);
    _ref.read(streakEventProvider.notifier).state = null;
    state = const SessionSignedOut();
  }

  /// Deletes the account, then leaves the device in exactly the state a
  /// sign-out leaves it. The cached user goes with it — the whole point is
  /// that nothing about this person is left on the phone either.
  ///
  /// Errors are rethrown so the dialog can show what the server said (a
  /// wrong password, most often) rather than closing on a silent failure and
  /// letting someone believe their account is gone when it is not.
  Future<void> deleteAccount({String? password, String? confirm}) async {
    await _api.deleteAccount(password: password, confirm: confirm);
    await _prefs.remove(_cachedUserKey);
    _ref.read(streakEventProvider.notifier).state = null;
    state = const SessionSignedOut();
  }

  void signOutLocally() {
    _api.clearToken();
    // The session is genuinely over — the next person to open this phone
    // must not be shown the last one's coins, streak or name.
    unawaited(_prefs.remove(_cachedUserKey));
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

/// The economy's dials, straight from the Лимиттер tab. Null until content
/// lands — every reader falls back to the same defaults routes.js uses, so a
/// screen built before the fetch resolves still shows sane numbers.
final limitsProvider = Provider<ContentLimits?>(
  (ref) => ref.watch(contentProvider).valueOrNull?.limits,
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

// ── Keeping the screens current ────────────────────────────────────────────
//
// Everything above is fetched once and then cached for the life of the
// process, which is right for a scroll but wrong for a shop: an operator
// changes a prize's stock in the admin and the app goes on selling the old
// number until someone force-quits it. The five tabs live in an IndexedStack
// so they all stay mounted, which also means `autoDispose` never fires and
// the providers that were supposed to refetch on re-entry never did.
//
// The answer is not to refetch everything on every tap — that spends the
// learner's data and makes the screen jump under their thumb. It is to
// refetch what a screen actually shows, and only when it might have gone
// stale:
//
//   • switching to a tab, if that tab's data is older than [_staleAfter]
//   • coming back from the background, always — a phone in a pocket for an
//     hour has stale everything
//   • pulling down, always — that gesture IS the request
//
// Nothing here blanks a screen: `ref.invalidate` on a watched provider is a
// refresh rather than a reload, and AsyncValue.when keeps showing the last
// value while the new one is in flight (skipLoadingOnRefresh defaults to
// true). The learner sees the old number until the new one lands, never a
// spinner where their coins used to be.

/// How long a tab's data stays trustworthy without asking again. One
/// second, so in practice every tab a learner opens refetches — the freshest
/// possible reading, at the cost of a request per tap. Not zero because a
/// single tap can still rebuild twice, and one request per tap is the point.
const Duration kStaleAfter = Duration(seconds: 1);

/// Which reads belong to which tab, so switching to one refreshes what that
/// screen draws and nothing else. Indexes match _HomeShell's tab order.
enum HomeTab { learn, league, shop, profile, settings }

/// Remembers when each data source was last refreshed, and answers whether
/// it is worth asking again. Split out from [Refresher] so the rule that
/// actually decides how much traffic the app makes can be tested on its
/// own, with no Riverpod and no network.
class StaleClock {
  StaleClock({DateTime Function()? now}) : _now = now ?? DateTime.now;

  final DateTime Function() _now;
  final Map<String, DateTime> _seen = {};

  /// True when [key] has never been refreshed, or was refreshed longer ago
  /// than [after]. Marks it as refreshed when it answers true, so two
  /// callers in the same moment do not both fire.
  bool due(String key, {Duration after = kStaleAfter, bool force = false}) {
    final last = _seen[key];
    if (!force && last != null && _now().difference(last) < after) return false;
    _seen[key] = _now();
    return true;
  }

  /// Forgets every clock, so the next read of anything refetches.
  void reset() => _seen.clear();
}

class Refresher {
  Refresher(this._ref, {StaleClock? clock}) : _clock = clock ?? StaleClock();

  final Ref _ref;
  final StaleClock _clock;

  /// Everything a tab shows. [force] skips the staleness check — that is
  /// what a pull-to-refresh and a return from the background both want.
  ///
  /// Awaitable, because RefreshIndicator holds its spinner until the future
  /// it is given completes; a fire-and-forget invalidate makes the gesture
  /// look like it did nothing.
  Future<void> tab(HomeTab which, {bool force = false}) {
    final work = <Future<void>>[];
    switch (which) {
      case HomeTab.learn:
        work.add(_refresh('content', force, () => _ref.refresh(contentProvider.future)));
      case HomeTab.league:
        work.add(_refresh(
            'leaderboard', force, () => _ref.refresh(leaderboardProvider.future)));
        final uni = _ref.read(currentUserProvider)?.state.uniId;
        if (uni != null) {
          work.add(_refresh(
              'uniBoard', force, () => _ref.refresh(uniBoardProvider(uni).future)));
        }
      case HomeTab.shop:
        // The prize stock lives in the content blob, so the shop's "3 left"
        // is only as fresh as this call.
        work.add(_refresh('content', force, () => _ref.refresh(contentProvider.future)));
      case HomeTab.profile:
        work.add(_refresh(
            'redemptions', force, () => _ref.refresh(redemptionsProvider.future)));
        work.add(_refresh('content', force, () => _ref.refresh(contentProvider.future)));
      case HomeTab.settings:
        break;
    }
    // Coins, energy and streak sit in the header of every tab, so the
    // session is refreshed alongside whatever else that tab needs.
    work.add(_refresh(
        'me', force, () => _ref.read(authProvider.notifier).refreshMe()));
    return Future.wait(work);
  }

  /// Every tab at once — for a return from the background, where there is no
  /// telling how long the app was away or which screen it will come back to.
  Future<void> everything() =>
      Future.wait([for (final t in HomeTab.values) tab(t, force: true)]);

  /// Runs [run] when [key] has gone stale, and swallows its failure: a
  /// refresh that cannot reach the server must leave the screen showing
  /// what it already had, not replace it with an error.
  Future<void> _refresh(String key, bool force, Future<void> Function() run) async {
    if (!_clock.due(key, force: force)) return;
    try {
      await run();
    } catch (_) {
      // The provider keeps its previous value; the next attempt will retry.
    }
  }

  /// Used on sign-in: the previous account's timings say nothing about this
  /// one, so the next read of anything refetches.
  void reset() => _clock.reset();
}

final refresherProvider = Provider<Refresher>((ref) => Refresher(ref));
