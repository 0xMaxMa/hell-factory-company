import { chromium } from 'playwright';

const BASE_URL = 'https://effectively-genuine-annotated-anthony.trycloudflare.com';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();

// Capture all API calls
const apiCalls = [];
context.on('request', req => {
  if (req.url().includes('/api/')) apiCalls.push({ method: req.method(), url: req.url().replace(BASE_URL, '') });
});
context.on('response', async res => {
  const url = res.url().replace(BASE_URL, '');
  if (url.includes('/api/sessions') && !url.includes('messages')) {
    const body = await res.text().catch(() => '');
    if (body) console.log('[SESSIONS API]', url, res.status(), body.slice(0, 200));
  }
});

const page = await context.newPage();
page.on('console', msg => { if (['error','warn'].includes(msg.type())) console.log(`[${msg.type().toUpperCase()}]`, msg.text()); });

// Go to /run
await page.goto(`${BASE_URL}/run`);
await page.waitForTimeout(2000);

// Select test-echo job  
const jobCards = page.locator('[data-testid="step-job-selector"]');
const hasSelector = await jobCards.isVisible().catch(() => false);
console.log('[Job selector visible]', hasSelector);

// Click test-echo in the job list
const echoBtn = page.locator('button, [role="button"]').filter({ hasText: /^test-echo$/ }).first();
const echoBtnVisible = await echoBtn.isVisible().catch(() => false);
console.log('[test-echo button visible]', echoBtnVisible);
if (echoBtnVisible) await echoBtn.click();

// Look for "New Session" button
await page.waitForTimeout(500);
const newSessionBtn = page.getByRole('button', { name: /New Session/ });
const newSessionVisible = await newSessionBtn.isVisible().catch(() => false);
console.log('[New Session visible]', newSessionVisible);
if (newSessionVisible) {
  await newSessionBtn.click();
  console.log('[Clicked New Session]');
}

await page.waitForTimeout(2000);
const sessionTitle = await page.locator('text=/job-test-echo/').first().textContent().catch(() => 'not found');
console.log('[Session title]', sessionTitle);

// === FIRST RUN ===
const runBtn = page.getByRole('button', { name: /Run Job/ });
if (await runBtn.isVisible()) {
  console.log('\n=== FIRST RUN ===');
  await runBtn.click();
  
  await page.waitForFunction(() => {
    const nodes = [...document.querySelectorAll('*')];
    return nodes.some(n => n.className && String(n.className).includes('idle') && n.textContent?.includes('idle'));
  }, { timeout: 45000 }).catch(() => console.log('[Timeout on first run]'));
  
  await page.waitForTimeout(1000);
  
  const bubbles1 = await page.evaluate(() => {
    const terminal = document.querySelector('[data-testid="agent-terminal"]');
    if (!terminal) return [];
    return [...terminal.children].map(c => c.textContent?.trim() || '').filter(Boolean);
  });
  console.log('[After run 1 - bubble count]', bubbles1.length);
  bubbles1.forEach((b, i) => console.log(`[RUN1 BUBBLE ${i}]`, b.slice(0, 200)));
  await page.screenshot({ path: '/tmp/pw-run1.png', fullPage: false });
  
  // === SECOND RUN ===
  console.log('\n=== SECOND RUN ===');
  await runBtn.click();
  
  await page.waitForFunction(() => {
    const nodes = [...document.querySelectorAll('*')];
    return nodes.some(n => n.className && String(n.className).includes('idle') && n.textContent?.includes('idle'));
  }, { timeout: 45000 }).catch(() => console.log('[Timeout on second run]'));
  
  await page.waitForTimeout(1000);
  
  const bubbles2 = await page.evaluate(() => {
    const terminal = document.querySelector('[data-testid="agent-terminal"]');
    if (!terminal) return [];
    return [...terminal.children].map(c => c.textContent?.trim() || '').filter(Boolean);
  });
  console.log('[After run 2 - bubble count]', bubbles2.length, '(expected 2+)');
  bubbles2.forEach((b, i) => console.log(`[RUN2 BUBBLE ${i}]`, b.slice(0, 200)));
  await page.screenshot({ path: '/tmp/pw-run2.png', fullPage: false });
}

// Test page refresh - history should persist
console.log('\n=== AFTER REFRESH ===');
await page.reload();
await page.waitForTimeout(2000);

// Resume the session
const resumeBtns = page.getByRole('button', { name: 'Resume' });
const rCount = await resumeBtns.count();
console.log('[Resume btns after refresh]', rCount);
if (rCount > 0) {
  await resumeBtns.first().click();
  await page.waitForTimeout(1000);
  
  const bubblesAfterRefresh = await page.evaluate(() => {
    const terminal = document.querySelector('[data-testid="agent-terminal"]');
    if (!terminal) return [];
    return [...terminal.children].map(c => c.textContent?.trim() || '').filter(Boolean);
  });
  console.log('[After refresh - bubble count]', bubblesAfterRefresh.length);
  bubblesAfterRefresh.forEach((b, i) => console.log(`[REFRESH BUBBLE ${i}]`, b.slice(0, 150)));
  await page.screenshot({ path: '/tmp/pw-refresh.png', fullPage: false });
}

await browser.close();
console.log('\n[DONE]');
