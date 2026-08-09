import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'src/api/api_client.dart';
import 'src/app.dart';
import 'src/state/providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Portrait only: the learn path's canvas is a fixed 288pt wide and the
  // whole layout is designed as a single column.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Both are awaited before the first frame so no provider has to expose an
  // "initialising" state that every widget would then have to handle.
  final api = await ApiClient.create();
  final prefs = await SharedPreferences.getInstance();

  runApp(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        prefsProvider.overrideWithValue(prefs),
      ],
      child: const JashMenApp(),
    ),
  );
}
