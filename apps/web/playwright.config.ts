import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const DB = process.env.E2E_DATABASE_URL ?? 'postgres://mescid:mescid@localhost:5432/mescid_e2e';

/**
 * Browsertests tegen een echte productiebuild en een aparte, lege e2e-database.
 * Gebruikt de vooraf geïnstalleerde Chromium als die er is.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'nl-NL',
    timezoneId: 'Europe/Amsterdam',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobiel', use: { ...devices['Pixel 7'] }, testMatch: /publiek\.spec\.ts/ },
  ],
  webServer: {
    command: `node e2e/reset-db.mjs && npx tsx scripts/migrate.ts && npx tsx scripts/seed.ts && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/v1/mosques`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: DB, SEED_PASSWORD: 'e2e-wachtwoord-123', NEXT_TELEMETRY_DISABLED: '1' },
  },
});
