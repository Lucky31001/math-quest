/** Outils communs aux tests de bout en bout. */
import type { Page, Locator } from '@playwright/test';

/** Donne une réponse quelconque mais complète à la question affichée (tous types sauf programme). */
export async function repondreAuHasard(question: Locator): Promise<void> {
  await question.evaluate((q) => {
    const changer = (e: HTMLInputElement) => {
      e.checked = true;
      e.dispatchEvent(new Event('change', { bubbles: true }));
    };
    if (q.classList.contains('type-vrai-faux')) q.querySelector<HTMLButtonElement>('.btn-vf')!.click();
    if (q.classList.contains('type-trouve-erreur')) q.querySelector<HTMLButtonElement>('.etape')!.click();
    const choix = q.querySelector<HTMLInputElement>('.choix input');
    if (choix) changer(choix);
    const saisie = q.querySelector<HTMLInputElement>('.saisie');
    if (saisie) {
      const n = Number(/(\d+) valeurs attendues/.exec(q.textContent ?? '')?.[1] ?? 1);
      saisie.value = Array(n).fill('1').join(';'); // « 1 » : valable quelle que soit la variable
      saisie.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
}

/** Progression enregistrée (localStorage), ou null. */
export const progression = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('math-quest:progression:v1') ?? 'null') as { xp: number; compteurs: { reponses: number }; questions: Record<string, unknown> } | null);
