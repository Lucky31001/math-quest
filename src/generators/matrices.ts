/** Générateurs — matrices (inverse 2×2, déterminant 3×3). */
import { randInt, randNonZero, pick } from '../core/random';
import type { Question } from '../core/schema';
import { Q, construireQcm, matTex, cleNum, type Generateur, type Candidat } from './outils';

/** Préfacteur 1/d en LaTeX : 1 → "", -1 → "-", 2 → \frac{1}{2}, -2 → -\frac{1}{2}. */
const prefacteur = (d: number) => (d === 1 ? '' : d === -1 ? '-' : `${d < 0 ? '-' : ''}\\frac{1}{${Math.abs(d)}}`);

export const inverse2x2: Generateur = {
  id: 'matrices-inverse-2x2',
  titre: 'Inverse 2×2',
  chapitre: 'matrices',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const R = [3, 4, 5][difficulte - 1];
    const dets = difficulte === 1 ? [1, -1, 2] : [2, -2, 3, -3, -1];
    let a, b, c, d, det;
    do {
      a = randNonZero(rng, -R, R);
      b = randNonZero(rng, -R, R);
      c = randNonZero(rng, -R, R);
      d = randNonZero(rng, -R, R);
      det = a * d - b * c;
    } while (!dets.includes(det) || b === c || a === d);
    const A = matTex([
      [a, b],
      [c, d],
    ]);
    const inv = [
      [new Q(d, det), new Q(-b, det)],
      [new Q(-c, det), new Q(a, det)],
    ];
    const correction = [
      `$\\det A = ad - bc = (${a})(${d}) - (${b})(${c}) = ${det} \\neq 0$ : $A$ est inversible.`,
      `Formule : $A^{-1} = \\frac{1}{\\det A}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}$ (on échange la diagonale, on change le signe des autres coefficients).`,
      `$A^{-1} = ${prefacteur(det)}${matTex([
        [d, -b],
        [-c, a],
      ])} = ${matTex(inv)}$.`,
      'Vérification : $AA^{-1} = I_2$.',
    ];
    const indice = 'Commence par calculer $\\det A = ad - bc$.';

    if (forme === 'libre') {
      const i = randInt(rng, 0, 1);
      const j = randInt(rng, 0, 1);
      return {
        id: '',
        type: 'numerique',
        difficulte,
        enonce: `Soit $A = ${A}$. Calculer le coefficient ligne ${i + 1}, colonne ${j + 1} de $A^{-1}$ (fraction acceptée, ex. « -3/2 »).`,
        indice,
        correction,
        reponse: inv[i][j].toString(),
      };
    }
    const cand = (pre: number, m: number[][], explication: string): Candidat => ({
      texte: `$${prefacteur(pre)}${matTex(m)}$`,
      explication,
      cle: cleNum(...m.flat().map((x) => x / pre)),
    });
    return construireQcm(
      { difficulte, enonce: `Soit $A = ${A}$. Que vaut $A^{-1}$ ?`, indice, correction },
      cand(
        det,
        [
          [d, -b],
          [-c, a],
        ],
        `Comatrice transposée divisée par $\\det A = ${det}$.`,
      ),
      [
        cand(1, [[d, -b], [-c, a]], `Oubli de la division par $\\det A = ${det}$.`),
        cand(det, [[a, -b], [-c, d]], 'La diagonale doit être échangée ($a \\leftrightarrow d$).'),
        cand(det, [[d, b], [c, a]], 'Les coefficients hors diagonale changent de signe : $-b$ et $-c$.'),
        cand(-det, [[d, -b], [-c, a]], 'Signe du déterminant faux : $\\det A = ad - bc$, pas $bc - ad$.'),
        cand(det, [[d, -c], [-b, a]], '$b$ et $-c$ ne doivent pas être échangés.'),
      ],
    );
  },
};

export const det3 = (m: number[][]): number =>
  m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
  m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
  m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

export const determinant3x3: Generateur = {
  id: 'matrices-det-3x3',
  titre: 'Déterminant 3×3',
  chapitre: 'matrices',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const R = [2, 3, 4][difficulte - 1];
    const m = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => randInt(rng, -R, R)));
    if (difficulte === 1) m[pick(rng, [1, 2])][0] = 0; // un zéro pour aider
    const M = [
      m[1][1] * m[2][2] - m[1][2] * m[2][1],
      m[1][0] * m[2][2] - m[1][2] * m[2][0],
      m[1][0] * m[2][1] - m[1][1] * m[2][0],
    ];
    const D = det3(m);
    const p = (v: number) => (v < 0 ? `(${v})` : String(v));
    const correction = [
      'Développement selon la première ligne, signes $+ \\; - \\; +$ :',
      `$\\det A = ${p(m[0][0])}\\begin{vmatrix} ${m[1][1]} & ${m[1][2]} \\\\ ${m[2][1]} & ${m[2][2]} \\end{vmatrix} - ${p(m[0][1])}\\begin{vmatrix} ${m[1][0]} & ${m[1][2]} \\\\ ${m[2][0]} & ${m[2][2]} \\end{vmatrix} + ${p(m[0][2])}\\begin{vmatrix} ${m[1][0]} & ${m[1][1]} \\\\ ${m[2][0]} & ${m[2][1]} \\end{vmatrix}$`,
      `Mineurs : $${M[0]}$, $${M[1]}$ et $${M[2]}$.`,
      `$\\det A = ${p(m[0][0])} \\times ${p(M[0])} - ${p(m[0][1])} \\times ${p(M[1])} + ${p(m[0][2])} \\times ${p(M[2])} = ${D}$.`,
    ];
    const enonce = `Calculer le déterminant de $A = ${matTex(m)}$.`;
    const indice = 'Développe selon une ligne ou une colonne contenant des zéros (signes en damier).';
    if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: D };
    const c = (v: number, explication: string): Candidat => ({ texte: `$${v}$`, explication, cle: cleNum(v) });
    const signeOublie = m[0][0] * M[0] + m[0][1] * M[1] + m[0][2] * M[2];
    const sarrusMoitie = m[0][0] * m[1][1] * m[2][2] + m[0][1] * m[1][2] * m[2][0] + m[0][2] * m[1][0] * m[2][1];
    return construireQcm({ difficulte, enonce, indice, correction }, c(D, `Développement correct : $\\det A = ${D}$.`), [
      c(signeOublie, 'Signe oublié : le 2e terme du développement est affecté du signe $-$ (damier $+-+$).'),
      c(sarrusMoitie, 'Règle de Sarrus incomplète : il faut aussi retrancher les trois produits « descendants vers la gauche ».'),
      c(-D, 'Erreur de signe globale : vérifie le signe de chaque mineur.'),
      c(m[0][0] * m[1][1] * m[2][2], "Ce n'est que le produit des coefficients diagonaux (vrai seulement pour une matrice triangulaire)."),
      c(D + 2, "Erreur de calcul dans l'un des mineurs 2×2."),
      c(D - 2, "Erreur de calcul dans l'un des mineurs 2×2."),
    ]);
  },
};
