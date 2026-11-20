/** Examen blanc : rien n'est corrigé pendant l'épreuve, puis note et copie corrigée. */
import { test, expect } from '@playwright/test';
import { repondreAuHasard, progression } from './outils';

test('20 questions, note sur 20, copie corrigée', async ({ page }) => {
  await page.goto('./#/jouer/examen/analyse');
  const question = page.locator('.session-scene .question');
  for (let i = 0; i < 20; i++) {
    await repondreAuHasard(question);
    await question.locator('.pied .btn-primaire').click();
    await expect(question.locator('.verdict')).toHaveText('Réponse enregistrée');
    await expect(question.locator('.correction')).toHaveCount(0);
    await question.locator('.btn-suivant').click();
  }
  await expect(page.locator('.bilan h2')).toHaveText(/^📝 [\d,]+\/20$/);
  await expect(page.locator('.copie .question.en-revue')).toHaveCount(20);
  await expect(page.locator('.copie .btn-suivant')).toHaveCount(0);
  expect((await progression(page))?.compteurs.reponses).toBe(20);

  // La note apparaît dans les statistiques, avec sa courbe (un point).
  await page.goto('./#/stats');
  const examen = page.locator('.examens .examen-matiere');
  await expect(examen).toContainText('Analyse');
  await expect(examen.locator('.courbe-marque')).toHaveCount(1);
});
