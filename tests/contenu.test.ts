/**
 * Validation du contenu pédagogique (/content) :
 *  - chaque fichier respecte le schéma (sinon l'appli l'ignorerait) ;
 *  - volume minimal par chapitre (10 exercices dont ≥ 4 QCM et ~40 %, 10 flashcards) ;
 *  - tout le LaTeX se compile avec KaTeX (pas de faute de frappe invisible) ;
 *  - chaque réponse attendue est évaluable par le vérificateur.
 */
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { CONTENU } from '../src/core/loader';
import { verifierExpression, verifierNumerique } from '../src/core/checker';
import type { Question } from '../src/core/schema';

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
});

describe.each(CONTENU.chapitres.map((c) => [c.id, c] as const))('chapitre %s', (_id, ch) => {
  it('contient assez de questions, de QCM et de flashcards', () => {
    const qcm = ch.exercices.filter((q) => q.type === 'qcm').length;
    expect(ch.exercices.length).toBeGreaterThanOrEqual(10);
    expect(qcm).toBeGreaterThanOrEqual(4);
    expect(qcm / ch.exercices.length).toBeGreaterThanOrEqual(0.35);
    expect(ch.flashcards.length).toBeGreaterThanOrEqual(10);
  });

  it('propose les trois niveaux de difficulté et plusieurs types', () => {
    expect(new Set(ch.exercices.map((q) => q.difficulte)).size).toBe(3);
    expect(new Set(ch.exercices.map((q) => q.type)).size).toBeGreaterThanOrEqual(3);
  });

  it('a un LaTeX valide partout', () => {
    const tous = [
      ch.resume,
      ...ch.cours.flatMap((s) => [s.titre, ...s.blocs.flatMap((b) => [b.texte, b.titre ?? ''])]),
      ...ch.flashcards.flatMap((f) => [f.recto, f.verso]),
      ...ch.exercices.flatMap(textes),
    ];
    const erreurs = tous.flatMap(erreursLatex);
    expect(erreurs, erreurs.join('\n')).toEqual([]);
  });

  it('a des réponses attendues évaluables', () => {
    for (const q of ch.exercices) {
      if (q.type === 'numerique') {
        const saisie = Array.isArray(q.reponse) ? q.reponse.join(';') : String(q.reponse);
        expect(verifierNumerique(saisie, q.reponse, q.tolerance).statut, q.id).toBe('correct');
      }
      if (q.type === 'expression') expect(verifierExpression(q.reponse, q.reponse, q).statut, q.id).toBe('correct');
    }
  });

  it('a des QCM avec 4 choix distincts et une explication par choix', () => {
    for (const q of ch.exercices) {
      if (q.type !== 'qcm') continue;
      expect(q.choix.length, q.id).toBeGreaterThanOrEqual(4);
      expect(new Set(q.choix.map((c) => c.texte)).size, q.id).toBe(q.choix.length);
      for (const c of q.choix) expect(c.explication.length, q.id).toBeGreaterThan(5);
    }
  });
});
