/// Covers what happens at launch when the network is not there.
///
/// It exists because of one real bug: _restore's catch block read
///
///   state = e.kind == ApiErrorKind.unauthorized
///       ? const SessionSignedOut()
///       : const SessionSignedOut();
///
/// Both branches the same, directly under a comment promising the opposite.
/// Every failure — no signal, a timeout, a container still starting — threw
/// the learner onto the login screen with a perfectly valid session still
/// on disk. The analyzer sees nothing wrong with a ternary like that, so
/// only a test that actually runs the failure path catches it.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:jashmen/src/api/api_client.dart';
import 'package:jashmen/src/models/user_state.dart';
import 'package:jashmen/src/state/providers.dart';

/// An ApiClient that answers the launch probe however the test wants.
class _ProbeClient implements ApiClient {
  _ProbeClient({required this.failures, required this.kind, this.thenSucceed = true});

  /// How many attempts fail before the connection "returns".
  int failures;
  final ApiErrorKind kind;
  final bool thenSucceed;
  int calls = 0;

  @override
  Future<bool> get hasToken async => true;

  @override
  Map<String, dynamic>? lastMeBody;

  @override
  Future<void> clearToken() async {}

  @override
  Future<AppUser> fetchMe() async {
    calls++;
    if (failures > 0) {
      failures--;
      throw ApiException(kind, 'no', status: kind == ApiErrorKind.unauthorized ? 401 : 0);
    }
    if (!thenSucceed) {
      throw ApiException(kind, 'no', status: 0);
    }
    lastMeBody = _body;
    return AppUser.fromJson(_body);
  }

  static const _body = {
    'id': 'u1',
    'name': 'Test',
    'email': 't@example.com',
    'state': {'coins': 42, 'streak': 7},
  };

  /// Signing in fires the daily claim. It is not what this test is about,
  /// and AuthController already swallows its failure, so it just refuses.
  @override
  Future<DailyClaim> claimDaily() async =>
      throw const ApiException(ApiErrorKind.offline, 'no', status: 0);

  /// AuthController wires this in its constructor; the launch probe never
  /// reaches it, so it just needs somewhere to land.
  @override
  void Function()? onSessionExpired;

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

Future<SessionState> settle(ProviderContainer c) async {
  for (var i = 0; i < 60; i++) {
    final s = c.read(authProvider);
    if (s is! SessionLoading) return s;
    await Future<void>.delayed(const Duration(milliseconds: 100));
  }
  return c.read(authProvider);
}

void main() {
  late SharedPreferences prefs;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
  });

  ProviderContainer containerFor(_ProbeClient api) {
    final c = ProviderContainer(overrides: [
      apiClientProvider.overrideWithValue(api),
      prefsProvider.overrideWithValue(prefs),
    ]);
    addTearDown(c.dispose);
    return c;
  }

  test('a 401 really does end the session', () async {
    final api = _ProbeClient(failures: 1, kind: ApiErrorKind.unauthorized);
    final state = await settle(containerFor(api));

    expect(state, isA<SessionSignedOut>());
    expect(api.calls, 1, reason: 'a rejection is final — do not retry it');
  });

  test('one offline blip at launch does NOT sign the learner out', () async {
    final api = _ProbeClient(failures: 1, kind: ApiErrorKind.offline);
    final state = await settle(containerFor(api));

    expect(state, isA<SessionSignedIn>(),
        reason: 'the session on disk was valid the whole time');
    expect(api.calls, 2, reason: 'first attempt failed, second succeeded');
  });

  test('a timeout is retried too, not treated as a rejection', () async {
    final api = _ProbeClient(failures: 2, kind: ApiErrorKind.timeout);
    final state = await settle(containerFor(api));

    expect(state, isA<SessionSignedIn>());
    expect(api.calls, 3);
  });

  test('a network that never comes back, and no cache, shows the auth screen',
      () async {
    final api = _ProbeClient(
      failures: 99, kind: ApiErrorKind.offline, thenSucceed: false);
    final state = await settle(containerFor(api));

    expect(state, isA<SessionSignedOut>());
    expect(api.calls, greaterThan(1),
        reason: 'giving up on the first failure is the bug this test exists for');
  });

  test('an offline launch opens on the cached account, not the login screen',
      () async {
    // First launch succeeds and caches the account.
    final online = _ProbeClient(failures: 0, kind: ApiErrorKind.offline);
    final first = await settle(containerFor(online));
    expect(first, isA<SessionSignedIn>());

    // Second launch, no network at all. The token is still on disk and the
    // learner has been here before, so the app opens on their own numbers.
    final offline = _ProbeClient(
      failures: 99, kind: ApiErrorKind.offline, thenSucceed: false);
    final second = await settle(containerFor(offline));

    expect(second, isA<SessionSignedIn>(),
        reason: 'no signal is not a reason to ask for a password again');
    expect((second as SessionSignedIn).user.state.coins, 42);
    expect(second.user.state.streak, 7);
  });

  test('a 401 clears the cache, so the next launch really is signed out',
      () async {
    final online = _ProbeClient(failures: 0, kind: ApiErrorKind.offline);
    final c = containerFor(online);
    expect(await settle(c), isA<SessionSignedIn>());

    c.read(authProvider.notifier).signOutLocally();

    final offline = _ProbeClient(
      failures: 99, kind: ApiErrorKind.offline, thenSucceed: false);
    expect(await settle(containerFor(offline)), isA<SessionSignedOut>(),
        reason: 'the next person on this phone must not see the last one');
  });
}
