/** Générateurs — suites d'ordre 2, limites par factorisation, tangentes, limites par DL, exp/ln. */
import { randInt, randNonZero, pick } from '../core/random';
import type { Question } from '../core/schema';
import { Q, construireQcm, cleNum, combinaisonTex, polyTex, fact, type Generateur, type Candidat } from './outils';
import { USUELLES, substituer } from './developpements-limites';

const candN = (v: number | Q, explication: string): Candidat => {
  const q = Q.of(v);
  return { texte: `$${q.tex()}$`, explication, cle: cleNum(q.valueOf()) };
};
const par = (v: number) => (v < 0 ? `(${v})` : String(v));

/* ------------------------------------------------------------------ */
/* Suites récurrentes linéaires d'ordre 2                              */
/* ------------------------------------------------------------------ */

/** λ·r^n en LaTeX : r = 1 → λ ; r = -2 → λ(-2)^n. */
const termeTex = (l: number, r: number): [number, string] => [l, r === 1 ? '' : r < 0 ? `(${r})^n` : Math.abs(l) === 1 ? `${r}^n` : `\\times ${r}^n`];

export const suiteOrdre2: Generateur = {
  id: 'suites-ordre-2',
  titre: 'Suites récurrentes d\'ordre 2',
  chapitre: 'suites',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    let r1 = 0;
    let r2 = 0;
    while (r1 === r2 || Math.abs(r1) === Math.abs(r2)) {
      r1 = randNonZero(rng, -3, 3);
      r2 = randNonZero(rng, difficulte === 1 ? 1 : -3, 3);
    }
    const l = randNonZero(rng, -3, 3);
    const m = randNonZero(rng, -3, 3);
    const a = r1 + r2;
    const b = -r1 * r2;
    const u = (n: number) => l * r1 ** n + m * r2 ** n;
    const rec = `u_{n+2} = ${combinaisonTex([[a, 'u_{n+1}'], [b, 'u_n']])}`;
    const enonceBase = `Soit $(u_n)$ définie par $u_0 = ${u(0)}$, $u_1 = ${u(1)}$ et $${rec}$.`;
    const formule = (x: number, p: number, y: number, q: number) => combinaisonTex([termeTex(x, p), termeTex(y, q)]);
    const correction = [
      `Équation caractéristique : $r^2 = ${combinaisonTex([[a, 'r'], [b, '']])}$, soit $${combinaisonTex([[1, 'r^2'], [-a, 'r'], [-b, '']])} = 0$ : racines $${r1}$ et $${r2}$.`,
      `Donc $u_n = \\lambda ${par(r1)}^n + \\mu ${par(r2)}^n$.`,
      `$u_0 = \\lambda + \\mu = ${u(0)}$ et $u_1 = ${r1}\\lambda + ${par(r2)}\\mu = ${u(1)}$ donnent $\\lambda = ${l}$, $\\mu = ${m}$.`,
      `$u_n = ${formule(l, r1, m, r2)}$.`,
    ];
    const indice = 'Cherche les racines de $r^2 = ar + b$, puis $\\lambda, \\mu$ avec $u_0$ et $u_1$.';
    if (forme === 'libre') {
      const k = randInt(rng, 5, 7);
      return { id: '', type: 'numerique', difficulte, enonce: `${enonceBase} Calculer $u_{${k}}$.`, indice, correction: [...correction, `$u_{${k}} = ${u(k)}$.`], reponse: u(k) };
    }
    const cand = (x: number, p: number, y: number, q: number, explication: string): Candidat => ({
      texte: `$u_n = ${formule(x, p, y, q)}$`,
      explication,
      cle: [0, 1, 2, 3, 4].map((n) => x * p ** n + y * q ** n).join(','),
    });
    return construireQcm({ difficulte, enonce: `${enonceBase} Quelle est l'expression de $u_n$ ?`, indice, correction }, cand(l, r1, m, r2, 'Racines et constantes correctes.'), [
      cand(l, -r1, m, -r2, "Signes des racines faux : l'équation caractéristique est $r^2 - ar - b = 0$."),
      cand(m, r1, l, r2, '$\\lambda$ et $\\mu$ échangés : vérifie $u_1$.'),
      cand(u(0), r1, u(1) - u(0), r2, 'Constantes mal déterminées : on n\'a pas $\\lambda = u_0$ en général.'),
      cand(l, r2, m, r1, '$\\lambda$ et $\\mu$ associés aux mauvaises racines.'),
      cand(l, r1, m, -r2, 'Signe d\'une racine faux.'),
      cand(l, -r1, m, r2, 'Signe d\'une racine faux.'),
    ]);
  },
};

/* ------------------------------------------------------------------ */
/* Limites par factorisation / quantité conjuguée                       */
/* ------------------------------------------------------------------ */

export const limitesFactorisation: Generateur = {
  id: 'limites-factorisation',
  titre: 'Lever une forme 0/0',
  chapitre: 'limites-continuite',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const genre = pick(rng, difficulte === 1 ? ['carre'] : difficulte === 2 ? ['trinome', 'puissance'] : ['racine', 'puissance', 'trinome']);
    let lim: string;
    let rep: Q;
    let correction: string[];
    let distr: Candidat[];
    if (genre === 'carre') {
      const a = randNonZero(rng, -5, 5);
      lim = `\\lim_{x \\to ${a}} \\frac{x^2 - ${a * a}}{${combinaisonTex([[1, 'x'], [-a, '']])}}`;
      rep = new Q(2 * a);
      correction = [`$x^2 - ${a * a} = (x - ${par(a)})(x + ${par(a)})$.`, `Pour $x \\neq ${a}$, le quotient vaut $x + ${par(a)} \\to ${2 * a}$.`];
      distr = [candN(0, 'Forme $\\frac00$ : ce n\'est pas 0 tant qu\'on n\'a pas simplifié.'), candN(a, `On a simplifié en $x$ au lieu de $x + ${par(a)}$.`), candN(a * a, 'Ni le numérateur ni le dénominateur ne tendent vers ça.'), candN(-2 * a, 'Erreur de signe.'), candN(2 * a + 1, 'Erreur de calcul.')];
    } else if (genre === 'trinome') {
      const a = randNonZero(rng, -4, 4);
      let b = randInt(rng, -4, 4);
      while (b === a) b = randInt(rng, -4, 4);
      const num = polyTex([new Q(a * b), new Q(-(a + b)), new Q(1)]);
      lim = `\\lim_{x \\to ${a}} \\frac{${num}}{${combinaisonTex([[1, 'x'], [-a, '']])}}`;
      rep = new Q(a - b);
      correction = [`$${a}$ est racine du numérateur : $${num} = (x - ${par(a)})(x - ${par(b)})$.`, `Le quotient vaut $x - ${par(b)} \\to ${a - b}$.`];
      distr = [candN(b - a, 'Erreur de signe dans la factorisation.'), candN(0, 'Forme $\\frac00$ : il faut factoriser.'), candN(a + b, 'Ce serait la limite de $x + b$ ; le facteur restant est $x - b$.'), candN(a, 'On a remplacé $x$ par $a$ dans un seul facteur.'), candN(a - b + 1, 'Erreur de calcul.')];
    } else if (genre === 'puissance') {
      const n = randInt(rng, 3, 4);
      const a = randInt(rng, 1, 3);
      lim = `\\lim_{x \\to ${a}} \\frac{x^{${n}} - ${a ** n}}{x - ${a}}`;
      rep = new Q(n * a ** (n - 1));
      correction = [`On reconnaît le taux d'accroissement de $x \\mapsto x^{${n}}$ en $${a}$.`, `La limite est la dérivée en $${a}$ : $${n} \\times ${a}^{${n - 1}} = ${n * a ** (n - 1)}$.`];
      distr = [candN(a ** (n - 1), `Oubli du facteur $${n}$ de la dérivée.`), candN(n * a ** n, 'Exposant non diminué : $(x^n)\' = nx^{n-1}$.'), candN((n - 1) * a ** (n - 1), 'Le facteur est $n$, pas $n - 1$.'), candN(0, 'Forme $\\frac00$.')];
    } else {
      const c = randInt(rng, 1, 4);
      lim = `\\lim_{x \\to 0} \\frac{\\sqrt{x + ${c * c}} - ${c}}{x}`;
      rep = new Q(1, 2 * c);
      correction = [`Quantité conjuguée : $\\dfrac{(x + ${c * c}) - ${c * c}}{x(\\sqrt{x + ${c * c}} + ${c})} = \\dfrac{1}{\\sqrt{x + ${c * c}} + ${c}}$.`, `Limite : $\\dfrac{1}{${c} + ${c}} = ${rep.tex()}$.`];
      distr = [candN(new Q(1, c), `Le dénominateur tend vers $${c} + ${c} = ${2 * c}$, pas $${c}$.`), candN(0, 'Forme $\\frac00$ : il faut la quantité conjuguée.'), candN(new Q(c, 2), 'Fraction renversée.'), candN(2 * c, 'On a pris le dénominateur au lieu de son inverse.')];
    }
    const enonce = `Calculer $\\displaystyle ${lim}$.`;
    const indice = 'Forme $\\frac00$ : factorise par $(x - a)$, reconnais une dérivée, ou utilise la quantité conjuguée.';
    if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: rep.toString() };
    return construireQcm({ difficulte, enonce, indice, correction }, candN(rep, 'Indétermination levée.'), distr);
  },
};

/* ------------------------------------------------------------------ */
/* Équation de tangente                                                */
/* ------------------------------------------------------------------ */

export const tangente: Generateur = {
  id: 'derivabilite-tangente',
  titre: 'Équation de tangente',
  chapitre: 'derivabilite',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    let fTex: string;
    let fa: Q;
    let fpa: Q;
    let calc: string;
    const a = difficulte === 1 ? randInt(rng, 1, 3) : randNonZero(rng, -2, 2);
    if (difficulte < 3) {
      const c = difficulte === 1 ? [randInt(rng, -4, 4), randInt(rng, -4, 4), randNonZero(rng, -3, 3)] : [randInt(rng, -4, 4), randInt(rng, -3, 3), randInt(rng, -2, 2), randNonZero(rng, -2, 2)];
      const P = c.map((x) => new Q(x));
      const D = P.slice(1).map((x, k) => x.mul(k + 1));
      const ev = (p: Q[], x: number) => p.reduce((s, ck, k) => s.add(ck.mul(new Q(x).pow(k))), new Q(0));
      fTex = polyTex(P);
      fa = ev(P, a);
      fpa = ev(D, a);
      calc = `$f'(x) = ${polyTex(D)}$, donc $f(${a}) = ${fa.tex()}$ et $f'(${a}) = ${fpa.tex()}$.`;
    } else {
      const al = randNonZero(rng, -4, 4);
      let q = randNonZero(rng, -3, 3);
      while (a + q === 0) q = randNonZero(rng, -3, 3);
      fTex = `\\dfrac{${al}}{${combinaisonTex([[1, 'x'], [q, '']])}}`;
      fa = new Q(al, a + q);
      fpa = new Q(-al, (a + q) ** 2);
      calc = `$f'(x) = \\dfrac{${-al}}{(${combinaisonTex([[1, 'x'], [q, '']])})^2}$, donc $f(${a}) = ${fa.tex()}$ et $f'(${a}) = ${fpa.tex()}$.`;
    }
    const m = fpa;
    const p = fa.sub(fpa.mul(a));
    const droite = (pente: Q, ordonnee: Q) => combinaisonTex([[pente, 'x'], [ordonnee, '']]);
    const correction = [
      `Tangente en $a$ : $y = f'(a)(x - a) + f(a)$.`,
      calc,
      `$y = ${m.tex()}(x - ${par(a)}) + ${fa.n < 0 ? `(${fa.tex()})` : fa.tex()}$, soit $y = ${droite(m, p)}$.`,
    ];
    const enonce = `Donner l'équation de la tangente à la courbe de $f(x) = ${fTex}$ au point d'abscisse $${a}$.`;
    const indice = '$y = f\'(a)(x - a) + f(a)$.';
    if (forme === 'libre')
      return {
        id: '',
        type: 'expression',
        difficulte,
        enonce: `${enonce} Écris seulement le membre de droite ($y = \\dots$, en fonction de $x$).`,
        indice,
        correction,
        reponse: `${m.str()}*x + ${p.str()}`,
        variables: ['x'],
      };
    const cand = (pente: Q, ordonnee: Q, explication: string): Candidat => ({ texte: `$y = ${droite(pente, ordonnee)}$`, explication, cle: `${pente}|${ordonnee}` });
    return construireQcm({ difficulte, enonce, indice, correction }, cand(m, p, 'Pente $f\'(a)$, et la droite passe par $(a, f(a))$.'), [
      cand(m, fa, 'Oubli du $-a$ : la droite doit passer par $(a, f(a))$, pas par $(0, f(a))$.'),
      cand(fa, m.sub(fa.mul(a)), 'Rôles de $f(a)$ et $f\'(a)$ inversés.'),
      cand(m, fa.add(m.mul(a)), 'Signe : c\'est $(x - a)$, pas $(x + a)$.'),
      cand(m.neg(), fa.add(m.mul(a)), 'Pente de signe opposé.'),
      cand(m, new Q(0), "Oubli de l'ordonnée à l'origine : la tangente ne passe pas forcément par l'origine."),
      cand(m, p.neg(), "Signe de l'ordonnée à l'origine faux."),
      cand(m.add(1), p, 'Erreur dans le calcul de $f\'(a)$.'),
    ]);
  },
};

/* ------------------------------------------------------------------ */
/* Limites calculées par DL                                            */
/* ------------------------------------------------------------------ */

export const limiteParDl: Generateur = {
  id: 'dl-limite',
  titre: 'Limites par DL',
  chapitre: 'developpements-limites',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    for (;;) {
      const f = pick(rng, USUELLES);
      const a = difficulte === 1 ? 1 : pick(rng, difficulte === 2 ? [1, 2, -1] : [2, -2, 3]);
      const c = substituer(f.coefs, a);
      const k = pick(rng, difficulte === 1 ? [0, 1] : [1, 2]); // ordre de troncature
      if (c[k + 1].zero) continue;
      const T = c.slice(0, k + 1);
      if (T.every((x) => x.zero) && difficulte > 1) continue;
      const u = a === 1 ? 'x' : a === -1 ? '-x' : `${a}x`;
      const fx = f.tex(u).replace('1 + -', '1 - ').replace('1 - -', '1 + ');
      const reste = polyTex(T.map((x) => x.neg()), 'croissant');
      const num = reste === '0' ? fx : reste.startsWith('-') ? `${fx} - ${reste.slice(1)}` : `${fx} + ${reste}`;
      const den = k + 1 === 1 ? 'x' : `x^{${k + 1}}`;
      const rep = c[k + 1];
      const lim = `\\lim_{x \\to 0} \\frac{${num}}{${den}}`;
      const correction = [
        `DL usuel : $${f.rappel}$.`,
        `Avec $u = ${u}$ : $${fx} = ${polyTex(c.slice(0, k + 2), 'croissant')} + o(x^{${k + 1}})$.`,
        `Le numérateur vaut donc $${polyTex([...T.map(() => new Q(0)), rep], 'croissant')} + o(x^{${k + 1}})$ : la limite vaut $${rep.tex()}$.`,
      ];
      const enonce = `Calculer $\\displaystyle ${lim}$.`;
      const indice = `Fais un DL du numérateur à l'ordre ${k + 1}.`;
      if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: rep.toString() };
      return construireQcm({ difficulte, enonce, indice, correction }, candN(rep, `Coefficient de $x^{${k + 1}}$ dans le DL.`), [
        candN(rep.neg(), 'Erreur de signe dans le DL.'),
        candN(0, 'On ne soustrait pas des équivalents : il faut le terme suivant du DL.'),
        candN(rep.mul(fact(k + 1)), `Factorielle oubliée : le coefficient de $x^{${k + 1}}$ est divisé par $${k + 1}!$.`),
        candN(f.coefs[k + 1].mul(a), `L'argument est $${u}$ : le coefficient est multiplié par $${par(a)}^{${k + 1}}$.`),
        candN(rep.add(1), 'Erreur de calcul dans le DL.'),
      ]);
    }
  },
};

/* ------------------------------------------------------------------ */
/* Exponentielle et logarithme                                         */
/* ------------------------------------------------------------------ */

export const expLn: Generateur = {
  id: 'fonctions-exp-ln',
  titre: 'Calculs avec exp et ln',
  chapitre: 'fonctions-usuelles',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    if (difficulte === 3) {
      // e^{2x} − (a+b)e^x + ab = 0  ⟺  e^x ∈ {a, b}
      const a = randInt(rng, 2, 5);
      let b = randInt(rng, 2, 6);
      while (b === a) b = randInt(rng, 2, 6);
      const enonce = `Résoudre dans $\\mathbb{R}$ : $e^{2x} - ${a + b}e^x + ${a * b} = 0$.`;
      const correction = [
        `On pose $X = e^x > 0$ : $X^2 - ${a + b}X + ${a * b} = 0$, soit $(X - ${a})(X - ${b}) = 0$.`,
        `$e^x = ${a}$ ou $e^x = ${b}$, donc $x = \\ln ${a}$ ou $x = \\ln ${b}$.`,
      ];
      const indice = 'Pose $X = e^x$.';
      if (forme === 'libre')
        return { id: '', type: 'numerique', difficulte, enonce: `${enonce} Donne les deux solutions séparées par « ; » (ex. ln(2)).`, indice, correction, reponse: [`log(${a})`, `log(${b})`] };
      const paire = (u: string, v: string, explication: string, cle: string): Candidat => ({ texte: `$\\{${u},\\ ${v}\\}$`, explication, cle });
      return construireQcm({ difficulte, enonce, indice, correction }, paire(`\\ln ${a}`, `\\ln ${b}`, '$x = \\ln X$.', 'ln'), [
        paire(`${a}`, `${b}`, 'Ce sont les valeurs de $X = e^x$ : il reste à prendre le logarithme.', 'X'),
        paire(`e^{${a}}`, `e^{${b}}`, '$e^x = a \\iff x = \\ln a$, pas $e^a$.', 'e'),
        paire(`-\\ln ${a}`, `-\\ln ${b}`, 'Erreur de signe.', 'moins'),
      ]);
    }
    const genre = pick(rng, difficulte === 1 ? ['exp-ln', 'ln-puissance'] : ['ln-quotient', 'exp-somme', 'exp-ln']);
    const a = randInt(rng, 2, 5);
    const k = randInt(rng, 2, 4);
    let expr: string;
    let rep: number;
    let correction: string[];
    let distr: Candidat[];
    switch (genre) {
      case 'exp-ln':
        expr = `e^{${k}\\ln ${a}}`;
        rep = a ** k;
        correction = [`$e^{${k}\\ln ${a}} = e^{\\ln(${a}^{${k}})} = ${a}^{${k}} = ${rep}$.`];
        distr = [candN(k * a, '$k\\ln a = \\ln(a^k)$, pas $\\ln(ka)$.'), candN(k ** a, 'Base et exposant inversés.'), candN(a + k, 'Ce n\'est pas une somme.'), candN(a ** (k + 1), 'Exposant faux : $k\\ln a = \\ln(a^k)$.'), candN(a ** (k - 1), 'Exposant faux : $k\\ln a = \\ln(a^k)$.')];
        break;
      case 'ln-puissance':
        expr = `\\dfrac{\\ln(${a ** k})}{\\ln ${a}}`;
        rep = k;
        correction = [`$${a ** k} = ${a}^{${k}}$ donc $\\ln(${a ** k}) = ${k}\\ln ${a}$ ; le quotient vaut $${k}$.`];
        distr = [candN(a ** (k - 1), '$\\frac{\\ln A}{\\ln B} \\neq \\frac{A}{B}$.'), candN(a ** k - a, '$\\frac{\\ln A}{\\ln B} \\neq A - B$.'), candN(a * k, 'Ce n\'est pas un produit.'), candN(k + 1, `Exposant mal lu : $${a ** k} = ${a}^{${k}}$.`), candN(k - 1, `Exposant mal lu : $${a ** k} = ${a}^{${k}}$.`), candN(a ** k, `On a oublié de diviser par $\\ln ${a}$ : le quotient vaut l'exposant.`)];
        break;
      case 'ln-quotient': {
        let b = randInt(rng, 2, 4);
        while (b === k || b === a) b = randInt(rng, 2, 6);
        expr = `\\ln(${a * b}) - \\ln(${b}) + \\ln(${k})`;
        rep = a * k;
        correction = [`$\\ln(${a * b}) - \\ln ${b} + \\ln ${k} = \\ln\\left(\\frac{${a * b} \\times ${k}}{${b}}\\right) = \\ln(${a * k})$.`, `Donc $e^{\\text{expression}} = ${a * k}$.`];
        expr = `e^{${expr}}`;
        distr = [candN(a * b - b + k, 'Le logarithme transforme les produits en sommes, pas l\'inverse.'), candN(a * b * b * k, 'Le $-\\ln$ correspond à une division.'), candN(a + k, '$\\ln u + \\ln v = \\ln(uv)$, pas $\\ln(u + v)$.'), candN(a, `Le terme $\\ln ${k}$ a été oublié.`), candN(a * k + 1, 'Erreur de calcul.')];
        break;
      }
      default:
        expr = `e^{\\ln ${a} + \\ln ${k}}`;
        rep = a * k;
        correction = [`$e^{\\ln ${a} + \\ln ${k}} = e^{\\ln ${a}}\\,e^{\\ln ${k}} = ${a} \\times ${k} = ${rep}$.`];
        distr = [candN(a + k, '$e^{u+v} = e^ue^v$ : produit, pas somme.'), candN(a ** k, 'Ce n\'est pas une puissance.'), { texte: `$\\ln ${a * k}$`, explication: 'On a oublié d\'appliquer l\'exponentielle.', cle: 'ln' }];
    }
    const enonce = `Simplifier $${expr}$.`;
    const indice = '$e^{\\ln u} = u$, $\\ln(uv) = \\ln u + \\ln v$, $\\ln(u^k) = k\\ln u$.';
    if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: rep };
    return construireQcm({ difficulte, enonce, indice, correction }, candN(rep, 'Propriétés de exp et ln.'), distr);
  },
};
