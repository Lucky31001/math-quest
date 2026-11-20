/**
 * Chargement à la demande : au démarrage, l'application n'a que l'INDEX (résumés
 * calculés au build par le plugin « resume-chapitres ») ; le chapitre complet
 * est chargé et validé à l'ouverture.
 */
import { describe, it, expect } from 'vitest';
import { INDEX, chargerChapitre, chargerTout, ErreurChapitre, validerIndex } from '../src/core/loader';
import { resumerChapitre } from '../src/core/resume';
import { CONTENU } from './outils/contenu';

describe('index des chapitres (démarrage)', () => {
  it('contient tous les chapitres, dans le même ordre, sans erreur', () => {
    expect(INDEX.erreurs).toEqual([]);
    expect(INDEX.chapitres.map((c) => c.id)).toEqual(CONTENU.chapitres.map((c) => c.id));
  });

  it('résumé = métadonnées + identifiants, types et difficultés des questions, sans aucun texte', () => {
    for (const c of CONTENU.chapitres) {
      const r = INDEX.chapitres.find((x) => x.id === c.id)!;
      expect(r).toEqual(resumerChapitre(c));
      expect(r.exercices).toEqual(c.exercices.map((q) => ({ id: q.id, type: q.type, difficulte: q.difficulte })));
      expect(Object.keys(r)).not.toContain('cours');
      expect(JSON.stringify(r)).not.toMatch(/"(enonce|correction|recto|verso|choix)"/);
    }
  });

  it('signale un résumé invalide sans bloquer les autres', () => {
    const ok = resumerChapitre(CONTENU.chapitres[0]);
    const r = validerIndex({ [`/content/${CONTENU.chapitres[0].monde}/a.json`]: ok, '/content/x/b.json': { id: 'B!' } }, CONTENU.catalogue);
    expect(r.chapitres).toHaveLength(1);
    expect(r.erreurs.map((e) => e.fichier)).toEqual(['/content/x/b.json']);
  });
});

describe('chapitres complets (à la demande)', () => {
  it('charge et valide un chapitre, une seule fois (cache)', async () => {
    const id = CONTENU.chapitres[0].id;
    const a = chargerChapitre(id);
    expect(chargerChapitre(id)).toBe(a);
    expect(await a).toEqual(CONTENU.chapitres[0]);
  });

  it('charge tout le contenu (Survie, QCM éclair)', async () => {
    expect((await chargerTout()).map((c) => c.id)).toEqual(CONTENU.chapitres.map((c) => c.id));
  });

  it('rejette un chapitre inconnu avec une erreur lisible', async () => {
    await expect(chargerChapitre('nexiste-pas')).rejects.toBeInstanceOf(ErreurChapitre);
  });
});
