/** Parcours de base, avec de vrais clics (un élément caché sous un autre ne serait pas cliquable). */
import { test, expect } from '@playwright/test';
import { progression } from './outils';

// Sans service worker : il pré-chargerait tous les fichiers et fausserait la mesure du chargement à la demande.
test.use({ serviceWorkers: 'block' });

test('accueil : aucun chapitre complet chargé, puis seulement celui qu’on ouvre', async ({ page }) => {
  const chapitres: string[] = [];
  page.on('request', (r) => {
    const f = r.url().split('/').pop()!;
    if (f.endsWith('.js') && !/^(index|mathjs|katex|zod|rolldown|pwa|workbox|worker|transfert|uqr|fflate)/.test(f)) chapitres.push(f);
  });
  await page.goto('./');
  await expect(page.locator('.diapo').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(chapitres).toEqual([]);
  await page.goto('./#/chapitre/suites/cours');
  await expect(page.locator('.katex').first()).toBeVisible();
  expect(chapitres.map((f) => f.split('-')[0])).toEqual(['suites']);
});

test('onglet Exercices : on répond à un QCM et la réponse est enregistrée', async ({ page }) => {
  await page.goto('./#/chapitre/c-pointeurs/exercices');
  await page.locator('.exercice-ligne', { hasText: 'QCM' }).first().click();
  const question = page.locator('.question');
  await question.locator('.choix-item label').first().click();
  // Vrai clic : échoue si la barre « Vérifier » est cachée (ex. sous la barre d'onglets mobile).
  await question.locator('.pied .btn-primaire').click();
  await expect(question.locator('.verdict')).toBeVisible();
  await expect(question.locator('.correction')).toBeVisible();
  expect((await progression(page))?.compteurs.reponses).toBe(1);
});

test('statistiques, badges et réglages s’affichent', async ({ page }) => {
  for (const ecran of ['stats', 'badges', 'reglages']) {
    await page.goto(`./#/${ecran}`);
    await expect(page.locator('#contenu h1')).toBeVisible();
  }
});
