import { expect, test } from '@playwright/test';

test.describe('publieke app (pilotscenario 1 en 2)', () => {
  test('anonieme bezoeker vindt een demo-moskee en ziet bron, datum, tijdzone, tijden en iqama', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Vandaag' })).toBeVisible();
    await page.getByLabel('Zoek op naam, plaats of postcode').fill('Demostad');
    await page.getByRole('button', { name: 'Zoeken' }).click();
    await expect(page.getByTestId('mosque-list').getByRole('link')).toHaveCount(1);
    await page.getByRole('link', { name: 'Demo-moskee Noord' }).click();

    await expect(page.getByTestId('mosque-name')).toHaveText('Demo-moskee Noord');
    await expect(page.getByTestId('demo-banner')).toContainText('fictieve tijden');
    await expect(page.getByTestId('selected-date')).toContainText('Vandaag');
    const table = page.getByTestId('day-table');
    for (const name of ['Fajr (Sabah)', 'Zonsopkomst', 'Dhuhr (Öğle)', 'Asr (İkindi)', 'Maghrib (Akşam)', 'Isha (Yatsı)']) {
      await expect(table.getByRole('rowheader', { name: new RegExp(name.replace(/[()]/g, '\\$&')) })).toBeVisible();
    }
    await expect(table.locator('tr[data-prayer="dhuhr"] td.iq')).toHaveText(/^\d{2}:\d{2}$/);
    await expect(page.getByTestId('source-info')).toContainText('Demo: fictieve tijden');
    await expect(page.getByTestId('source-info')).toContainText('Europe/Amsterdam');
    await expect(page.getByTestId('next-prayer')).toContainText(/\d{2}:\d{2}/);
    await expect(page.getByTestId('next-prayer')).toContainText(/over /);
    await expect(page.getByTestId('week-table').locator('tbody tr')).toHaveCount(7);
  });

  test('moskee instellen als favoriet; startpagina toont die zonder account', async ({ page }) => {
    await page.goto('/m/demo-moskee-zuid');
    await page.getByRole('button', { name: 'Als mijn moskee instellen' }).click();
    await expect(page.getByText('Dit is je moskee')).toBeVisible();
    await page.goto('/');
    await expect(page.getByTestId('home-favorite')).toContainText('Demo-moskee Zuid');
    await expect(page.getByTestId('home-favorite').getByTestId('next-prayer')).toBeVisible();
  });

  test('wisselen van moskee toont geen gegevens van de vorige moskee', async ({ page }) => {
    await page.goto('/m/demo-moskee-noord');
    await expect(page.getByTestId('mosque-name')).toHaveText('Demo-moskee Noord');
    await page.goto('/m/demo-moskee-west');
    await expect(page.getByTestId('mosque-name')).toHaveText('Demo-moskee West');
    await expect(page.getByText('Demo-moskee Noord')).toHaveCount(0);
  });

  test('datum zonder rooster toont een duidelijke melding, geen verzonnen tijden', async ({ page }) => {
    const future = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);
    await page.goto(`/m/demo-moskee-noord?datum=${future}`);
    await expect(page.getByTestId('no-data')).toContainText('geen rooster beschikbaar');
    await expect(page.getByTestId('day-table')).toHaveCount(0);
  });

  test('taal wisselen naar Turks', async ({ page }) => {
    await page.goto('/meer');
    await page.getByRole('button', { name: 'Türkçe' }).click();
    await expect(page.getByRole('button', { name: 'Türkçe' })).toHaveAttribute('aria-pressed', 'true');
    await page.goto('/m/demo-moskee-noord');
    await expect(page.getByTestId('next-prayer')).toContainText('Sıradaki namaz');
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  });

  test('onbekende of verborgen moskee geeft 404', async ({ page }) => {
    const res = await page.goto('/m/bestaat-niet');
    expect(res?.status()).toBe(404);
  });

  test('geen console-fouten in de kernflow', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(`${m.text()} ${m.location().url}`));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page.goto('/moskeeen');
    await page.goto('/m/demo-moskee-noord');
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });

  test('screenshot moskeepagina', async ({ page }, info) => {
    await page.goto('/m/demo-moskee-noord');
    await expect(page.getByTestId('next-prayer')).toBeVisible();
    await page.screenshot({ path: `../../docs/verification/screenshots/moskee-${info.project.name}.png`, fullPage: true });
  });
});
