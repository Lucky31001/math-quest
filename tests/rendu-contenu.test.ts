// @vitest-environment happy-dom
/**
 * Chaque texte du contenu (cours, énoncés, corrections, flashcards…) passe par
 * le rendu de l'application : aucune formule en erreur, aucun `$` ni `**` restés bruts.
 */
import { describe, it } from 'vitest';
import { CONTENU } from './outils/contenu';
import { toutVerifier } from './outils/tout-verifier';
import { rendreHtml } from '../src/ui/texte';

/** Champs qui ne sont pas du texte affiché avec rendreHtml (code C brut, réponses à saisir…). */
const IGNORES = new Set(['$schema', 'id', 'code', 'harnais', 'solution', 'reponse', 'tests', 'entree', 'sortie', 'generateur', 'icone', 'emblème', 'couleur', 'couleurFonce']);

function textes(valeur: unknown, chemin: string, sortie: [string, string][]) {
  if (typeof valeur === 'string') sortie.push([chemin, valeur]);
  else if (Array.isArray(valeur)) valeur.forEach((v, i) => textes(v, `${chemin}[${i}]`, sortie));
  else if (valeur && typeof valeur === 'object')
    for (const [k, v] of Object.entries(valeur)) if (!IGNORES.has(k)) textes(v, `${chemin}.${k}`, sortie);
}

describe('rendu du contenu', () => {
  it('tout texte se rend sans LaTeX en erreur ni balisage resté brut', () => {
    const cas: [string, () => void][] = [];
    for (const ch of CONTENU.chapitres) {
      const liste: [string, string][] = [];
      textes(ch, ch.id, liste);
      for (const [chemin, texte] of liste)
        cas.push([chemin, () => {
          const html = rendreHtml(texte);
          if (html.includes('katex-error')) throw new Error(`LaTeX invalide : ${texte}`);
          const div = document.createElement('div');
          div.innerHTML = html;
          div.querySelectorAll('.katex, .katex-display, pre, code').forEach((e) => e.remove());
          if (/\*\*|\$/.test(div.textContent ?? ''))
            throw new Error(`balisage brut : ${texte}`);
        }]);
    }
    toutVerifier(cas);
  });
});
