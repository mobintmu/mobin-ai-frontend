import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173', launchOptions: process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : undefined },
  webServer: { command: 'VITE_TURNSTILE_SITE_KEY=test-site-key npm run build && npm run preview -- --host 0.0.0.0', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI, timeout: 120000 },
});
