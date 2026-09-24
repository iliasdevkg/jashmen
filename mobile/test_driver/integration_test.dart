/// Host side of the App Store screenshot run.
///
/// `integration_test` captures a PNG on the device and hands the bytes here;
/// this writes them to disk. Run through `flutter drive`:
///
///   SHOT_DIR=/some/dir flutter drive \
///     --driver=test_driver/integration_test.dart \
///     --target=integration_test/store_screenshots_test.dart -d `<simulator>`
library;

import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

Future<void> main() async {
  final dir = Directory(Platform.environment['SHOT_DIR'] ?? 'build/store_shots')
    ..createSync(recursive: true);

  await integrationDriver(
    onScreenshot: (name, bytes, [args]) async {
      File('${dir.path}/$name.png').writeAsBytesSync(bytes);
      return true;
    },
  );
}
