import { expect, test, type Page } from '@playwright/test';

const PW = 'e2e-wachtwoord-123';

async function loginAs(page: Page, email: string) {
  await page.goto('/beheer/inloggen');
  await page.getByLabel('E-mailadres').fill(email);
  await page.getByLabel('Wachtwoord').fill(PW);
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page.getByRole('heading', { name: 'Mijn moskeeën' })).toBeVisible();
}

/** Vult een complete, fictieve testdag in het raster in. */
async function fillDay(page: Page, date: string, o: Record<string, string> = {}) {
  const v = { imsak: '', fajr: '06:10', sunrise: '07:40', dhuhr: '13:35', asr: '16:05', maghrib: '18:50', isha: '20:20', ...o };
  for (const [k, time] of Object.entries(v)) {
    if (!time) continue;
    const label = { imsak: 'Imsak', fajr: 'Fajr', sunrise: 'Zonsopkomst', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' }[k]!;
    await page.getByLabel(`${date} ${label}`, { exact: true }).fill(time);
  }
}

test.describe('beheer', () => {
  test('beveiligde pagina zonder login gaat naar inloggen', async ({ page }) => {
    await page.goto('/beheer');
    await expect(page).toHaveURL(/\/beheer\/inloggen$/);
  });

  test('fout wachtwoord geeft een neutrale foutmelding', async ({ page }) => {
    await page.goto('/beheer/inloggen');
    await page.getByLabel('E-mailadres').fill('beheer-a@demo.invalid');
    await page.getByLabel('Wachtwoord').fill('helemaal-fout-123');
    await page.getByRole('button', { name: 'Inloggen' }).click();
    await expect(page.getByTestId('flash-error')).toContainText('E-mailadres of wachtwoord is onjuist');
  });

  test('beheerder maakt een moskee, voert een rooster in, publiceert, en de bezoeker ziet het', async ({ page }) => {
    await loginAs(page, 'beheer-a@demo.invalid');
    await expect(page.getByTestId('admin-mosques')).not.toContainText('Demo-moskee West');

    await page.getByRole('link', { name: 'Nieuwe moskee' }).click();
    await page.getByLabel('Naam').fill('Demo-moskee E2E');
    await page.getByLabel('Webadres (slug)').fill('demo-moskee-e2e');
    await page.getByLabel('Plaats').fill('Teststad');
    await page.getByLabel('Zichtbaarheid').selectOption('public');
    await page.getByRole('button', { name: 'Moskee aanmaken' }).click();
    await expect(page.getByTestId('flash-ok')).toContainText('Moskee aangemaakt');

    // Concept van twee dagen in de toekomst.
    const from = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10);
    const form = page.getByTestId('new-draft');
    await form.getByLabel('Van', { exact: true }).fill(from);
    await form.getByLabel('Tot en met').fill(to);
    await form.getByLabel('Bron van de tijden').fill('E2E-testbron (fictief)');
    await form.getByRole('button', { name: 'Concept aanmaken' }).click();
    await expect(page.getByTestId('version-status')).toHaveText('Concept');
    await expect(page.getByTestId('validation')).toContainText('fout(en)');

    // Eén dag met een fout: Isha vóór Maghrib.
    await fillDay(page, from);
    await fillDay(page, to, { isha: '18:00' });
    await page.getByLabel(`${from} Dhuhr iqama`).fill('13:50');
    await page.getByRole('button', { name: 'Concept opslaan en controleren' }).click();
    await expect(page.getByTestId('flash-ok')).toBeVisible();
    await expect(page.getByTestId(`issues-${to}`)).toContainText('verkeerde volgorde');
    await expect(page.getByRole('button', { name: 'Publiceren' })).toBeDisabled();

    // Herstellen en publiceren.
    await page.getByLabel(`${to} Isha`, { exact: true }).fill('20:21');
    await page.getByRole('button', { name: 'Concept opslaan en controleren' }).click();
    await expect(page.getByTestId('validation')).toContainText('kan gepubliceerd worden');
    await page.getByLabel('Ik heb de tijden gecontroleerd met de officiële bron.').check();
    await page.screenshot({ path: '../../docs/verification/screenshots/beheer-concept.png', fullPage: true });
    await page.getByRole('button', { name: 'Publiceren' }).click();
    await expect(page.getByTestId('flash-ok')).toContainText('Gepubliceerd');
    await expect(page.getByTestId('version-status')).toHaveText('Gepubliceerd');

    // Bezoeker ziet de nieuwe tijden.
    await page.goto(`/m/demo-moskee-e2e?datum=${from}`);
    await expect(page.locator('tr[data-prayer="dhuhr"] td.t')).toHaveText('13:35');
    await expect(page.locator('tr[data-prayer="dhuhr"] td.iq')).toHaveText('13:50');
    await expect(page.getByTestId('source-info')).toContainText('E2E-testbron (fictief)');

    // Auditlog bevat de publicatie.
    await page.goto('/beheer/audit');
    await expect(page.getByTestId('audit')).toContainText('schedule.publish');
  });

  test('beheerder B kan moskee van organisatie A niet openen via de URL (pilotscenario 3)', async ({ page }) => {
    await loginAs(page, 'beheer-a@demo.invalid');
    await page.getByRole('link', { name: 'Demo-moskee Noord' }).click();
    await page.waitForURL(/\/beheer\/moskeeen\/[0-9a-f-]{36}$/);
    const url = page.url();
    await page.getByRole('button', { name: 'Uitloggen' }).click();

    await loginAs(page, 'beheer-b@demo.invalid');
    await expect(page.getByTestId('admin-mosques')).not.toContainText('Demo-moskee Noord');
    const res = await page.goto(url);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Niet gevonden' })).toBeVisible();
    await expect(page.getByText('Demo-moskee Noord')).toHaveCount(0);
  });

  test('redacteur kan niet publiceren', async ({ page }) => {
    await loginAs(page, 'redacteur-a@demo.invalid');
    await page.getByRole('link', { name: 'Demo-moskee Noord' }).click();
    await page.getByTestId('versions').getByRole('link').first().click();
    await expect(page.getByRole('heading', { name: 'Publiceren' })).toHaveCount(0);
  });
});
