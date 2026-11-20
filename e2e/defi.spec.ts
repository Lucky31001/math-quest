/** Défi : un examen, le lien « Défier un camarade », puis le camarade passe le même sujet. */
import { test, expect, type Page } from '@playwright/test';
import { repondreAuHasard } from './outils';

async function passerExamen(page: Page): Promise<string[]> {
  const question = page.locator('.session-scene .question');
  const enonces: string[] = [];
  for (let i = 0; i < 20; i++) {
    enonces.push((await question.locator('.enonce').textContent()) ?? '');
    await repondreAuHasard(question);
    await question.locator('.pied .btn-primaire').click();
    await question.locator('.btn-suivant').click();
  }
  await expect(page.locator('.bilan h2')).toBeVisible();
  return enonces;
}

test('le camarade reçoit le même sujet et voit la comparaison des notes', async ({ browser }) => {
  const a = await (await browser.newContext({ serviceWorkers: 'block' })).newPage();
  await a.goto('./#/jouer/examen/physique');
  const sujetA = await passerExamen(a);
  const lien = await a.locator('.btn-defi').getAttribute('data-lien');
  expect(lien).toMatch(/#\/defi\/D1-/);

  const b = await (await browser.newContext({ serviceWorkers: 'block' })).newPage();
  await b.goto(lien!);
  await expect(b.locator('.defi h1')).toContainText('Physique');
  await expect(b.locator('.defi-note')).toContainText('/20');
  await b.getByRole('link', { name: /Commencer/ }).click();
  await expect(b.locator('.session-titre')).toContainText('Défi');
  const sujetB = await passerExamen(b);
  expect(sujetB).toEqual(sujetA);
  await expect(b.locator('.bilan .record')).toContainText(/Défi remporté|Égalité|Pas cette fois/);
});

test('un lien de défi abîmé affiche une erreur', async ({ page }) => {
  await page.goto('./#/defi/D1-abime');
  await expect(page.locator('[role=alert]')).toContainText('invalide');
});
