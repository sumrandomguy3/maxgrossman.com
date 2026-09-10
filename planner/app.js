/* Bench — market production planner.
   Local-first: all state lives in this browser's localStorage. No build step, no server. */
'use strict';

const STORAGE_KEY = 'bench.market-planner.v1';
const MS_DAY = 86400000;
const MS_WEEK = 7 * MS_DAY;

/* ------------------------------------------------------------------ helpers */

const uid = () => Math.random().toString(36).slice(2, 10);
const num = (v, dflt = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : dflt; };
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

function h(tag, props, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false || kid === '') continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

function today0() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function parseDate(s) {
  if (!s) return null;
  const [y, m, d] = String(s).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const fmtDate = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const weeksBetween = (a, b) => (b - a) / MS_WEEK;
const daysBetween = (a, b) => Math.round((b - a) / MS_DAY);

function fmtHours(x) {
  if (!Number.isFinite(x)) return '—';
  const r = Math.abs(x) < 10 ? Math.round(x * 10) / 10 : Math.round(x);
  return `${r} hr`;
}
function fmtRate(x) {
  if (!Number.isFinite(x)) return '—';
  return `${Math.round(x * 10) / 10}/wk`;
}
function relDays(n) {
  if (n < 0) return `${-n} day${-n === 1 ? '' : 's'} ago`;
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n < 21) return `in ${n} days`;
  const w = Math.round(n / 7);
  if (w < 9) return `in ${w} weeks`;
  return `in ${Math.round(n / 30.4)} months`;
}
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* -------------------------------------------------------------------- state */

const blankState = () => ({
  version: 2,
  settings: { weeklyHours: 8, bufferWeeks: 1, machineHoursPerWeek: 0, updatedAt: 0 },
  products: [],
  markets: [],
  commissions: [],
});

/* Records are never spliced out -- deleting sets `deleted: true` and stamps the
   time. Without those tombstones, a delete on the phone would be silently
   resurrected by the laptop's older copy on the next merge. They are purged
   once they are far older than any plausible offline gap. */
const TOMBSTONE_TTL = 120 * MS_DAY;
const live = (arr) => arr.filter((x) => !x.deleted);

let state = load();
let view = 'plan';
const openEditors = new Set();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return blankState();
    return normalize(JSON.parse(raw));
  } catch (err) {
    console.warn('Could not read saved data; starting empty.', err);
    return blankState();
  }
}

function normalize(data, now = Date.now()) {
  const s = blankState();
  if (!data || typeof data !== 'object') return s;
  const stampOf = (r) => Math.max(0, num(r && r.updatedAt, 0));
  const fresh = (r) => !r.deleted || stampOf(r) > now - TOMBSTONE_TTL;

  s.settings.weeklyHours = num(data.settings?.weeklyHours, 8);
  s.settings.bufferWeeks = num(data.settings?.bufferWeeks, 1);
  s.settings.machineHoursPerWeek = Math.max(0, num(data.settings?.machineHoursPerWeek, 0));
  s.settings.updatedAt = stampOf(data.settings);

  s.products = (data.products || []).map((p) => ({
    id: p.id || uid(),
    name: String(p.name || 'Untitled'),
    hoursEach: Math.max(0, num(p.hoursEach, 1)),
    machineHoursEach: Math.max(0, num(p.machineHoursEach, 0)),
    onHand: Math.max(0, Math.round(num(p.onHand, 0))),
    updatedAt: stampOf(p),
    deleted: !!p.deleted,
  })).filter(fresh);

  const ids = new Set(live(s.products).map((p) => p.id));
  s.markets = (data.markets || []).map((m) => {
    const targets = {};
    for (const [k, v] of Object.entries(m.targets || {})) {
      if (ids.has(k) && num(v) > 0) targets[k] = Math.max(0, Math.round(num(v)));
    }
    return {
      id: m.id || uid(), name: String(m.name || 'Untitled market'),
      date: m.date || '', notes: String(m.notes || ''), targets,
      updatedAt: stampOf(m), deleted: !!m.deleted,
    };
  }).filter(fresh);

  s.commissions = (data.commissions || []).map((c) => ({
    id: c.id || uid(),
    name: String(c.name || 'Commission'),
    hours: Math.max(0, num(c.hours, 0)),
    due: c.due || '',
    done: !!c.done,
    updatedAt: stampOf(c),
    deleted: !!c.deleted,
  })).filter(fresh);

  return s;
}

/* Merge two copies of the whole document, record by record, newest wins.
   Good enough because one person rarely edits the same spoon on two devices
   inside the same minute -- and when they do, one edit wins cleanly instead of
   the whole document being clobbered. */
function mergeStates(a, b) {
  const out = blankState();
  out.settings = (num(b.settings?.updatedAt, 0) > num(a.settings?.updatedAt, 0) ? b : a).settings;
  for (const key of ['products', 'markets', 'commissions']) {
    const byId = new Map();
    for (const rec of [...(a[key] || []), ...(b[key] || [])]) {
      const seen = byId.get(rec.id);
      if (!seen || num(rec.updatedAt, 0) > num(seen.updatedAt, 0)) byId.set(rec.id, rec);
    }
    out[key] = [...byId.values()];
  }
  return normalize(out);
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Save failed', err);
    alert('Could not save to this browser’s storage. Export a backup from Settings before you lose anything.');
  }
}

function update(fn) { fn(state); save(); render(); if (window.BenchSync) window.BenchSync.notifyLocalChange(); }

const touch = (rec) => { rec.updatedAt = Date.now(); return rec; };
const addRecord = (key, rec) => update((s) => s[key].push(touch(rec)));
const editRecord = (key, id, fn) => update((s) => {
  const t = s[key].find((x) => x.id === id);
  if (t) { fn(t); touch(t); }
});
const removeRecord = (key, id) => update((s) => {
  const t = s[key].find((x) => x.id === id);
  if (t) { t.deleted = true; touch(t); }
});
const liveProducts = () => live(state.products);

/* ------------------------------------------------------------------ planner */

/*
 * The model, in one paragraph:
 *
 *   Stock on hand is a single shared pool. The nearest market draws from it
 *   first, so a later market only counts what the earlier ones leave behind.
 *   Whatever is still missing has to be made, and making takes hours. Every
 *   market's deadline therefore has to cover *all* the work due by then --
 *   its own build, every earlier market's build, and any commission due in
 *   the same window. Compare that demand against the hours you actually have
 *   (weekly hours x weeks left) and you get the one number worth knowing:
 *   are you ahead of the date, or already behind it?
 */
function computePlan(s) {
  const now = today0();
  const weeklyHours = Math.max(0, num(s.settings.weeklyHours, 0));
  const bufferWeeks = Math.max(0, num(s.settings.bufferWeeks, 0));
  // Machine time is not your time. A CNC job running while you are at school
  // costs the shop elapsed hours but costs you none, so it is counted against
  // its own budget -- otherwise the planner tells you to cut work the machine
  // could have carried. Zero means "not tracked": machine hours are still
  // reported, they just do not constrain anything.
  const machineWeekly = Math.max(0, num(s.settings.machineHoursPerWeek, 0));
  const tracksMachine = machineWeekly > 0;

  const products = live(s.products);
  const stock = new Map(products.map((p) => [p.id, Math.max(0, p.onHand)]));
  const committed = new Map(products.map((p) => [p.id, 0]));

  const upcoming = live(s.markets)
    .map((m) => ({ market: m, date: parseDate(m.date) }))
    .filter((x) => x.date && x.date >= now)
    .sort((a, b) => a.date - b.date);

  const past = live(s.markets)
    .map((m) => ({ market: m, date: parseDate(m.date) }))
    .filter((x) => !x.date || x.date < now)
    .sort((a, b) => (b.date || 0) - (a.date || 0));

  const openCommissions = live(s.commissions)
    .filter((c) => !c.done)
    .map((c) => ({ commission: c, due: parseDate(c.due) }));

  const perProductWeekly = new Map();
  const bump = (id, units) => perProductWeekly.set(id, (perProductWeekly.get(id) || 0) + units);

  let cumMakeHours = 0;
  let cumMachineHours = 0;
  const rows = [];

  for (const { market, date } of upcoming) {
    // Finish `bufferWeeks` early so packing and finishing aren't a scramble.
    const deadline = new Date(date.getTime() - bufferWeeks * MS_WEEK);
    const weeksLeft = weeksBetween(now, deadline);

    const lines = [];
    for (const p of products) {
      const target = num(market.targets[p.id], 0);
      if (target <= 0) continue;
      const have = stock.get(p.id) || 0;
      const fromStock = Math.min(have, target);
      stock.set(p.id, have - fromStock);
      committed.set(p.id, (committed.get(p.id) || 0) + fromStock);
      const toMake = target - fromStock;
      const hours = toMake * p.hoursEach;
      const machineHours = toMake * (Number(p.machineHoursEach) || 0);
      // Units to put on the bench this week to land this line on time.
      const thisWeek = toMake === 0 ? 0
        : weeksLeft > 0 ? Math.min(toMake, Math.ceil(toMake / weeksLeft))
        : toMake;
      if (thisWeek > 0) bump(p.id, thisWeek);
      lines.push({ product: p, target, fromStock, toMake, hours, machineHours, thisWeek });
    }

    const makeHours = sum(lines.map((l) => l.hours));
    const makeMachineHours = sum(lines.map((l) => l.machineHours));
    cumMakeHours += makeHours;
    cumMachineHours += makeMachineHours;

    const commissionHours = sum(
      openCommissions.filter((c) => !c.due || c.due <= deadline).map((c) => c.commission.hours)
    );
    const demandHours = cumMakeHours + commissionHours;
    const capacityHours = Math.max(0, weeksLeft) * weeklyHours;
    const handRatio = capacityHours > 0 ? demandHours / capacityHours : (demandHours > 0 ? Infinity : 0);

    const machineCapacityHours = Math.max(0, weeksLeft) * machineWeekly;
    const machineRatio = !tracksMachine ? 0
      : machineCapacityHours > 0 ? cumMachineHours / machineCapacityHours
      : (cumMachineHours > 0 ? Infinity : 0);

    // Whichever budget runs out first is the one that decides the date.
    const ratio = Math.max(handRatio, machineRatio);
    const machineBound = tracksMachine && machineRatio > handRatio;

    let status = 'ok';
    if (demandHours <= 0 && cumMachineHours <= 0) status = 'ok';
    else if (ratio > 1) status = 'behind';
    else if (ratio > 0.85) status = 'tight';

    rows.push({
      market, date, deadline, weeksLeft,
      daysToMarket: daysBetween(now, date),
      lines,
      unitsToMake: sum(lines.map((l) => l.toMake)),
      makeHours, cumMakeHours, commissionHours, demandHours, capacityHours, ratio, status,
      makeMachineHours, cumMachineHours, machineCapacityHours, machineRatio, handRatio,
      tracksMachine, machineBound,
      paceNeeded: weeksLeft > 0 ? demandHours / weeksLeft : demandHours,
      machinePaceNeeded: weeksLeft > 0 ? cumMachineHours / weeksLeft : cumMachineHours,
      shortfall: Math.max(0, demandHours - capacityHours),
      machineShortfall: Math.max(0, cumMachineHours - machineCapacityHours),
      startBy: weeklyHours > 0 ? new Date(deadline.getTime() - (demandHours / weeklyHours) * MS_WEEK) : null,
    });
  }

  // What belongs on the bench this week, pulled across every upcoming market.
  const weekProducts = products
    .map((p) => {
      const units = perProductWeekly.get(p.id) || 0;
      return {
        product: p, units,
        hours: units * p.hoursEach,
        machineHours: units * (Number(p.machineHoursEach) || 0),
      };
    })
    .filter((x) => x.units > 0)
    .sort((a, b) => b.hours - a.hours);

  const weekCommissions = openCommissions
    .map(({ commission, due }) => {
      const weeksLeft = due ? weeksBetween(now, due) : Infinity;
      const hours = !Number.isFinite(weeksLeft) ? 0
        : weeksLeft > 0 ? Math.min(commission.hours, commission.hours / weeksLeft)
        : commission.hours;
      return { commission, due, weeksLeft, hours };
    })
    .filter((x) => x.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  const makeHours = sum(weekProducts.map((x) => x.hours));
  const machineHours = sum(weekProducts.map((x) => x.machineHours));
  const commissionHours = sum(weekCommissions.map((x) => x.hours));

  return {
    now, weeklyHours, bufferWeeks,
    rows, past, committed,
    freeStock: stock,
    thisWeek: {
      products: weekProducts,
      commissions: weekCommissions,
      makeHours, commissionHours, machineHours,
      totalHours: makeHours + commissionHours,
      capacity: weeklyHours,
      over: makeHours + commissionHours - weeklyHours,
      machineCapacity: machineWeekly,
      machineOver: tracksMachine ? machineHours - machineWeekly : 0,
      tracksMachine,
    },
    totals: {
      unitsToMake: sum(rows.map((r) => r.unitsToMake)),
      hoursToMake: sum(rows.map((r) => r.makeHours)),
      machineHoursToMake: sum(rows.map((r) => r.makeMachineHours)),
    },
  };
}

/* -------------------------------------------------------------------- views */

function viewPlan(plan) {
  const out = [];

  if (!liveProducts().length || !live(state.markets).length) {
    out.push(h('div', { class: 'empty' },
      h('strong', { text: 'Nothing to plan yet' }),
      h('p', { class: 'small', style: 'margin:6px 0 14px' },
        'Add what you make under ', h('b', { text: 'Stock' }),
        ', then add a market with a date and per-item targets. Or load your usual ',
        'market goods and the September fair as a starting point.'),
      h('button', { class: 'btn btn-sm', onclick: () => { go(liveProducts().length ? 'markets' : 'stock'); } },
        liveProducts().length ? 'Add a market' : 'Add your first item'),
      ' ',
      h('button', { class: 'btn btn-sm', onclick: loadStartingSetup }, 'Load starting setup')));
    return out;
  }

  out.push(weekCard(plan));

  out.push(h('div', {},
    h('div', { class: 'section-head' },
      h('h2', { text: 'Upcoming markets' }),
      plan.totals.unitsToMake > 0
        ? h('p', { text: `${plural(plan.totals.unitsToMake, 'piece')} still to make · ${fmtHours(plan.totals.hoursToMake)} of bench time` })
        : h('p', { text: 'Every target is covered by stock on hand.' })),
    h('div', { class: 'stack' },
      plan.rows.length
        ? plan.rows.map(marketPlanCard)
        : h('div', { class: 'empty' }, h('strong', { text: 'No upcoming markets' }),
            'Add one under Markets to start counting backwards from the date.'))));

  return out;
}

function weekCard(plan) {
  const w = plan.thisWeek;
  const status = w.totalHours === 0 ? 'ok' : w.over > 0.05 ? 'behind' : w.totalHours > w.capacity * 0.85 ? 'tight' : 'ok';
  const pct = w.capacity > 0 ? Math.min(100, (w.totalHours / w.capacity) * 100) : (w.totalHours > 0 ? 100 : 0);

  const body = [
    h('div', { class: 'spread' },
      h('h2', { style: 'margin:0;font-size:16px', text: 'This week at the bench' }),
      h('span', { class: `pill ${status}` },
        w.totalHours === 0 ? 'Clear' : w.over > 0.05 ? `${fmtHours(w.over)} over` : `${fmtHours(w.capacity - w.totalHours)} spare`)),
  ];

  if (w.totalHours === 0) {
    body.push(h('p', { class: 'small muted', style: 'margin:8px 0 0' },
      'Nothing needs to be on the bench this week to hit your targets.'));
  } else {
    body.push(h('ul', { class: 'lines' },
      w.products.map(({ product, units, hours }) => h('li', {},
        h('span', { class: 'line-name' }, h('b', { text: `${units}×` }), ' ', product.name),
        h('span', { class: 'line-num muted tiny', text: fmtHours(hours) }))),
      w.commissions.map(({ commission, due }) => h('li', {},
        h('span', { class: 'line-name' },
          h('span', { class: 'muted', text: 'commission · ' }), commission.name,
          due ? h('span', { class: 'muted tiny', text: ` (due ${fmtDate(due)})` }) : null),
        h('span', { class: 'line-num muted tiny', text: fmtHours(commissionsWeekHours(w, commission.id)) })))));

    body.push(h('div', { class: `bar ${status}` }, h('i', { style: `width:${pct}%` })));
    body.push(h('p', { class: 'small muted', style: 'margin:8px 0 0' },
      `${fmtHours(w.totalHours)} of your own time against ${fmtHours(w.capacity)} available`,
      w.commissionHours > 0 ? ` (${fmtHours(w.commissionHours)} of it commission work)` : '',
      '.',
      w.tracksMachine && w.machineHours > 0.01
        ? ` Plus ${fmtHours(w.machineHours)} on the machine, against ${fmtHours(w.machineCapacity)} of run time — that runs without you.`
        : ''));
    if (w.tracksMachine && w.machineOver > 0.05) {
      body.push(h('div', { class: 'verdict tight' },
        `The machine is ${fmtHours(w.machineOver)} over for the week. Queue a job before you leave in the morning, or add a weekend run.`));
    }

    if (w.over > 0.05) {
      body.push(h('div', { class: 'verdict behind' },
        `You are ${fmtHours(w.over)} short this week. `,
        w.commissionHours > 0.01
          ? 'Either find the time, trim a target, or push a commission out — leaving it will cost you at the next market.'
          : 'Either find the time or trim a target — leaving it will cost you at the market.'));
    }
  }

  return h('section', { class: `card edge ${status}` }, h('div', { class: 'card-body' }, body));
}

function commissionsWeekHours(week, id) {
  const found = week.commissions.find((c) => c.commission.id === id);
  return found ? found.hours : 0;
}

function marketPlanCard(r) {
  const body = [];

  body.push(h('div', { class: 'spread' },
    h('div', {},
      h('h3', { style: 'margin:0;font-size:15.5px', text: r.market.name }),
      h('p', { class: 'small muted', style: 'margin:2px 0 0' },
        `${fmtDate(r.date)} · ${relDays(r.daysToMarket)}`,
        r.market.notes ? ` · ${r.market.notes}` : '')),
    h('span', { class: `pill ${r.status}` },
      r.status === 'behind' ? 'Behind' : r.status === 'tight' ? 'Tight' : 'On track')));

  body.push(h('div', { class: 'metrics' },
    h('div', { class: 'metric' }, h('b', { text: String(r.unitsToMake) }), h('span', { text: 'to make' })),
    h('div', { class: 'metric' }, h('b', { text: fmtHours(r.makeHours) }), h('span', { text: 'bench time' })),
    h('div', { class: 'metric' }, h('b', { text: fmtRate(r.paceNeeded) }), h('span', { text: 'hrs needed' })),
    r.tracksMachine && r.makeMachineHours > 0.01
      ? h('div', { class: `metric ${r.machineShortfall > 0.05 ? 'warn' : ''}` },
          h('b', { text: fmtHours(r.makeMachineHours) }), h('span', { text: 'machine time' }))
      : null,
    h('div', { class: `metric ${r.shortfall > 0.05 ? 'warn' : ''}` },
      h('b', { text: r.shortfall > 0.05 ? `-${fmtHours(r.shortfall)}` : fmtHours(Math.max(0, r.capacityHours - r.demandHours)) }),
      h('span', { text: r.shortfall > 0.05 ? 'short by' : 'slack' }))));

  // Pace and slack are cumulative; spell out what else is competing for the same weeks.
  if (r.demandHours > r.makeHours + 0.01) {
    const earlier = r.cumMakeHours - r.makeHours;
    const parts = [];
    if (earlier > 0.01) parts.push(`${fmtHours(earlier)} for earlier markets`);
    if (r.commissionHours > 0.01) parts.push(`${fmtHours(r.commissionHours)} of commission work`);
    body.push(h('p', { class: 'tiny muted', style: 'margin:10px 0 0' },
      `Pace and slack count every hands-on hour due by ${fmtDate(r.deadline)}: ${fmtHours(r.makeHours)} for this market plus ${parts.join(' and ')}.`,
      r.tracksMachine && r.cumMachineHours > 0.01
        ? ` Machine time is counted separately — ${fmtHours(r.cumMachineHours)} against ${fmtHours(r.machineCapacityHours)} of run time.`
        : ''));
  }

  body.push(verdictFor(r));

  if (r.lines.length) {
    body.push(h('ul', { class: 'lines' }, r.lines.map((l) => h('li', {},
      h('span', { class: 'line-name' }, l.product.name,
        h('span', { class: 'muted tiny', text: ` · target ${l.target}` })),
      l.toMake > 0
        ? h('span', { class: 'line-num' },
            h('b', { text: `make ${l.toMake}` }),
            h('span', { class: 'muted tiny', text: ` · ${fmtHours(l.hours)} hands-on${l.machineHours > 0.01 ? ` · ${fmtHours(l.machineHours)} machine` : ''}${l.fromStock ? ` · ${l.fromStock} from stock` : ''}` }))
        : h('span', { class: 'line-num line-ok tiny', text: `covered (${l.fromStock} from stock)` })))));
  } else {
    body.push(h('p', { class: 'small muted', style: 'margin:12px 0 0' },
      'No targets set for this market yet — set them under Markets.'));
  }

  return h('article', { class: `card edge ${r.status}` }, h('div', { class: 'card-body' }, body));
}

function verdictFor(r) {
  if (r.demandHours <= 0) {
    return h('div', { class: 'verdict ok' }, 'Stock already covers this one. Nothing to build.');
  }
  if (r.weeksLeft <= 0) {
    return h('div', { class: 'verdict behind' },
      `Your finish-by date has passed. ${fmtHours(r.demandHours)} of work is still outstanding.`);
  }
  if (r.status === 'behind' && r.machineBound) {
    return h('div', { class: 'verdict behind' },
      `The machine is the bottleneck, not you. `,
      `${fmtHours(r.cumMachineHours)} of run time is needed by then but only ${fmtHours(r.machineCapacityHours)} is available — `,
      `${fmtHours(r.machineShortfall)} short. Start the jobs earlier in the day, run them at weekends too, or cut a target.`);
  }
  if (r.status === 'behind') {
    // Hours left for this build once commissions and earlier markets take their cut.
    const earlierBuilds = r.cumMakeHours - r.makeHours;
    const forThisBuild = Math.max(0, r.capacityHours - r.commissionHours - earlierBuilds);
    const hoursPerPiece = Math.max(0.1, r.makeHours / Math.max(1, r.unitsToMake));
    const canDo = Math.min(r.unitsToMake, Math.floor(forThisBuild / hoursPerPiece));
    return h('div', { class: 'verdict behind' },
      `Needs ${fmtRate(r.paceNeeded)} but only ${fmtHours(r.capacityHours)} remain before the finish-by date — ${fmtHours(r.shortfall)} short. `,
      `At your current hours you arrive with about ${canDo} of ${r.unitsToMake} pieces. `,
      r.commissionHours > 0.01
        ? 'Start now, cut the target, or clear a commission.'
        : 'Start now, or cut the target.');
  }
  const startBy = r.startBy;
  const startTxt = startBy
    ? (startBy <= today0()
        ? 'This needs to be underway now.'
        : `Latest you can start at full hours: ${fmtDate(startBy)} (${relDays(daysBetween(today0(), startBy))}).`)
    : 'Set your weekly hours in Settings to get a start-by date.';
  return h('div', { class: `verdict ${r.status}` },
    `${fmtRate(r.paceNeeded)} of bench time gets you there`,
    r.tracksMachine && r.cumMachineHours > 0.01
      ? `, with ${fmtRate(r.machinePaceNeeded)} of machine time alongside it. `
      : '. ',
    startTxt);
}

/* ---------------------------------------------------------------- stock view */

function viewStock(plan) {
  const out = [];

  out.push(h('div', { class: 'section-head' },
    h('h2', { text: 'What you make' }),
    h('p', { text: 'Hours-each drives every estimate. Keep counts honest — update them after a build session and after a market.' })));

  if (liveProducts().length) {
    out.push(h('div', { class: 'stack' }, liveProducts().map((p) => productCard(p, plan))));
  } else {
    out.push(h('div', { class: 'empty' },
      h('strong', { text: 'No items yet' }),
      'Add the things you sell — one row per item, with how long one takes you.'));
  }

  out.push(h('form', {
    class: 'add-form',
    onsubmit: (e) => {
      e.preventDefault();
      const f = e.target;
      const name = f.name.value.trim();
      if (!name) return;
      addRecord('products', {
        id: uid(), name,
        hoursEach: Math.max(0, num(f.hours.value, 1)),
        machineHoursEach: Math.max(0, num(f.machinehours.value, 0)),
        onHand: Math.max(0, Math.round(num(f.onhand.value, 0))),
      });
    },
  },
    h('h3', { text: 'Add an item' }),
    h('div', { class: 'row' },
      h('label', { class: 'field w-name' }, h('span', { text: 'Item' }),
        h('input', { type: 'text', name: 'name', placeholder: 'Cooking spoon', required: true })),
      h('label', { class: 'field w-num' }, h('span', { text: 'Hands-on hrs' }),
        h('input', { type: 'number', name: 'hours', min: '0', step: '0.25', value: '1', inputMode: 'decimal' })),
      h('label', { class: 'field w-num' }, h('span', { text: 'Machine hrs' }),
        h('input', { type: 'number', name: 'machinehours', min: '0', step: '0.25', value: '0', inputMode: 'decimal' })),
      h('label', { class: 'field w-num' }, h('span', { text: 'On hand' }),
        h('input', { type: 'number', name: 'onhand', min: '0', step: '1', value: '0', inputMode: 'numeric' })),
      h('button', { class: 'btn btn-primary', type: 'submit', style: 'align-self:flex-end' }, 'Add'))));

  return out;
}

function productCard(p, plan) {
  const committed = plan.committed.get(p.id) || 0;
  const free = Math.max(0, p.onHand - committed);
  const setCount = (n) => editRecord('products', p.id, (t) => { t.onHand = Math.max(0, Math.round(n)); });

  return h('article', { class: 'card' }, h('div', { class: 'card-body' },
    h('div', { class: 'spread' },
      h('div', { style: 'flex:1 1 180px;min-width:0' },
        h('input', {
          type: 'text', value: p.name, 'aria-label': 'Item name',
          style: 'font-weight:600;border-color:transparent;background:transparent;padding-left:0',
          onchange: (e) => editRecord('products', p.id, (t) => { t.name = e.target.value.trim() || t.name; }),
        }),
        h('div', { class: 'row small muted', style: 'gap:6px;margin-top:2px' },
          h('input', {
            type: 'number', min: '0', step: '0.25', value: String(p.hoursEach), inputMode: 'decimal',
            'aria-label': 'Hours each', style: 'width:72px;padding:3px 6px',
            onchange: (e) => editRecord('products', p.id, (t) => { t.hoursEach = Math.max(0, num(e.target.value, t.hoursEach)); }),
          }),
          h('span', { text: 'hours each' }))),
      h('div', { class: 'row', style: 'gap:8px' },
        h('div', { class: 'stepper' },
          h('button', { type: 'button', 'aria-label': `One fewer ${p.name}`, onclick: () => setCount(p.onHand - 1) }, '−'),
          h('input', {
            type: 'number', min: '0', step: '1', value: String(p.onHand), inputMode: 'numeric',
            'aria-label': `${p.name} on hand`,
            onchange: (e) => setCount(num(e.target.value, p.onHand)),
          }),
          h('button', { type: 'button', 'aria-label': `One more ${p.name}`, onclick: () => setCount(p.onHand + 1) }, '+')),
        h('button', { class: 'btn btn-sm', type: 'button', title: 'Logged a build session', onclick: () => setCount(p.onHand + 5) }, '+5'),
        h('button', {
          class: 'btn btn-sm btn-quiet btn-danger', type: 'button', 'aria-label': `Delete ${p.name}`,
          onclick: () => {
            if (!confirm(`Delete "${p.name}"? Its targets will be removed from every market.`)) return;
            update((s) => {
              const t = s.products.find((x) => x.id === p.id);
              if (t) { t.deleted = true; touch(t); }
              s.markets.forEach((m) => {
                if (m.targets[p.id] != null) { delete m.targets[p.id]; touch(m); }
              });
            });
          },
        }, 'Delete'))),
    h('p', { class: 'tiny muted', style: 'margin:8px 0 0' },
      committed > 0
        ? `${p.onHand} on hand · ${committed} spoken for by upcoming markets · ${free} free`
        : `${p.onHand} on hand · none committed yet`)));
}

/* -------------------------------------------------------------- markets view */

function viewMarkets(plan) {
  const out = [];

  out.push(h('div', { class: 'section-head' },
    h('h2', { text: 'Markets' }),
    h('p', { text: 'Set how many of each item you want on the table. Targets are what you would like to bring, not what you have.' })));

  if (plan.rows.length) {
    out.push(h('div', { class: 'stack' }, plan.rows.map((r) => marketEditCard(r.market, r))));
  } else {
    out.push(h('div', { class: 'empty' },
      h('strong', { text: 'No upcoming markets' }),
      'Add the next fair below and work backwards from its date.'));
  }

  out.push(h('form', {
    class: 'add-form',
    onsubmit: (e) => {
      e.preventDefault();
      const f = e.target;
      const name = f.name.value.trim();
      if (!name || !f.date.value) return;
      const id = uid();
      openEditors.add(id);
      addRecord('markets', { id, name, date: f.date.value, notes: f.notes.value.trim(), targets: {} });
    },
  },
    h('h3', { text: 'Add a market' }),
    h('div', { class: 'row' },
      h('label', { class: 'field w-name' }, h('span', { text: 'Market' }),
        h('input', { type: 'text', name: 'name', placeholder: 'West Orange Fall Fair', required: true })),
      h('label', { class: 'field w-date' }, h('span', { text: 'Date' }),
        h('input', { type: 'date', name: 'date', required: true })),
      h('label', { class: 'field w-name' }, h('span', { text: 'Note (optional)' }),
        h('input', { type: 'text', name: 'notes', placeholder: '2-day, outdoor' })),
      h('button', { class: 'btn btn-primary', type: 'submit', style: 'align-self:flex-end' }, 'Add'))));

  if (plan.past.length) {
    out.push(h('details', {},
      h('summary', { class: 'small muted', style: 'cursor:pointer;padding:6px 0' },
        `Past markets (${plan.past.length})`),
      h('div', { class: 'stack', style: 'margin-top:10px' },
        plan.past.map(({ market, date }) => h('article', { class: 'card' }, h('div', { class: 'card-body spread' },
          h('div', {},
            h('b', { text: market.name }),
            h('p', { class: 'tiny muted', style: 'margin:2px 0 0', text: date ? fmtDate(date) : 'no date set' })),
          h('div', { class: 'row', style: 'gap:6px' },
            h('button', {
              class: 'btn btn-sm', type: 'button',
              onclick: () => {
                const next = prompt(`Copy "${market.name}" targets to a new market. Date (YYYY-MM-DD)?`, toISO(new Date(Date.now() + 90 * MS_DAY)));
                if (!next || !parseDate(next)) return;
                addRecord('markets', {
                  id: uid(), name: market.name, date: next, notes: market.notes, targets: { ...market.targets },
                });
              },
            }, 'Repeat'),
            h('button', {
              class: 'btn btn-sm btn-quiet btn-danger', type: 'button',
              onclick: () => {
                if (!confirm(`Delete "${market.name}"?`)) return;
                removeRecord('markets', market.id);
              },
            }, 'Delete'))))))));
  }

  return out;
}

function marketEditCard(m, r) {
  const isOpen = openEditors.has(m.id);
  const setTarget = (pid, v) => editRecord('markets', m.id, (t) => {
    const n = Math.max(0, Math.round(num(v, 0)));
    if (n > 0) t.targets[pid] = n; else delete t.targets[pid];
  });

  return h('article', { class: 'card' }, h('div', { class: 'card-body' },
    h('div', { class: 'row', style: 'gap:8px;align-items:flex-end' },
      h('label', { class: 'field w-name' }, h('span', { text: 'Market' }),
        h('input', {
          type: 'text', value: m.name,
          onchange: (e) => editRecord('markets', m.id, (t) => { t.name = e.target.value.trim() || t.name; }),
        })),
      h('label', { class: 'field w-date' }, h('span', { text: 'Date' }),
        h('input', {
          type: 'date', value: m.date,
          onchange: (e) => editRecord('markets', m.id, (t) => { if (e.target.value) t.date = e.target.value; }),
        })),
      h('button', {
        class: 'btn btn-sm btn-quiet btn-danger', type: 'button',
        onclick: () => {
          if (!confirm(`Delete "${m.name}"?`)) return;
          removeRecord('markets', m.id);
        },
      }, 'Delete')),

    h('p', { class: 'tiny muted', style: 'margin:8px 0 0' },
      `${relDays(r.daysToMarket)} · finish by ${fmtDate(r.deadline)} · `,
      r.unitsToMake > 0 ? `${plural(r.unitsToMake, 'piece')} to make` : 'covered by stock'),

    h('details', {
      class: 'market-edit', open: isOpen,
      ontoggle: (e) => { if (e.target.open) openEditors.add(m.id); else openEditors.delete(m.id); },
    },
      h('summary', { text: `Targets (${Object.keys(m.targets).length} of ${liveProducts().length} items)` }),
      liveProducts().length
        ? h('div', { class: 'targets' }, liveProducts().map((p) => [
            h('label', { class: 't-name', for: `t-${m.id}-${p.id}` }, p.name,
              h('span', { class: 'muted tiny', text: ` · ${p.onHand} on hand` })),
            h('input', {
              id: `t-${m.id}-${p.id}`, type: 'number', min: '0', step: '1', inputMode: 'numeric',
              value: String(num(m.targets[p.id], 0)),
              onchange: (e) => setTarget(p.id, e.target.value),
            }),
          ]))
        : h('p', { class: 'small muted' }, 'Add items under Stock first.'))));
}

/* ---------------------------------------------------------- commissions view */

function viewCommissions(plan) {
  const out = [];

  out.push(h('div', { class: 'section-head' },
    h('h2', { text: 'Commissions & other claims on your time' }),
    h('p', { text: 'This is the part that ate West Orange. Anything logged here is subtracted from the hours available for market stock.' })));

  const open = live(state.commissions).filter((c) => !c.done);
  const done = live(state.commissions).filter((c) => c.done);
  const openHours = sum(open.map((c) => c.hours));

  if (open.length) {
    out.push(h('p', { class: 'small muted', style: 'margin:0 0 10px' },
      `${plural(open.length, 'open commission')} · ${fmtHours(openHours)} committed`));
  }

  const rows = [...open, ...done];
  if (rows.length) {
    out.push(h('div', { class: 'stack' }, rows.map((c) => commissionCard(c))));
  } else {
    out.push(h('div', { class: 'empty' },
      h('strong', { text: 'No commissions logged' }),
      'Add one the moment you accept it, so the plan sees the hours going out the door.'));
  }

  out.push(h('form', {
    class: 'add-form',
    onsubmit: (e) => {
      e.preventDefault();
      const f = e.target;
      const name = f.name.value.trim();
      if (!name) return;
      addRecord('commissions', {
        id: uid(), name, hours: Math.max(0, num(f.hours.value, 0)), due: f.due.value, done: false,
      });
    },
  },
    h('h3', { text: 'Add a commission' }),
    h('div', { class: 'row' },
      h('label', { class: 'field w-name' }, h('span', { text: 'What' }),
        h('input', { type: 'text', name: 'name', placeholder: 'Wedding spoon set', required: true })),
      h('label', { class: 'field w-num' }, h('span', { text: 'Hours' }),
        h('input', { type: 'number', name: 'hours', min: '0', step: '0.5', value: '4', inputMode: 'decimal' })),
      h('label', { class: 'field w-date' }, h('span', { text: 'Due' }),
        h('input', { type: 'date', name: 'due' })),
      h('button', { class: 'btn btn-primary', type: 'submit', style: 'align-self:flex-end' }, 'Add'))));

  return out;
}

function commissionCard(c) {
  const due = parseDate(c.due);
  return h('article', { class: `card ${c.done ? 'is-done' : ''}` }, h('div', { class: 'card-body spread' },
    h('label', { class: 'checkline', style: 'flex:1 1 200px;min-width:0' },
      h('input', {
        type: 'checkbox', checked: c.done,
        onchange: () => editRecord('commissions', c.id, (t) => { t.done = !t.done; }),
      }),
      h('span', { class: 'line-name' }, c.name,
        h('span', { class: 'muted tiny' },
          ` · ${fmtHours(c.hours)}`, due ? ` · due ${fmtDate(due)}` : ' · no due date'))),
    h('div', { class: 'row', style: 'gap:6px' },
      due && !c.done ? h('span', { class: `pill ${due < today0() ? 'behind' : 'done'}`, text: relDays(daysBetween(today0(), due)) }) : null,
      h('button', {
        class: 'btn btn-sm btn-quiet btn-danger', type: 'button',
        onclick: () => removeRecord('commissions', c.id),
      }, 'Delete'))));
}

/* ------------------------------------------------------------- settings view */

function viewSettings() {
  const s = state.settings;
  const out = [];

  out.push(h('section', { class: 'card' }, h('div', { class: 'card-body' },
    h('h2', { style: 'margin:0 0 4px;font-size:16px', text: 'Your capacity' }),
    h('p', { class: 'small muted', style: 'margin:0 0 12px' },
      'Be realistic rather than optimistic. This number is the whole point — an honest 6 hours beats a hopeful 15.'),
    h('div', { class: 'row' },
      h('label', { class: 'field w-num' }, h('span', { text: 'Hours / week' }),
        h('input', {
          type: 'number', min: '0', step: '0.5', value: String(s.weeklyHours), inputMode: 'decimal',
          onchange: (e) => update((st) => {
            st.settings.weeklyHours = Math.max(0, num(e.target.value, st.settings.weeklyHours));
            touch(st.settings);
          }),
        })),
      h('label', { class: 'field w-num' }, h('span', { text: 'Buffer weeks' }),
        h('input', {
          type: 'number', min: '0', step: '0.5', value: String(s.bufferWeeks), inputMode: 'decimal',
          onchange: (e) => update((st) => {
            st.settings.bufferWeeks = Math.max(0, num(e.target.value, st.settings.bufferWeeks));
            touch(st.settings);
          }),
        })),
      h('label', { class: 'field w-num' }, h('span', { text: 'Machine hrs / week' }),
        h('input', {
          type: 'number', min: '0', step: '1', value: String(s.machineHoursPerWeek || 0), inputMode: 'decimal',
          onchange: (e) => update((st) => {
            st.settings.machineHoursPerWeek = Math.max(0, num(e.target.value, st.settings.machineHoursPerWeek));
            touch(st.settings);
          }),
        }))),
    h('p', { class: 'tiny muted', style: 'margin:10px 0 0' },
      'Buffer weeks finish your build early, so oiling, pricing and packing are not part of the sprint. ',
      'Machine hours are the hours the CNC can run unattended in a week — while you are at school, say. ',
      'They are counted separately, because a job running without you does not cost you bench time. ',
      'Leave it at 0 if you would rather not track it.'))));

  out.push(syncCard());

  out.push(h('section', { class: 'card' }, h('div', { class: 'card-body' },
    h('h2', { style: 'margin:0 0 4px;font-size:16px', text: 'Your data' }),
    h('p', { class: 'small muted', style: 'margin:0 0 12px' },
      'Saved in this browser only. Clearing site data wipes it — keep an exported copy somewhere safe. ',
      h('em', {}, 'Load starting setup'),
      ' fills in your usual market goods with placeholder hours — correct them under Stock.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onclick: exportJSON }, 'Export backup'),
      h('button', { class: 'btn', type: 'button', onclick: copyJSON }, 'Copy as JSON'),
      h('label', { class: 'btn', style: 'cursor:pointer' }, 'Import backup',
        h('input', { type: 'file', accept: 'application/json,.json', style: 'display:none', onchange: importJSON })),
      h('button', { class: 'btn', type: 'button', onclick: loadStartingSetup }, 'Load starting setup'),
      h('button', {
        class: 'btn btn-danger', type: 'button',
        onclick: () => {
          if (!confirm('Erase everything and start over? Export a backup first if you want one.')) return;
          state = blankState();
          save();
          go('plan');
        },
      }, 'Erase everything')))));

  out.push(h('section', { class: 'card' }, h('div', { class: 'card-body' },
    h('h2', { style: 'margin:0 0 8px;font-size:16px', text: 'How the numbers work' }),
    h('ul', { class: 'small muted', style: 'margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px' },
      h('li', {}, 'Stock is one shared pool. The nearest market draws from it first; later markets only count what is left over.'),
      h('li', {}, 'Each market’s deadline has to cover every hour due by then — its own build, all earlier markets’ builds, and any commission due in the same window.'),
      h('li', {}, 'Available hours = weekly hours × weeks until the finish-by date (market date minus your buffer).'),
      h('li', {}, 'Demand above available hours is a shortfall, and it is reported the day it appears rather than the week before the fair.')))));

  return out;
}

function syncCard() {
  const sync = window.BenchSync;
  if (!sync) {
    return h('section', { class: 'card' }, h('div', { class: 'card-body' },
      h('h2', { style: 'margin:0 0 4px;font-size:16px', text: 'Sync across devices' }),
      h('p', { class: 'small muted', style: 'margin:0' },
        'sync.js is not loaded, so this copy is local to this browser only.')));
  }

  const connected = sync.isConfigured();
  const body = [
    h('h2', { style: 'margin:0 0 4px;font-size:16px', text: 'Sync across devices' }),
    h('p', { class: 'small muted', style: 'margin:0 0 12px' },
      connected
        ? 'This browser is sharing one dataset with your other devices. Edits sync a second or two after you make them, and queue up while offline.'
        : 'Without this, every browser keeps its own separate copy. Point this at your sync Worker to share one dataset between phone and laptop.'),
  ];

  if (connected) {
    body.push(h('p', { id: 'sync-status-line', class: 'small', style: 'margin:0 0 10px' }, '…'));
    body.push(h('p', { class: 'tiny muted', style: 'margin:0 0 12px;overflow-wrap:anywhere' }, sync.config().url));
    body.push(h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onclick: () => sync.syncNow() }, 'Sync now'),
      h('button', {
        class: 'btn btn-danger', type: 'button',
        onclick: () => {
          if (!confirm('Stop syncing on this device? Your data stays here and on the server, they just stop talking.')) return;
          sync.disconnect();
          render();
        },
      }, 'Disconnect this device')));
  } else {
    body.push(h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        const f = e.target;
        const btn = f.querySelector('button[type=submit]');
        const url = f.url.value.trim();
        const pass = f.pass.value;
        btn.disabled = true;
        btn.textContent = 'Connecting…';
        let res = await sync.connect(url, pass);
        if (res.needsChoice) {
          const useRemote = confirm(
            'Both this device and the shared copy already have data.\n\n' +
            'OK — replace what is on this device with the shared copy.\n' +
            'Cancel — merge the two together (nothing is lost, but you may see duplicates).'
          );
          res = await sync.connect(url, pass, useRemote ? 'replace' : 'merge');
        }
        btn.disabled = false;
        btn.textContent = 'Connect';
        if (!res.ok && res.error) alert(res.error);
        render();
      },
    },
      h('div', { class: 'stack', style: 'gap:10px' },
        h('label', { class: 'field' }, h('span', { text: 'Sync URL' }),
          h('input', { type: 'text', name: 'url', placeholder: '/api/bench', value: '/api/bench', required: true })),
        h('label', { class: 'field' }, h('span', { text: 'Passphrase' }),
          h('input', { type: 'password', name: 'pass', placeholder: 'the one you set on the Worker', required: true })),
        h('div', {}, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Connect')))));
    body.push(h('p', { class: 'tiny muted', style: 'margin:12px 0 0' },
      'The passphrase is stored in this browser so you only type it once per device. It is never part of the page itself, so publishing this page does not expose it.'));
  }

  return h('section', { class: 'card' }, h('div', { class: 'card-body' }, body));
}

/* -------------------------------------------------------------- data actions */

function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `bench-backup-${toISO(new Date())}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyJSON() {
  const text = JSON.stringify(state, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    alert('Copied. Paste it somewhere safe.');
  } catch {
    prompt('Copy this:', text);
  }
}

function importJSON(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!Array.isArray(data.products) || !Array.isArray(data.markets)) throw new Error('Not a Bench backup');
      if (!confirm('Replace everything currently in the app with this backup?')) return;
      state = normalize(data);
      save();
      go('plan');
    } catch (err) {
      alert(`Could not read that file: ${err.message}`);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* The starting setup: Max's usual market goods and the next fair.
   The hours-each figures are placeholders -- they are the one thing only he
   can supply, and every number in the app derives from them, so the app says
   so rather than letting a guess pass for a measurement. Shelf counts start at
   zero for the same reason: better to show nothing than to invent stock. */
function loadStartingSetup() {
  if (liveProducts().length || live(state.markets).length) {
    if (!confirm('Replace what is here with the starting setup?')) return;
  }
  const now = Date.now();
  const p = (name, hoursEach, machineHoursEach = 0) =>
    ({ id: uid(), name, hoursEach, machineHoursEach, onHand: 0, updatedAt: now });

  // Spoons are CNC work: a little setup and finishing from you, the rest run
  // unattended. Split that way they cost you far less than the clock suggests.
  const board = p('Cutting board', 2.5);
  const spoon = p('Hand-carved spoon', 0.4, 1);
  const coaster = p('Coaster set (4)', 1.25);
  const vaseSmall = p('Bud vase — small', 1);
  const vaseLarge = p('Bud vase — large', 1.5);
  const camera = p('Toy camera', 1.5);

  state = {
    version: 2,
    // No buffer: the fair is close enough that finishing a week early is not
    // on the table, and a buffer would put the finish-by date in the past.
    settings: { weeklyHours: 8, bufferWeeks: 0, machineHoursPerWeek: 30, updatedAt: now },
    products: [board, spoon, coaster, vaseSmall, vaseLarge, camera],
    markets: [{
      id: uid(), name: 'Bakers Street — September', date: '2026-09-19',
      notes: 'confirm load-in time', updatedAt: now,
      targets: {
        [board.id]: 3,
        [spoon.id]: 20,
        [coaster.id]: 12,
        [vaseSmall.id]: 6,
        [vaseLarge.id]: 4,
        [camera.id]: 4,
      },
    }],
    commissions: [],
  };
  save();
  go('stock');
}

/* ------------------------------------------------------------------- render */

function go(next) { view = next; render(); }

function render() {
  const plan = computePlan(state);

  document.querySelectorAll('#tabs .tab').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.view === view);
  });

  const chip = document.getElementById('capacity-chip');
  const w = plan.thisWeek;
  chip.replaceChildren();
  if (liveProducts().length) {
    chip.append(h('span', {}, 'this week: ', h('strong', { text: fmtHours(w.totalHours) }), ` of ${fmtHours(w.capacity)}`));
  } else {
    chip.append(h('span', { text: `${fmtHours(plan.weeklyHours)}/week available` }));
  }

  const main = document.getElementById('app');
  main.replaceChildren();
  const views = { plan: viewPlan, stock: viewStock, markets: viewMarkets, commissions: viewCommissions, settings: viewSettings };
  main.append(...[views[view](plan)].flat(Infinity).filter(Boolean));
  if (typeof window.renderSyncStatus === 'function') window.renderSyncStatus();
}

/* ------------------------------------------------------------ sync bridge */

window.Bench = {
  getState: () => state,
  normalize: (data) => normalize(data),
  hasData: () => liveProducts().length > 0 || live(state.markets).length > 0,
  setState(next) { state = normalize(next); save(); render(); },
  merge(remote) {
    state = mergeStates(state, normalize(remote));
    save();
    render();
    return state;
  },
};

function fmtAgo(ts) {
  if (!ts) return 'never';
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 45) return 'just now';
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}

const SYNC_LABELS = {
  off: ['', ''],
  syncing: ['syncing…', 'tight'],
  synced: ['synced', 'ok'],
  offline: ['offline — queued', 'tight'],
  auth: ['passphrase rejected', 'behind'],
  error: ['sync failed', 'behind'],
};

/* Updated in place rather than through render(), so a background sync landing
   mid-keystroke cannot pull focus out of the field being typed into. */
window.renderSyncStatus = function renderSyncStatus() {
  const sync = window.BenchSync;
  const chip = document.getElementById('sync-chip');
  if (!chip) return;
  if (!sync || !sync.isConfigured()) {
    chip.hidden = true;
    const off = document.getElementById('foot-note');
    if (off) off.textContent = 'Everything is stored in this browser only. Export a backup from Settings now and then.';
    return;
  }
  const [label, tone] = SYNC_LABELS[sync.state.status] || SYNC_LABELS.error;
  chip.hidden = false;
  chip.className = `capsule sync-${tone}`;
  chip.textContent = sync.state.status === 'synced' ? `synced ${fmtAgo(sync.lastSyncAt())}` : label;
  chip.title = sync.state.message || '';

  const foot = document.getElementById('foot-note');
  if (foot) {
    foot.textContent = sync.isConfigured()
      ? 'Shared with your other devices through your own sync Worker. Export a backup from Settings now and then.'
      : 'Everything is stored in this browser only. Export a backup from Settings now and then.';
  }

  const line = document.getElementById('sync-status-line');
  if (line) {
    line.textContent = sync.state.status === 'synced'
      ? `Up to date — last synced ${fmtAgo(sync.lastSyncAt())}.`
      : `${label}${sync.state.message ? ` — ${sync.state.message}` : ''}`;
  }
};

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (btn) go(btn.dataset.view);
});

render();
