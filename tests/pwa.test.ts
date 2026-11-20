import { describe, it, expect, vi } from 'vitest';

vi.mock('virtual:pwa-register', () => ({ registerSW: () => async () => {} }));
const { ecranOccupe } = await import('../src/pwa');

describe('mise à jour de l’application', () => {
  it('pas de rechargement pendant une séance, des flashcards ou dans l’atelier', () => {
    for (const h of ['#/jouer/eclair', '#/jouer', '#/revision', '#/atelier']) expect(ecranOccupe(h), h).toBe(true);
    for (const h of ['', '#/', '#/chapitre/suites/cours', '#/stats', '#/reglages', '#/revisions']) expect(ecranOccupe(h), h).toBe(false);
  });
});
