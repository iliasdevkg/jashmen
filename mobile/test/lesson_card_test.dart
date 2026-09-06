/// Covers LessonCard.fromJson against the card shapes the admin panel
/// actually authors (admin-src/pages/LessonsModule.jsx).
///
/// The media card is why this file exists: its three fields — mediaType, url
/// and caption — were not read at all, so every media card the admin added
/// rendered as an empty page in the app while the web showed it correctly.
library;

import 'package:flutter_test/flutter_test.dart';

import 'package:jashmen/src/core/i18n.dart';
import 'package:jashmen/src/models/content.dart';

void main() {
  group('media card', () {
    // Exactly what LessonsModule.jsx#addCard('media') produces.
    final json = {
      'type': 'media',
      'mediaType': 'image',
      'url': 'https://cdn.example.com/chart.png',
      'caption': {
        'ky': 'Айлык бюджеттин бөлүнүшү',
        'ru': 'Распределение месячного бюджета',
        'en': 'Monthly budget split',
      },
    };

    test('keeps the url, the media type and the caption', () {
      final card = LessonCard.fromJson(json);
      expect(card.type, CardType.media);
      expect(card.mediaType, 'image');
      expect(card.url, 'https://cdn.example.com/chart.png');
      expect(card.isVideo, isFalse);
      expect(localizedContent(card.caption, AppLocale.ru),
          'Распределение месячного бюджета');
      expect(localizedContent(card.caption, AppLocale.en), 'Monthly budget split');
    });

    test('a video card reports itself as one', () {
      final card = LessonCard.fromJson({...json, 'mediaType': 'video'});
      expect(card.isVideo, isTrue);
    });

    test('an empty, freshly-added card parses without throwing', () {
      // The admin adds the card first and fills it in after, so the client
      // has to survive the half-authored shape it may fetch in between.
      final card = LessonCard.fromJson({
        'type': 'media',
        'mediaType': 'image',
        'url': '',
        'caption': {'ky': '', 'ru': '', 'en': ''},
      });
      expect(card.type, CardType.media);
      expect(localizedContent(card.caption, AppLocale.ky), '');
    });

    test('a legacy bare-string caption still resolves', () {
      final card = LessonCard.fromJson({...json, 'caption': 'Эски формат'});
      expect(localizedContent(card.caption, AppLocale.ky), 'Эски формат');
    });
  });

  group('the other card types are unchanged', () {
    test('theory keeps its title and body', () {
      final card = LessonCard.fromJson({
        'type': 'theory',
        'title': {'ky': 'Бюджет деген эмне?', 'ru': 'Что такое бюджет?', 'en': 'What is a budget?'},
        'body': {'ky': 'Кирешең менен чыгашаңдын планы.', 'ru': 'План.', 'en': 'A plan.'},
      });
      expect(card.type, CardType.theory);
      expect(localizedContent(card.title, AppLocale.ky), 'Бюджет деген эмне?');
      expect(card.url, isNull, reason: 'a theory card carries no media');
    });

    test('quiz keeps its options, answer and explanation', () {
      final card = LessonCard.fromJson({
        'type': 'quiz',
        'q': {'ky': 'Канча пайыз үнөмдөө сунушталат?', 'ru': '?', 'en': '?'},
        'opts': [
          {'ky': '5%', 'ru': '5%', 'en': '5%'},
          {'ky': '20%', 'ru': '20%', 'en': '20%'},
        ],
        'a': 1,
        'explanation': {'ky': '50/30/20 эрежеси.', 'ru': '50/30/20.', 'en': '50/30/20.'},
      });
      expect(card.type, CardType.quiz);
      expect(card.options.length, 2);
      expect(card.answerIndex, 1);
      expect(localizedContent(card.explanation, AppLocale.ky), '50/30/20 эрежеси.');
    });

    test('an unknown type degrades instead of throwing', () {
      final card = LessonCard.fromJson({'type': 'something-new'});
      expect(card.type, CardType.unknown);
      expect(card.answerIndex, 0);
    });
  });
}
