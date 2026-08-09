/// HTTP layer for https://jashmenstudio.com/admin/api.
///
/// The auth design is inherited from the web app and is the single most
/// error-prone thing to port:
///
///   - The **access token** is a 15-minute JWT sent as `Authorization:
///     Bearer`. Stored in the keychain/keystore.
///   - The **refresh token** is an opaque value in an httpOnly cookie. A
///     browser stores and replays it automatically; Flutter does not, so we
///     run a PersistCookieJar on disk. Without it, every cold start looks
///     like a logged-out user even though the session is still valid
///     server-side.
///
/// A 401 on any authenticated call triggers exactly one refresh attempt, the
/// original request is replayed with the new token, and concurrent 401s
/// share that single refresh rather than stampeding the endpoint.
library;

import 'dart:async';
import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';

import '../models/content.dart';
import '../models/user_state.dart';

const String kBaseUrl = 'https://jashmenstudio.com/admin/api';

/// Errors the UI is expected to render differently. Anything the user can
/// act on gets its own case; everything else collapses to [unknown] with the
/// server's message when there is one.
enum ApiErrorKind { offline, timeout, unauthorized, badRequest, server, unknown }

class ApiException implements Exception {
  const ApiException(this.kind, this.message);
  final ApiErrorKind kind;
  final String message;

  @override
  String toString() => 'ApiException($kind): $message';
}

class ApiClient {
  ApiClient._(this._dio, this._storage);

  final Dio _dio;
  final FlutterSecureStorage _storage;

  static const _accessTokenKey = 'jashmen.access_token';

  /// Guards the refresh so N concurrent 401s cause one refresh, not N.
  Future<String?>? _refreshInFlight;

  /// Set by AuthController so a failed refresh can drop the session and send
  /// the user back to the sign-in screen.
  void Function()? onSessionExpired;

  static Future<ApiClient> create() async {
    final dir = await getApplicationSupportDirectory();
    final jar = PersistCookieJar(
      storage: FileStorage('${dir.path}/.cookies/'),
      ignoreExpires: false,
    );

    final dio = Dio(BaseOptions(
      baseUrl: kBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 20),
      headers: {'Content-Type': 'application/json'},
      // We inspect status codes ourselves so a 401 can be turned into a
      // refresh rather than an exception thrown mid-interceptor.
      validateStatus: (code) => code != null && code < 500,
    ));

    dio.interceptors.add(CookieManager(jar));

    final client = ApiClient._(dio, const FlutterSecureStorage());
    dio.interceptors.add(client._authInterceptor());
    return client;
  }

  InterceptorsWrapper _authInterceptor() => InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (options.extra['skipAuth'] != true) {
            final token = await _storage.read(key: _accessTokenKey);
            if (token != null) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }
          handler.next(options);
        },
        onResponse: (response, handler) async {
          final isAuthEndpoint = response.requestOptions.extra['skipAuth'] == true;
          final alreadyRetried = response.requestOptions.extra['retried'] == true;

          if (response.statusCode != 401 || isAuthEndpoint || alreadyRetried) {
            handler.next(response);
            return;
          }

          final token = await _refreshAccessToken();
          if (token == null) {
            onSessionExpired?.call();
            handler.next(response);
            return;
          }

          try {
            final opts = response.requestOptions
              ..headers['Authorization'] = 'Bearer $token'
              ..extra['retried'] = true;
            final retried = await _dio.fetch(opts);
            handler.resolve(retried);
          } catch (_) {
            handler.next(response);
          }
        },
      );

  Future<String?> _refreshAccessToken() {
    // Collapse concurrent refreshes onto one in-flight future.
    return _refreshInFlight ??= _doRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<String?> _doRefresh() async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/u/refresh',
        options: Options(extra: {'skipAuth': true}),
      );
      final token = res.data?['token'] as String?;
      if (token == null) return null;
      await _storage.write(key: _accessTokenKey, value: token);
      return token;
    } catch (_) {
      return null;
    }
  }

  Future<void> _saveToken(String token) =>
      _storage.write(key: _accessTokenKey, value: token);

  Future<void> clearToken() => _storage.delete(key: _accessTokenKey);

  Future<bool> get hasToken async =>
      (await _storage.read(key: _accessTokenKey)) != null;

  // ── Request helpers ────────────────────────────────────────────────────

  Never _throwFor(Response res) {
    final body = res.data;
    final message = body is Map && body['error'] != null
        ? body['error'].toString()
        : 'HTTP ${res.statusCode}';
    // A null status means the response never carried one — treat it as a
    // server fault rather than silently classifying it as a client error.
    final status = res.statusCode ?? 500;
    throw ApiException(
      switch (status) {
        401 || 403 => ApiErrorKind.unauthorized,
        >= 400 && < 500 => ApiErrorKind.badRequest,
        _ => ApiErrorKind.server,
      },
      message,
    );
  }

  Future<T> _run<T>(Future<Response> Function() send, T Function(Response) parse) async {
    try {
      final res = await send();
      if (res.statusCode != null && res.statusCode! >= 400) _throwFor(res);
      return parse(res);
    } on DioException catch (e) {
      throw ApiException(
        switch (e.type) {
          DioExceptionType.connectionTimeout ||
          DioExceptionType.sendTimeout ||
          DioExceptionType.receiveTimeout =>
            ApiErrorKind.timeout,
          DioExceptionType.connectionError =>
            e.error is SocketException ? ApiErrorKind.offline : ApiErrorKind.server,
          _ => ApiErrorKind.unknown,
        },
        e.message ?? 'Network error',
      );
    }
  }

  Map<String, dynamic> _asMap(Response res) =>
      (res.data as Map).cast<String, dynamic>();

  // ── Auth ───────────────────────────────────────────────────────────────

  Future<AppUser> signup({
    required String name,
    required String email,
    required String password,
  }) =>
      _run(
        () => _dio.post('/u/signup',
            data: {'name': name, 'email': email, 'password': password},
            options: Options(extra: {'skipAuth': true})),
        (res) {
          final data = _asMap(res);
          _saveToken(data['token'] as String);
          return AppUser.fromJson((data['user'] as Map).cast<String, dynamic>());
        },
      );

  Future<AppUser> login({required String email, required String password}) =>
      _run(
        () => _dio.post('/u/login',
            data: {'email': email, 'password': password},
            options: Options(extra: {'skipAuth': true})),
        (res) {
          final data = _asMap(res);
          _saveToken(data['token'] as String);
          return AppUser.fromJson((data['user'] as Map).cast<String, dynamic>());
        },
      );

  Future<void> logout() async {
    try {
      await _dio.post('/u/logout', options: Options(extra: {'skipAuth': true}));
    } catch (_) {
      // A failed logout still has to clear the device — the server session
      // expires on its own.
    }
    await clearToken();
  }

  // ── Content & progress ─────────────────────────────────────────────────

  Future<AppContent> fetchContent() => _run(
        () => _dio.get('/public/content', options: Options(extra: {'skipAuth': true})),
        (res) => AppContent.fromJson(_asMap(res)),
      );

  Future<AppUser> fetchMe() => _run(
        () => _dio.get('/u/me'),
        (res) => AppUser.fromJson(_asMap(res)),
      );

  Future<List<LeaderboardEntry>> fetchLeaderboard() => _run(
        () => _dio.get('/u/leaderboard', options: Options(extra: {'skipAuth': true})),
        (res) {
          final data = res.data;
          final rows = data is List ? data : (data is Map ? data['leaderboard'] : null);
          if (rows is! List) return const <LeaderboardEntry>[];
          return rows
              .whereType<Map>()
              .map((e) => LeaderboardEntry.fromJson(e.cast<String, dynamic>()))
              .toList(growable: false);
        },
      );

  /// POST /u/me/lesson. The server applies the reward and returns the
  /// updated state; the client never computes the authoritative numbers.
  Future<({UserState state, LessonReward reward})> completeLesson({
    required String lessonId,
    required int mistakes,
  }) =>
      _run(
        () => _dio.post('/u/me/lesson',
            data: {'lessonId': lessonId, 'mistakes': mistakes}),
        (res) {
          final data = _asMap(res);
          return (
            state: UserState.fromJson((data['state'] as Map).cast<String, dynamic>()),
            reward: LessonReward.fromJson(
                (data['reward'] as Map?)?.cast<String, dynamic>() ?? const {}),
          );
        },
      );

  Future<UserState> claimDaily() => _run(
        () => _dio.post('/u/me/daily'),
        (res) {
          final data = _asMap(res);
          final state = data['state'] ?? data;
          return UserState.fromJson((state as Map).cast<String, dynamic>());
        },
      );

  Future<UserState> buyItem(String itemId) => _run(
        () => _dio.post('/u/me/buy', data: {'itemId': itemId}),
        (res) {
          final data = _asMap(res);
          final state = data['state'] ?? data;
          return UserState.fromJson((state as Map).cast<String, dynamic>());
        },
      );

  Future<UserState> patchState(Map<String, dynamic> patch) => _run(
        () => _dio.patch('/u/me/state', data: patch),
        (res) {
          final data = _asMap(res);
          final state = data['state'] ?? data;
          return UserState.fromJson((state as Map).cast<String, dynamic>());
        },
      );

  /// Analytics. Deliberately fire-and-forget: a dropped event must never
  /// surface as an error in the user's face.
  void logEvent(String event, [Map<String, dynamic>? payload]) {
    unawaited(
      _dio
          .post('/u/log-event', data: {'event': event, ...?payload})
          .catchError((_) => Response(requestOptions: RequestOptions(path: ''))),
    );
  }
}
