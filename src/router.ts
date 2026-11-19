/**
 * Routeur par hash (#/chemin) : fonctionne tel quel sur GitHub Pages, sans configuration serveur.
 *
 *   #/                         carte des mondes
 *   #/chapitre/:id[/:onglet]   cours | flashcards | exercices
 *   #/jouer/:mode[/:chap[/:d]] entrainement, infini, boss, survie, eclair, revision
 *   #/revision                 révision du jour
 *   #/stats  #/badges  #/reglages
 */
export type Ecran = (main: HTMLElement, params: string[]) => void | (() => void);

const routes: [string, Ecran][] = [];
let nettoyage: (() => void) | void;

export function route(prefixe: string, ecran: Ecran): void {
  routes.push([prefixe, ecran]);
}

export function aller(chemin: string): void {
  if (location.hash === `#${chemin}`) rendre();
  else location.hash = chemin;
}

export function demarrer(main: HTMLElement): void {
  addEventListener('hashchange', () => rendre(main));
  rendre(main);
}

let mainCourant: HTMLElement | null = null;
function rendre(main: HTMLElement | null = mainCourant): void {
  if (!main) return;
  mainCourant = main;
  const chemin = location.hash.replace(/^#/, '') || '/';
  const morceaux = chemin.split('/').filter(Boolean).map(decodeURIComponent);
  const nom = morceaux[0] ?? '';
  const trouve = routes.find(([p]) => p === nom) ?? routes.find(([p]) => p === '')!;
  if (typeof nettoyage === 'function') nettoyage();
  main.replaceChildren();
  window.scrollTo({ top: 0 });
  nettoyage = trouve[1](main, morceaux.slice(1));
  main.focus({ preventScroll: true });
}
