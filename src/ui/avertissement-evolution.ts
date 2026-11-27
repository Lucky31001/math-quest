/**
 * Fenêtre affichée à la première visite : le site est en développement actif et
 * peut beaucoup changer. Une fois fermée, elle ne revient plus sur cet appareil
 * (localStorage). Changer la clé la fait réapparaître pour tout le monde.
 */
import { h } from './dom';

export const CLE_AVERTISSEMENT = 'math-quest:avertissement-evolution:1';

function dejaVu(): boolean {
  try {
    return localStorage.getItem(CLE_AVERTISSEMENT) !== null;
  } catch {
    return false;
  }
}

function noterVu(): void {
  try {
    localStorage.setItem(CLE_AVERTISSEMENT, new Date().toISOString());
  } catch {
    /* stockage indisponible : la fenêtre reviendra à la prochaine visite */
  }
}

export function afficherAvertissementEvolution(): void {
  if (dejaVu()) return;
  const fenetre = h(
    'dialog',
    { class: 'modale', 'aria-labelledby': 'avertissement-titre' },
    h('div', { class: 'modale-icone', 'aria-hidden': 'true' }, '🚧'),
    h('h2', { id: 'avertissement-titre' }, 'Math Quest évolue vite'),
    h('p', null, 'Le site est en plein développement : contenu, écrans et modes de jeu changent souvent, parfois d’un jour à l’autre.'),
    h('p', null, 'Ne sois pas surpris si quelque chose bouge ou disparaît entre deux visites. C’est normal !'),
    h('p', { class: 'modale-note' }, 'Ta progression est conservée d’une version à l’autre. Pour plus de sûreté, exporte-la de temps en temps dans ⚙️ Réglages.'),
    h('form', { method: 'dialog', class: 'actions' }, h('button', { class: 'btn btn-primaire', type: 'submit', autofocus: true }, 'Compris !')),
  );
  // « close » couvre le bouton comme la touche Échap.
  fenetre.addEventListener('close', () => {
    noterVu();
    fenetre.remove();
  });
  document.body.append(fenetre);
  fenetre.showModal();
}
