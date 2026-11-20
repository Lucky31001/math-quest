/**
 * Courbe des notes d'examen blanc d'une matière (sur 20), en SVG.
 *
 * Une seule série par courbe (le titre de la carte nomme la matière, donc pas de
 * légende) : ligne de 2 px à la couleur de la matière (`--couleur`), points de
 * 8 px, grille discrète à 10 et 20. Survol d'un point : infobulle avec la date
 * et la note. Le SVG est décoratif pour les lecteurs d'écran : les notes sont
 * données en texte à côté (voir l'écran Statistiques).
 */
import { h } from '../dom';

const NS = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, ...enfants: Node[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.append(...enfants);
  return el;
}

const noteFr = (n: number) => String(n).replace('.', ',');
const dateFr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export function courbeNotes(notes: readonly { date: string; note: number }[]): HTMLElement {
  const L = 320;
  const H = 120;
  const marge = { g: 26, d: 10, h: 8, b: 8 };
  const x = (i: number) => marge.g + (notes.length === 1 ? (L - marge.g - marge.d) / 2 : (i * (L - marge.g - marge.d)) / (notes.length - 1));
  const y = (n: number) => marge.h + ((20 - n) * (H - marge.h - marge.b)) / 20;

  const infobulle = h('div', { class: 'courbe-infobulle', role: 'status', hidden: true });
  const montrer = (i: number) => {
    infobulle.textContent = `${dateFr(notes[i].date)} : ${noteFr(notes[i].note)}/20`;
    infobulle.style.left = `${(x(i) / L) * 100}%`;
    // Au-dessus du point, ou en dessous s'il est près du haut (pour ne pas sortir du graphique).
    const yi = y(notes[i].note);
    infobulle.style.top = `${(yi / H) * 100}%`;
    infobulle.classList.toggle('dessous', yi < H * 0.35);
    infobulle.hidden = false;
  };
  const cacher = () => (infobulle.hidden = true);

  const grille = [0, 10, 20].map((v) =>
    svg('g', {}, svg('line', { x1: marge.g, x2: L - marge.d, y1: y(v), y2: y(v), class: v === 10 ? 'courbe-moyenne' : 'courbe-grille' }), svg('text', { x: marge.g - 6, y: y(v) + 4, class: 'courbe-axe' }, document.createTextNode(String(v)))),
  );
  const ligne = notes.length > 1 ? svg('polyline', { points: notes.map((n, i) => `${x(i)},${y(n.note)}`).join(' '), class: 'courbe-ligne' }) : null;
  const points = notes.map((n, i) => {
    const g = svg(
      'g',
      { class: 'courbe-point' },
      // Zone de survol plus grande que le point.
      svg('circle', { cx: x(i), cy: y(n.note), r: 12, class: 'courbe-cible' }),
      svg('circle', { cx: x(i), cy: y(n.note), r: 4, class: 'courbe-marque' }),
    );
    g.addEventListener('pointerenter', () => montrer(i));
    g.addEventListener('pointerleave', cacher);
    return g;
  });
  const graphique = svg('svg', { viewBox: `0 0 ${L} ${H}`, class: 'courbe', 'aria-hidden': 'true' }, ...grille, ...(ligne ? [ligne] : []), ...points);
  return h('div', { class: 'courbe-conteneur' }, graphique, infobulle);
}
