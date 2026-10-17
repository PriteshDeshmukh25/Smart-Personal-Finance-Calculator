export const defaultFilters = () => ({ category: '', from: '', to: '', month: '', search: '', sort: 'newest' });
export const isFiltered = f => !!(f.category || f.from || f.to || f.month || f.search.trim());

const SORTS = {
  newest: (a, b) => b.date.localeCompare(a.date),
  oldest: (a, b) => a.date.localeCompare(b.date),
  high: (a, b) => b.amount - a.amount,
  low: (a, b) => a.amount - b.amount
};

/** Pure: returns a new array; never mutates the stored list. All filters combine with AND. */
export function applyFilters(list, f) {
  const q = f.search.trim().toLowerCase();
  return list
    .filter(e =>
      (!f.category || e.category === f.category) &&
      (!f.from || e.date >= f.from) &&
      (!f.to || e.date <= f.to) &&
      (!f.month || e.date.startsWith(f.month)) &&
      (!q || e.title.toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q)))
    .sort(SORTS[f.sort] || SORTS.newest);
}
