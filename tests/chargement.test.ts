/**
 * Contenu : validé AU BUILD par le plugin « contenu » (vite.config.ts) ; au
 * démarrage, l'application n'a que l'INDEX (résumés) ; le chapitre complet est
 * chargé à l'ouverture.
 */
import { describe, it, expect } from 'vitest';
import { INDEX, chargerChapitre, chargerTout, ErreurChapitre } from '../src/core/loader';
import { validerChapitre } from '../src/core/validation';
import { resumerChapitre } from '../src/core/resume';
import { CONTENU } from './outils/contenu';

describe('index des chapitres (démarrage)', () => {
  it('contient tous les chapitres, dans le même ordre', () => {
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
});

describe('validation au build (plugin « contenu »)', () => {
  const ch = () => structuredClone(CONTENU.chapitres[0]);
  const fichier = () => `/content/${CONTENU.chapitres[0].monde}/x.json`;

  it('renvoie le chapitre avec les valeurs par défaut du schéma', () => {
    const brut = ch();
    const qcm = brut.exercices.find((q) => q.type === 'qcm')!;
    delete (qcm as { multiple?: boolean }).multiple;
    const r = validerChapitre(fichier(), brut, CONTENU.catalogue);
    expect(r.ok && r.chapitre.exercices.find((q) => q.id === qcm.id)).toMatchObject({ multiple: false });
  });

  it('refuse un fichier invalide en nommant le champ fautif', () => {
    const brut = ch() as unknown as { exercices: { enonce?: string }[] };
    delete brut.exercices[0].enonce;
    const r = validerChapitre(fichier(), brut, CONTENU.catalogue);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.messages.join()).toMatch(/exercices\.0\.enonce/);
  });

  it('refuse une matière absente du catalogue ou un mauvais dossier', () => {
    expect(validerChapitre('/content/autre/x.json', ch(), CONTENU.catalogue).ok).toBe(false);
    expect(validerChapitre(fichier(), { ...ch(), monde: 'inconnue' }, CONTENU.catalogue).ok).toBe(false);
  });
});

describe('chapitres complets (à la demande)', () => {
  it('charge un chapitre, une seule fois (cache)', async () => {
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
