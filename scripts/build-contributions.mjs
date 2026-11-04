#!/usr/bin/env node
// Builds assets/contributions.svg from the GitHub GraphQL contribution calendar.
// Zero dependencies (Node 18+). The SVG holds only dates and daily counts, never repo names.
//
//   PROFILE_TOKEN=... GH_LOGIN=pandistic-zain node scripts/build-contributions.mjs
//   node scripts/build-contributions.mjs --empty     placeholder shown before the first sync
//   node scripts/build-contributions.mjs --sample    synthetic data for layout tests only
//   --out <path>                                      write somewhere else
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const outPath = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : path.join(ROOT, 'assets', 'contributions.svg');
const LOGIN = process.env.GH_LOGIN || 'pandistic-zain';

const C = { red: '#d71920', blue: '#123c69', ink: '#0b0b0e', paper: '#f7f7f3', grey: '#b6b6b8', line: '#55555b' };
const LEVELS = ['#17171d', '#4a1316', '#8a161b', '#d71920', '#f7f7f3'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const b64 = (f) => fs.readFileSync(path.join(ROOT, 'fonts', f)).toString('base64');
const fonts = [
  ['Syne', 700, 'syne-700.woff2'], ['Manrope', 400, 'manrope-400.woff2'], ['DM Mono', 500, 'dm-mono-500.woff2'],
].map(([fam, w, f]) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${b64(f)}) format('woff2')}`).join('');

// ---------- data ----------
async function fetchCalendar(token) {
  const to = new Date();
  const from = new Date(to.getTime() - 365 * 86400000);
  const query = `query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){restrictedContributionsCount contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}}}`;
  const res = await fetch(process.env.GITHUB_GRAPHQL_URL || 'https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-readme-contributions' },
    body: JSON.stringify({ query, variables: { login: LOGIN, from: from.toISOString(), to: to.toISOString() } }),
  });
  if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error('GitHub API error: ' + json.errors.map((e) => e.message).join('; '));
  const cc = json.data?.user?.contributionsCollection;
  if (!cc) throw new Error('No contribution data returned for ' + LOGIN);
  console.log(`calendar total: ${cc.contributionCalendar.totalContributions} | restricted (private) count: ${cc.restrictedContributionsCount}`);
  return cc.contributionCalendar.weeks.map((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })));
}

function sampleWeeks() {
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const weeks = []; const start = new Date(Date.UTC(2025, 10, 2));
  for (let w = 0; w < 53; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start.getTime() + (w * 7 + d) * 86400000);
      if (dt > new Date(Date.UTC(2026, 10, 4))) continue;
      const wk = d === 0 || d === 6 ? 0.35 : 1;
      days.push({ date: dt.toISOString().slice(0, 10), count: rnd() < 0.55 * wk ? Math.floor(rnd() * rnd() * 14) : 0 });
    }
    weeks.push(days);
  }
  return weeks;
}

function stats(weeks) {
  const days = weeks.flat();
  const total = days.reduce((a, d) => a + d.count, 0);
  let longest = 0, run = 0;
  for (const d of days) { run = d.count > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  let cur = 0, i = days.length - 1;
  if (i >= 0 && days[i].count === 0) i--; // today may not have happened yet
  for (; i >= 0 && days[i].count > 0; i--) cur++;
  return { total, longest, cur, busiest: Math.max(0, ...days.map((d) => d.count)) };
}

// ---------- render ----------
function render({ weeks, mode }) {
  const W = 900, H = 336;
  const empty = mode === 'empty';
  const st = empty ? { total: 0, longest: 0, cur: 0, busiest: 0 } : stats(weeks);
  const maxc = Math.max(1, st.busiest);
  const level = (n) => (n <= 0 ? 0 : n <= maxc * 0.25 ? 1 : n <= maxc * 0.5 ? 2 : n <= maxc * 0.75 ? 3 : 4);
  const X0 = 48, Y0 = 190, PITCH = 15, CELL = 12;
  const grid = empty ? Array.from({ length: 53 }, () => Array.from({ length: 7 }, () => ({ count: 0, date: '' }))) : weeks;
  let cols = '', months = '', lastMonth = -1;
  grid.forEach((week, wi) => {
    let rects = '';
    week.forEach((d, di) => { rects += `<rect x="${X0 + wi * PITCH}" y="${Y0 + di * PITCH}" width="${CELL}" height="${CELL}" fill="${LEVELS[level(d.count)]}"/>`; });
    cols += `<g class="k" style="animation-delay:${(wi * 0.018).toFixed(3)}s">${rects}</g>`;
    if (!empty && week[0]) {
      const m = new Date(week[0].date + 'T00:00:00Z').getUTCMonth();
      if (m !== lastMonth) { months += `<text x="${X0 + wi * PITCH}" y="${Y0 - 10}" class="mn" font-size="9" fill="${C.grey}">${['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][m]}</text>`; lastMonth = m; }
    }
  });
  const synced = new Date().toISOString().slice(0, 10);
  const fmt = (n) => n.toLocaleString('en-US');
  const stat = (x, v, l) => `<text x="${x}" y="112" class="sy" font-size="30" fill="${C.paper}">${esc(v)}</text><text x="${x}" y="132" class="mn" font-size="9" fill="${C.grey}">${esc(l)}</text>`;
  const legend = LEVELS.map((c, i) => `<rect x="${X0 + 44 + i * 15}" y="313" width="12" height="12" fill="${c}"/>`).join('');
  const sampleBanner = mode === 'sample' ? `<rect x="0" y="0" width="${W}" height="22" fill="${C.red}"/><text x="${W / 2}" y="15" text-anchor="middle" class="mn" font-size="10" fill="${C.paper}">sample data / layout test / not real numbers</text>` : '';
  const note = empty ? 'syncs daily / first sync pending' : `includes private repositories (counts only) / synced ${synced}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="contrib-t contrib-d" data-total="${empty ? -1 : st.total}" data-mode="${mode}">
<title id="contrib-t">Contribution graph</title>
<desc id="contrib-d">${empty ? 'Contribution graph, first sync pending.' : `${fmt(st.total)} contributions in the last 12 months, including private repositories as anonymous counts. Current streak ${st.cur} days, longest ${st.longest} days.`}</desc>
<defs><style>${fonts}
.sy{font-family:Syne,'Arial Black',sans-serif;font-weight:700;letter-spacing:-0.02em}
.mn{font-family:'DM Mono',ui-monospace,Menlo,monospace;font-weight:500;text-transform:uppercase;letter-spacing:0.14em}
@keyframes k{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.k{animation:k .55s ease-out both}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style></defs>
<rect width="${W}" height="${H}" fill="${C.ink}"/>
${sampleBanner}
<text x="48" y="${mode === 'sample' ? 60 : 52}" class="mn" font-size="11" fill="${C.red}">05 / contributions</text>
<text x="46" y="122" class="sy" font-size="${empty ? 44 : 66}" fill="${C.paper}">${empty ? 'Awaiting first sync' : fmt(st.total)}</text>
<text x="48" y="146" class="mn" font-size="9" fill="${C.grey}">${empty ? 'runs daily once the workflow is set up' : 'contributions / last 12 months'}</text>
${empty ? '' : stat(500, String(st.cur), 'current streak') + stat(640, String(st.longest), 'longest streak') + stat(780, String(st.busiest), 'best day')}
${months}
${cols}
${legend}
<text x="${X0}" y="323" class="mn" font-size="9" fill="${C.grey}">less</text>
<text x="${X0 + 44 + 5 * 15 + 6}" y="323" class="mn" font-size="9" fill="${C.grey}">more</text>
<text x="852" y="323" text-anchor="end" class="mn" font-size="9" fill="${C.grey}">${esc(note)}</text>
</svg>
`;
}

// ---------- main ----------
function previousTotal() {
  try { const m = fs.readFileSync(outPath, 'utf8').match(/data-total="(-?\d+)"/); return m ? Number(m[1]) : -1; } catch { return -1; }
}

let svg;
if (flag('--empty')) svg = render({ weeks: null, mode: 'empty' });
else if (flag('--sample')) svg = render({ weeks: sampleWeeks(), mode: 'sample' });
else {
  const token = process.env.PROFILE_TOKEN;
  if (!token) { console.error('PROFILE_TOKEN is not set. Keeping the previous graph.'); process.exit(1); }
  try {
    const weeks = await fetchCalendar(token);
    const total = stats(weeks).total;
    const prev = previousTotal();
    if (total === 0 && prev > 0) { console.error(`Total is 0 but the previous graph had ${prev}. Keeping the previous graph.`); process.exit(1); }
    svg = render({ weeks, mode: 'live' });
  } catch (e) { console.error(String(e.message || e).replace(token, '***')); process.exit(1); }
}
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, svg);
console.log('wrote', path.relative(process.cwd(), outPath), (svg.length / 1024).toFixed(1) + ' KB');
