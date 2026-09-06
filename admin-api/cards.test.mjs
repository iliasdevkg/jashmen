// admin-api/cards.test.mjs — what a lesson's reward is counted from.
//
//   node --test admin-api/cards.test.mjs
//
// The two Duolingo-shaped card types (pair matching, sentence building) are
// graded like a quiz, so they have to pay out like one. This pins that down
// at the one place the server decides it — gradedCountOf, which feeds
// questionCount in routes.js#completeLesson.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { gradedCountOf, GRADED_CARD_TYPES } = await import('./contentStore.js');

test('graded types are exactly the three that ask for an answer', () => {
  assert.deepEqual([...GRADED_CARD_TYPES].sort(), ['build', 'match', 'quiz']);
  // theory and media are read-through — they must never earn on their own,
  // or a lesson of nothing but slides would pay a full reward.
  assert.ok(!GRADED_CARD_TYPES.has('theory'));
  assert.ok(!GRADED_CARD_TYPES.has('media'));
});

test('a lesson counts its graded cards, ignoring the read-through ones', () => {
  const lesson = {
    cards: [
      { type: 'theory' },
      { type: 'media', mediaType: 'image' },
      { type: 'quiz' },
      { type: 'match' },
      { type: 'build' },
    ],
  };
  assert.equal(gradedCountOf(lesson), 3);
});

test('the new types each pay like a quiz', () => {
  assert.equal(gradedCountOf({ cards: [{ type: 'match' }] }), 1);
  assert.equal(gradedCountOf({ cards: [{ type: 'build' }] }), 1);
  assert.equal(gradedCountOf({ cards: [{ type: 'quiz' }] }), 1);
});

test('a lesson of nothing but slides earns nothing', () => {
  assert.equal(gradedCountOf({ cards: [{ type: 'theory' }, { type: 'media' }] }), 0);
});

test('a pre-cards lesson still counts off its legacy questions array', () => {
  // Lessons authored before the card editor have no `cards` key at all.
  assert.equal(gradedCountOf({ questions: [{}, {}, {}] }), 3);
  assert.equal(gradedCountOf({ cards: [], questions: [{}, {}] }), 2);
});

test('junk degrades to zero rather than throwing', () => {
  assert.equal(gradedCountOf(null), 0);
  assert.equal(gradedCountOf({}), 0);
  assert.equal(gradedCountOf({ cards: [null, undefined, { type: 'quiz' }] }), 1);
  assert.equal(gradedCountOf({ cards: 'not an array' }), 0);
});
