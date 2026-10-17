const PALETTE = ['#0f766e', '#2563eb', '#d97706', '#db2777', '#7c3aed', '#dc2626', '#16a34a', '#64748b'];
const FALLBACK = '#94a3b8';
let cats = [];

export async function fetchCategories() {
  const res = await fetch('categories.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Server responded with HTTP ${res.status}`);
  let data;
  try { data = await res.json(); } catch { throw new Error('categories.json is not valid JSON'); }
  const list = data && data.categories;
  if (!Array.isArray(list) || !list.length) throw new Error('categories.json has no categories');
  const seen = new Set();
  for (const c of list) {
    if (!c || typeof c.id !== 'string' || !c.id || typeof c.name !== 'string' || !c.name.trim() || seen.has(c.id))
      throw new Error('categories.json contains an invalid or duplicate entry');
    seen.add(c.id);
  }
  return list.map(c => ({ id: c.id, name: c.name.trim(), icon: /^[a-z0-9-]+$/.test(c.icon || '') ? c.icon : 'tag' }));
}

export const setCategories = list => { cats = list; };
export const getCategories = () => cats;
const find = id => cats.find(c => c.id === id);
export const catName = id => (find(id) ? find(id).name : id);
export const catIcon = id => (find(id) ? find(id).icon : 'tag');
export const catColor = id => { const i = cats.findIndex(c => c.id === id); return i < 0 ? FALLBACK : PALETTE[i % PALETTE.length]; };
