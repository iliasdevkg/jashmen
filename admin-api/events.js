// admin-api/events.js
//
// Lightweight, append-only analytics log — lesson starts/completions and
// per-question outcomes. Written by ordinary users (fire-and-forget from
// LessonPage, plus a server-side write on real completion in routes.js),
// read only by the admin analytics endpoints (funnel + wrong-answer
// heatmap). Same tmp+rename persistence pattern as db.js/contentStore.js.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const MAX_EVENTS = 20_000; // soft cap so the log can't grow unbounded forever

function loadSync() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(EVENTS_FILE)) fs.writeFileSync(EVENTS_FILE, '[]');
  try {
    return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
  } catch (err) {
    console.error('[events] events.json is corrupt, starting fresh:', err.message);
    return [];
  }
}

let events = loadSync();
let writeChain = Promise.resolve();

function persist() {
  writeChain = writeChain.then(() => new Promise((resolve, reject) => {
    const tmp = `${EVENTS_FILE}.tmp`;
    fs.writeFile(tmp, JSON.stringify(events), err => {
      if (err) return reject(err);
      fs.rename(tmp, EVENTS_FILE, err2 => (err2 ? reject(err2) : resolve()));
    });
  })).catch(err => console.error('[events] failed to persist events.json:', err));
  return writeChain;
}

const ALLOWED_TYPES = new Set(['lesson_start', 'lesson_complete', 'question_answered']);

export async function logEvent(type, payload = {}) {
  if (!ALLOWED_TYPES.has(type)) return;
  events.push({ type, ...payload, ts: Date.now() });
  if (events.length > MAX_EVENTS) events = events.slice(events.length - MAX_EVENTS);
  await persist();
}

/// Per-lesson: how many PEOPLE started it vs. actually finished it.
///
/// Distinct learners, not raw event counts. Counting events produced
/// completion rates above 100% — up to 450% on production — because the two
/// halves are not written by the same thing: `lesson_start` comes from the
/// client (and the Flutter app did not send it at all until its key was
/// fixed), while `lesson_complete` is written server-side on every real
/// completion. Anyone who finished a lesson on their phone therefore
/// completed it without ever starting it, and re-opening a lesson on the web
/// counted a fresh start each time. One learner is one learner on both
/// sides, whichever client they used and however many times they opened it.
///
/// `completionPct` is still clamped: the historical rows above are already in
/// the log and no recount makes a phone-only completion grow a start.
export function funnel() {
  const byLesson = new Map();
  for (const e of events) {
    if (e.type !== 'lesson_start' && e.type !== 'lesson_complete') continue;
    if (!byLesson.has(e.lessonId)) {
      byLesson.set(e.lessonId, { lessonId: e.lessonId, startedBy: new Set(), completedBy: new Set() });
    }
    const row = byLesson.get(e.lessonId);
    // Events from before userId was recorded fall back to the event itself,
    // which counts them once rather than dropping them.
    const who = e.userId || `anon:${e.ts}`;
    (e.type === 'lesson_start' ? row.startedBy : row.completedBy).add(who);
  }

  return [...byLesson.values()]
    .map(({ lessonId, startedBy, completedBy }) => {
      // Someone who finished it plainly started it, whether or not the client
      // said so — so the denominator is everyone we know touched the lesson.
      const reached = new Set([...startedBy, ...completedBy]).size;
      const completed = completedBy.size;
      return {
        lessonId,
        started: reached,
        completed,
        completionPct: reached > 0 ? Math.min(100, Math.round((completed / reached) * 100)) : null,
      };
    })
    .sort((a, b) => b.started - a.started);
}

/// Forgets analytics. `keepLessonIds` is the set of lessons that still exist:
/// pass it to drop only the rows pointing at content that has been deleted
/// (the admin's "tidy up" button), omit it to clear the log outright.
export async function purgeEvents(keepLessonIds) {
  const before = events.length;
  events = keepLessonIds
    ? events.filter(e => !e.lessonId || keepLessonIds.has(e.lessonId))
    : [];
  await persist();
  return { removed: before - events.length, remaining: events.length };
}

/// Lesson ids the log still mentions — the admin needs it to tell a live
/// lesson from a deleted one.
export function eventLessonIds() {
  return [...new Set(events.map(e => e.lessonId).filter(Boolean))];
}

// Per-question wrong-answer rate — "Вопрос №3 (Про фишинг) — 74% ответили
// неверно" from the manifest. Sorted worst-first so the pain points surface.
export function questionHeatmap() {
  const byQuestion = new Map();
  for (const e of events) {
    if (e.type !== 'question_answered') continue;
    const key = `${e.lessonId}::${e.questionIndex}`;
    if (!byQuestion.has(key)) byQuestion.set(key, { lessonId: e.lessonId, questionIndex: e.questionIndex, total: 0, wrong: 0 });
    const row = byQuestion.get(key);
    row.total += 1;
    if (!e.correct) row.wrong += 1;
  }
  return [...byQuestion.values()]
    .map(r => ({ ...r, wrongPct: r.total > 0 ? Math.round((r.wrong / r.total) * 100) : 0 }))
    .sort((a, b) => b.wrongPct - a.wrongPct);
}
