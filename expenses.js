const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const pad = n => String(n).padStart(2, '0');
const parse = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };

export const fmtMoney = n => money.format(Number.isFinite(n) ? n : 0);
export const fmtDate = iso => parse(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
export const monthKey = iso => iso.slice(0, 7);
export const monthLabel = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }); };
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const round2 = n => Math.round(n * 100) / 100;

export function uid(existing = []) {
  let id;
  do {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  } while (existing.some(e => e.id === id));
  return id;
}

export function computeStats(list) {
  let total = 0, highest = null;
  const byCategory = {};
  for (const e of list) {
    total += e.amount;
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    if (!highest || e.amount > highest.amount) highest = e;
  }
  let top = null;
  for (const [id, amount] of Object.entries(byCategory)) if (!top || amount > top.amount) top = { id, amount: round2(amount) };
  return { total: round2(total), count: list.length, highest, top, byCategory, average: list.length ? round2(total / list.length) : 0 };
}

/** Current month vs previous month. change is null when there is no previous-month spending. */
export function monthComparison(list, now = new Date()) {
  const curKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const p = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = `${p.getFullYear()}-${pad(p.getMonth() + 1)}`;
  let cur = 0, prev = 0, prevCount = 0;
  for (const e of list) {
    const k = monthKey(e.date);
    if (k === curKey) cur += e.amount;
    else if (k === prevKey) { prev += e.amount; prevCount++; }
  }
  cur = round2(cur); prev = round2(prev);
  return { cur, prev, prevCount, change: prev > 0 ? ((cur - prev) / prev) * 100 : null };
}
