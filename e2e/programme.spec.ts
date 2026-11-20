/** Exercice « programme » : compilé et testé dans le navigateur (worker + compilateur xcc). */
import { test, expect } from '@playwright/test';

test.setTimeout(90_000);

test('la bonne solution réussit tous les tests ; une erreur de compilation est signalée sans être comptée', async ({ page }) => {
  await page.goto('./#/chapitre/c-pointeurs/exercices');
  await page.locator('.exercice-ligne', { hasText: 'Programme C' }).first().click();
  const question = page.locator('.question');
  const editeur = question.locator('textarea.editeur-c');

  await editeur.fill('void echanger(int *a, int *b) {\n    return x;\n}');
  await question.locator('.pied .btn-primaire').click();
  await expect(question.locator('.msg-invalide')).toContainText('compile', { timeout: 60_000 });
  await expect(question.locator('.console-erreur')).toBeVisible();

  await editeur.fill('void echanger(int *a, int *b) {\n    int t = *a;\n    *a = *b;\n    *b = t;\n}');
  await question.locator('.pied .btn-primaire').click();
  await expect(question.locator('.tests-c .test-ok')).toHaveCount(4, { timeout: 60_000 });
  await expect(question.locator('.verdict-detail')).toHaveText('Bonne réponse.');
});
