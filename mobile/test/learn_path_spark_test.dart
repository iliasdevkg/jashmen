/// Covers the light that travels down a module's road on the learn screen.
///
/// It is the same feature as the web's `.learn-spark` (src/index.css, drawn
/// in LearnPage.jsx), and the numbers are deliberately identical — a learner
/// who opens the site and then the app should not notice they changed
/// clients. What is pinned here is the rule about WHICH road is lit, because
/// getting it wrong turns a page of modules into a light show and burns a
/// ticker per module on a phone.
library;

import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:jashmen/src/models/content.dart';
import 'package:jashmen/src/screens/learn_screen.dart';

/// Paints the road once and hands back its pixels, so a test can compare two
/// frames instead of trusting that a number reached the canvas.
Future<Uint8List> _paint({double? sparkAt}) async {
  const size = Size(288, 420);
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder, Offset.zero & size);
  LearnPathPainter(
    points: nodePositionsFor(4),
    color: const Color(0xFF58CC02),
    bright: false,
    sparkAt: sparkAt,
  ).paint(canvas, size);
  final image = await recorder.endRecording().toImage(size.width.toInt(), size.height.toInt());
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  return data!.buffer.asUint8List();
}

Module _module(int lessons) => Module.fromJson({
      'id': 'm1',
      'title': {'ky': 'Модуль'},
      'color': '#58CC02',
      'lessons': List.generate(lessons, (i) => {
            'id': 'l$i',
            'title': {'ky': 'Сабак $i'},
            'questions': const [],
          }),
    });

Set<String> _done(int n) => {for (var i = 0; i < n; i++) 'l$i'};

void main() {
  group('which road carries the light', () {
    final module = _module(5);

    test('a module nobody has started is lit', () {
      // The narrow rule this replaced only lit a part-finished module, so a
      // learner with nothing completed saw a page of dead roads and
      // concluded the animation was missing.
      expect(moduleInProgress(module, const {}), isTrue,
          reason: 'a road with lessons left is worth pointing down');
    });

    test('a module in the middle is lit', () {
      expect(moduleInProgress(module, _done(1)), isTrue);
      expect(moduleInProgress(module, _done(4)), isTrue);
    });

    test('a finished module goes dark again', () {
      expect(moduleInProgress(module, _done(5)), isFalse,
          reason: 'a completed road has nowhere left to point');
    });

    test('lessons completed elsewhere do not count as progress here', () {
      // Still lit — but because this road has lessons left, not because
      // somebody finished something in another module.
      expect(moduleInProgress(module, {'someone-elses-lesson'}), isTrue);
      expect(moduleInProgress(module, _done(5)), isFalse);
    });

    test('a one-lesson module is never lit', () {
      // There is no road between two nodes to travel down.
      expect(moduleInProgress(_module(1), _done(1)), isFalse);
      expect(moduleInProgress(_module(1), const {}), isFalse);
      expect(moduleInProgress(_module(0), const {}), isFalse);
    });
  });

  group('how fast it travels', () {
    test('a longer road takes proportionally longer', () {
      expect(sparkSeconds(20), greaterThan(sparkSeconds(10)),
          reason: 'so the apparent speed is the same on both');
    });

    test('a short road still takes a readable amount of time', () {
      // Without the floor, a three-lesson module would flash past in three
      // seconds and read as a glitch rather than as motion.
      expect(sparkSeconds(2), greaterThanOrEqualTo(4));
      expect(sparkSeconds(0), greaterThanOrEqualTo(4));
    });

    test('it matches the web, which uses lessons × 1.1', () {
      expect(sparkSeconds(10), 11);
      expect(sparkSeconds(30), 33);
    });
  });

  test('the light is the same length as on the web', () {
    // src/index.css draws it as `stroke-dasharray: 6 94` over a path
    // normalised to 100 — a 6% segment.
    expect(kSparkFraction, closeTo(0.06, 0.0001));
  });

  group('the light actually reaches the canvas, and moves', () {
    test('a lit road differs from a dark one', () async {
      final dark = await _paint();
      final lit = await _paint(sparkAt: 0.4);
      expect(lit, isNot(equals(dark)),
          reason: 'sparkAt must draw something, not be quietly ignored');
    });

    test('two positions along the road look different', () async {
      final a = await _paint(sparkAt: 0.20);
      final b = await _paint(sparkAt: 0.70);
      expect(a, isNot(equals(b)), reason: 'the light travels');
    });

    test('it wraps with no gap at the ends', () async {
      // At the very start the segment straddles the seam: its head is at 0
      // and its tail belongs at the far end. Both halves have to be drawn,
      // or the light blinks out for a moment every lap.
      final seam = await _paint(sparkAt: 0.01);
      final dark = await _paint();
      expect(seam, isNot(equals(dark)),
          reason: 'the wrap-around half must still be painted');
    });
  });
}
