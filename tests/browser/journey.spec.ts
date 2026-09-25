import { expect, test, type Page } from '@playwright/test';

async function mockServices(page: Page) {
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route => route.fulfill({ contentType: 'application/javascript', body: 'window.__turnstileResets=0;window.turnstile={render:function(el,opts){window.__turnstileOptions=opts;setTimeout(function(){opts.callback("test-turnstile-token")},0);return "widget-1"},reset:function(){window.__turnstileResets++},remove:function(){}};' }));
  await page.route('https://api.mobinshaterian.com/api/v1/**', async route => {
    const url = route.request().url();
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'content-type,authorization,idempotency-key' } });
    if (url.endsWith('/clients')) return route.fulfill({ json: { client_id: 'client-1', registration_grant: 'grant-1' }, headers });
    if (url.endsWith('/conversations') && route.request().method() === 'POST') return route.fulfill({ json: { conversation_id: 'conversation-1', access_token: 'token-1', expires_at: '2099-01-01T00:00:00Z', quota: { limit: 100, used: 0, remaining: 100 } }, headers });
    if (url.endsWith('/conversations/conversation-1') && route.request().method() === 'GET') return route.fulfill({ json: { conversation_id: 'conversation-1', quota: { limit: 100, used: 0, remaining: 100 } }, headers });
    if (url.endsWith('/messages') && route.request().method() === 'GET') return route.fulfill({ json: { messages: [] }, headers });
    if (url.endsWith('/messages:stream')) return route.fulfill({ status: 200, contentType: 'text/event-stream', headers, body: 'event: retrieving\ndata: {}\n\nevent: delta\ndata: {"text":"A reliable data pipeline uses bounded batches. [c1]"}\n\nevent: complete\ndata: {"message_id":"answer-1","conversation_id":"conversation-1","answer":"A reliable data pipeline uses bounded batches. [c1]","grounded":true,"citations":[{"citation_id":"c1","title":"Pipeline article","url":"https://mobinshaterian.com/blog/pipeline"}],"quota":{"limit":100,"used":1,"remaining":99}}\n\n' });
    return route.fulfill({ status: 404, json: { code: 'not_found', message: 'Not found' }, headers });
  });
}

test('registers and answers with a citation on the standalone page', async ({ page }) => {
  await mockServices(page);
  await page.goto('/');
  await page.getByLabel('Given name').fill('Ada');
  await page.getByLabel('Family name').fill('Lovelace');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByRole('checkbox', { name: /privacy notice/ }).check();
  await page.getByRole('button', { name: /Continue to chat/ }).click();
  await expect(page.getByText('100 of 100 questions remaining')).toBeVisible();
  await page.getByRole('textbox', { name: 'Ask a question' }).fill('How should I handle batches?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText('99 of 100 questions remaining')).toBeVisible();
  await expect(page.getByRole('link', { name: /Pipeline article/ })).toBeVisible();
});

test('loader opens one iframe and returns focus on close', async ({ page }) => {
  await mockServices(page);
  await page.goto('http://localhost:4173/');
  await page.addScriptTag({ url: 'http://127.0.0.1:4173/embed/v1.js' });
  await page.addScriptTag({ url: 'http://127.0.0.1:4173/embed/v1.js' });
  await page.evaluate(() => { window.MobinAI?.destroy(); window.MobinAI?.init({ baseUrl: 'http://127.0.0.1:4173' }); });
  const launcher = page.locator('#mobin-ai-widget').locator('button.launcher');
  await expect(launcher).toHaveCount(1);
  await launcher.click();
  await expect(page.locator('#mobin-ai-widget iframe')).toHaveCount(1);
  await expect(page.frameLocator('#mobin-ai-widget iframe').getByText('Start with a quick hello.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(launcher).toBeFocused();
  await page.evaluate(() => window.MobinAI?.destroy());
  await expect(page.locator('#mobin-ai-widget')).toHaveCount(0);
});

test('registration requires both names, contact, and privacy consent while marketing stays optional', async ({ page }) => {
  await mockServices(page);
  await page.goto('/');
  const submit = page.getByRole('button', { name: /Continue to chat/ });
  await expect(page.getByRole('checkbox', { name: /occasional updates/ })).not.toBeChecked();
  await submit.click();
  await expect(page.getByText('Enter your given name.')).toBeVisible();
  await expect(page.getByText('Enter your family name.')).toBeVisible();
  await expect(page.getByText('Enter an email address or phone number.')).toBeVisible();
  await expect(page.getByText('Accept the privacy notice to continue.')).toBeVisible();
});

test('mobile layout does not overflow horizontally', async ({ page }) => {
  await mockServices(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Good questions/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('#conversation').scrollIntoViewIfNeeded();
  await expect(page.getByLabel('Given name')).toBeVisible();
});


test('Turnstile expiry and failure disable registration until a fresh token arrives', async ({ page }) => {
  await mockServices(page);
  await page.goto('/');
  const submit = page.getByRole('button', { name: /Continue to chat/ });
  await expect(submit).toBeEnabled();
  await page.evaluate(() => (window as unknown as { __turnstileOptions: Record<string, () => void> }).__turnstileOptions['expired-callback']());
  await expect(submit).toBeDisabled();
  expect(await page.evaluate(() => (window as unknown as { __turnstileResets: number }).__turnstileResets)).toBeGreaterThan(0);
  await page.evaluate(() => (window as unknown as { __turnstileOptions: { callback: (token: string) => void } }).__turnstileOptions.callback('fresh-token'));
  await expect(submit).toBeEnabled();
  await page.evaluate(() => (window as unknown as { __turnstileOptions: Record<string, () => void> }).__turnstileOptions['error-callback']());
  await expect(submit).toBeDisabled();
  await expect(page.getByText('Verification could not load. Refresh the page to try again.')).toBeVisible();
});

test('rapid repeated registration clicks create only one client request', async ({ page }) => {
  await mockServices(page);
  let calls = 0;
  await page.route('https://api.mobinshaterian.com/api/v1/clients', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'content-type' } });
    calls += 1;
    await new Promise(resolve => setTimeout(resolve, 250));
    await route.fulfill({ json: { client_id: 'client-1', registration_grant: 'grant-1' }, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.goto('/');
  await page.getByLabel('Given name').fill('Ada');
  await page.getByLabel('Family name').fill('Lovelace');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByRole('checkbox', { name: /privacy notice/ }).check();
  await expect(page.getByRole('button', { name: /Continue to chat/ })).toBeEnabled();
  await page.evaluate(() => { const button = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Continue to chat')); button?.click(); button?.click(); });
  await expect(page.getByText('100 of 100 questions remaining')).toBeVisible();
  expect(calls).toBe(1);
});
