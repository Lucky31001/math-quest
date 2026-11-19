/**
 * Icônes SVG en ligne (traits arrondis, couleur = currentColor).
 * Plus fiables que des caractères (←, ✕, ✓) dont l'alignement dépend de la police.
 */
import { h } from './dom';

const TRACES = {
  retour: '<path d="M15 5 8 12l7 7"/>',
  croix: '<path d="M6 6l12 12M18 6 6 18"/>',
  coche: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  horloge: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9.5 3h5"/>',
  ampoule: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3Z"/>',
} as const;

export type NomIcone = keyof typeof TRACES;

/** Élément <span class="icone"> contenant le SVG demandé (décoratif : aria-hidden). */
export function icone(nom: NomIcone, classe = ''): HTMLSpanElement {
  return h('span', {
    class: `icone ${classe}`.trim(),
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${TRACES[nom]}</svg>`,
  });
}
