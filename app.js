import { loadExpenses, saveExpenses } from './storage.js';
import { fetchCategories, setCategories, getCategories, catName, catIcon, catColor } from './categories.js';
import { validateExpense } from './validation.js';
import { applyFilters, defaultFilters, isFiltered } from './filters.js';
import { fmtMoney, fmtDate, todayISO, uid, computeStats, monthComparison } from './expenses.js';
import { renderCharts } from './charts.js';
import { initReveal, animateNumber, initProgress } from './animations.js';

const $ = id => document.getElementById(id);
const FIELDS = ['title', 'amount', 'category', 'date', 'payment', 'notes'];
const state = { expenses: [], catsReady: false, filters: defaultFilters(), editingId: null, flashId: null, saving: false };

/* ---------- small DOM helper (text is always inserted as text, never as HTML) ---------- */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v);
  }
  for (const k of kids.flat()) { if (k == null || k === false) continue; el.append(k); }
  return el;
}

function notify(msg, tone = 'success') {
  const label = { success: 'Done', danger: 'Error', warning: 'Notice' }[tone];
  const t = h('div', { class: `toast-msg ${tone}` }, h('strong', {}, label + ': '), msg);
  $('toasts').append(t);
  setTimeout(() => t.remove(), tone === 'success' ? 3500 : 7000);
}

let pendingConfirm = null;
function confirmAction(message, okText, onOk) {
  if (!window.bootstrap) { if (window.confirm(message)) onOk(); return; }
  $('confirmBody').textContent = message;
  $('confirmOk').textContent = okText;
  pendingConfirm = onOk;
  window.bootstrap.Modal.getOrCreateInstance($('confirmModal')).show();
}

/* ---------- persistence: one flow for add / edit / delete ---------- */
function commit(newList, message) {
  if (!saveExpenses(newList)) {
    notify('Could not save: browser storage is full or blocked. Your previously saved data is unchanged.', 'danger');
    return false;
  }
  state.expenses = newList;
  refresh();
  notify(message);
  return true;
}

/* ---------- categories ---------- */
function setCatSelectState(mode) {
  const fc = $('f-category');
  if (mode === 'loading') { fc.replaceChildren(h('option', { value: '' }, 'Loading categories…')); fc.disabled = true; }
  if (mode === 'failed') { fc.replaceChildren(h('option', { value: '' }, 'Categories unavailable')); fc.disabled = true; }
  $('submitBtn').disabled = !state.catsReady;
}

function fillCatSelects() {
  const cats = getCategories();
  const fc = $('f-category'), ff = $('flt-category');
  fc.replaceChildren(h('option', { value: '' }, 'Select a category'), ...cats.map(c => h('option', { value: c.id }, c.name)));
  fc.disabled = false;
  ff.replaceChildren(h('option', { value: '' }, 'All categories'), ...cats.map(c => h('option', { value: c.id }, c.name)));
  ff.value = cats.some(c => c.id === state.filters.category) ? state.filters.category : '';
  state.filters.category = ff.value;
}

async function loadCats() {
  state.catsReady = false;
  $('catError').hidden = true;
  setCatSelectState('loading');
  try {
    setCategories(await fetchCategories());
    state.catsReady = true;
    fillCatSelects();
    setCatSelectState('ready');
  } catch (e) {
    console.error('Category load failed', e);
    $('catErrorText').textContent = `Categories could not be loaded (${e.message}). Your saved expenses are safe, but new ones can’t be added until this works. If you opened the file directly, run it through a local server instead.`;
    $('catError').hidden = false;
    setCatSelectState('failed');
  }
  refresh();
}

/* ---------- form ---------- */
function showErrors(errors) {
  for (const f of FIELDS) {
    const el = $('f-' + f), msg = errors[f];
    el.classList.toggle('is-invalid', !!msg);
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    $('err-' + f).textContent = msg || '';
  }
}

function exitEdit() {
  state.editingId = null;
  $('formTitle').textContent = 'Add an expense';
  $('submitBtn').textContent = 'Add expense';
  $('cancelEdit').hidden = true;
}

function resetForm() {
  $('expenseForm').reset();
  $('f-date').value = todayISO();
  showErrors({});
  exitEdit();
}

function handleSubmit() {
  const raw = {};
  for (const f of FIELDS) raw[f] = $('f-' + f).value;
  const { errors, value } = validateExpense(raw, getCategories().map(c => c.id), todayISO());
  showErrors(errors);
  const bad = FIELDS.find(f => errors[f]);
  if (bad) { $('f-' + bad).focus(); return; }

  if (state.editingId) {
    const id = state.editingId;
    if (commit(state.expenses.map(e => (e.id === id ? { ...value, id } : e)), 'Expense updated.')) { state.flashId = id; resetForm(); refresh(); }
  } else {
    const rec = { id: uid(state.expenses), ...value };
    state.flashId = rec.id;
    if (commit([...state.expenses, rec], 'Expense added.')) resetForm(); else state.flashId = null;
  }
}

function startEdit(id) {
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  state.editingId = id;
  $('f-title').value = e.title; $('f-amount').value = e.amount; $('f-date').value = e.date;
  $('f-category').value = e.category; $('f-payment').value = e.paymentMethod || ''; $('f-notes').value = e.notes || '';
  showErrors({});
  $('formTitle').textContent = 'Edit expense';
  $('submitBtn').textContent = 'Save changes';
  $('cancelEdit').hidden = false;
  $('add').scrollIntoView({ behavior: 'smooth' });
  $('f-title').focus({ preventScroll: true });
}

function askDelete(id) {
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  confirmAction(`Delete “${e.title}” (${fmtMoney(e.amount)})? This can’t be undone.`, 'Delete', () => {
    if (state.editingId === id) resetForm();
    commit(state.expenses.filter(x => x.id !== id), 'Expense deleted.');
  });
}

/* ---------- rendering ---------- */
function catBadge(id) {
  const s = h('span', { class: 'cat-badge' }, h('i', { class: `bi bi-${catIcon(id)}`, 'aria-hidden': 'true' }), catName(id));
  s.style.setProperty('--c', catColor(id));
  return s;
}

function actions(e) {
  const btn = (label, icon, fn, cls) => h('button', { type: 'button', class: `btn btn-sm ${cls}`, 'aria-label': `${label} ${e.title}`, onclick: fn },
    h('i', { class: `bi bi-${icon}`, 'aria-hidden': 'true' }));
  return h('div', { class: 'd-flex gap-1 justify-content-end' },
    btn('Edit', 'pencil', () => startEdit(e.id), 'btn-outline-secondary'),
    btn('Delete', 'trash3', () => askDelete(e.id), 'btn-outline-danger'));
}

function row(e) {
  return h('tr', { class: e.id === state.flashId ? 'flash' : null },
    h('td', { class: 'text-nowrap' }, fmtDate(e.date)),
    h('td', { class: 'text-break' }, h('div', { class: 'fw-semibold' }, e.title), e.notes ? h('div', { class: 'small text-muted' }, e.notes) : null),
    h('td', {}, catBadge(e.category)),
    h('td', {}, e.paymentMethod || '—'),
    h('td', { class: 'text-end fw-semibold text-nowrap' }, fmtMoney(e.amount)),
    h('td', {}, actions(e)));
}

function card(e) {
  return h('div', { class: `tx-card${e.id === state.flashId ? ' flash' : ''}` },
    h('div', { class: 'd-flex justify-content-between gap-2' },
      h('div', { class: 'fw-semibold text-break' }, e.title), h('div', { class: 'fw-semibold text-nowrap' }, fmtMoney(e.amount))),
    h('div', { class: 'small text-muted my-1' }, fmtDate(e.date), e.paymentMethod ? ` · ${e.paymentMethod}` : ''),
    e.notes ? h('div', { class: 'small text-break mb-1' }, e.notes) : null,
    h('div', { class: 'd-flex justify-content-between align-items-center mt-2' }, catBadge(e.category), actions(e)));
}

function renderStats(view) {
  const s = computeStats(view), all = computeStats(state.expenses), filtered = isFiltered(state.filters);
  animateNumber($('statTotal'), s.total, fmtMoney);
  animateNumber($('statCount'), s.count, v => String(Math.round(v)));
  animateNumber($('statHighest'), s.highest ? s.highest.amount : 0, fmtMoney);
  $('statScope').textContent = filtered ? `Filtered view (${view.length} of ${all.count} records)` : 'All records';
  $('statAllTime').textContent = `All-time: ${fmtMoney(all.total)}`;
  $('statStored').textContent = `${all.count} stored in total`;
  $('statHighestName').textContent = s.highest ? s.highest.title : 'No data yet';
  $('statTopCat').textContent = s.top ? catName(s.top.id) : '—';
  $('statTopCatAmt').textContent = s.top ? `${fmtMoney(s.top.amount)} (${(s.top.amount / s.total * 100).toFixed(1)}% of shown)` : 'No data yet';
}

function renderList(view) {
  const total = state.expenses.length;
  $('resultCount').textContent = total ? (isFiltered(state.filters) ? `Showing ${view.length} of ${total} records` : `${total} record${total === 1 ? '' : 's'}`) : '';
  $('emptyAll').hidden = total !== 0;
  $('emptyFiltered').hidden = !(total && !view.length);
  $('listWrap').hidden = !view.length;
  $('clearAllBtn').disabled = total === 0;
  $('txBody').replaceChildren(...view.map(row));
  $('cardList').replaceChildren(...view.map(card));
  state.flashId = null;
}

function renderInsights() {
  const all = state.expenses, empty = all.length === 0;
  $('insEmpty').hidden = !empty; $('insContent').hidden = empty;
  if (empty) return;
  const st = computeStats(all), mc = monthComparison(all);
  $('insMonth').textContent = fmtMoney(mc.cur);
  if (mc.change === null) $('insCompare').textContent = 'No spending recorded last month, so there is nothing to compare yet.';
  else if (Math.abs(mc.change) < 0.05) $('insCompare').textContent = `About the same as last month (${fmtMoney(mc.prev)}).`;
  else $('insCompare').textContent = `${Math.abs(mc.change).toFixed(1)}% ${mc.change > 0 ? 'higher' : 'lower'} than last month (${fmtMoney(mc.prev)}).`;
  $('insAvg').textContent = fmtMoney(st.average);
  $('insAvgSub').textContent = `Across ${st.count} record${st.count === 1 ? '' : 's'}`;
  $('insTop').textContent = st.top ? catName(st.top.id) : '—';
  $('insTopSub').textContent = st.top ? `${fmtMoney(st.top.amount)} (${(st.top.amount / st.total * 100).toFixed(1)}% of all spending)` : '';
  const rows = Object.entries(st.byCategory).sort((a, b) => b[1] - a[1]).map(([id, amt]) => {
    const pct = st.total ? amt / st.total * 100 : 0;
    const fill = h('div', { class: 'progress-bar' });
    fill.style.width = pct.toFixed(1) + '%'; fill.style.background = catColor(id);
    return h('div', { class: 'mb-3' },
      h('div', { class: 'd-flex justify-content-between small mb-1' }, h('span', {}, catName(id)), h('span', {}, `${fmtMoney(amt)} · ${pct.toFixed(1)}%`)),
      h('div', { class: 'progress', role: 'progressbar', 'aria-label': `${catName(id)} share of spending`, 'aria-valuenow': pct.toFixed(1), 'aria-valuemin': '0', 'aria-valuemax': '100' }, fill));
  });
  $('insDist').replaceChildren(...rows);
}

function refresh() {
  const view = applyFilters(state.expenses, state.filters);
  renderStats(view);
  renderList(view);
  renderInsights();
  renderCharts(view);
}

/* ---------- filters ---------- */
function readFilters() {
  const f = state.filters = {
    category: $('flt-category').value, from: $('flt-from').value, to: $('flt-to').value,
    month: $('flt-month').value, search: $('flt-search').value, sort: $('flt-sort').value
  };
  $('dateWarn').hidden = !(f.from && f.to && f.from > f.to);
  refresh();
}

function resetFilters() {
  state.filters = defaultFilters();
  $('flt-category').value = ''; $('flt-from').value = ''; $('flt-to').value = '';
  $('flt-month').value = ''; $('flt-search').value = ''; $('flt-sort').value = 'newest';
  $('dateWarn').hidden = true;
  refresh();
}

/* ---------- events & init ---------- */
function bindEvents() {
  $('expenseForm').addEventListener('submit', ev => {
    ev.preventDefault();
    if (state.saving || !state.catsReady) return;
    state.saving = true; $('submitBtn').disabled = true;
    try { handleSubmit(); } finally { state.saving = false; $('submitBtn').disabled = !state.catsReady; }
  });
  for (const f of FIELDS) $('f-' + f).addEventListener('input', () => {
    $('f-' + f).classList.remove('is-invalid'); $('f-' + f).removeAttribute('aria-invalid'); $('err-' + f).textContent = '';
  });
  $('cancelEdit').addEventListener('click', resetForm);
  $('catRetry').addEventListener('click', loadCats);
  ['flt-category', 'flt-from', 'flt-to', 'flt-month', 'flt-search', 'flt-sort'].forEach(id => {
    $(id).addEventListener('input', readFilters); $(id).addEventListener('change', readFilters);
  });
  $('resetFilters').addEventListener('click', resetFilters);
  $('emptyResetBtn').addEventListener('click', resetFilters);
  $('emptyAddBtn').addEventListener('click', () => setTimeout(() => $('f-title').focus({ preventScroll: true }), 50));
  $('clearAllBtn').addEventListener('click', () =>
    confirmAction('Delete ALL expense records from this browser? This can’t be undone.', 'Delete everything', () => {
      resetForm(); commit([], 'All records cleared.');
    }));
  $('confirmOk').addEventListener('click', () => {
    const fn = pendingConfirm; pendingConfirm = null;
    window.bootstrap.Modal.getOrCreateInstance($('confirmModal')).hide();
    if (fn) fn();
  });
  document.querySelectorAll('#navMenu .nav-link').forEach(a => a.addEventListener('click', () => {
    if (window.bootstrap) { const c = window.bootstrap.Collapse.getInstance($('navMenu')); if (c) c.hide(); }
  }));
}

async function init() {
  initProgress();
  bindEvents();
  const { data, problem } = loadExpenses();
  state.expenses = data;
  if (problem === 'corrupt') notify('Your saved data was unreadable and could not be loaded. A copy was kept in browser storage under “smartSpendExpensesBackup”.', 'warning');
  else if (problem === 'blocked') notify('Browser storage is unavailable, so expenses can’t be saved in this session.', 'danger');
  else if (problem && problem.startsWith('dropped:')) notify(`${problem.split(':')[1]} saved record(s) were invalid and skipped. A backup copy of the original data was kept.`, 'warning');
  $('f-date').value = todayISO();
  $('f-date').max = todayISO();
  refresh();
  initReveal();
  await loadCats();
}

init();
