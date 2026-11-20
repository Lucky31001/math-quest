/** Atelier C : scanf (%s, fin d'entrée) fonctionne dans le navigateur (worker + scanf de remplacement). */
import { test, expect } from '@playwright/test';

test.setTimeout(90_000);

test('lecture de mots avec scanf("%s") jusqu’à EOF', async ({ page }) => {
  await page.goto('./#/atelier');
  await page.locator('textarea.editeur-c').fill(
    '#include <stdio.h>\nint main(void) {\n    char mot[50];\n    int n = 0;\n    while (scanf("%49s", mot) != EOF)\n        printf("%d:%s\\n", ++n, mot);\n    return 0;\n}',
  );
  await page.locator('summary', { hasText: 'Entrée standard' }).click();
  await page.locator('textarea.entree-c').fill('bonjour le monde');
  await page.getByRole('button', { name: /Exécuter/ }).click();
  await expect(page.locator('.statut-c')).toContainText('Terminé', { timeout: 60_000 });
  await expect(page.locator('.console-c')).toHaveText('1:bonjour\n2:le\n3:monde\n');
});
