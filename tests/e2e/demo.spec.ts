import { expect, test } from '@playwright/test';

test('register, ask a question, recover the conversation, and start a new session', async ({ page }) => {
  await page.goto('/');

  await test.step('registration validates required fields and optional marketing stays off', async () => {
    await expect(page.getByText('Local demo verification is active.')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /occasional updates/i })).not.toBeChecked();
    await page.getByRole('button', { name: /continue to chat/i }).click();
    await expect(page.getByText('Enter your given name.')).toBeVisible();
    await expect(page.getByText('Enter your family name.')).toBeVisible();
    await expect(page.getByText('Enter an email address or phone number.')).toBeVisible();
    await expect(page.getByText('Accept the privacy notice to continue.')).toBeVisible();
  });

  await test.step('registration creates a conversation through the demo API', async () => {
    await page.getByLabel('Given name').fill('Ada');
    await page.getByLabel('Family name').fill('Lovelace');
    await page.getByLabel('Email').fill('ada@example.com');
    await page.getByRole('checkbox', { name: /privacy notice/i }).check();
    const registration = page.waitForResponse(response => response.url().endsWith('/api/v1/clients') && response.request().method() === 'POST');
    await page.getByRole('button', { name: /continue to chat/i }).click();
    expect((await registration).status()).toBe(200);
    await expect(page.getByText('100 of 100 questions remaining')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('mobin-ai-session-v1'))).toBeTruthy();
  });

  await test.step('the answer streams and updates the server quota', async () => {
    await page.getByRole('textbox', { name: 'Ask a question' }).fill('How do data pipelines work?');
    const stream = page.waitForResponse(response => response.url().endsWith('/messages:stream') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Send question' }).click();
    expect((await stream).status()).toBe(200);
    await expect(page.getByText('99 of 100 questions remaining')).toBeVisible();
    await expect(page.locator('.message.assistant').filter({ hasText: 'Local demo answer' })).toHaveCount(1);
    await expect(page.getByText('The available articles may not fully support this answer.')).toBeVisible();
    await expect(page.locator('.message.user').filter({ hasText: 'How do data pipelines work?' })).toHaveCount(1);
  });

  await test.step('refresh restores the same conversation without a duplicate answer', async () => {
    await page.reload();
    await expect(page.getByText('99 of 100 questions remaining')).toBeVisible();
    await expect(page.locator('.message.assistant').filter({ hasText: 'Local demo answer' })).toHaveCount(1);
    await expect(page.locator('.message.user').filter({ hasText: 'How do data pipelines work?' })).toHaveCount(1);
  });

  await test.step('starting over clears the browser session', async () => {
    await page.getByRole('button', { name: 'New session' }).click();
    await expect(page.getByText('Start with a quick hello.')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('mobin-ai-session-v1'))).toBeNull();
  });
});

test('embedded loader creates the iframe on demand and closes from inside it', async ({ page }) => {
  await page.goto('/');
  await page.addScriptTag({ url: '/embed/v1.js' });
  await page.evaluate(() => {
    window.MobinAI?.destroy();
    window.MobinAI?.init({ baseUrl: window.location.origin });
  });
  const widget = page.locator('#mobin-ai-widget');
  const launcher = widget.locator('button.launcher');

  await expect(launcher).toBeVisible();
  await expect(widget.locator('iframe')).toHaveCount(0);
  await launcher.focus();
  await page.keyboard.press('Enter');
  await expect(widget.locator('iframe')).toHaveCount(1);
  await expect(page.frameLocator('#mobin-ai-widget iframe').getByText('Start with a quick hello.')).toBeVisible();
  await page.frameLocator('#mobin-ai-widget iframe').getByRole('button', { name: 'Close chat' }).click();
  await expect(launcher).toBeVisible();
  await expect(launcher).toBeFocused();
  await launcher.press('Space');
  await expect(widget.locator('iframe')).toHaveCount(1);
});

test('mobile chat remains inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByLabel('Given name')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
