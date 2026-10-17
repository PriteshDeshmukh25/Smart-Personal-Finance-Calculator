import { catName, catColor } from './categories.js';
import { fmtMoney, monthKey, monthLabel } from './expenses.js';

const $ = id => document.getElementById(id);
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let pie = null, bar = null;

function destroyAll() {
  if (pie) { pie.destroy(); pie = null; }
  if (bar) { bar.destroy(); bar = null; }
}

export function renderCharts(view) {
  const area = $('chartArea'), empty = $('chartEmpty'), err = $('chartError');
  err.hidden = true;
  if (!view.length) { destroyAll(); area.hidden = true; empty.hidden = false; return; }
  empty.hidden = true;
  if (typeof Chart === 'undefined') { area.hidden = true; err.hidden = false; return; }
  area.hidden = false;
  try {
    const byCat = {}, byMonth = {};
    for (const e of view) {
      byCat[e.category] = (byCat[e.category] || 0) + e.amount;
      const k = monthKey(e.date);
      byMonth[k] = (byMonth[k] || 0) + e.amount;
    }
    const ids = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
    const total = ids.reduce((s, i) => s + byCat[i], 0);
    const labels = ids.map(catName), values = ids.map(i => Math.round(byCat[i] * 100) / 100), colors = ids.map(catColor);
    const mKeys = Object.keys(byMonth).sort().slice(-6);
    const mLabels = mKeys.map(monthLabel), mValues = mKeys.map(k => Math.round(byMonth[k] * 100) / 100);
    const animation = reduced() ? false : { duration: 500 };

    if (pie) {
      pie.data.labels = labels; pie.data.datasets[0].data = values; pie.data.datasets[0].backgroundColor = colors; pie.update();
    } else {
      pie = new Chart($('pieChart'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: '#fff', borderWidth: 2 }] },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '60%', animation,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: { callbacks: { label: c => {
              const sum = c.dataset.data.reduce((a, b) => a + b, 0);
              return ` ${c.label}: ${fmtMoney(c.parsed)} (${sum ? (c.parsed / sum * 100).toFixed(1) : 0}%)`;
            } } }
          }
        }
      });
    }

    if (bar) {
      bar.data.labels = mLabels; bar.data.datasets[0].data = mValues; bar.update();
    } else {
      bar = new Chart($('barChart'), {
        type: 'bar',
        data: { labels: mLabels, datasets: [{ label: 'Spent', data: mValues, backgroundColor: '#0f766e', borderRadius: 6 }] },
        options: {
          responsive: true, maintainAspectRatio: false, animation,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${fmtMoney(c.parsed.y)}` } } },
          scales: { y: { beginAtZero: true, ticks: { callback: v => '₹' + Number(v).toLocaleString('en-IN') } } }
        }
      });
    }

    $('chartSummary').textContent = 'Spending by category: ' +
      ids.map((id, i) => `${labels[i]} ${fmtMoney(values[i])} (${(byCat[id] / total * 100).toFixed(1)}%)`).join('; ') +
      '. Monthly totals: ' + mKeys.map((k, i) => `${mLabels[i]} ${fmtMoney(mValues[i])}`).join('; ') + '.';
  } catch (e) {
    console.error('Chart rendering failed', e);
    destroyAll(); area.hidden = true; err.hidden = false;
  }
}
