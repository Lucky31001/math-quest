/** Écran « rien encore » : une icône, un message et un bouton pour démarrer (au lieu de compteurs à zéro). */
import { chapitresDe } from '../../core/loader';
import { h } from '../dom';
import { matiereSelectionnee } from '../selection';

export function etatVide(icone: string, titre: string, texte: string): HTMLElement {
  // Le premier chapitre de la matière affichée sur la carte : là où l'élève commencerait.
  const premier = chapitresDe(matiereSelectionnee() ?? '')[0];
  return h(
    'section',
    { class: 'etat-vide' },
    h('div', { class: 'etat-vide-icone', 'aria-hidden': 'true' }, icone),
    h('h2', null, titre),
    h('p', null, texte),
    h(
      'div',
      { class: 'actions' },
      premier
        ? h('a', { class: 'btn btn-primaire', href: `#/chapitre/${premier.id}/exercices` }, `${premier.icone} Commencer « ${premier.titre} »`)
        : null,
      h('a', { class: `btn ${premier ? '' : 'btn-primaire'}`, href: '#/' }, 'Voir la carte des chapitres'),
    ),
  );
}
