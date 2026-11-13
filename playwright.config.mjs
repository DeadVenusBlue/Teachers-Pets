import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['line']],
  use: {
    baseURL: 'http://127.0.0.1:5000',
    browserName: 'chromium',
    channel: 'msedge',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
});
