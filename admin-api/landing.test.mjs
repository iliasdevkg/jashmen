// admin-api/landing.test.mjs — the public landing page's content store.
//
//   node --test admin-api/landing.test.mjs
//
// The landing page is the one surface an anonymous visitor sees, so the
// failure mode worth pinning down is a partial save silently wiping copy
// that isn't on screen: the editor PUTs one section at a time, and
// sanitizeLanding is what has to carry every other section through untouched.
//
// Talks to contentStore directly — the two routes are one-liners over these
// functions, and the contract lives in the sanitiser.
//
// NOTE: the page this store fed was removed — jashmenstudio.com/app no
// longer exists, and `/` is the business site (business.seed.js). The store
// and these tests stay because the content is still in content.json and
// nothing has been deleted from it; if the student landing never returns,
// this file and LANDING_SECTIONS go together.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA_DIR = path.join(import.meta.dirname, 'data');
const BACKUP = path.join(os.tmpdir(), `jashmen-landing-${process.pid}`);

let content;
let original;

before(async () => {
  if (fs.existsSync(DATA_DIR)) fs.cpSync(DATA_DIR, BACKUP, { recursive: true });
  content = await import('./contentStore.js');
  original = structuredClone(content.getLanding());
});

after(async () => {
  if (content && original) await content.setLanding(original);
  if (fs.existsSync(BACKUP)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    fs.cpSync(BACKUP, DATA_DIR, { recursive: true });
    fs.rmSync(BACKUP, { recursive: true, force: true });
  }
});

test('every section is seeded and trilingual', () => {
  const l = content.getLanding();
  assert.deepEqual(
    Object.keys(l),
    ['hero', 'ribbon', 'stats', 'features', 'steps', 'uni', 'partners',
     'gamification', 'testimonials', 'download', 'faq', 'footer'],
    'the page has every section, in render order',
  );
  for (const key of content.LANDING_SECTION_KEYS) {
    assert.equal(typeof l[key].enabled, 'boolean', `${key} carries a visibility flag`);
  }
  assert.ok(l.hero.title.ky, 'the hero headline exists in Kyrgyz');
  assert.ok(l.hero.title.ru && l.hero.title.en, 'and in both other languages');
  assert.equal(l.features.items.length, 6);
  assert.equal(l.faq.items.length, 6);
  assert.equal(l.ribbon.items.length, 6, 'the scrolling ribbon has phrases to scroll');
  assert.equal(l.testimonials.items.length, 3);
});

test('the hero badge names a live counter, never a typed-in number', async () => {
  assert.equal(content.getLanding().hero.badgeStat, 'universities', 'seeded to a real counter');

  await content.setLanding({ hero: { badgeStat: 'learners' } });
  assert.equal(content.getLanding().hero.badgeStat, 'learners');

  // Anything outside the whitelist falls back to the seeded choice rather
  // than reaching the page as a key nothing can resolve.
  await content.setLanding({ hero: { badgeStat: '200+ partners' } });
  assert.equal(content.getLanding().hero.badgeStat, 'universities');

  await content.setLanding({ hero: { badgeStat: 'none' } });
  assert.equal(content.getLanding().hero.badgeStat, 'none', "'none' takes the badge off the page");

  await content.setLanding({ hero: { badgeStat: 'universities' } });
});

test('a testimonial keeps its untranslated name and its photo url', async () => {
  await content.setLanding({
    testimonials: {
      items: [{
        id: 'nurbek',
        name: '  Нурбек  ',
        avatarUrl: '/admin/api/uploads/nurbek.jpg',
        role: { ky: 'КГТУ, 4-курс', ru: 'КГТУ, 4 курс' },
        text: { ky: 'Пикир', ru: 'Отзыв', en: 'Review' },
      }],
    },
  });

  const [row] = content.getLanding().testimonials.items;
  assert.equal(row.name, 'Нурбек', 'a person\'s name is a plain string, trimmed — not trilingual');
  assert.equal(row.avatarUrl, '/admin/api/uploads/nurbek.jpg');
  assert.equal(row.role.ky, 'КГТУ, 4-курс', 'but what they study still translates');
  assert.equal(row.text.en, 'Review');
});

test('a testimonial photo cannot smuggle in a script url', async () => {
  await content.setLanding({
    testimonials: { items: [{ id: 'x', name: 'X', avatarUrl: 'javascript:alert(1)', text: { ky: 'A' }, role: { ky: 'B' } }] },
  });
  assert.equal(content.getLanding().testimonials.items[0].avatarUrl, '');
});

test('saving one section leaves every other section untouched', async () => {
  const before = content.getLanding();
  const featuresBefore = structuredClone(before.features);
  const faqBefore = structuredClone(before.faq);

  await content.setLanding({ hero: { title: { ky: 'Жаңы ураан', ru: 'Новый слоган', en: 'New headline' } } });

  const after = content.getLanding();
  assert.equal(after.hero.title.ky, 'Жаңы ураан');
  assert.deepEqual(after.features, featuresBefore, 'features survive a hero-only save');
  assert.deepEqual(after.faq, faqBefore, 'so does the FAQ');
  assert.equal(after.hero.eyebrow.ky, before.hero.eyebrow.ky, 'untouched hero fields survive too');
});

test('a section can be hidden without losing its copy', async () => {
  const title = content.getLanding().download.title.ky;
  await content.setLanding({ download: { enabled: false } });

  const l = content.getLanding();
  assert.equal(l.download.enabled, false);
  assert.equal(l.download.title.ky, title, 'the copy is still there when it comes back');

  await content.setLanding({ download: { enabled: true } });
  assert.equal(content.getLanding().download.enabled, true);
});

test('list items get stable, unique ids even when the client sends none', async () => {
  await content.setLanding({
    features: {
      items: [
        { title: { ky: 'Бир' }, text: { ky: 'Биринчи' }, icon: 'wallet' },
        { id: 'dup', title: { ky: 'Эки' }, text: { ky: 'Экинчи' }, icon: 'coins' },
        { id: 'dup', title: { ky: 'Үч' }, text: { ky: 'Үчүнчү' }, icon: 'star' },
      ],
    },
  });

  const items = content.getLanding().features.items;
  assert.equal(items.length, 3);
  assert.equal(items[0].id, 'item-1', 'a missing id becomes a positional one');
  assert.equal(items[1].id, 'dup');
  assert.notEqual(items[2].id, 'dup', 'a duplicate id is disambiguated, not dropped');
  assert.equal(new Set(items.map(i => i.id)).size, 3, 'ids are unique — they are React keys');
});

test('an unknown icon slug is dropped rather than stored', async () => {
  await content.setLanding({
    steps: { items: [{ id: 'a', icon: '<script>', title: { ky: 'А' }, text: { ky: 'Б' } }] },
  });
  assert.equal(content.getLanding().steps.items[0].icon, null);

  await content.setLanding({ steps: { items: [{ id: 'a', icon: 'rocket', title: { ky: 'А' }, text: { ky: 'Б' } }] } });
  assert.equal(content.getLanding().steps.items[0].icon, 'rocket', 'a real slug is kept');
});

test('lists are capped so one bad request cannot bloat the page', async () => {
  const many = Array.from({ length: 40 }, (_, i) => ({
    id: `q${i}`, q: { ky: `Суроо ${i}` }, a: { ky: `Жооп ${i}` },
  }));
  await content.setLanding({ faq: { items: many } });
  assert.equal(content.getLanding().faq.items.length, 20, 'the FAQ caps at 20 entries');
});

test('links are validated; a javascript: url never reaches the page', async () => {
  await content.setLanding({
    download: { apkUrl: 'javascript:alert(1)' },
    footer: { instagram: 'https://www.instagram.com/jashmen.studio/' },
  });
  const l = content.getLanding();
  assert.equal(l.download.apkUrl, '', 'a non-http scheme is rejected');
  assert.equal(l.footer.instagram, 'https://www.instagram.com/jashmen.studio/');

  await content.setLanding({ download: { apkUrl: '/downloads/jashmen.apk' } });
  assert.equal(content.getLanding().download.apkUrl, '/downloads/jashmen.apk', 'a site-relative path is fine');
});

test('clearing a text field is allowed and stores an empty value', async () => {
  await content.setLanding({ faq: { subtitle: { ky: '', ru: '', en: '' } } });
  assert.equal(content.getLanding().faq.subtitle, '', 'an optional caption can be emptied');
});

test('a garbage payload cannot corrupt the page', async () => {
  const before = structuredClone(content.getLanding());
  await content.setLanding({ hero: 'not an object', nosuchsection: { title: 'x' } });
  const after = content.getLanding();

  assert.deepEqual(Object.keys(after), Object.keys(before), 'no section is added or lost');
  assert.deepEqual(after.hero, before.hero, 'a non-object section is ignored, not applied');
});

test('the landing rides along on the public content payload', () => {
  const landing = content.getContent().landing;
  assert.ok(landing?.hero?.title, 'GET /public/content serves it — the site needs no second request');
});
