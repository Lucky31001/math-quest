/**
 * Exactitude du contenu écrit à la main : chaque réponse numérique ou « expression »
 * (et une sélection de QCM) est recalculée par une AUTRE méthode que la correction.
 * Les vérifications sont rangées par matière dans tests/verifications/ ;
 * un test par matière les exécute toutes et liste celles qui échouent.
 */
import { describe, it, expect } from 'vitest';
import { CONTENU } from './outils/contenu';
import { toutVerifier } from './outils/tout-verifier';
import { verifications as maths } from './verifications/maths';
import { verifications as physique } from './verifications/physique';
import { verifications as informatique } from './verifications/informatique';

describe('exactitude du contenu', () => {
  it('algèbre et analyse', () => toutVerifier(maths));
  it('physique (simulations, tracé de rayons, thermodynamique)', () => toutVerifier(physique));
  // ~60 programmes compilés par gcc : environ 4,5 s, trop près de la limite par défaut (5 s).
  it('informatique (code C compilé et exécuté par gcc)', { timeout: 30_000 }, () => toutVerifier(informatique));

  it('chaque question numérique ou « expression » a sa vérification indépendante', () => {
    const verifiees = { ...maths, ...physique, ...informatique };
    const manquantes = CONTENU.chapitres.flatMap((c) =>
      c.exercices.filter((q) => (q.type === 'numerique' || q.type === 'expression') && !verifiees[`${c.id}/${q.id}`]).map((q) => `${c.id}/${q.id}`),
    );
    expect(manquantes).toEqual([]);
  });
});
