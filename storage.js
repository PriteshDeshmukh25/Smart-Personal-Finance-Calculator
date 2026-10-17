import { isValidISODate } from './validation.js';
import { uid } from './expenses.js';

const KEY = 'smartSpendExpenses';
const BACKUP = 'smartSpendExpensesBackup';

const isRecord = e => e && typeof e === 'object' && typeof e.id === 'string' && e.id &&
  typeof e.title === 'string' && e.title.trim() && typeof e.amount === 'number' && Number.isFinite(e.amount) && e.amount > 0 &&
  typeof e.category === 'string' && isValidISODate(e.date);

function backup(raw) { try { localStorage.setItem(BACKUP, raw); } catch { /* best effort */ } }

/** Returns { data, problem } where problem is null | 'blocked' | 'corrupt' | 'dropped:<n>'. Bad data is backed up, never silently lost. */
export function loadExpenses() {
  let raw;
  try { raw = localStorage.getItem(KEY); } catch { return { data: [], problem: 'blocked' }; }
  if (raw === null) return { data: [], problem: null };
  let parsed;
  try { parsed = JSON.parse(raw); if (!Array.isArray(parsed)) throw new Error('not an array'); }
  catch { backup(raw); return { data: [], problem: 'corrupt' }; }

  const data = [], seen = new Set();
  let dropped = 0, fixedIds = false;
  for (const e of parsed) {
    if (!isRecord(e)) { dropped++; continue; }
    let id = e.id;
    if (seen.has(id)) { id = uid(data); fixedIds = true; }
    seen.add(id);
    data.push({
      id, title: e.title.trim(), amount: e.amount, category: e.category, date: e.date,
      paymentMethod: typeof e.paymentMethod === 'string' ? e.paymentMethod : '',
      notes: typeof e.notes === 'string' ? e.notes : ''
    });
  }
  if (dropped || fixedIds) backup(raw);
  return { data, problem: dropped ? `dropped:${dropped}` : null };
}

export function saveExpenses(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}
