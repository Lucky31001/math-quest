/** Générateurs — suites réelles. */
import { randInt, randNonZero, pick } from '../core/random';
import type { Question } from '../core/schema';
import { Q, construireQcm, cleNum, combinaisonTex, type Generateur, type Candidat } from './outils';

const candQ = (v: Q | number, explication: string): Candidat => {
  const q = Q.of(v);
  return { texte: `$${q.tex()}$`, explication, cle: cleNum(q.valueOf()) };
};
const infini = (signe: 1 | -1, explication: string): Candidat => ({
  texte: `$${signe > 0 ? '+' : '-'}\\infty$`,
  explication,
  cle: signe > 0 ? '+inf' : '-inf',
});

/** Limite d'une fraction rationnelle en n, ou d'une forme √(n²+an) − n. */
export const limiteSuite: Generateur = {
  id: 'suites-limite',
  titre: 'Limites de suites',
  chapitre: 'suites',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    if (difficulte === 3) {
      const a = randNonZero(rng, -6, 6);
      const l = new Q(a, 2);
      const enonce = `Déterminer la limite de $u_n = \\sqrt{${combinaisonTex([[1, 'n^2'], [a, 'n']])}} - n$.`;
      const correction = [
        'Forme indéterminée $\\infty - \\infty$ : on multiplie par la quantité conjuguée.',
        `$u_n = \\frac{(n^2 ${a < 0 ? '-' : '+'} ${Math.abs(a)}n) - n^2}{\\sqrt{n^2 ${a < 0 ? '-' : '+'} ${Math.abs(a)}n} + n} = \\frac{${a}n}{n\\left(\\sqrt{1 ${a < 0 ? '-' : '+'} \\frac{${Math.abs(a)}}{n}} + 1\\right)}$.`,
        `Le dénominateur divisé par $n$ tend vers $2$, donc $u_n \\to \\frac{${a}}{2} = ${l.tex()}$.`,
      ];
      const indice = 'Multiplie et divise par $\\sqrt{n^2 + an} + n$.';
      if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: l.toString() };
      return construireQcm({ difficulte, enonce, indice, correction }, candQ(l, 'Quantité conjuguée puis factorisation par $n$.'), [
        candQ(0, "$\\infty - \\infty$ est une forme indéterminée : ce n'est pas $0$ en général."),
        candQ(a, 'Oubli du facteur 2 au dénominateur ($\\sqrt{1 + a/n} + 1 \\to 2$).'),
        infini(1, 'Forme indéterminée : il faut lever l\'indétermination.'),
      ]);
    }
    // (a n² + b n + c) / (d n² + e n + f)
    const a = randNonZero(rng, -6, 6);
    const b = randInt(rng, -5, 5);
    const c = randNonZero(rng, -5, 5);
    const d = randInt(rng, 1, 5);
    const e = randInt(rng, 1, 4);
    let f = randInt(rng, 1, 5);
    while (Math.abs(c * d - a * f) === 0) f = randInt(rng, 1, 6);
    const num = combinaisonTex([[a, 'n^2'], [b, 'n'], [c, '']]);
    const den = combinaisonTex([[d, 'n^2'], [e, 'n'], [f, '']]);
    // Difficulté 2 : le numérateur peut être de degré 1 ou 3.
    const variante = difficulte === 2 && forme === 'qcm' ? pick(rng, ['meme', 'plus', 'moins']) : 'meme';
    const numV = variante === 'plus' ? combinaisonTex([[a, 'n^3'], [b, 'n'], [c, '']]) : variante === 'moins' ? combinaisonTex([[a, 'n'], [c, '']]) : num;
    const l = new Q(a, d);
    const enonce = `Déterminer la limite de $u_n = \\dfrac{${numV}}{${den}}$.`;
    const indice = 'Factorise numérateur et dénominateur par leur terme de plus haut degré.';
    const correction =
      variante === 'meme'
        ? [
            `On factorise par $n^2$ : $u_n = \\dfrac{${a} + \\frac{${b}}{n} + \\frac{${c}}{n^2}}{${d} + \\frac{${e}}{n} + \\frac{${f}}{n^2}}$.`,
            `Les termes en $\\frac{1}{n}$ tendent vers 0 : $u_n \\to \\frac{${a}}{${d}} = ${l.tex()}$.`,
          ]
        : variante === 'plus'
          ? [`Termes dominants : $u_n \\sim \\frac{${a}n^3}{${d}n^2} = \\frac{${a}}{${d}}n$.`, `Donc $u_n \\to ${a > 0 ? '+' : '-'}\\infty$.`]
          : [`Termes dominants : $u_n \\sim \\frac{${a}n}{${d}n^2} = \\frac{${a}}{${d}n}$.`, 'Donc $u_n \\to 0$.'];
    if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: l.toString() };
    const sgn = (a > 0 ? 1 : -1) as 1 | -1;
    const bonne = variante === 'meme' ? candQ(l, 'Quotient des coefficients dominants.') : variante === 'plus' ? infini(sgn, 'Le degré du numérateur est plus grand.') : candQ(0, 'Le degré du dénominateur est plus grand.');
    return construireQcm({ difficulte, enonce, indice, correction }, bonne, [
      candQ(l, 'Quotient des coefficients de $n^2$ : valable seulement si les degrés sont égaux.'),
      candQ(new Q(c, f), "Ce sont les termes constants : ils deviennent négligeables quand $n \\to +\\infty$."),
      candQ(0, "Le numérateur ne devient pas négligeable : il est du même ordre que le dénominateur."),
      infini(sgn, 'Ce n\'est pas parce que numérateur et dénominateur tendent vers l\'infini que le quotient aussi.'),
      candQ(new Q(a + (variante === 'moins' ? 0 : b) + c, d + e + f), "C'est $u_1$, pas la limite."),
    ]);
  },
};

/** Suite arithmético-géométrique u_{n+1} = q u_n + r. */
export const arithmeticoGeometrique: Generateur = {
  id: 'suites-arithmetico-geometrique',
  titre: 'Suites arithmético-géométriques',
  chapitre: 'suites',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const q = pick(rng, difficulte === 1 ? [new Q(1, 2), new Q(1, 3)] : [new Q(1, 2), new Q(-1, 2), new Q(2, 3), new Q(1, 4), new Q(-1, 3)]);
    let r = randNonZero(rng, -6, 6);
    const u0 = randInt(rng, 0, 5);
    const l = new Q(r).div(new Q(1).sub(q));
    if (l.equals(u0)) r += 1;
    const L = new Q(r).div(new Q(1).sub(q));
    const enonce = `Soit $u_0 = ${u0}$ et $u_{n+1} = ${q.tex()}\\,u_n ${r < 0 ? '-' : '+'} ${Math.abs(r)}$. Déterminer $\\lim u_n$.`;
    const correction = [
      `Point fixe : $\\ell = ${q.tex()}\\ell ${r < 0 ? '-' : '+'} ${Math.abs(r)}$, donc $\\ell = \\frac{${r}}{1 - ${q.n < 0 ? `(${q.tex()})` : q.tex()}} = ${L.tex()}$.`,
      `$v_n = u_n - \\ell$ vérifie $v_{n+1} = ${q.tex()}\\,v_n$ : suite géométrique de raison $${q.tex()}$.`,
      `Comme $|${q.tex()}| < 1$, $v_n \\to 0$, donc $u_n \\to ${L.tex()}$ (quel que soit $u_0$).`,
    ];
    const indice = "Cherche le point fixe $\\ell = q\\ell + r$, puis étudie $v_n = u_n - \\ell$.";
    if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: L.toString() };
    return construireQcm({ difficulte, enonce, indice, correction }, candQ(L, 'Point fixe, et $|q| < 1$.'), [
      candQ(new Q(r).div(new Q(1).add(q)), 'Erreur de signe en résolvant $\\ell = q\\ell + r$ : $\\ell(1 - q) = r$.'),
      candQ(u0, 'La limite ne dépend pas de $u_0$ quand $|q| < 1$.'),
      candQ(r, "Oubli de la division par $1 - q$."),
      candQ(new Q(r).div(q), "Équation du point fixe mal écrite."),
      candQ(0, '$v_n = u_n - \\ell$ tend vers 0, mais $u_n$ tend vers $\\ell$.'),
    ]);
  },
};
