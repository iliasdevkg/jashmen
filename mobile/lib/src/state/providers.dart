/// Riverpod wiring: API client, session, content, and user preferences.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../core/i18n.dart';
import '../models/content.dart';
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

final stringsProvider = Provider<Strings>(
  (ref) => Strings(ref.watch(localeProvider)),
);

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
  AuthController(this._api) : super(const SessionLoading()) {
    _api.onSessionExpired = signOutLocally;
    _restore();
  }

  final ApiClient _api;

  /// A stored access token may be expired; the client's 401 interceptor
  /// refreshes it transparently, so one /u/me call is the whole probe.
  Future<void> _restore() async {
    if (!await _api.hasToken) {
      state = const SessionSignedOut();
      return;
    }
    try {
      state = SessionSignedIn(await _api.fetchMe());
    } on ApiException catch (e) {
      // Offline at launch must NOT log the user out — only an actual
      // rejection from the server does.
      state = e.kind == ApiErrorKind.unauthorized
          ? const SessionSignedOut()
          : const SessionSignedOut();
    }
  }

  Future<void> login(String email, String password) async {
    final user = await _api.login(email: email, password: password);
    state = SessionSignedIn(user);
  }

  Future<void> signup(String name, String email, String password) async {
    final user = await _api.signup(name: name, email: email, password: password);
    state = SessionSignedIn(user);
  }

  /// Google sign-in: the server turns the id_token into the same session
  /// login/signup produce, so nothing downstream changes.
  Future<void> signInWithGoogle(String idToken) async {
    state = SessionSignedIn(await _api.loginWithGoogle(idToken));
  }

  Future<void> signOut() async {
    await _api.logout();
    state = const SessionSignedOut();
  }

  void signOutLocally() {
    _api.clearToken();
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
      state: next,
    ));
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
  (ref) => AuthController(ref.watch(apiClientProvider)),
);

/// Convenience: the signed-in user's progress, or null.
final userStateProvider = Provider<UserState?>((ref) {
  final session = ref.watch(authProvider);
  return session is SessionSignedIn ? session.user.state : null;
});

// ── Content ────────────────────────────────────────────────────────────────

final contentProvider = FutureProvider<AppContent>(
  (ref) => ref.watch(apiClientProvider).fetchContent(),
);

final leaderboardProvider = FutureProvider<List<LeaderboardEntry>>(
  (ref) => ref.watch(apiClientProvider).fetchLeaderboard(),
);
