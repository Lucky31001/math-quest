/** Vérifications indépendantes — Algèbre et analyse. Clé : « chapitre/question ». */
import { expect } from 'vitest';
import {
  POINTS,
  attendu,
  attendus,
  binom,
  bonChoix,
  derivee,
  enC,
  fact,
  fonction,
  proche,
  question,
  rang,
  rk4,
  simpson,
} from '../outils/verification';
import type { C } from '../outils/verification';
import { math } from '../../src/core/checker';

export const verifications: Record<string, () => void> = {
  /* ---------------- Logique ---------------- */
  'logique/table-verite-implication': () => {
    let n = 0;
    for (const P of [true, false]) for (const Q of [true, false]) if (!P || Q) n++;
    expect(attendu(question('logique', 'table-verite-implication')).re).toBe(n);
  },
  'logique/recurrence-suite': () => {
    let u = 1;
    for (let i = 0; i < 10; i++) u = 2 * u + 1;
    expect(attendu(question('logique', 'recurrence-suite')).re).toBe(u);
  },
  'logique/somme-cubes': () => {
    const f = fonction(question('logique', 'somme-cubes'));
    for (let n = 1; n <= 12; n++) {
      let s = 0;
      for (let k = 1; k <= n; k++) s += k ** 3;
      expect(f(n)).toBeCloseTo(s, 8);
    }
  },
  /* ---------------- Ensembles ---------------- */
  'ensembles/nombre-injections': () => {
    let n = 0;
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) for (let c = 0; c < 5; c++) if (a !== b && b !== c && a !== c) n++;
    expect(attendu(question('ensembles', 'nombre-injections')).re).toBe(n);
  },
  'ensembles/cardinal-union': () => {
    const A = new Set([1, 2, 3, 4, 5, 6, 7]);
    const B = new Set([5, 6, 7, 8, 9]); // |A ∩ B| = 3
    expect(attendu(question('ensembles', 'cardinal-union')).re).toBe(new Set([...A, ...B]).size);
  },
  'ensembles/nombre-applications': () => expect(bonChoix(question('ensembles', 'nombre-applications'))).toBe(2 ** 3),
  'ensembles/cardinal-parties': () => expect(bonChoix(question('ensembles', 'cardinal-parties'))).toBe(2 ** 3),
  'ensembles/reciproque-affine': () => {
    const g = fonction(question('ensembles', 'reciproque-affine'));
    for (const y of [-3, 0.5, 7]) expect(3 * g(y) - 5).toBeCloseTo(y, 10);
  },
  'ensembles/reciproque-carre-negatif': () => {
    const g = fonction(question('ensembles', 'reciproque-carre-negatif'));
    for (const y of [1, 2.5, 10]) {
      expect(g(y) ** 2 + 1).toBeCloseTo(y, 10);
      expect(g(y)).toBeLessThanOrEqual(0);
    }
  },
  /* ---------------- Complexes ---------------- */
  'complexes/module-produit': () => {
    const z = math.multiply(math.complex(3, 4), math.complex(1, -1)) as unknown as { re: number; im: number };
    expect(proche(attendu(question('complexes', 'module-produit')), Math.hypot(z.re, z.im))).toBe(true);
  },
  'complexes/second-degre': () => {
    const sols = attendus(question('complexes', 'second-degre'));
    expect(sols).toHaveLength(2);
    expect(proche(sols[0], sols[1])).toBe(false);
    for (const z of sols) {
      const c = math.complex(z.re, z.im);
      const v = math.add(math.add(math.multiply(c, c), math.multiply(2, c)), 5) as unknown as C;
      expect(Math.hypot(v.re, v.im)).toBeLessThan(1e-12);
    }
  },
  'complexes/puissance-1-i-racine3': () => {
    const z = math.pow(math.complex(1, Math.sqrt(3)), 6) as unknown as C;
    expect(proche(attendu(question('complexes', 'puissance-1-i-racine3')), z, 1e-9)).toBe(true);
  },
  'complexes/puissance-1-plus-i': () => {
    const z = math.pow(math.complex(1, 1), 8) as unknown as C;
    expect(proche(bonChoix(question('complexes', 'puissance-1-plus-i')), z, 1e-9)).toBe(true);
  },
  'complexes/module-3-4i': () => expect(bonChoix(question('complexes', 'module-3-4i'))).toBe(Math.hypot(3, 4)),
  'complexes/linearisation-cos3': () => {
    const f = fonction(question('complexes', 'linearisation-cos3'));
    for (const x of POINTS) expect(f(x)).toBeCloseTo(Math.cos(x) ** 3, 12);
  },
  /* ---------------- Sommes ---------------- */
  'sommes/somme-100': () => expect(bonChoix(question('sommes', 'somme-100'))).toBe(Array.from({ length: 100 }, (_, k) => k + 1).reduce((a, b) => a + b)),
  'sommes/binomial-5-2': () => expect(bonChoix(question('sommes', 'binomial-5-2'))).toBe(binom(5, 2)),
  'sommes/somme-carres-10': () => {
    let s = 0;
    for (let k = 1; k <= 10; k++) s += k * k;
    expect(attendu(question('sommes', 'somme-carres-10')).re).toBe(s);
  },
  'sommes/somme-geo-3': () => {
    let s = 0;
    for (let k = 0; k <= 5; k++) s += 3 ** k;
    expect(attendu(question('sommes', 'somme-geo-3')).re).toBe(s);
  },
  'sommes/somme-double': () => {
    let s = 0;
    for (let j = 1; j <= 4; j++) for (let i = 1; i <= j; i++) s += i;
    expect(attendu(question('sommes', 'somme-double')).re).toBe(s);
  },
  'sommes/somme-impairs-decales': () => {
    const f = fonction(question('sommes', 'somme-impairs-decales'));
    for (let n = 1; n <= 10; n++) {
      let s = 0;
      for (let k = 1; k <= n; k++) s += 2 * k + 1;
      expect(f(n)).toBeCloseTo(s, 10);
    }
  },
  'sommes/somme-k-binomial': () => {
    const f = fonction(question('sommes', 'somme-k-binomial'));
    for (let n = 1; n <= 10; n++) {
      let s = 0;
      for (let k = 0; k <= n; k++) s += k * binom(n, k);
      expect(f(n)).toBeCloseTo(s, 8);
    }
  },
  /* ---------------- Polynômes ---------------- */
  'polynomes/evaluation': () => expect(attendu(question('polynomes', 'evaluation')).re).toBe(2 * (-2) ** 3 - -2 + 4),
  'polynomes/reste-x-moins-1': () => expect(bonChoix(question('polynomes', 'reste-x-moins-1'))).toBe(1 + 2 - 1),
  'polynomes/somme-carres-racines': () => {
    const d = Math.sqrt(25 - 24);
    const [a, b] = [(5 + d) / 2, (5 - d) / 2];
    expect(attendu(question('polynomes', 'somme-carres-racines')).re).toBeCloseTo(a * a + b * b, 12);
  },
  'polynomes/multiplicite-1': () => {
    const P = (x: number) => x ** 3 - 3 * x + 2;
    // multiplicité 2 : P(1) = P'(1) = 0, P''(1) ≠ 0
    expect(P(1)).toBe(0);
    expect(derivee(P, 1)).toBeCloseTo(0, 6);
    expect(bonChoix(question('polynomes', 'multiplicite-1'))).toBe(2);
  },
  'polynomes/somme-racines-degre3': () => {
    // somme des racines numériques de X³ − 2X² + 5X − 7
    const r = math.polynomialRoot(-7, 5, -2, 1) as unknown as (number | C)[];
    const s = r.map(enC).reduce((a, z) => ({ re: a.re + z.re, im: a.im + z.im }), { re: 0, im: 0 });
    expect(proche(bonChoix(question('polynomes', 'somme-racines-degre3')), s, 1e-9)).toBe(true);
  },
  'polynomes/quotient-x3-1': () => {
    const Q = fonction(question('polynomes', 'quotient-x3-1'));
    for (const x of POINTS) expect((x - 1) * Q(x)).toBeCloseTo(x ** 3 - 1, 10);
  },
  'polynomes/reste-x5': () => {
    const R = fonction(question('polynomes', 'reste-x5'));
    // X⁵ − R doit s'annuler en ±1 (racines de X² − 1), et R est de degré ≤ 1
    for (const x of [1, -1]) expect(x ** 5 - R(x)).toBeCloseTo(0, 10);
    expect(R(2) - 2 * R(1) + R(0)).toBeCloseTo(0, 10);
  },
  /* ---------------- Matrices ---------------- */
  'matrices/det-2x2': () => expect(bonChoix(question('matrices', 'det-2x2'))).toBeCloseTo(math.det([[2, 3], [1, 4]]), 10),
  'matrices/det-2a': () => {
    const A = [[1, 2, 0], [0, 1, 1], [2, 0, 1]]; // det = 5
    expect(math.det(A)).toBeCloseTo(5, 10);
    expect(bonChoix(question('matrices', 'det-2a'))).toBeCloseTo(math.det(math.multiply(2, A) as number[][]), 10);
  },
  'matrices/det-triangulaire': () => expect(attendu(question('matrices', 'det-triangulaire')).re).toBeCloseTo(math.det([[1, 2, 0], [0, 1, 3], [0, 0, 4]]), 10),
  'matrices/det-3x3': () => expect(attendu(question('matrices', 'det-3x3')).re).toBeCloseTo(math.det([[1, 2, 3], [0, 1, 4], [5, 6, 0]]), 10),
  'matrices/m-non-inversible': () => {
    const m = attendu(question('matrices', 'm-non-inversible')).re;
    expect(math.det([[1, m], [2, 4]])).toBeCloseTo(0, 12);
  },
  'matrices/systeme-parametre': () => {
    const a = attendu(question('matrices', 'systeme-parametre')).re;
    expect(math.det([[1, 1, 1], [1, 2, 3], [1, 3, a]])).toBeCloseTo(0, 12);
    expect(math.det([[1, 1, 1], [1, 2, 3], [1, 3, a + 1]])).not.toBeCloseTo(0, 6);
  },
  'matrices/puissance-matrice-1': () => {
    const f = fonction(question('matrices', 'puissance-matrice-1'));
    for (let n = 1; n <= 8; n++) expect(f(n)).toBeCloseTo((math.pow([[1, 1], [0, 1]], n) as number[][])[0][1], 10);
  },
  'matrices/puissance-matrice-2': () => {
    const f = fonction(question('matrices', 'puissance-matrice-2'));
    for (let n = 1; n <= 8; n++) expect(f(n)).toBeCloseTo((math.pow([[1, 1], [1, 1]], n) as number[][])[0][0], 10);
  },
  /* ---------------- Espaces vectoriels ---------------- */
  'espaces-vectoriels/dim-vect': () => expect(attendu(question('espaces-vectoriels', 'dim-vect')).re).toBe(rang([[1, 0, 0], [0, 1, 0], [1, 1, 0]])),
  'espaces-vectoriels/dim-equations': () => expect(attendu(question('espaces-vectoriels', 'dim-equations')).re).toBe(4 - rang([[1, 1, 0, 0], [0, 0, 1, -1]])),
  'espaces-vectoriels/famille-liee-parametre': () => {
    const a = attendu(question('espaces-vectoriels', 'famille-liee-parametre')).re;
    expect(rang([[1, 0, 1], [0, 1, 1], [1, 1, a]])).toBe(2);
    expect(rang([[1, 0, 1], [0, 1, 1], [1, 1, a + 1]])).toBe(3);
  },
  'espaces-vectoriels/coordonnees': () => {
    const alpha = fonction(question('espaces-vectoriels', 'coordonnees'));
    for (const [x, y] of [[1, 2], [-3, 0.5], [4, -4]]) {
      const beta = x - alpha(x, y); // α + β = x
      expect(alpha(x, y) - beta).toBeCloseTo(y, 12); // α − β = y
    }
  },
  /* ---------------- Fonctions usuelles ---------------- */
  'fonctions-usuelles/ln8-ln2': () => expect(bonChoix(question('fonctions-usuelles', 'ln8-ln2'))).toBeCloseTo(Math.log(8) / Math.log(2), 12),
  'fonctions-usuelles/arcsin-sin': () => expect(bonChoix(question('fonctions-usuelles', 'arcsin-sin'))).toBeCloseTo(Math.asin(Math.sin((3 * Math.PI) / 4)), 12),
  'fonctions-usuelles/exp-2ln3': () => expect(attendu(question('fonctions-usuelles', 'exp-2ln3')).re).toBeCloseTo(Math.exp(2 * Math.log(3)), 10),
  'fonctions-usuelles/arccos-moins-demi': () => expect(attendu(question('fonctions-usuelles', 'arccos-moins-demi')).re).toBeCloseTo(Math.acos(-0.5), 12),
  'fonctions-usuelles/equation-ch': () => {
    const x = attendu(question('fonctions-usuelles', 'equation-ch')).re;
    expect(x).toBeGreaterThan(0);
    expect(Math.cosh(x)).toBeCloseTo(5 / 4, 12);
  },
  'fonctions-usuelles/derivee-x-puissance-x': () => {
    const f = fonction(question('fonctions-usuelles', 'derivee-x-puissance-x'));
    for (const x of POINTS) expect(f(x)).toBeCloseTo(derivee((t) => t ** t, x), 6);
  },
  'fonctions-usuelles/tan-arcsin': () => {
    const f = fonction(question('fonctions-usuelles', 'tan-arcsin'));
    for (const x of [-0.8, -0.2, 0.4, 0.9]) expect(f(x)).toBeCloseTo(Math.tan(Math.asin(x)), 10);
  },
  /* ---------------- Suites ---------------- */
  'suites/limite-rationnelle': () => expect(bonChoix(question('suites', 'limite-rationnelle'))).toBeCloseTo((3 * 1e8 ** 2 + 1) / (1e8 ** 2 + 5), 8),
  'suites/n-sin-1-sur-n': () => expect(bonChoix(question('suites', 'n-sin-1-sur-n'))).toBeCloseTo(1e6 * Math.sin(1e-6), 8),
  'suites/recurrente-racine': () => {
    let u = 0;
    for (let i = 0; i < 200; i++) u = Math.sqrt(u + 2);
    expect(bonChoix(question('suites', 'recurrente-racine'))).toBeCloseTo(u, 10);
  },
  'suites/adjacentes-e': () => {
    let s = 0;
    for (let k = 0; k <= 20; k++) s += 1 / fact(k);
    expect(bonChoix(question('suites', 'adjacentes-e'))).toBeCloseTo(s, 12);
  },
  'suites/limite-2-5': () => expect(attendu(question('suites', 'limite-2-5')).re).toBeCloseTo((2 * 1e9 + 3) / (5 * 1e9 - 1), 8),
  'suites/recurrence-ordre2': () => {
    let [a, b] = [0, 3];
    for (let n = 0; n < 10; n++) [a, b] = [b, b + 2 * a];
    expect(attendu(question('suites', 'recurrence-ordre2')).re).toBe(a);
  },
  'suites/limite-1-plus-2-sur-n': () => expect(attendu(question('suites', 'limite-1-plus-2-sur-n')).re).toBeCloseTo((1 + 2 / 1e7) ** 1e7, 5),
  'suites/arith-geo-formule': () => {
    const f = fonction(question('suites', 'arith-geo-formule'));
    let u = 5;
    for (let n = 0; n <= 10; n++) {
      expect(f(n)).toBeCloseTo(u, 8);
      u = 2 * u - 3;
    }
  },
  /* ---------------- Limites et continuité ---------------- */
  'limites-continuite/conjuguee-0': () => expect(bonChoix(question('limites-continuite', 'conjuguee-0'))).toBeCloseTo((Math.sqrt(1 + 1e-8) - 1) / 1e-8, 6),
  'limites-continuite/limite-quotient-x2': () => {
    const f = (x: number) => (x * x - 4) / (x - 2);
    expect(attendu(question('limites-continuite', 'limite-quotient-x2')).re).toBeCloseTo((f(2 + 1e-6) + f(2 - 1e-6)) / 2, 8);
  },
  'limites-continuite/conjuguee-infini': () => {
    const x = 1e7;
    expect(attendu(question('limites-continuite', 'conjuguee-infini')).re).toBeCloseTo(Math.sqrt(x * x + 3 * x) - x, 5);
  },
  'limites-continuite/prolongement-sin3x': () => expect(attendu(question('limites-continuite', 'prolongement-sin3x')).re).toBeCloseTo(Math.sin(3e-7) / 1e-7, 8),
  'limites-continuite/exp-sur-sin': () => {
    const f = (x: number) => (Math.exp(3 * x) - 1) / Math.sin(2 * x);
    expect(attendu(question('limites-continuite', 'exp-sur-sin')).re).toBeCloseTo((f(1e-5) + f(-1e-5)) / 2, 8);
  },
  /* ---------------- Dérivabilité ---------------- */
  'derivabilite/rolle-c': () => {
    const c = bonChoix(question('derivabilite', 'rolle-c')) as number;
    expect(derivee((x) => x * x - 4 * x, c)).toBeCloseTo(0, 8);
  },
  'derivabilite/taf-c': () => {
    const c = bonChoix(question('derivabilite', 'taf-c')) as number;
    expect(derivee((x) => x ** 3, c)).toBeCloseTo((27 - 0) / 3, 6);
  },
  'derivabilite/derivee-reciproque': () => {
    // (f⁻¹)'(2) par différences finies sur la réciproque calculée par dichotomie
    const inv = (y: number) => {
      let [a, b] = [-10, 10];
      for (let i = 0; i < 200; i++) {
        const m = (a + b) / 2;
        if (m ** 3 + m < y) a = m;
        else b = m;
      }
      return (a + b) / 2;
    };
    expect(bonChoix(question('derivabilite', 'derivee-reciproque'))).toBeCloseTo(derivee(inv, 2, 1e-4), 6);
  },
  'derivabilite/derivee-en-2': () => expect(attendu(question('derivabilite', 'derivee-en-2')).re).toBeCloseTo(derivee((x) => 3 * x * x - 5 * x + 1, 2), 6),
  'derivabilite/pente-racine': () => expect(attendu(question('derivabilite', 'pente-racine')).re).toBeCloseTo(derivee(Math.sqrt, 4), 8),
  'derivabilite/leibniz': () => {
    // x²eˣ = Σ x^(k+2)/k! : le coefficient de x¹⁰ est 1/8!, donc f⁽¹⁰⁾(0) = 10!/8!
    expect(attendu(question('derivabilite', 'leibniz')).re).toBe(fact(10) / fact(8));
  },
  'derivabilite/derivee-ln-cos': () => {
    const f = fonction(question('derivabilite', 'derivee-ln-cos'));
    for (const x of [-1, -0.3, 0.5, 1.2]) expect(f(x)).toBeCloseTo(derivee((t) => Math.log(Math.cos(t)), x), 6);
  },
  'derivabilite/derivee-arctan-exp': () => {
    const f = fonction(question('derivabilite', 'derivee-arctan-exp'));
    for (const x of POINTS) expect(f(x)).toBeCloseTo(derivee((t) => Math.atan(Math.exp(t)), x), 8);
  },
  /* ---------------- DL ---------------- */
  'developpements-limites/limite-exp-x2': () => {
    const f = (x: number) => (Math.exp(x) - 1 - x) / (x * x);
    expect(bonChoix(question('developpements-limites', 'limite-exp-x2'))).toBeCloseTo((f(1e-4) + f(-1e-4)) / 2, 6);
  },
  'developpements-limites/coeff-sin2x': () => {
    const h = 1e-3;
    const c3 = ((Math.sin(2 * h) - 2 * h) / h ** 3 + (Math.sin(-2 * h) + 2 * h) / -(h ** 3)) / 2;
    expect(attendu(question('developpements-limites', 'coeff-sin2x')).re).toBeCloseTo(c3, 4);
  },
  'developpements-limites/limite-sin-x3': () => {
    const h = 1e-3;
    expect(attendu(question('developpements-limites', 'limite-sin-x3')).re).toBeCloseTo((Math.sin(h) - h) / h ** 3, 5);
  },
  'developpements-limites/limite-inverse-sin2': () => {
    const x = 1e-3;
    expect(attendu(question('developpements-limites', 'limite-inverse-sin2')).re).toBeCloseTo(1 / Math.sin(x) ** 2 - 1 / (x * x), 4);
  },
  'developpements-limites/dl-exp-sin': () => {
    const P = fonction(question('developpements-limites', 'dl-exp-sin'));
    for (const h of [1e-3, -1e-3]) expect(Math.abs((Math.exp(h) * Math.sin(h) - P(h)) / h ** 3)).toBeLessThan(0.01);
  },
  'developpements-limites/dl-sqrt-exp': () => {
    const P = fonction(question('developpements-limites', 'dl-sqrt-exp'));
    for (const h of [1e-4, -1e-4]) expect(Math.abs((Math.sqrt(1 + h) * Math.exp(-h) - P(h)) / h ** 2)).toBeLessThan(0.01);
  },
  /* ---------------- Intégration ---------------- */
  'integration/integrale-x2': () => expect(bonChoix(question('integration', 'integrale-x2'))).toBeCloseTo(simpson((x) => x * x, 0, 1), 10),
  'integration/ipp-x-exp': () => expect(bonChoix(question('integration', 'ipp-x-exp'))).toBeCloseTo(simpson((x) => x * Math.exp(x), 0, 1), 10),
  'integration/cdv-2x-exp': () => expect(bonChoix(question('integration', 'cdv-2x-exp'))).toBeCloseTo(simpson((x) => 2 * x * Math.exp(x * x), 0, 1), 10),
  'integration/riemann-arctan': () => {
    const n = 200000;
    let s = 0;
    for (let k = 1; k <= n; k++) s += n / (n * n + k * k);
    expect(bonChoix(question('integration', 'riemann-arctan'))).toBeCloseTo(s, 5);
  },
  'integration/integrale-1-sur-x': () => expect(attendu(question('integration', 'integrale-1-sur-x')).re).toBeCloseTo(simpson((x) => 1 / x, 1, Math.E), 10),
  'integration/integrale-cos-sin': () => expect(attendu(question('integration', 'integrale-cos-sin')).re).toBeCloseTo(simpson((x) => Math.cos(x) * Math.sin(x), 0, Math.PI / 2), 10),
  'integration/ipp-double': () => expect(attendu(question('integration', 'ipp-double')).re).toBeCloseTo(simpson((x) => x * x * Math.exp(x), 0, 1), 10),
  'integration/primitive-x-ln': () => {
    const F = fonction(question('integration', 'primitive-x-ln'));
    for (const x of [0.5, 1.2, 2.5]) expect(derivee(F, x)).toBeCloseTo(x * Math.log(x), 6);
  },
  'integration/primitive-fraction': () => {
    const F = fonction(question('integration', 'primitive-fraction'));
    for (const x of [1.5, 2, 4]) expect(derivee(F, x)).toBeCloseTo(1 / (x * x - 1), 6);
  },
  /* ---------------- Équations différentielles ---------------- */
  'equations-differentielles/cauchy-y-2y': () => {
    const [y1] = rk4((_x, [y]) => [2 * y], [3], 0, 1);
    expect(attendu(question('equations-differentielles', 'cauchy-y-2y')).re).toBeCloseTo(y1, 6);
  },
  'equations-differentielles/cauchy-y-plus-y': () => {
    const [y1] = rk4((_x, [y]) => [1 - y], [0], 0, Math.log(2));
    expect(attendu(question('equations-differentielles', 'cauchy-y-plus-y')).re).toBeCloseTo(y1, 8);
  },
  'equations-differentielles/cauchy-ordre2': () => {
    const [y1] = rk4((_x, [y, yp]) => [yp, 3 * yp - 2 * y], [0, 1], 0, Math.log(3));
    expect(attendu(question('equations-differentielles', 'cauchy-ordre2')).re).toBeCloseTo(y1, 6);
  },
  'equations-differentielles/resoudre-y-moins-y-x': () => {
    const y = fonction(question('equations-differentielles', 'resoudre-y-moins-y-x'));
    const [y1] = rk4((x, [v]) => [v + x], [0], 0, 1.3);
    expect(y(1.3)).toBeCloseTo(y1, 6);
  },
  'equations-differentielles/resoudre-y-seconde-plus-y': () => {
    const y = fonction(question('equations-differentielles', 'resoudre-y-seconde-plus-y'));
    const [y1] = rk4((_x, [v, vp]) => [vp, -v], [1, 2], 0, 2.1);
    expect(y(2.1)).toBeCloseTo(y1, 6);
  },
  /* ---------------- Ajouts (2e vague) ---------------- */
  'logique/recurrence-forte-somme': () => {
    const u = [1];
    for (let n = 0; n < 6; n++) u.push(u.reduce((a, b) => a + b, 0));
    expect(attendu(question('logique', 'recurrence-forte-somme')).re).toBe(u[6]);
  },
  'ensembles/parties-produit': () => expect(attendu(question('ensembles', 'parties-produit')).re).toBe(2 ** (2 * 3)),
  'ensembles/reciproque-exp-affine': () => {
    const g = fonction(question('ensembles', 'reciproque-exp-affine'));
    for (const y of [0.5, 1, 7]) expect(Math.exp(2 * g(y) + 1)).toBeCloseTo(y, 10);
  },
  'complexes/argument-quotient': () => {
    const z = math.divide(math.complex(1, 1), math.complex(1, -1)) as unknown as C;
    expect(attendu(question('complexes', 'argument-quotient')).re).toBeCloseTo(Math.atan2(z.im, z.re), 12);
  },
  'complexes/linearisation-sin2cos2': () => {
    const f = fonction(question('complexes', 'linearisation-sin2cos2'));
    for (const x of POINTS) expect(f(x)).toBeCloseTo(Math.sin(x) ** 2 * Math.cos(x) ** 2, 12);
  },
  'sommes/somme-alternee': () => {
    let s = 0;
    for (let k = 1; k <= 20; k++) s += (-1) ** k * k;
    expect(attendu(question('sommes', 'somme-alternee')).re).toBe(s);
  },
  'sommes/somme-k-factorielle': () => {
    let s = 0;
    for (let k = 1; k <= 5; k++) s += k * fact(k);
    expect(attendu(question('sommes', 'somme-k-factorielle')).re).toBe(s);
  },
  'polynomes/reste-x-plus-2': () => expect(attendu(question('polynomes', 'reste-x-plus-2')).re).toBe((-2) ** 4 + -2 + 1),
  'polynomes/quotient-x4-1': () => {
    const Q = fonction(question('polynomes', 'quotient-x4-1'));
    for (const x of POINTS) expect(Q(x) * (x * x + 1)).toBeCloseTo(x ** 4 - 1, 10);
  },
  'matrices/coefficient-inverse': () => expect(attendu(question('matrices', 'coefficient-inverse')).re).toBeCloseTo((math.inv([[2, 1], [5, 3]]) as number[][])[0][1], 10),
  'matrices/vandermonde': () => expect(attendu(question('matrices', 'vandermonde')).re).toBeCloseTo(math.det([[1, 1, 1], [1, 2, 4], [1, 3, 9]]), 10),
  'espaces-vectoriels/dim-matrices-2-3': () => expect(attendu(question('espaces-vectoriels', 'dim-matrices-2-3')).re).toBe(2 * 3),
  'espaces-vectoriels/dim-intersection': () => expect(attendu(question('espaces-vectoriels', 'dim-intersection')).re).toBe(3 - rang([[1, 1, 1], [1, -1, 0]])),
  'fonctions-usuelles/somme-arctan': () => expect(attendu(question('fonctions-usuelles', 'somme-arctan')).re).toBeCloseTo(Math.atan(1) + Math.atan(Math.sqrt(3)), 12),
  'fonctions-usuelles/equation-ln-somme': () => {
    const x = attendu(question('fonctions-usuelles', 'equation-ln-somme')).re;
    expect(x).toBeGreaterThan(0);
    expect(Math.log(x) + Math.log(x + 1)).toBeCloseTo(Math.log(6), 12);
  },
  'suites/limite-n-racine': () => {
    const n = 1e6;
    expect(attendu(question('suites', 'limite-n-racine')).re).toBeCloseTo(n * (Math.sqrt(1 + 1 / n) - 1), 5);
  },
  'suites/heron': () => {
    let u = 1;
    for (let i = 0; i < 50; i++) u = (u + 2 / u) / 2;
    expect(attendu(question('suites', 'heron')).re).toBeCloseTo(u, 12);
  },
  'suites/geometrique-formule': () => {
    const f = fonction(question('suites', 'geometrique-formule'));
    let u = 5;
    for (let n = 0; n <= 8; n++) {
      expect(f(n)).toBeCloseTo(u, 12);
      u /= 3;
    }
  },
  'limites-continuite/tan-3x': () => {
    const f = (x: number) => Math.tan(3 * x) / x;
    expect(attendu(question('limites-continuite', 'tan-3x')).re).toBeCloseTo((f(1e-5) + f(-1e-5)) / 2, 8);
  },
  'limites-continuite/x-exp-inverse': () => {
    const x = 1e6;
    expect(attendu(question('limites-continuite', 'x-exp-inverse')).re).toBeCloseTo(x * Math.expm1(1 / x), 5);
  },
  'derivabilite/maximum-x-exp': () => {
    // maximum par balayage fin
    let best = -Infinity;
    let argmax = 0;
    for (let x = -2; x <= 5; x += 1e-4) {
      const v = x * Math.exp(-x);
      if (v > best) [best, argmax] = [v, x];
    }
    expect(attendu(question('derivabilite', 'maximum-x-exp')).re).toBeCloseTo(argmax, 3);
  },
  'derivabilite/nombre-racines-cubique': () => {
    // changements de signe sur une grille fine (les racines sont dans [-3, 3])
    const f = (x: number) => x ** 3 - 3 * x + 1;
    let n = 0;
    for (let x = -3; x < 3; x += 1e-3) if (f(x) * f(x + 1e-3) < 0) n++;
    expect(attendu(question('derivabilite', 'nombre-racines-cubique')).re).toBe(n);
  },
  'developpements-limites/limite-ln-dl': () => {
    const f = (x: number) => (Math.log1p(x) - x) / (x * x);
    expect(attendu(question('developpements-limites', 'limite-ln-dl')).re).toBeCloseTo((f(1e-4) + f(-1e-4)) / 2, 6);
  },
  'developpements-limites/limite-exp-sin': () => {
    const f = (x: number) => (Math.expm1(x) - Math.sin(x)) / (x * x);
    expect(attendu(question('developpements-limites', 'limite-exp-sin')).re).toBeCloseTo((f(1e-4) + f(-1e-4)) / 2, 6);
  },
  'developpements-limites/dl-cos-exp': () => {
    const P = fonction(question('developpements-limites', 'dl-cos-exp'));
    for (const h of [1e-4, -1e-4]) expect(Math.abs((Math.exp(h) * Math.cos(h) - P(h)) / h ** 2)).toBeLessThan(0.01);
  },
  'integration/integrale-x-1-moins-x': () => expect(attendu(question('integration', 'integrale-x-1-moins-x')).re).toBeCloseTo(simpson((x) => x * (1 - x), 0, 1), 10),
  'integration/integrale-ln': () => expect(attendu(question('integration', 'integrale-ln')).re).toBeCloseTo(simpson(Math.log, 1, Math.E), 10),
  'integration/primitive-x-sur-1-plus-x2': () => {
    const F = fonction(question('integration', 'primitive-x-sur-1-plus-x2'));
    for (const x of [-1.5, 0.5, 2]) expect(derivee(F, x)).toBeCloseTo(x / (1 + x * x), 6);
  },
  'equations-differentielles/cauchy-oscillateur': () => {
    const [y1] = rk4((_x, [y, yp]) => [yp, -y], [0, 3], 0, Math.PI / 2);
    expect(attendu(question('equations-differentielles', 'cauchy-oscillateur')).re).toBeCloseTo(y1, 6);
  },
  'equations-differentielles/cauchy-y-plus-x': () => {
    const [y1] = rk4((x, [y]) => [y + x], [1], 0, 1);
    expect(attendu(question('equations-differentielles', 'cauchy-y-plus-x')).re).toBeCloseTo(y1, 6);
  },
  'equations-differentielles/resoudre-second-membre-constant': () => {
    const y = fonction(question('equations-differentielles', 'resoudre-second-membre-constant'));
    const [y1] = rk4((_x, [v, vp]) => [vp, 2 + 3 * vp - 2 * v], [2, 0], 0, 0.9);
    expect(y(0.9)).toBeCloseTo(y1, 6);
  },
};
