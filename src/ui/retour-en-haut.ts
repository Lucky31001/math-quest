/**
 * Bouton « retour en haut », en bas à droite. Il n'apparaît que sur une page
 * longue, une fois qu'on a fait défiler plus d'un écran. Masqué en CSS quand une
 * barre du bas (.pied, Vérifier / Continuer) est affichée.
 */
import { h } from './dom';

export function creerRetourEnHaut(): HTMLButtonElement {
  const bouton = h(
    'button',
    {
      class: 'haut-de-page',
      type: 'button',
      title: 'Revenir en haut',
      'aria-label': 'Revenir en haut de la page',
      tabindex: '-1',
      onclick: () => {
        const doux = !matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: doux ? 'smooth' : 'auto' });
        document.getElementById('contenu')?.focus({ preventScroll: true });
      },
    },
    h('span', { 'aria-hidden': 'true' }, '↑'),
  );

  let prevu = false;
  const actualiser = () => {
    prevu = false;
    const visible = window.scrollY > window.innerHeight;
    bouton.classList.toggle('visible', visible);
    // Hors de l'ordre de tabulation tant qu'il est caché.
    bouton.tabIndex = visible ? 0 : -1;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (prevu) return;
      prevu = true;
      requestAnimationFrame(actualiser);
    },
    { passive: true },
  );
  window.addEventListener('resize', actualiser, { passive: true });
  return bouton;
}
