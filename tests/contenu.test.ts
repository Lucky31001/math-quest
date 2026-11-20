/**
 * Validation du contenu pédagogique (/content) :
 *  - chaque fichier respecte le schéma (sinon l'appli l'ignorerait) ;
 *  - volume minimal par chapitre (10 exercices dont ≥ 4 QCM et ~40 %, 10 flashcards) ;
 *  - tout le LaTeX se compile avec KaTeX (pas de faute de frappe invisible) ;
 *  - chaque réponse attendue est évaluable par le vérificateur.
 */
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { CONTENU, validerContenu } from '../src/core/loader';
import { verifierExpression, verifierNumerique } from '../src/core/checker';
import { toutVerifier } from './outils/tout-verifier';
import type { Chapitre, Question } from '../src/core/schema';

/** Tous les textes affichés d'une question. */
function textes(q: Question): string[] {
  const t = [q.enonce, ...q.correction, q.indice ?? ''];
  if (q.type === 'qcm') q.choix.forEach((c) => t.push(c.texte, c.explication));
  if (q.type === 'vrai-faux') q.justifications.forEach((c) => t.push(c.texte, c.explication));
  if (q.type === 'trouve-erreur') t.push(...q.etapes, q.explication);
  return t;
}

/** Compile chaque segment $…$ / $$…$$ ; renvoie les erreurs. */
function erreursLatex(texte: string): string[] {
  const erreurs: string[] = [];
  // Le code (`…` et ```…```) n'est pas du LaTeX : on le retire avant l'analyse.
  texte = texte.replace(/```[\s\S]+?```|`[^`\n]+`/g, ' ');
  const morceaux = texte.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g);
  for (const m of morceaux) {
    const bloc = m.startsWith('$$');
    if (!m.startsWith('$')) {
      if (m.includes('$')) erreurs.push(`dollar orphelin dans « ${texte.slice(0, 60)} »`);
      continue;
    }
    const tex = bloc ? m.slice(2, -2) : m.slice(1, -1);
    try {
      katex.renderToString(tex, { throwOnError: true, displayMode: bloc, strict: 'ignore' });
    } catch (e) {
      erreurs.push(`${(e as Error).message} dans « ${tex} »`);
    }
  }
  return erreurs;
}

describe('fichiers de contenu', () => {
  it('sont tous valides', () => {
    expect(CONTENU.erreurs, JSON.stringify(CONTENU.erreurs, null, 2)).toEqual([]);
  });
  it('chaque chapitre appartient à une matière du catalogue', () => {
    const matieres = CONTENU.catalogue.niveaux.flatMap((n) => n.matieres.map((m) => m.id));
    for (const c of CONTENU.chapitres) expect(matieres, c.id).toContain(c.monde);
  });
});

describe('catalogue (niveaux et matières)', () => {
  const chapitre = (monde: string) => ({ id: 'c', monde, ordre: 1, titre: 'T', icone: '📘', resume: 'R', cours: [{ titre: 'S', blocs: [{ type: 'remarque', texte: 'x' }] }], flashcards: [], exercices: [] });
  const cat = (ids: string[][]) => ({
    niveaux: ids.map((ms, k) => ({ id: `n${k}`, nom: `N${k}`, matieres: ms.map((id) => ({ id, nom: id, sousTitre: 's', embleme: '📘', couleur: '#123456', couleurFonce: '#000000' })) })),
  });
  it('accepte une nouvelle matière et un nouveau niveau sans code', () => {
    const r = validerContenu({ '/content/physique/c.json': chapitre('physique') }, cat([['algebre'], ['physique']]));
    expect(r.erreurs).toEqual([]);
    expect(r.chapitres.map((c) => c.monde)).toEqual(['physique']);
  });
  it('signale un chapitre dont la matière est absente du catalogue', () => {
    const r = validerContenu({ '/content/chimie/c.json': chapitre('chimie') }, cat([['algebre']]));
    expect(r.erreurs[0].messages.join()).toMatch(/absente de content\/catalogue.json/);
  });
  it('refuse une matière déclarée deux fois ou une couleur invalide', () => {
    expect(validerContenu({}, cat([['algebre'], ['algebre']])).erreurs).toHaveLength(1);
    const c = cat([['algebre']]);
    c.niveaux[0].matieres[0].couleur = 'violet';
    expect(validerContenu({}, c).erreurs).toHaveLength(1);
  });
  it('trie les chapitres selon l’ordre du catalogue', () => {
    const r = validerContenu({ '/content/b/c.json': { ...chapitre('b'), id: 'cb' }, '/content/a/c.json': { ...chapitre('a'), id: 'ca' } }, cat([['b', 'a']]));
    expect(r.chapitres.map((c) => c.id)).toEqual(['cb', 'ca']);
  });
});

/** Applique une vérification à chaque chapitre ; l'échec liste les chapitres fautifs. */
const pourChaqueChapitre = (verifier: (ch: Chapitre) => void) => toutVerifier(CONTENU.chapitres.map((ch) => [ch.id, () => verifier(ch)] as [string, () => void]));

describe('chaque chapitre', () => {
  it('contient assez de questions, de QCM et de flashcards', () =>
    pourChaqueChapitre((ch) => {
      const qcm = ch.exercices.filter((q) => q.type === 'qcm').length;
      // Les exercices « programme » sont à part : le ratio de QCM porte sur les questions courtes.
      const courtes = ch.exercices.filter((q) => q.type !== 'programme').length;
      expect(courtes).toBeGreaterThanOrEqual(10);
      expect(qcm).toBeGreaterThanOrEqual(4);
      expect(qcm / courtes).toBeGreaterThanOrEqual(0.35);
      expect(ch.flashcards.length).toBeGreaterThanOrEqual(10);
    }));

  it('propose les trois niveaux de difficulté et plusieurs types', () =>
    pourChaqueChapitre((ch) => {
      expect(new Set(ch.exercices.map((q) => q.difficulte)).size).toBe(3);
      expect(new Set(ch.exercices.map((q) => q.type)).size).toBeGreaterThanOrEqual(3);
    }));

  it('a un LaTeX valide partout', () =>
    pourChaqueChapitre((ch) => {
      const tous = [
        ch.resume,
        ...ch.cours.flatMap((s) => [s.titre, ...s.blocs.flatMap((b) => [b.texte, b.titre ?? ''])]),
        ...ch.flashcards.flatMap((f) => [f.recto, f.verso]),
        ...ch.exercices.flatMap(textes),
      ];
      const erreurs = tous.flatMap(erreursLatex);
      expect(erreurs, erreurs.join('\n')).toEqual([]);
    }));

  it('a des réponses attendues évaluables', () =>
    pourChaqueChapitre((ch) => {
      for (const q of ch.exercices) {
        if (q.type === 'numerique') {
          const saisie = Array.isArray(q.reponse) ? q.reponse.join(';') : String(q.reponse);
          expect(verifierNumerique(saisie, q.reponse, q.tolerance).statut, q.id).toBe('correct');
        }
        if (q.type === 'expression') expect(verifierExpression(q.reponse, q.reponse, q).statut, q.id).toBe('correct');
      }
    }));

  it('a des QCM avec 4 choix distincts et une explication par choix', () =>
    pourChaqueChapitre((ch) => {
      for (const q of ch.exercices) {
        if (q.type !== 'qcm') continue;
        expect(q.choix.length, q.id).toBeGreaterThanOrEqual(4);
        expect(new Set(q.choix.map((c) => c.texte)).size, q.id).toBe(q.choix.length);
        for (const c of q.choix) expect(c.explication.length, q.id).toBeGreaterThan(5);
      }
    }));
});
