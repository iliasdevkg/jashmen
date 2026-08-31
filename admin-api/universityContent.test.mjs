// admin-api/universityContent.test.mjs — Module Г: the university league's
// content moved out of the two client bundles and into the admin store, so
// the validation that used to be "whatever the developer typed" is now a
// real contract. This covers it.
//
//   node --test admin-api/universityContent.test.mjs
//
// Talks to contentStore directly: the routes are three one-liners over these
// functions, and the risk worth pinning down is the sanitiser, not Express.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA_DIR = path.join(import.meta.dirname, 'data');
const BACKUP = path.join(os.tmpdir(), `jashmen-uni-content-${process.pid}`);

let content;

const validUni = (over = {}) => ({
  listName: 'ТЕСТ УНИВЕРСИТЕТ',
  name: { ky: 'Тест университети', ru: 'Тестовый университет', en: 'Test University' },
  shortName: { ky: 'ТЕСТ', ru: 'ТЕСТ', en: 'TEST' },
  color: '#123ABC',
  ...over,
});

const validContest = (over = {}) => ({
  organizerPhone: '+996700000000',
  address: { ky: 'Дареги', ru: 'Адрес', en: 'Address' },
  sponsorName: 'mbank',
  prizePool: 120000,
  firstPrize: 70000,
  secondPrize: 30000,
  thirdPrize: 20000,
  giftsTopN: 10,
  startsAt: '2025-09-18',
  endsAt: '2025-10-18',
  rules: { ky: 'Эрежелер', ru: 'Правила', en: 'Rules' },
  ...over,
});

before(async () => {
  if (fs.existsSync(DATA_DIR)) fs.cpSync(DATA_DIR, BACKUP, { recursive: true });
  content = await import('./contentStore.js');
});

after(() => {
  if (fs.existsSync(BACKUP)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    fs.cpSync(BACKUP, DATA_DIR, { recursive: true });
    fs.rmSync(BACKUP, { recursive: true, force: true });
  }
});

test('the store seeds the campuses the clients used to carry', () => {
  const unis = content.getUniversities();
  assert.ok(unis.length >= 6, 'every seeded campus survives the migration');
  const kstu = content.findUniversity('kstu');
  assert.ok(kstu, 'kstu is still addressable by the id learners have saved');
  assert.equal(kstu.contest.prizePool, 120000);
  assert.equal(kstu.contest.giftsTopN, 10);
  assert.equal(kstu.name.en, 'KSTU named after I. Razzakov');
});

test('a campus can be created, found by slug, and removed', async () => {
  const created = await content.addUniversity(validUni());
  // slugify keeps Cyrillic on purpose — the id stays readable to the people
  // who actually run these contests.
  assert.equal(created.id, 'тест-университет', 'id is a readable slug, not a UUID');
  assert.equal(created.contest, null, 'a campus starts without a contest');
  assert.equal(content.findUniversity(created.id).listName, 'ТЕСТ УНИВЕРСИТЕТ');

  await content.deleteUniversity(created.id);
  assert.equal(content.findUniversity(created.id), null);
});

test('a second campus with the same label gets its own id', async () => {
  const a = await content.addUniversity(validUni());
  const b = await content.addUniversity(validUni());
  assert.notEqual(a.id, b.id);
  assert.equal(b.id, `${a.id}-2`);
  await content.deleteUniversity(a.id);
  await content.deleteUniversity(b.id);
});

test('a contest round-trips every field the card renders', async () => {
  const uni = await content.addUniversity(validUni({ contest: validContest() }));
  const c = uni.contest;
  assert.equal(c.organizerPhone, '+996700000000');
  assert.equal(c.address.ru, 'Адрес');
  assert.equal(c.sponsorName, 'mbank');
  assert.deepEqual(
    [c.prizePool, c.firstPrize, c.secondPrize, c.thirdPrize, c.giftsTopN],
    [120000, 70000, 30000, 20000, 10],
  );
  assert.equal(c.startsAt, '2025-09-18');
  assert.equal(c.rules.en, 'Rules');
  await content.deleteUniversity(uni.id);
});

test('a finished contest is cleared by sending contest: null', async () => {
  const uni = await content.addUniversity(validUni({ contest: validContest() }));
  const updated = await content.updateUniversity(uni.id, { contest: null });
  assert.equal(updated.contest, null);
  // Editing something else must not resurrect it.
  const again = await content.updateUniversity(uni.id, { listName: 'ЖАҢЫ АТ' });
  assert.equal(again.contest, null);
  assert.equal(again.listName, 'ЖАҢЫ АТ');
  await content.deleteUniversity(uni.id);
});

test('a blank Kyrgyz name is rejected — it is the fallback every locale uses', async () => {
  await assert.rejects(
    () => content.addUniversity(validUni({ name: { ky: '', ru: 'Есть', en: 'Has' } })),
    /толук аты/,
  );
  await assert.rejects(() => content.addUniversity(validUni({ listName: '  ' })), /Тизмедеги аты/);
});

test('a malformed date is rejected rather than reaching the card', async () => {
  await assert.rejects(
    () => content.addUniversity(validUni({ contest: validContest({ startsAt: '18.09.2025' }) })),
    /Башталышы/,
  );
  await assert.rejects(
    () => content.addUniversity(validUni({ contest: validContest({ endsAt: '' }) })),
    /Бүтүшү/,
  );
});

test('money and rank are coerced, never NaN', async () => {
  const uni = await content.addUniversity(validUni({
    contest: validContest({ prizePool: '90000', firstPrize: -5, giftsTopN: 0 }),
  }));
  assert.equal(uni.contest.prizePool, 90000, 'a numeric string is accepted');
  assert.equal(uni.contest.firstPrize, 0, 'a negative prize floors at zero');
  assert.equal(uni.contest.giftsTopN, 10, 'rank 0 would mean nobody — falls back to 10');
  await content.deleteUniversity(uni.id);
});

test('an unusable logo or colour degrades instead of reaching the client', async () => {
  const uni = await content.addUniversity(validUni({
    color: 'not-a-colour',
    logoUrl: 'javascript:alert(1)',
    contest: validContest({ sponsorLogoUrl: '//evil.example/x.png' }),
  }));
  assert.equal(uni.color, '#1D4ED8', 'falls back to the default tint');
  assert.equal(uni.logoUrl, null);
  assert.equal(uni.contest.sponsorLogoUrl, null, 'protocol-relative URLs are not ours to trust');
  await content.deleteUniversity(uni.id);
});
