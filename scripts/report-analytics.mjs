#!/usr/bin/env node
/**
 * Weekly analytics report, straight from Workers Analytics Engine.
 *
 *   CF_ACCOUNT_ID=... CF_API_TOKEN=... pnpm report:analytics
 *   CF_ACCOUNT_ID=... CF_API_TOKEN=... pnpm report:analytics --days 30
 *
 * Why this exists: `functions/api/event.ts` writes events, but Analytics Engine only exposes a SQL API —
 * there is no dashboard for "daily actives / top tools / failure rate". Without this script the data
 * accumulates for three months (the retention window) and is then deleted unread.
 *
 * Environment:
 *   CF_ACCOUNT_ID   Cloudflare account id (dash → any Workers page → right sidebar)
 *   CF_API_TOKEN    API token with **Account → Analytics → Read**
 *   AE_DATASET      Analytics Engine dataset name (the *dataset*, not the binding variable), default `syntools_events`
 *
 * Column map written by the collector: blob1 = event name, blob2 = tool id, blob3 = UI language,
 * blob4 = "k=v&k=v" properties; doubles1 = elapsed ms; index1 = random per-tab session id.
 *
 * Exit code: 0 when every query succeeded, 1 when configuration is missing or any query failed.
 */

const ENDPOINT = 'https://api.cloudflare.com/client/v4/accounts';

const args = process.argv.slice(2);
const daysIndex = args.indexOf('--days');
const DAYS = Number(daysIndex >= 0 ? args[daysIndex + 1] : 7) || 7;

const ACCOUNT_ID = (process.env.CF_ACCOUNT_ID ?? '').trim();
const API_TOKEN = (process.env.CF_API_TOKEN ?? '').trim();
const DATASET = (process.env.AE_DATASET ?? 'syntools_events').trim();

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error(
    [
      'Missing credentials.',
      '',
      '  export CF_ACCOUNT_ID=<account id>',
      '  export CF_API_TOKEN=<token with Account → Analytics → Read>',
      '  pnpm report:analytics',
      '',
      'The dataset name defaults to `syntools_events`; override with AE_DATASET if it differs.',
    ].join('\n'),
  );
  process.exit(1);
}

// The dataset name is interpolated into SQL, so it must never carry anything but identifier characters
if (!/^[a-zA-Z0-9_]+$/.test(DATASET)) {
  console.error(`Illegal AE_DATASET: ${DATASET}`);
  process.exit(1);
}

const WINDOW = `timestamp > NOW() - INTERVAL '${DAYS}' DAY`;

/** Run one SQL statement; returns rows or throws with the Cloudflare error message */
async function query(sql) {
  const res = await fetch(`${ENDPOINT}/${ACCOUNT_ID}/analytics_engine/sql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'text/plain' },
    body: sql,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data ?? [];
}

const num = (value) => Number(value ?? 0);
const pad = (value, width) => String(value).padEnd(width);
const numPad = (value, width) => String(value).padStart(width);

function table(title, rows, columns) {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log('  (no rows)');
    return;
  }
  console.log('  ' + columns.map((c) => pad(c.label, c.width)).join(''));
  for (const row of rows) {
    const line = columns
      .map((c) => (c.right ? numPad(row[c.key] ?? '', c.width) : pad(row[c.key] ?? '', c.width)))
      .join('');
    console.log('  ' + line);
  }
}

async function main() {
  console.log(`SynTools analytics — last ${DAYS} days — dataset ${DATASET}`);

  const failures = [];
  const run = async (label, sql) => {
    try {
      return await query(sql);
    } catch (error) {
      failures.push(label);
      console.log(`\n${label}\n  query failed: ${error.message}`);
      return [];
    }
  };

  const totals = await run(
    'Events',
    `SELECT blob1 AS event, sum(_sample_interval) AS n FROM ${DATASET} WHERE ${WINDOW} GROUP BY event ORDER BY n DESC`,
  );
  const byEvent = Object.fromEntries(totals.map((r) => [r.event, num(r.n)]));
  table(
    'Events',
    totals.map((r) => ({ event: r.event, n: num(r.n) })),
    [
      { key: 'event', label: 'event', width: 18 },
      { key: 'n', label: 'count', width: 10, right: true },
    ],
  );

  const opens = byEvent.tool_open ?? 0;
  const errors = byEvent.tool_error ?? 0;
  const sessions = await run(
    'Sessions',
    `SELECT count(DISTINCT index1) AS sessions FROM ${DATASET} WHERE ${WINDOW}`,
  );
  const searches = byEvent.search_use ?? 0;
  const clicks = byEvent.download_click ?? 0;
  const pricing = byEvent.pricing_view ?? 0;

  console.log('\nKey ratios');
  console.log(`  tool opens      ${numPad(opens, 8)}`);
  console.log(
    `  tool failure    ${numPad(errors, 8)}   ${opens ? ((errors / opens) * 100).toFixed(2) : '0.00'}% of opens`,
  );
  console.log(
    `  search used     ${numPad(searches, 8)}   ${opens ? ((searches / opens) * 100).toFixed(1) : '0.0'}% of opens`,
  );
  console.log(`  installer click ${numPad(clicks, 8)}`);
  console.log(`  pricing views   ${numPad(pricing, 8)}`);
  console.log(
    `  sessions        ${numPad(num(sessions[0]?.sessions), 8)}   (distinct random tab ids)`,
  );

  const daily = await run(
    'Daily',
    `SELECT toStartOfDay(timestamp) AS day, count(DISTINCT index1) AS sessions, sum(_sample_interval) AS events FROM ${DATASET} WHERE ${WINDOW} GROUP BY day ORDER BY day`,
  );
  table(
    'Daily',
    daily.map((r) => ({
      day: String(r.day).slice(0, 10),
      sessions: num(r.sessions),
      events: num(r.events),
    })),
    [
      { key: 'day', label: 'day', width: 14 },
      { key: 'sessions', label: 'sessions', width: 11, right: true },
      { key: 'events', label: 'events', width: 10, right: true },
    ],
  );

  const topTools = await run(
    'Top tools',
    `SELECT blob2 AS tool, sum(_sample_interval) AS opens FROM ${DATASET} WHERE blob1 = 'tool_open' AND ${WINDOW} GROUP BY tool ORDER BY opens DESC LIMIT 15`,
  );
  table(
    'Top tools',
    topTools.map((r) => ({ tool: r.tool || '(unknown)', opens: num(r.opens) })),
    [
      { key: 'tool', label: 'tool', width: 32 },
      { key: 'opens', label: 'opens', width: 9, right: true },
    ],
  );

  const pages = await run(
    'Page views',
    `SELECT blob4 AS props, sum(_sample_interval) AS n FROM ${DATASET} WHERE blob1 = 'page_view' AND ${WINDOW} GROUP BY props ORDER BY n DESC LIMIT 15`,
  );
  table(
    'Page views',
    pages.map((r) => ({ props: r.props || '(none)', n: num(r.n) })),
    [
      { key: 'props', label: 'properties', width: 40 },
      { key: 'n', label: 'views', width: 9, right: true },
    ],
  );

  const search = await run(
    'Search',
    `SELECT blob4 AS props, sum(_sample_interval) AS n FROM ${DATASET} WHERE blob1 = 'search_use' AND ${WINDOW} GROUP BY props ORDER BY n DESC LIMIT 12`,
  );
  table(
    'Search (query length / result count — a row with res=0 is a search that returned nothing)',
    search.map((r) => ({ props: r.props || '(none)', n: num(r.n) })),
    [
      { key: 'props', label: 'properties', width: 40 },
      { key: 'n', label: 'count', width: 9, right: true },
    ],
  );

  const errorRows = await run(
    'Errors',
    `SELECT blob2 AS tool, blob4 AS props, sum(_sample_interval) AS n FROM ${DATASET} WHERE blob1 = 'tool_error' AND ${WINDOW} GROUP BY tool, props ORDER BY n DESC LIMIT 12`,
  );
  table(
    'Errors (by tool and de-identified signature)',
    errorRows.map((r) => ({
      tool: r.tool || '(unknown)',
      props: r.props || '(none)',
      n: num(r.n),
    })),
    [
      { key: 'tool', label: 'tool', width: 28 },
      { key: 'props', label: 'signature', width: 42 },
      { key: 'n', label: 'count', width: 7, right: true },
    ],
  );

  if (failures.length > 0) {
    console.log(`\n${failures.length} query/queries failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
  if (totals.length === 0) {
    console.log(
      '\nNo events in the window. Check that the dataset name matches Cloudflare and that the\n' +
        '`ANALYTICS` binding is attached to the Pages project (without it the collector returns 204 and drops events).',
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
