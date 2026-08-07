// admin-api/db.js
//
// Minimal JSON-file datastore. No external DB dependency to stand up for
// local dev / a small deployment — writes are serialized through a promise
// chain and land via a tmp-file + rename so a crash mid-write can't corrupt
// db.json. Swap this module out for real Postgres/etc. if this ever needs
// to survive a serverless/ephemeral filesystem in production.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function loadSync() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (err) {
    console.error('[db] db.json is corrupt, starting from an empty store:', err.message);
    return { users: [] };
  }
}

const state = loadSync();
let writeChain = Promise.resolve();

function persist() {
  writeChain = writeChain.then(() => new Promise((resolve, reject) => {
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFile(tmp, JSON.stringify(state, null, 2), err => {
      if (err) return reject(err);
      fs.rename(tmp, DB_FILE, err2 => (err2 ? reject(err2) : resolve()));
    });
  })).catch(err => console.error('[db] failed to persist db.json:', err));
  return writeChain;
}

export function findUserByEmail(email) {
  const normalized = String(email || '').toLowerCase().trim();
  return state.users.find(u => u.email === normalized) || null;
}

export function findUserById(id) {
  return state.users.find(u => u.id === id) || null;
}

export async function insertUser(user) {
  state.users.push(user);
  await persist();
  return user;
}

export async function saveUser(user) {
  const idx = state.users.findIndex(u => u.id === user.id);
  if (idx === -1) throw new Error(`[db] cannot save unknown user ${user.id}`);
  state.users[idx] = user;
  await persist();
  return user;
}

export function listUsers() {
  return state.users;
}
