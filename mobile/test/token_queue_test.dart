/// Covers the access-token queue in ApiClient.
///
/// The bug this pins down was found by a screenshot script, not by a user,
/// which is exactly why it deserves a test: it only shows on a FRESH install,
/// and a fresh install is the one path a first-time App Store reviewer walks.
///
/// After a login the token was written to the Keychain without being awaited.
/// The next request (the daily claim, fired the moment the shell appears) read
/// the store before that write landed, found no token, got a 401, and the
/// refresh it started wrote the token again while the first write was still in
/// flight — two concurrent adds of one Keychain item, which iOS answers with
/// -25299 "item already exists". The refresh cookie rescued the session, so a
/// person saw a flicker; the exception was what broke the run.
///
/// The fix is one queue: writes run in order, and a read waits for any write in
/// flight. These tests drive it through the plugin's platform channel, so they
/// exercise the real FlutterSecureStorage rather than a stand-in.
library;

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:jashmen/src/api/api_client.dart';

const _channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');

/// A Keychain that behaves like iOS's for the two cases that matter: a write
/// takes real time, and adding an item that already exists fails.
class _FakeKeychain {
  final Map<String, String> items = {};
  final List<String> log = [];
  int inFlightWrites = 0;
  int maxConcurrentWrites = 0;
  Duration writeDelay = const Duration(milliseconds: 40);

  Future<Object?> handle(MethodCall call) async {
    final args = (call.arguments as Map).cast<String, Object?>();
    final key = args['key'] as String?;
    switch (call.method) {
      case 'write':
        inFlightWrites++;
        if (inFlightWrites > maxConcurrentWrites) maxConcurrentWrites = inFlightWrites;
        log.add('write:${args['value']}');
        await Future<void>.delayed(writeDelay);
        inFlightWrites--;
        items[key!] = args['value'] as String;
        return null;
      case 'read':
        log.add('read');
        return items[key];
      case 'delete':
        log.add('delete');
        items.remove(key);
        return null;
      default:
        return null;
    }
  }
}

ApiClient _client() =>
    ApiClient.forTesting(Dio(), const FlutterSecureStorage());

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _FakeKeychain keychain;

  setUp(() {
    keychain = _FakeKeychain();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_channel, keychain.handle);
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_channel, null);
  });

  test('a read right after a write sees the token, not nothing', () async {
    final api = _client();

    // Exactly the login shape: the save is not awaited...
    unawaited(api.saveAccessToken('fresh-token'));
    // ...and the very next request asks whether there is a token.
    final has = await api.hasToken;

    expect(has, isTrue,
        reason: 'reading before the write lands is what produced the 401');
  });

  test('writes never overlap', () async {
    final api = _client();

    // A login save and a refresh save, started together.
    await Future.wait([
      api.saveAccessToken('from-login'),
      api.saveAccessToken('from-refresh'),
    ]);

    expect(keychain.maxConcurrentWrites, 1,
        reason: 'two concurrent adds of one item is the -25299');
    expect(keychain.items['jashmen.access_token'], 'from-refresh',
        reason: 'and the later write wins, as it would if they were sequential');
  });

  test('a failed write does not jam the queue for every later one', () async {
    final api = _client();
    var first = true;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_channel, (call) async {
      if (call.method == 'write' && first) {
        first = false;
        throw PlatformException(code: 'boom', message: 'disk full');
      }
      return keychain.handle(call);
    });

    await expectLater(api.saveAccessToken('a'), throwsA(isA<PlatformException>()));
    await api.saveAccessToken('b');

    expect(keychain.items['jashmen.access_token'], 'b',
        reason: 'one bad write must not silently drop every token after it');
  });

  test('"item already exists" is answered by replacing, not by failing',
      () async {
    final api = _client();
    var threw = false;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_channel, (call) async {
      if (call.method == 'write' && !threw) {
        threw = true;
        throw PlatformException(
          code: 'Unexpected security result code',
          message: 'Code: -25299, Message: The specified item already exists in the keychain.',
        );
      }
      return keychain.handle(call);
    });

    await api.saveAccessToken('replacement');

    expect(keychain.items['jashmen.access_token'], 'replacement');
  });

  test('clearing waits for a write in flight instead of racing it', () async {
    final api = _client();

    unawaited(api.saveAccessToken('about-to-go'));
    await api.clearToken();

    expect(await api.hasToken, isFalse,
        reason: 'a delete that ran first would leave the late write behind');
  });
}
