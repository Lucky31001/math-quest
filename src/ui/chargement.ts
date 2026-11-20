/**
 * Écran qui dépend de contenu chargé à la demande (chapitres complets) :
 * affiche « Chargement… », puis l'écran, ou une erreur avec « Réessayer ».
 * Si l'élève quitte l'écran avant la fin du chargement, rien n'est affiché.
 */
import { h } from './dom';
import { ErreurChapitre } from '../core/loader';

export function ecranApresChargement<T>(main: HTMLElement, charger: () => Promise<T>, rendre: (donnees: T) => (() => void) | void): () => void {
  let actif = true;
  let nettoyer: (() => void) | void;
  const attente = h('p', { class: 'chargement', role: 'status' }, 'Chargement…');
  // Le message n'apparaît que si le chargement dure (sinon, simple clignotement).
  attente.hidden = true;
  const minuterie = setTimeout(() => (attente.hidden = false), 150);
  main.append(attente);

  const lancer = () => {
    charger().then(
      (donnees) => {
        clearTimeout(minuterie);
        if (!actif) return;
        attente.remove();
        nettoyer = rendre(donnees);
      },
      (e: unknown) => {
        clearTimeout(minuterie);
        if (!actif) return;
        const detail = e instanceof ErreurChapitre ? e.messages.slice(0, 5) : [e instanceof Error ? e.message : String(e)];
        attente.replaceWith(
          h(
            'div',
            { class: 'carte-vide', role: 'alert' },
            h('p', null, '⚠️ Impossible de charger ce contenu.'),
            h('ul', null, detail.map((m) => h('li', null, m))),
            h(
              'div',
              { class: 'actions' },
              h('button', { class: 'btn', type: 'button', onclick: () => location.reload() }, 'Réessayer'),
              h('a', { class: 'btn', href: '#/' }, 'Accueil'),
            ),
          ),
        );
      },
    );
  };
  lancer();
  return () => {
    actif = false;
    clearTimeout(minuterie);
    if (typeof nettoyer === 'function') nettoyer();
  };
}
