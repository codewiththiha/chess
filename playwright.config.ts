// Exercise the actual browser worker and responsive interface without mocks.
import { defineConfig, devices } from '@playwright/test';
const port = Number(process.env.PLAYWRIGHT_PORT ?? 5173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('PLAYWRIGHT_PORT must be an integer from 1024 to 65535.');
const preview = `npm run preview -- --port ${port} --strictPort`;
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { open: 'never' }],
        ['junit', { outputFile: 'test-results/results.xml' }],
      ]
    : 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
      // On a phone the study card and the move list live in a sheet, so the
      // specs that drive that content step by step run on the desktop project
      // and `compact.spec.ts` covers the phone: one screen, the sheet, the strip,
      // and the board. The rest of the suite runs on both projects.
      testMatch:
        /(accessibility|bots|compact|modes|play|recovery|settings|speech)\.spec\.ts/,
    },
  ],
  webServer: {
    command:
      process.env.PLAYWRIGHT_PREBUILT === '1'
        ? preview
        : `npm run build && ${preview}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
