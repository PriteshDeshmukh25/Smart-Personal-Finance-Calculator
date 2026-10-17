# SmartSpend – Personal Expense Tracker

A responsive web app for students to record and analyse daily expenses. Built with plain HTML, CSS and JavaScript (ES modules), Bootstrap 5 and Chart.js. No backend and no build step.

## Features
- Validated expense form (title, amount, category, date, optional payment method and notes) with field-specific error messages
- Add, edit and delete expenses (delete asks for confirmation); "Clear all" with confirmation
- Records saved in `localStorage` and restored on every visit
- Categories loaded from `categories.json` with the Fetch API, with loading, error and retry states
- Filters that combine: category, month, date range, search, plus sorting (newest, oldest, highest, lowest)
- Dashboard cards, doughnut chart (spending by category), bar chart (monthly spending), and an insights section (this month vs last month, average, top category, % share)
- Scroll-reveal animations (Intersection Observer), animated counters, scroll progress bar; `prefers-reduced-motion` respected
- Accessible: labels, keyboard focus, `aria-live` notifications, chart text summary
- Responsive: table on desktop, cards on mobile

## Run locally (use a server — not `file://`)
`fetch('categories.json')` and ES modules do not work when opening `index.html` directly.

```
cd smart-spend
python -m http.server 8000
```
Open http://localhost:8000. (Alternative: `npx serve .` or the VS Code "Live Server" extension.)
An internet connection is needed because Bootstrap, Bootstrap Icons and Chart.js load from the jsDelivr CDN.

## Project structure
```
smart-spend/
├── index.html
├── categories.json
├── css/styles.css
└── js/
    ├── app.js          startup, rendering, events
    ├── storage.js      safe localStorage read/write, backup of bad data
    ├── expenses.js     formatting (₹, dates), statistics, ids
    ├── categories.js   Fetch API + validation of categories.json, colours
    ├── filters.js      search / filter / sort (pure functions)
    ├── charts.js       Chart.js creation and updates
    ├── validation.js   form validation rules
    └── animations.js   scroll reveal, counters, progress bar
```

## How it works
- **Fetch API / categories.json** – on startup the app fetches `categories.json` (relative path, so it works on GitHub Pages sub-paths), checks `response.ok`, validates the structure, then fills both the form dropdown and the filter dropdown from that single list. If loading fails, a message and a Retry button appear and the form stays disabled; saved expenses are untouched.
- **localStorage** – expenses live under the key `smartSpendExpenses`. Each record stores the category **id** (e.g. `food`), and the name is looked up from `categories.json`. If stored data is corrupted or has invalid records, the original is copied to `smartSpendExpensesBackup` and a warning is shown. If a write fails (quota/blocked), the app says so and keeps the previous data. Data is per browser and per site address — it is not synced anywhere.
- **Chart.js** – the doughnut and bar charts are computed from the currently filtered records and update (not duplicate) when data changes.

## Manual test checklist
1. Submit an empty form → errors appear under each field; nothing saved.
2. Try amount `0`, `-5`, `abc`, `10000001`, `1.234`; try a future date → rejected with messages.
3. Add 3–4 expenses in different categories → list, cards and charts update.
4. Refresh the page → expenses are still there.
5. Filter by category + search + month + date range; check sorting; click Reset filters.
6. Edit an expense → count stays the same. Delete one → confirmation, totals and charts update.
7. In DevTools → Application → Local Storage, set `smartSpendExpenses` to `{bad` and reload → warning, app still works.
8. Rename `categories.json` temporarily → error banner with Retry; rename back and click Retry.
9. Resize to 320 px, 768 px and 1366 px → no horizontal scroll, table switches to cards.
10. Turn on "reduce motion" in your OS → animations are skipped.

## Deployment
**GitHub Pages:** create a repository, upload the contents of `smart-spend/` (so `index.html` is at the repo root), then Settings → Pages → Deploy from branch → `main` / root. Open `https://<username>.github.io/<repo>/`. All paths are relative, so no changes are needed.

**Vercel:** import the repository (or run `npx vercel` inside the folder); framework preset "Other", no build command, output directory `.`.

After deploying, open the live URL, add an expense, refresh, and check the browser console for errors.

## Known limitations
- Data is stored only in one browser on one device; clearing site data deletes it.
- Libraries load from a CDN, so the first load needs internet access.
- Firefox desktop shows the month filter as a text box (type `YYYY-MM`) on some versions.
