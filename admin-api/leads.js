// admin-api/leads.js — B2B partnership enquiries.
//
// Its own file and its own store, deliberately kept away from db.json. A
// lead is not a user: nobody signs in as one, it has no state the app
// reads, and it must survive independently of the learner database — the
// one thing that must never be lost while somebody is still deciding
// whether to answer it.
//
// Two shapes land here and are kept apart on purpose (see the site's
// strategy: a bank's enquiry must never queue behind a learner's bug
// report):
//
//   kind: 'partner'    an organisation asking to work with JashMen
//   kind: 'feedback'   a learner reporting something about the app
//   kind: 'subscribe'  someone leaving an address for the newsletter
//
// Same store because all three are "somebody left us an address"; the
// `kind` is what the admin filters on. A subscriber carries nothing but
// that address — asking a newsletter form for an organisation and a
// contact name is how a one-field form turns into an abandoned one.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

/// A lead is small, but a bot can send a lot of them. These caps are what
/// stop one submission from filling the disk; the rate limiter upstream
/// stops the flood.
const MAX_FIELD = 400;
const MAX_MESSAGE = 4000;
const MAX_STORED = 5000;

const KINDS = new Set(['partner', 'feedback', 'subscribe']);

/// What an organisation can say it wants. Anything else becomes 'other'
/// rather than being rejected — a lead is never worth losing to a typo in
/// a dropdown.
export const PARTNER_INTERESTS = new Set([
  'module', 'rewards', 'league', 'integration', 'other',
]);

/// What a learner can be writing about.
export const FEEDBACK_TOPICS = new Set([
  'bug', 'suggestion', 'content', 'reward', 'account', 'other',
]);

function load() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, '[]');
    const parsed = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    // A corrupt file must not stop the server from booting — but it also
    // must not be silently overwritten, so say so loudly and start empty.
    console.error('[leads] could not read leads.json, starting empty:', err);
    return [];
  }
}

const state = load();

let writeChain = Promise.resolve();

/// Same serialized write-then-rename the other stores use: a crash during
/// a write can never leave a half-written file where the leads were.
function persist() {
  const task = writeChain.then(() => new Promise((resolve, reject) => {
    const tmp = `${LEADS_FILE}.tmp`;
    fs.writeFile(tmp, JSON.stringify(state, null, 2), err => {
      if (err) return reject(err);
      fs.rename(tmp, LEADS_FILE, err2 => (err2 ? reject(err2) : resolve()));
    });
  }));
  writeChain = task.catch(err => console.error('[leads] failed to persist:', err));
  return task;
}

/// Trims to [max] and collapses whitespace. Returns '' for anything that is
/// not a usable string, so a caller can test one field for emptiness rather
/// than for four kinds of absence.
function clean(v, max = MAX_FIELD) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/// Deliberately permissive: this is a "will a reply reach them" check, not
/// an attempt to implement RFC 5322. A lead with a slightly odd address is
/// worth keeping; a lead with no @ is not answerable.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// Validates and records one enquiry.
///
/// Returns `{ ok: true, lead }`, or `{ ok: false, error }` with a message
/// that says which field is wrong and why — a form that answers "invalid
/// input" makes the person guess.
export async function addLead(input) {
  const body = input || {};
  const kind = KINDS.has(body.kind) ? body.kind : 'partner';

  const email = clean(body.email, 200);
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Укажите email, на который мы сможем ответить' };
  }

  const message = clean(body.message, MAX_MESSAGE);

  const lead = {
    id: randomUUID(),
    kind,
    ts: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    email,
    message,
    handledAt: null,
  };

  if (kind === 'partner') {
    const organization = clean(body.organization);
    if (!organization) {
      return { ok: false, error: 'Укажите название организации' };
    }
    const contact = clean(body.contact);
    if (!contact) {
      return { ok: false, error: 'Укажите контактное лицо' };
    }
    lead.organization = organization;
    lead.contact = contact;
    lead.phone = clean(body.phone, 60);
    lead.website = clean(body.website, 200);
    lead.interest = PARTNER_INTERESTS.has(body.interest) ? body.interest : 'other';
    // Everything below is the optional second step — asked after the form
    // is already sent, so a missing answer never blocks a submission.
    lead.orgType = clean(body.orgType, 80);
    lead.audience = clean(body.audience);
    lead.audienceSize = clean(body.audienceSize, 80);
  } else if (kind === 'feedback') {
    lead.topic = FEEDBACK_TOPICS.has(body.topic) ? body.topic : 'other';
    if (!message) {
      return { ok: false, error: 'Напишите, что произошло' };
    }
  } else {
    // A subscriber is an email and nothing else. Re-submitting the same
    // address is a no-op rather than a second row: people press the button
    // twice when nothing visibly happens, and two identical rows in the
    // inbox is a bug the operator has to clean up by hand.
    const existing = state.find(l => l.kind === 'subscribe' && l.email === email);
    if (existing) return { ok: true, lead: existing };
    lead.source = clean(body.source, 80);
  }

  state.push(lead);
  // Oldest first out. A cap this high is a disk guard, not a retention
  // policy — if it ever trims anything, that is a signal to export.
  if (state.length > MAX_STORED) state.splice(0, state.length - MAX_STORED);
  await persist();
  return { ok: true, lead };
}

/// Every lead, newest first. The admin joins nothing to this — a lead is
/// self-contained by design, so a deleted account cannot orphan one.
export function listLeads(kind) {
  const rows = kind ? state.filter(l => l.kind === kind) : state;
  return [...rows].sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

export function countUnhandled(kind) {
  return state.filter(l => !l.handledAt && (!kind || l.kind === kind)).length;
}

/// Marks a lead as dealt with, or takes the mark back. A timestamp rather
/// than a boolean: it answers "when" for free and needs no migration for
/// the rows written before it existed.
export async function setLeadHandled(id, handled) {
  const row = state.find(l => l.id === id);
  if (!row) return null;
  row.handledAt = handled ? Date.now() : null;
  await persist();
  return row;
}

export async function deleteLead(id) {
  const i = state.findIndex(l => l.id === id);
  if (i < 0) return false;
  state.splice(i, 1);
  await persist();
  return true;
}
