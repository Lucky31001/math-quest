/** Générateurs — limites usuelles en 0 et fonctions trigonométriques réciproques. */
import { randInt, pick } from '../core/random';
import type { Question } from '../core/schema';
import { Q, construireQcm, cleNum, piTex, piStr, type Generateur, type Candidat } from './outils';

const candQ = (v: Q, explication: string): Candidat => ({ texte: `$${v.tex()}$`, explication, cle: cleNum(v.valueOf()) });

/* ------------------------------------------------------------------ */
/* Limites « taux d'accroissement » en 0                               */
/* ------------------------------------------------------------------ */

export const limitesUsuelles: Generateur = {
  id: 'limites-usuelles',
  titre: 'Limites usuelles en 0',
  chapitre: 'limites-continuite',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const a = randInt(rng, 2, 5);
    let b = randInt(rng, 1, 5);
    while (b === a) b = randInt(rng, 1, 5);
    const bx = b === 1 ? 'x' : `${b}x`;
    const types = difficulte === 1 ? ['sin', 'exp'] : difficulte === 2 ? ['ln', 'exp', 'tan'] : ['cos', 'ln', 'tan'];
    const t = pick(rng, types);
    let enonce: string;
    let rep: Q;
    let regle: string;
    if (t === 'cos') {
      enonce = `\\lim_{x \\to 0} \\frac{1 - \\cos(${a}x)}{${b === 1 ? '' : b}x^2}`;
      rep = new Q(a * a, 2 * b);
      regle = `$1 - \\cos u \\sim \\frac{u^2}{2}$ en 0, avec $u = ${a}x$ : $1 - \\cos(${a}x) \\sim \\frac{${a * a}x^2}{2}$.`;
    } else {
      const num = { sin: `\\sin(${a}x)`, exp: `e^{${a}x} - 1`, ln: `\\ln(1 + ${a}x)`, tan: `\\tan(${a}x)` }[t]!;
      const eq = { sin: '\\sin u \\sim u', exp: 'e^u - 1 \\sim u', ln: '\\ln(1+u) \\sim u', tan: '\\tan u \\sim u' }[t]!;
      enonce = `\\lim_{x \\to 0} \\frac{${num}}{${bx}}`;
      rep = new Q(a, b);
      regle = `En 0, $${eq}$ avec $u = ${a}x \\to 0$ : le numérateur est équivalent à $${a}x$.`;
    }
    const correction = [regle, `Donc la limite vaut $${rep.tex()}$.`];
    const indice = 'Utilise les équivalents usuels en 0 (ou reconnais un taux d\'accroissement).';
    const enonceComplet = `Calculer $\\displaystyle ${enonce}$.`;
    if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce: enonceComplet, indice, correction, reponse: rep.toString() };
    const distracteurs =
      t === 'cos'
        ? [
            candQ(new Q(a, 2 * b), `$(${a}x)^2 = ${a * a}x^2$ : le coefficient est au carré.`),
            candQ(new Q(a * a, b), 'Oubli du $\\frac{1}{2}$ : $1 - \\cos u \\sim \\frac{u^2}{2}$.'),
            candQ(new Q(0), "$1 - \\cos u$ tend vers 0 mais pas plus vite que $x^2$ : il faut l'équivalent."),
          ]
        : [
            candQ(new Q(1), `Le coefficient $${a}$ (et le $${b}$ du dénominateur) ne disparaissent pas.`),
            candQ(new Q(b, a), 'Rapport inversé.'),
            candQ(new Q(a), `On a oublié le $${b}$ du dénominateur.`),
            candQ(new Q(0), 'Forme indéterminée $\\frac{0}{0}$ : ce n\'est pas 0.'),
          ];
    return construireQcm({ difficulte, enonce: enonceComplet, indice, correction }, candQ(rep, 'Équivalent usuel correctement appliqué.'), distracteurs);
  },
};

/* ------------------------------------------------------------------ */
/* arcsin(sin θ), arccos(cos θ), arctan(tan θ)                          */
/* ------------------------------------------------------------------ */

interface Reciproque {
  f: 'sin' | 'cos' | 'tan';
  nom: string;
  /** Intervalle image (multiples de π). */
  min: number;
  max: number;
  intervalle: string;
  angles: Q[];
}

const RECIPROQUES: Reciproque[] = [
  { f: 'sin', nom: '\\arcsin', min: -0.5, max: 0.5, intervalle: '\\left[-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right]', angles: [new Q(2, 3), new Q(3, 4), new Q(5, 6), new Q(7, 6), new Q(5, 4), new Q(4, 3)] },
  { f: 'cos', nom: '\\arccos', min: 0, max: 1, intervalle: '[0, \\pi]', angles: [new Q(-1, 3), new Q(-3, 4), new Q(7, 6), new Q(5, 4), new Q(5, 3), new Q(7, 4)] },
  { f: 'tan', nom: '\\arctan', min: -0.5, max: 0.5, intervalle: '\\left]-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right[', angles: [new Q(2, 3), new Q(3, 4), new Q(5, 6), new Q(7, 6), new Q(5, 4), new Q(4, 3)] },
];

const valeur = (f: Reciproque['f'], t: Q) => Math[f](Math.PI * t.valueOf());

/** L'unique antécédent de f(θ) dans l'intervalle image de la réciproque. */
export function reduire(r: Reciproque, theta: Q): Q {
  const cible = valeur(r.f, theta);
  const candidats = [theta, theta.neg(), new Q(1).sub(theta), theta.sub(1), new Q(2).sub(theta), theta.sub(2), theta.add(1), theta.add(2)];
  for (const c of candidats) {
    const v = c.valueOf();
    const dansI = r.f === 'tan' ? v > r.min && v < r.max : v >= r.min && v <= r.max;
    if (dansI && Math.abs(valeur(r.f, c) - cible) < 1e-9) return c;
  }
  throw new Error('réduction impossible');
}

export const trigoReciproques: Generateur = {
  id: 'trigo-reciproques',
  titre: 'arcsin, arccos, arctan',
  chapitre: 'fonctions-usuelles',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const r = pick(rng, difficulte === 1 ? [RECIPROQUES[0], RECIPROQUES[2]] : RECIPROQUES);
    const theta = pick(rng, r.angles);
    const rep = reduire(r, theta);
    const expr = `${r.nom}\\left(\\${r.f}\\left(${piTex(theta)}\\right)\\right)`;
    const enonce = `Calculer $${expr}$.`;
    const correction = [
      `$${r.nom}$ est à valeurs dans $${r.intervalle}$ : $${r.nom}(\\${r.f}\\theta) = \\theta$ seulement si $\\theta$ est dans cet intervalle.`,
      `Ici $${piTex(theta)} \\notin ${r.intervalle}$. On cherche $\\varphi \\in ${r.intervalle}$ tel que $\\${r.f}\\varphi = \\${r.f}\\left(${piTex(theta)}\\right)$.`,
      `$\\varphi = ${piTex(rep)}$ convient, donc $${expr} = ${piTex(rep)}$.`,
    ];
    const indice = `Dans quel intervalle $${r.nom}$ prend-il ses valeurs ?`;
    if (forme === 'libre')
      return { id: '', type: 'numerique', difficulte, enonce: `${enonce} (Réponse en fonction de pi, ex. « -pi/6 ».)`, indice, correction, reponse: piStr(rep) };
    const cand = (t: Q): Candidat => {
      const v = t.valueOf();
      const dansI = r.f === 'tan' ? v > r.min && v < r.max : v >= r.min && v <= r.max;
      const explication = !dansI
        ? `$${piTex(t)} \\notin ${r.intervalle}$ : ce ne peut pas être une valeur de $${r.nom}$.`
        : `$${piTex(t)}$ est bien dans $${r.intervalle}$, mais $\\${r.f}\\left(${piTex(t)}\\right) \\neq \\${r.f}\\left(${piTex(theta)}\\right)$.`;
      return { texte: `$${piTex(t)}$`, explication, cle: t.toString() };
    };
    return construireQcm(
      { difficulte, enonce, indice, correction },
      { texte: `$${piTex(rep)}$`, explication: 'Bon intervalle et même valeur de la fonction.', cle: rep.toString() },
      [cand(theta), cand(rep.neg()), cand(theta.neg()), cand(new Q(1).sub(theta)), cand(theta.sub(1))],
    );
  },
};
