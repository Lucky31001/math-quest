/**
 * Éditeur de code C minimal (zone de texte) : Tab = 4 espaces, Entrée conserve
 * l'indentation (et l'augmente après « { »), Ctrl/Cmd + Entrée = exécuter.
 * Partagé par l'atelier et les exercices « programme ».
 */
import { h } from '../dom';

export interface OptionsEditeurC {
  valeur: string;
  libelle?: string;
  /** Ctrl/Cmd + Entrée. */
  surExecuter?: () => void;
  /** Après chaque modification (saisie ou touche gérée ici). */
  surModif?: () => void;
  lignes?: number;
}

export function creerEditeurC(o: OptionsEditeurC): HTMLTextAreaElement {
  const editeur = h('textarea', {
    class: 'editeur-c',
    spellcheck: 'false',
    autocapitalize: 'off',
    autocomplete: 'off',
    wrap: 'off',
    rows: o.lignes,
    'aria-label': o.libelle ?? 'Code C',
  });
  editeur.value = o.valeur;
  editeur.addEventListener('input', () => o.surModif?.());
  editeur.addEventListener('keydown', (e) => {
    const { selectionStart: debut, selectionEnd: fin, value } = editeur;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      o.surExecuter?.();
    } else if (e.key === 'Tab' && !e.shiftKey && debut === fin) {
      e.preventDefault();
      editeur.setRangeText('    ', debut, fin, 'end');
      o.surModif?.();
    } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      const ligne = value.slice(value.lastIndexOf('\n', debut - 1) + 1, debut);
      const indentation = /^\s*/.exec(ligne)![0] + (/\{\s*$/.test(ligne) ? '    ' : '');
      if (!indentation) return;
      e.preventDefault();
      editeur.setRangeText(`\n${indentation}`, debut, fin, 'end');
      o.surModif?.();
    }
  });
  return editeur;
}
