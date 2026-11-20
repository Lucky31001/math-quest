/** Transfert entre deux appareils (deux contextes de navigateur isolés). */
import { test, expect } from '@playwright/test';
import { progression } from './outils';

test('le lien créé sur un appareil importe la même progression sur l’autre', async ({ browser }) => {
  const a = await (await browser.newContext({ serviceWorkers: 'block' })).newPage();
  await a.goto('./#/chapitre/c-bases/exercices');
  await a.locator('.exercice-ligne', { hasText: 'QCM' }).first().click();
  await a.locator('.question .choix-item label').first().click();
  await a.locator('.question .pied .btn-primaire').click();
  await expect(a.locator('.question .verdict')).toBeVisible();
  await a.goto('./#/reglages');
  await a.getByRole('button', { name: /Créer un lien/ }).click();
  await expect(a.locator('.qr-transfert svg')).toBeVisible();
  const lien = await a.locator('.zone-transfert .lien-transfert').inputValue();

  const b = await (await browser.newContext({ serviceWorkers: 'block' })).newPage();
  b.on('dialog', (d) => d.accept());
  await b.goto(lien);
  await b.getByRole('button', { name: /Importer cette progression/ }).click();
  await expect(b).toHaveURL(/#\/$/); // le lien ne reste pas dans la barre d'adresse
  expect(await progression(b)).toEqual(await progression(a));
});
