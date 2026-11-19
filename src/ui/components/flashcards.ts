/**
 * Paquet de flashcards : on retourne la carte (clic, Espace), puis on s'auto-évalue
 * (« Je savais » → boîte suivante, « À revoir » → boîte 1). Raccourcis : Espace, 1, 2.
 */
import type { Chapitre, Flashcard } from '../../core/schema';
import { cle } from '../../core/loader';
import { shuffle } from '../../core/random';
import { h } from '../dom';
import { riche } from '../texte';
import { etat } from '../etat';
import { enregistrerFlashcard } from '../../game/progres';
import { jouerSon, xpFlottant } from '../effets';
import { icone } from '../icones';

export interface CarteChapitre {
  chapitre: Chapitre;
  flashcard: Flashcard;
}

export function paquetFlashcards(cartes: CarteChapitre[], surFin?: (connues: number, total: number) => void): { el: HTMLElement; detruire: () => void } {
  const paquet = shuffle(cartes);
  let i = 0;
  let retournee = false;
  let connues = 0;
  const el = h('div', { class: 'paquet' });

  function afficher() {
    if (i >= paquet.length) {
      el.replaceChildren(
        h(
          'div',
          { class: 'bilan' },
          h('h2', null, '🎴 Paquet terminé'),
          h('p', null, `${connues}/${paquet.length} carte(s) connue(s).`),
          h('p', { class: 'note' }, 'Les cartes « à revoir » reviendront dans ta révision du jour.'),
          h('button', { class: 'btn btn-primaire', type: 'button', onclick: () => ((i = 0), (connues = 0), afficher()) }, '🔁 Recommencer'),
        ),
      );
      surFin?.(connues, paquet.length);
      return;
    }
    retournee = false;
    const { chapitre, flashcard } = paquet[i];
    const carte = h(
      'button',
      { class: 'flashcard', type: 'button', 'aria-label': 'Retourner la carte (Espace)' },
      h('div', { class: 'face recto' }, h('span', { class: 'face-label' }, `${chapitre.icone} Question`), riche('div', flashcard.recto, 'face-texte')),
      h('div', { class: 'face verso' }, h('span', { class: 'face-label' }, 'Réponse'), riche('div', flashcard.verso, 'face-texte')),
    );
    const boutons = h(
      'div',
      { class: 'actions eval', hidden: true },
      h('button', { class: 'btn btn-rate', type: 'button', title: 'À revoir (touche 1)', onclick: () => noter(false) }, icone('croix'), h('span', null, 'À revoir'), h('kbd', null, '1')),
      h('button', { class: 'btn btn-reussi', type: 'button', title: 'Je savais (touche 2)', onclick: () => noter(true) }, icone('coche'), h('span', null, 'Je savais'), h('kbd', null, '2')),
    );
    const retourner = () => {
      retournee = !retournee;
      carte.classList.toggle('retournee', retournee);
      boutons.hidden = false;
    };
    carte.onclick = retourner;
    el.replaceChildren(h('p', { class: 'compteur' }, `Carte ${i + 1}/${paquet.length}`), carte, h('p', { class: 'aide' }, 'Clique ou appuie sur Espace pour retourner.'), boutons);
    (el as unknown as { retourner: () => void }).retourner = retourner;
    function noter(connue: boolean) {
      const gain = etat.modifier((p) => enregistrerFlashcard(p, cle(chapitre.id, flashcard.id), connue, etat.aujourdhui()));
      if (connue) {
        connues++;
        jouerSon('clic');
        xpFlottant(boutons, `+${gain} XP`);
      }
      i++;
      afficher();
    }
    (el as unknown as { noter: (b: boolean) => void }).noter = noter;
  }

  const surTouche = (e: KeyboardEvent) => {
    if (!el.isConnected || i >= paquet.length || (e.target as HTMLElement)?.tagName === 'INPUT') return;
    const api = el as unknown as { retourner: () => void; noter: (b: boolean) => void };
    if (e.key === ' ') {
      e.preventDefault();
      api.retourner();
    } else if (retournee && (e.key === '1' || e.key === '2')) api.noter(e.key === '2');
  };
  document.addEventListener('keydown', surTouche);
  afficher();
  return { el, detruire: () => document.removeEventListener('keydown', surTouche) };
}
