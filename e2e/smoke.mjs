// E2E smoke against a running app (dev server or vite preview).
//   BASE_URL=http://localhost:4173 node smoke.mjs
// Checks, per phone/tablet/desktop viewport:
//   - every route renders without page errors
//   - the page never scrolls horizontally (wide content must scroll inside
//     its own container)
// plus two planner invariants that have regressed before:
//   - the extract dropdown opens ABOVE the map and its options are clickable
//   - selecting The Labyrinth and clicking the map draws a non-dashed,
//     multi-point walkable route
// Exits non-zero with a failure list; run in CI after `vite preview`.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
];
const ROUTES = ['/', '/planner', '/progress', '/hideout', '/items', '/ammo', '/market', '/xp'];

const failures = [];
const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  page.on('pageerror', (e) => failures.push(`${vp.name}: PAGEERROR ${e.message}`));
  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(route === '/planner' ? 1200 : 400);
    const { scrollW, innerW } = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
    }));
    if (scrollW > innerW + 1) {
      failures.push(`${vp.name} ${route}: horizontal overflow ${scrollW}px > ${innerW}px`);
    }
  }
  await page.close();
}

// planner invariants, desktop viewport
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => failures.push(`planner: PAGEERROR ${e.message}`));
await page.goto(`${BASE}/planner`, { waitUntil: 'networkidle' });

// extract dropdown above the map
await page.getByRole('button', { name: /customs/i }).first().click();
await page.waitForTimeout(1200);
const trigger = page.getByLabel('Target extract');
await trigger.click();
await page.waitForTimeout(400);
const options = page.getByRole('option');
if ((await options.count()) < 2) {
  failures.push('planner: extract dropdown rendered no options');
} else {
  const clickable = await options.nth(1).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return el === top || el.contains(top) || (top?.contains(el) ?? false);
  });
  if (!clickable) failures.push('planner: extract dropdown options are covered by the map');
  await page.keyboard.press('Escape');
}

// labyrinth walkable route
await page.getByRole('button', { name: /the labyrinth/i }).first().click();
await page.waitForTimeout(2000);
const box = await page.locator('.leaflet-container').boundingBox();
await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.55);
await page.waitForTimeout(1500);
const walkable = await page.evaluate(() =>
  [...document.querySelectorAll('.leaflet-overlay-pane path')].some((p) => {
    const dash = p.getAttribute('stroke-dasharray');
    const points = (p.getAttribute('d')?.match(/L/g) ?? []).length + 1;
    return (dash === null || dash === 'none') && points > 3;
  }),
);
if (!walkable) failures.push('planner: labyrinth route has no walkable multi-point leg');

await browser.close();
if (failures.length > 0) {
  console.error(`SMOKE FAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('smoke passed: routes render, no overflow, dropdown clickable, labyrinth routes');
