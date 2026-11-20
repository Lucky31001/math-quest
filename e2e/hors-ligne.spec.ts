/** Mode hors ligne : le service worker pré-cache le site, qui s'ouvre ensuite sans réseau. */
import { test, expect } from '@playwright/test';

test('après une première visite, le site fonctionne sans réseau (cours avec formules)', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload(); // la page est maintenant contrôlée par le service worker
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // Attendre la fin du pré-cache (toast « prêt à fonctionner hors ligne » ou cache complet).
  await expect
    .poll(async () => page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (k) => (await (await caches.open(k)).keys()).length))).reduce((a, b) => a + b, 0)), { timeout: 30_000 })
    .toBeGreaterThan(50);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.diapo').first()).toBeVisible();
  await page.goto('./#/chapitre/integration/cours');
  await expect(page.locator('.katex').first()).toBeVisible();
  expect(await page.evaluate(() => document.fonts.check('16px "Nunito Variable"'))).toBe(true);
});
