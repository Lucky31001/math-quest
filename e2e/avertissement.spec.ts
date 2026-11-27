/** Fenêtre « le site évolue vite » : affichée à la première visite seulement. */
import { test, expect } from '@playwright/test';

// Stockage vide : première visite (la configuration marque l'avertissement comme vu).
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' });

test('avertissement de première visite : affiché une fois, fermé par « Compris ! »', async ({ page }) => {
  await page.goto('./');
  const fenetre = page.getByRole('dialog', { name: 'Math Quest évolue vite' });
  await expect(fenetre).toBeVisible();
  await expect(fenetre).toContainText('changent souvent');

  await fenetre.getByRole('button', { name: 'Compris !' }).click();
  await expect(fenetre).toBeHidden();
  // La carte est de nouveau utilisable.
  await page.locator('a[href="#/reglages"]').first().click();
  await expect(page).toHaveURL(/#\/reglages/);

  await page.goto('./');
  await page.reload();
  await expect(page.locator('.diapo').first()).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
