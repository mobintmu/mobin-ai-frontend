import { expect, test } from '@playwright/test';

test('widget stays collapsed until first open, restores preference, and remains idempotent', async ({ page }) => {
  await page.goto('/');
  await page.addScriptTag({ url: '/embed/v1.js' });
  await page.addScriptTag({ url: '/embed/v1.js' });
  const widget = page.locator('#mobin-ai-widget');
  const launcher = widget.locator('button.launcher');
  const panel = widget.locator('#mobin-ai-panel');

  await expect(widget).toHaveCount(1);
  await expect(launcher).toHaveCount(1);
  await expect(launcher).toBeVisible();
  await expect(launcher).toHaveAttribute('aria-expanded', 'false');
  await expect(widget.locator('iframe')).toHaveCount(0);
  expect(await launcher.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height, radius: getComputedStyle(element).borderRadius };
  })).toMatchObject({ width: 56, height: 56, radius: '50%' });

  await launcher.focus();
  await page.keyboard.press('Enter');
  await expect(panel).toBeVisible();
  await expect(widget.locator('iframe')).toHaveCount(1);
  await expect(widget.locator('iframe')).toHaveAttribute('allow', 'microphone; clipboard-write');
  await expect(widget.locator('iframe')).toHaveAttribute('title', "Mobin'AI chat with article citations");
  await expect(launcher).toHaveAttribute('aria-expanded', 'true');
  expect(await panel.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  })).toMatchObject({ width: 380, height: 600 });
  expect(await page.evaluate(() => localStorage.getItem('mobin-ai-widget-open-v1'))).toBe('open');

  await page.reload();
  await page.addScriptTag({ url: '/embed/v1.js' });
  await expect(panel).toBeVisible();
  await expect(widget.locator('iframe')).toHaveCount(1);
  await panel.locator('button.close').click();
  await expect(launcher).toBeVisible();
  await expect(launcher).toBeFocused();
  await expect(widget.locator('iframe')).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem('mobin-ai-widget-open-v1'))).toBe('closed');

  await launcher.press('Space');
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(launcher).toBeFocused();
  await page.reload();
  await page.addScriptTag({ url: '/embed/v1.js' });
  await expect(launcher).toBeVisible();
  await expect(widget.locator('iframe')).toHaveCount(0);
});

test('mobile panel fits the viewport without changing page width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.addScriptTag({ url: '/embed/v1.js' });
  const widget = page.locator('#mobin-ai-widget');
  await widget.locator('button.launcher').click();
  const bounds = await widget.locator('#mobin-ai-panel').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(390);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(844);
  expect(bounds.width).toBeGreaterThan(350);
  expect(bounds.height).toBeGreaterThan(700);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
