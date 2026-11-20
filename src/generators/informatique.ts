/**
 * Générateurs — informatique (langage C, programme CY Tech).
 *
 * Chaque question montre un extrait de code C et demande ce qu'il affiche
 * (un entier). La réponse est calculée ici en reproduisant la sémantique du C
 * (division entière tronquée vers zéro, reste du signe du dividende…) ; les
 * tests COMPILENT l'extrait affiché avec gcc et comparent sa sortie
 * (tests/generators-informatique.test.ts).
 *
 * Exception : listes, piles et files (opérations décrites en mots, QCM).
 */
import { randInt, pick, shuffle, type Rng } from '../core/random';
import type { Difficulte, Question } from '../core/schema';
import { construireQcm, cleNum, type Forme, type Generateur } from './outils';

/** Division et reste entiers du C (troncature vers zéro). */
export const divC = (a: number, b: number): number => Math.trunc(a / b);
export const modC = (a: number, b: number): number => a - b * divC(a, b);

const bloc = (code: string): string => `\`\`\`c\n${code}\n\`\`\``;

interface ProblemeC {
  /** Extrait de code C : il affiche exactement `valeur` (suivi d'un retour à la ligne). */
  code: string;
  valeur: number;
  indice: string;
  correction: string[];
  explication: string;
  pieges: [number, string][];
  /** Phrase d'introduction (défaut : « Qu'affiche ce code ? »). */
  question?: string;
}

function produire(p: ProblemeC, difficulte: Difficulte, forme: Forme): Question {
  const enonce = `${p.question ?? 'Qu’affiche ce code ?'}\n${bloc(p.code)}`;
  const { indice, correction } = p;
  if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: p.valeur };
  const cand = (v: number, explication: string) => ({ texte: `\`${v}\``, explication, cle: cleNum(v) });
  // Pièges de réserve (priorité basse) : toujours 4 choix.
  const reserve: [number, string][] = [
    [p.valeur + 1, 'Erreur d’une unité : refais la trace pas à pas.'],
    [p.valeur - 1, 'Erreur d’une unité : refais la trace pas à pas.'],
    [-p.valeur, 'Attention au signe.'],
    [p.valeur + 2, 'Refais la trace pas à pas.'],
  ];
  const pieges = [...p.pieges, ...reserve].filter(([v]) => Number.isFinite(v));
  return construireQcm({ difficulte, enonce, indice, correction }, cand(p.valeur, p.explication), pieges.map(([v, e]) => cand(v, e)));
}

const generateur = (id: string, titre: string, chapitre: string, probleme: (rng: Rng, d: Difficulte) => ProblemeC): Generateur => ({
  id,
  titre,
  chapitre,
  formes: ['qcm', 'libre'],
  generer: (rng, difficulte, forme) => produire(probleme(rng, difficulte), difficulte, forme),
});

/* ------------------------------------------------------------------ */
/* Bases : division entière, modulo, priorités                         */
/* ------------------------------------------------------------------ */

export const operateurs = generateur('c-operateurs', 'Division entière et modulo', 'c-bases', (rng, d) => {
  if (d <= 2) {
    const b = randInt(rng, 2, 9);
    let a = randInt(rng, 10, 60);
    while (a % b === 0) a = randInt(rng, 10, 60);
    if (d === 2) a = -a;
    const op = pick(rng, ['/', '%'] as const);
    const valeur = op === '/' ? divC(a, b) : modC(a, b);
    const reel = a / b;
    const pieges: [number, string][] =
      op === '/'
        ? [
            [Math.floor(reel), d === 2 ? 'En C, la division entière tronque vers zéro (pas vers −∞).' : 'Ce serait l’arrondi inférieur d’un réel négatif.'],
            [Math.round(reel), 'La division entière tronque : elle n’arrondit pas au plus proche.'],
            [Math.ceil(reel), 'La division entière ne prend pas l’entier supérieur.'],
            [modC(a, b), 'C’est le reste (`%`), pas le quotient.'],
            [-valeur, 'Attention au signe du quotient.'],
          ]
        : [
            [((a % b) + b) % b, d === 2 ? 'En C, le reste a le signe du dividende : il est négatif ici.' : 'Reste mal calculé.'],
            [divC(a, b), 'C’est le quotient (`/`), pas le reste.'],
            [-valeur, 'Le reste a le signe du dividende `a`.'],
            [b - Math.abs(valeur), 'C’est ce qu’il manque pour atteindre le multiple suivant, pas le reste.'],
          ];
    return {
      code: `int a = ${a}, b = ${b};\nprintf("%d\\n", a ${op} b);`,
      valeur,
      indice: d === 2 ? 'En C, `/` entre entiers tronque vers zéro et `a % b` a le signe de `a`.' : '`/` entre deux `int` donne un `int` : la partie décimale est perdue.',
      correction: [
        `$${a} = ${b} \\times (${divC(a, b)}) + (${modC(a, b)})$ : quotient tronqué vers zéro ${op === '/' ? '' : 'et '}reste du signe du dividende.`,
        `Donc \`a ${op} b\` vaut \`${valeur}\`.`,
      ],
      explication: `\`a ${op} b\` vaut ${valeur} en C.`,
      pieges,
    };
  }
  // Priorités : * / % (de gauche à droite) avant + −.
  const [a, b, c] = [randInt(rng, 11, 40), randInt(rng, 2, 7), randInt(rng, 2, 6)];
  const modele = pick(rng, [
    { code: 'a / b * c', v: divC(a, b) * c, droite: divC(a, b * c), reel: Math.round((a / b) * c) },
    { code: 'a * c / b', v: divC(a * c, b), droite: a * divC(c, b), reel: Math.round((a * c) / b) },
    { code: 'a % b * c', v: modC(a, b) * c, droite: modC(a, b * c), reel: (a % b) * c + 1 },
    { code: 'a + b % c', v: a + modC(b, c), droite: modC(a + b, c), reel: a + b },
    { code: 'a - b * c / 2', v: a - divC(b * c, 2), droite: a - b * divC(c, 2), reel: Math.round(a - (b * c) / 2) },
  ]);
  return {
    code: `int a = ${a}, b = ${b}, c = ${c};\nprintf("%d\\n", ${modele.code});`,
    valeur: modele.v,
    indice: '`*`, `/` et `%` ont la même priorité et se calculent de gauche à droite, avant `+` et `-`.',
    correction: [`Ordre des calculs : \`${modele.code}\` se lit de gauche à droite pour \`* / %\`, chaque division étant entière.`, `Résultat : \`${modele.v}\`.`],
    explication: 'Priorités et division entière respectées.',
    pieges: [
      [modele.droite, 'Calculé de droite à gauche : `*`, `/` et `%` s’évaluent de gauche à droite.'],
      [modele.reel, 'Calcul fait en réels : chaque division entière tronque immédiatement.'],
      [modele.v + 1, 'Erreur d’une unité dans une division entière.'],
      [modele.v - 1, 'Erreur d’une unité dans une division entière.'],
    ],
  };
});

/* ------------------------------------------------------------------ */
/* Conditions et boucles                                               */
/* ------------------------------------------------------------------ */

export const boucles = generateur('c-boucles', 'Tracer une boucle', 'c-controle', (rng, d) => {
  if (d === 1) {
    const debut = randInt(rng, 0, 4);
    const fin = randInt(rng, debut + 3, debut + 8);
    let s = 0;
    for (let i = debut; i < fin; i++) s += i;
    return {
      code: `int s = 0;\nfor (int i = ${debut}; i < ${fin}; i++)\n    s += i;\nprintf("%d\\n", s);`,
      valeur: s,
      indice: `\`i\` prend les valeurs de ${debut} à ${fin - 1} (la condition est \`i < ${fin}\`, stricte).`,
      correction: [`\`i\` vaut successivement ${Array.from({ length: fin - debut }, (_, k) => debut + k).join(', ')}.`, `Leur somme est ${s}.`],
      explication: `Somme des entiers de ${debut} à ${fin - 1}.`,
      pieges: [
        [s + fin, `\`i < ${fin}\` est stricte : ${fin} n’est pas ajouté.`],
        [s - debut + fin, 'Décalage d’un cran : la boucle commence à la valeur initiale.'],
        [fin - debut, 'C’est le nombre de tours, pas la somme.'],
        [s - debut, `La première valeur, ${debut}, est bien ajoutée.`],
      ],
    };
  }
  if (d === 2) {
    if (rng() < 0.5) {
      const n = randInt(rng, 9, 200);
      let m = n;
      let k = 0;
      while (m > 1) {
        m = divC(m, 2);
        k++;
      }
      return {
        code: `int n = ${n}, k = 0;\nwhile (n > 1) {\n    n = n / 2;\n    k++;\n}\nprintf("%d\\n", k);`,
        valeur: k,
        indice: 'Compte combien de divisions entières par 2 il faut pour descendre à 1.',
        correction: [`$${n}$ : on divise par 2 (division entière) tant que $n > 1$.`, `Il faut ${k} divisions : c’est $\\lfloor \\log_2 ${n} \\rfloor$.`],
        explication: `${k} divisions par 2.`,
        pieges: [
          [k + 1, 'Un tour de trop : on s’arrête dès que `n` vaut 1.'],
          [k - 1, 'Un tour manquant.'],
          [divC(n, 2), 'C’est n / 2, pas le nombre de tours.'],
          [Math.ceil(Math.log2(n)), 'Arrondi supérieur : les divisions entières font arrondir vers le bas.'],
        ],
      };
    }
    const debut = randInt(rng, 1, 5);
    const pas = randInt(rng, 2, 4);
    const fin = randInt(rng, debut + 3 * pas, debut + 6 * pas);
    let s = 0;
    let tours = 0;
    for (let i = debut; i <= fin; i += pas) {
      s += i;
      tours++;
    }
    return {
      code: `int s = 0;\nfor (int i = ${debut}; i <= ${fin}; i += ${pas})\n    s += i;\nprintf("%d\\n", s);`,
      valeur: s,
      indice: `Liste les valeurs de \`i\` : ${debut}, ${debut + pas}, … sans dépasser ${fin}.`,
      correction: [
        `\`i\` vaut ${Array.from({ length: tours }, (_, k) => debut + k * pas).join(', ')} (${tours} tours).`,
        `Somme : ${s}.`,
      ],
      explication: `Somme des valeurs prises par \`i\`.`,
      pieges: [
        [tours, 'C’est le nombre de tours, pas la somme.'],
        [s + debut + tours * pas, 'Un tour de trop : la dernière valeur dépasserait la borne.'],
        [s - (debut + (tours - 1) * pas), `\`<=\` : la borne ${fin} est atteinte si elle est sur le pas.`],
        [((debut + fin) * (fin - debut + 1)) / 2, `Le pas est ${pas}, pas 1.`],
      ],
    };
  }
  const n = randInt(rng, 4, 9);
  const v = pick(rng, [
    { init: 'i', cond: 'j < n', c: (n * (n + 1)) / 2 },
    { init: 'i + 1', cond: 'j < n', c: (n * (n - 1)) / 2 },
    { init: '0', cond: 'j < i', c: (n * (n - 1)) / 2 },
    { init: '0', cond: 'j <= i', c: (n * (n + 1)) / 2 },
  ]);
  return {
    code: `int n = ${n}, c = 0;\nfor (int i = 0; i < n; i++)\n    for (int j = ${v.init}; ${v.cond}; j++)\n        c++;\nprintf("%d\\n", c);`,
    valeur: v.c,
    indice: 'Compte les tours de la boucle intérieure pour chaque valeur de `i`, puis additionne.',
    correction: [`Pour chaque \`i\`, la boucle intérieure fait un nombre de tours qui dépend de \`i\` : on additionne ces nombres.`, `Total : ${v.c}.`],
    explication: 'Somme des tours de la boucle intérieure.',
    pieges: [
      [n * n, 'La boucle intérieure ne fait pas n tours à chaque fois : elle dépend de `i`.'],
      [v.c === (n * (n + 1)) / 2 ? (n * (n - 1)) / 2 : (n * (n + 1)) / 2, 'Décalage d’un tour sur chaque passage (borne `<` ou `<=`, départ `i` ou `i + 1`).'],
      [n, 'C’est le nombre de tours de la boucle extérieure.'],
      [2 * n, 'Les deux boucles sont imbriquées : les tours se multiplient, ils ne s’additionnent pas.'],
    ],
  };
});

/* ------------------------------------------------------------------ */
/* Fonctions et tableaux                                               */
/* ------------------------------------------------------------------ */

const tableau = (rng: Rng, n: number) => Array.from({ length: n }, () => randInt(rng, -9, 20));
const litteral = (t: number[]) => `{${t.join(', ')}}`;

export const tableaux = generateur('c-tableaux', 'Tableaux et fonctions', 'c-fonctions-tableaux', (rng, d) => {
  if (d === 1) {
    const t = tableau(rng, 6);
    const pairs = t.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
    const impairs = t.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0);
    return {
      code: `int t[6] = ${litteral(t)};\nint s = 0;\nfor (int i = 0; i < 6; i += 2)\n    s += t[i];\nprintf("%d\\n", s);`,
      valeur: pairs,
      indice: 'Les indices commencent à 0 : `i` vaut 0, 2 puis 4.',
      correction: [`On additionne \`t[0]\`, \`t[2]\` et \`t[4]\` : ${t[0]} + ${t[2]} + ${t[4]} = ${pairs}.`],
      explication: 'Somme des cases d’indice pair (0, 2, 4).',
      pieges: [
        [impairs, 'Les indices commencent à 0 : la première case additionnée est `t[0]`.'],
        [pairs + impairs, 'Le pas est 2 : une case sur deux.'],
        [t[0] + t[2], 'La case `t[4]` est aussi prise (4 < 6).'],
        [t[2] + t[4], '`t[0]` est la première case.'],
      ],
    };
  }
  if (d === 2) {
    const t = tableau(rng, 3);
    const x = randInt(rng, 2, 9);
    return {
      code: `void f(int t[], int x) {\n    t[0] = x;\n    x = 0;\n}\n\nint t[3] = ${litteral(t)};\nint x = ${x};\nf(t, x);\nprintf("%d\\n", t[0] + x);`,
      valeur: 2 * x,
      indice: 'Un tableau passé à une fonction est modifiable par elle ; un `int` est copié.',
      correction: [`\`t[0] = x\` modifie le tableau de l’appelant : \`t[0]\` vaut ${x}.`, `\`x = 0\` ne modifie que la copie locale : \`x\` vaut toujours ${x}.`, `Affichage : ${x} + ${x} = ${2 * x}.`],
      explication: 'Le tableau est modifié, l’entier non.',
      pieges: [
        [x, 'La modification de `x` dans `f` ne touche qu’une copie.'],
        [t[0] + x, 'Le tableau, lui, est bien modifié par `f` (on passe son adresse).'],
        [t[0], 'Ni l’un ni l’autre ? Le tableau est modifié.'],
        [3 * x, 'Seule la case `t[0]` reçoit `x`.'],
      ],
    };
  }
  const t = tableau(rng, 7);
  let c = 0;
  for (let i = 1; i < t.length; i++) if (t[i] > t[i - 1]) c++;
  return {
    code: `int t[7] = ${litteral(t)};\nint c = 0;\nfor (int i = 1; i < 7; i++)\n    if (t[i] > t[i - 1])\n        c++;\nprintf("%d\\n", c);`,
    valeur: c,
    indice: 'Compare chaque case à la précédente (6 comparaisons).',
    correction: [`On compte les montées strictes : ${t.slice(1).map((v, i) => `${t[i]}→${v}`).join(', ')}.`, `Il y en a ${c}.`],
    explication: 'Nombre de cases strictement plus grandes que la précédente.',
    pieges: [
      [6 - c, 'Ce sont les descentes (ou égalités), pas les montées.'],
      [c + 1, 'La boucle commence à `i = 1` : 6 comparaisons seulement.'],
      [t.filter((v) => v > 0).length, 'On compare chaque case à la précédente, pas à 0.'],
      [c - 1, 'Une montée a été oubliée.'],
    ],
  };
});

/* ------------------------------------------------------------------ */
/* Pointeurs                                                           */
/* ------------------------------------------------------------------ */

export const pointeurs = generateur('c-pointeurs', 'Suivre des pointeurs', 'c-pointeurs', (rng, d) => {
  if (d === 1) {
    const a = randInt(rng, 2, 20);
    const k = randInt(rng, 2, 9);
    return {
      code: `int a = ${a};\nint *p = &a;\n*p = *p + ${k};\nprintf("%d\\n", a);`,
      valeur: a + k,
      indice: '`*p` désigne la variable pointée par `p`, c’est-à-dire `a` lui-même.',
      correction: [`\`p\` contient l’adresse de \`a\` : \`*p = *p + ${k}\` équivaut à \`a = a + ${k}\`.`, `\`a\` vaut ${a + k}.`],
      explication: 'Modifier `*p` modifie `a`.',
      pieges: [
        [a, 'Modifier `*p`, c’est modifier `a` : `p` pointe sur `a`.'],
        [k, '`*p` vaut `a` au départ, on lui ajoute ' + k + '.'],
        [a * k, 'C’est une addition.'],
        [2 * a + k, '`*p` et `a` sont la même variable : elle n’est augmentée qu’une fois.'],
      ],
    };
  }
  if (d === 2) {
    const a = randInt(rng, 2, 12);
    const b = randInt(rng, 2, 12);
    const k = randInt(rng, 1, 5);
    const a2 = b + k;
    const b2 = 2 * b;
    return {
      code: `int a = ${a}, b = ${b};\nint *p = &a, *q = &b;\n*p = *q + ${k};\np = q;\n*p = *p * 2;\nprintf("%d\\n", a + b);`,
      valeur: a2 + b2,
      indice: 'Après `p = q`, `p` pointe sur `b` (c’est l’adresse qui est copiée).',
      correction: [`\`*p = *q + ${k}\` : \`a = b + ${k} = ${a2}\`.`, `\`p = q\` : \`p\` pointe maintenant sur \`b\`.`, `\`*p = *p * 2\` : \`b = ${b2}\`.`, `\`a + b = ${a2 + b2}\`.`],
      explication: '`a` reçoit `b + k`, puis `b` est doublé.',
      pieges: [
        [2 * a2 + b, '`p = q` copie l’adresse : c’est `b` qui est doublé, pas `a`.'],
        [a2 + b, 'Après `p = q`, `*p` désigne `b`, qui est doublé.'],
        [a + b2, '`*p = *q + k` a modifié `a` (p pointait alors sur `a`).'],
        [a + b + k, 'Les deux affectations par pointeur ont eu lieu.'],
      ],
    };
  }
  const t = Array.from({ length: 7 }, () => randInt(rng, 1, 30));
  const i = randInt(rng, 2, 4);
  const j = randInt(rng, 1, 6 - i);
  const k = randInt(rng, 1, Math.min(i, 6 - i));
  const v = t[i + j] - t[i - k];
  return {
    code: `int t[7] = ${litteral(t)};\nint *p = t + ${i};\nprintf("%d\\n", *(p + ${j}) - p[-${k}]);`,
    valeur: v,
    indice: `\`p\` pointe sur \`t[${i}]\` ; \`*(p + ${j})\` et \`p[${j}]\` désignent la même case.`,
    correction: [`\`p = t + ${i}\` pointe sur \`t[${i}]\`.`, `\`*(p + ${j})\` vaut \`t[${i + j}]\` = ${t[i + j]} et \`p[-${k}]\` vaut \`t[${i - k}]\` = ${t[i - k]}.`, `Différence : ${v}.`],
    explication: `\`t[${i + j}] - t[${i - k}]\`.`,
    pieges: [
      [t[j] - t[k], `\`p\` ne pointe pas sur le début du tableau mais sur \`t[${i}]\`.`],
      [t[i] + j - (t[i] - k), '`*(p + j)` décale le pointeur, pas la valeur pointée.'],
      [t[i + j] - t[i + k], '`p[-k]` remonte de k cases.'],
      [-v, 'Ordre de la soustraction inversé.'],
    ],
  };
});

/* ------------------------------------------------------------------ */
/* Chaînes de caractères                                               */
/* ------------------------------------------------------------------ */

const MOTS = ['chat', 'python', 'matrice', 'pointeur', 'boucle', 'tableau', 'kayak', 'algorithme', 'pile', 'octet'];

export const chaines = generateur('c-chaines-gen', 'Chaînes et caractères', 'c-chaines', (rng, d) => {
  if (d === 1) {
    const mot = pick(rng, MOTS);
    const sizeOf = rng() < 0.5;
    const n = mot.length;
    return {
      code: `char s[] = "${mot}";\nprintf("%d\\n", (int)${sizeOf ? 'sizeof s' : 'strlen(s)'});`,
      valeur: sizeOf ? n + 1 : n,
      indice: '`strlen` compte les caractères avant `\'\\0\'` ; `sizeof` d’un tableau compte tous ses octets, `\'\\0\'` compris.',
      correction: [`« ${mot} » compte ${n} caractères ; le tableau en réserve ${n + 1} (avec le \`'\\0'\` final).`, sizeOf ? `\`sizeof s\` vaut ${n + 1}.` : `\`strlen(s)\` vaut ${n}.`],
      explication: sizeOf ? '`sizeof` compte aussi le caractère nul.' : '`strlen` ne compte pas le caractère nul.',
      pieges: [
        [sizeOf ? n : n + 1, sizeOf ? '`sizeof` d’un tableau compte aussi le `\'\\0\'` final.' : '`strlen` ne compte pas le `\'\\0\'` final.'],
        [8, 'Ce serait la taille d’un pointeur ; ici `s` est un tableau.'],
        [n - 1, 'Tous les caractères comptent.'],
        [n + 2, 'Un seul caractère nul termine la chaîne.'],
      ],
    };
  }
  if (d === 2) {
    const lettre = String.fromCharCode(97 + randInt(rng, 2, 24));
    const rang = lettre.charCodeAt(0) - 97 + 1;
    return {
      code: `char c = '${lettre}';\nprintf("%d\\n", c - 'a' + 1);`,
      valeur: rang,
      indice: 'Les lettres minuscules ont des codes consécutifs : `\'b\' - \'a\'` vaut 1.',
      correction: [`\`'${lettre}' - 'a'\` vaut ${rang - 1} (écart entre les codes ASCII).`, `On ajoute 1 : ${rang}, le rang de « ${lettre} » dans l’alphabet.`],
      explication: `« ${lettre} » est la ${rang}ᵉ lettre.`,
      pieges: [
        [rang - 1, 'Il reste le `+ 1`.'],
        [lettre.charCodeAt(0), 'C’est le code ASCII de la lettre, pas la différence.'],
        [lettre.charCodeAt(0) - 97, 'Il reste le `+ 1`… et c’est l’écart, pas le code.'],
        [rang + 1, '`\'a\' - \'a\'` vaut 0.'],
      ].filter(([v], i, l) => l.findIndex(([w]) => w === v) === i) as [number, string][],
    };
  }
  const mot = pick(rng, MOTS);
  const cible = pick(rng, [...new Set(mot)]);
  const n = [...mot].filter((ch) => ch === cible).length;
  return {
    code: `char s[] = "${mot}";\nint n = 0;\nfor (int i = 0; s[i] != '\\0'; i++)\n    if (s[i] == '${cible}')\n        n++;\nprintf("%d\\n", n);`,
    valeur: n,
    indice: 'La boucle parcourt chaque caractère jusqu’au `\'\\0\'` final.',
    correction: [`On compte les « ${cible} » de « ${mot} » : ${n}.`],
    explication: `« ${cible} » apparaît ${n} fois.`,
    pieges: [
      [mot.length, 'C’est la longueur de la chaîne.'],
      [n + 1, 'Le `\'\\0\'` final n’est pas compté.'],
      [n - 1 > 0 ? n - 1 : n + 2, 'Toutes les occurrences comptent, la première comme la dernière.'],
      [mot.length - n, 'Ce sont les autres caractères.'],
    ],
  };
});

/* ------------------------------------------------------------------ */
/* Récursivité                                                         */
/* ------------------------------------------------------------------ */

const fib = (n: number): number => (n <= 1 ? n : fib(n - 1) + fib(n - 2));
const appelsFib = (n: number): number => (n <= 1 ? 1 : 1 + appelsFib(n - 1) + appelsFib(n - 2));

export const recursion = generateur('c-recursion', 'Tracer une fonction récursive', 'c-algorithmes', (rng, d) => {
  if (d === 1) {
    const n = randInt(rng, 102, 9999);
    const s = [...String(n)].reduce((a, ch) => a + Number(ch), 0);
    return {
      code: `int f(int n) {\n    if (n < 10)\n        return n;\n    return n % 10 + f(n / 10);\n}\n\nprintf("%d\\n", f(${n}));`,
      valeur: s,
      indice: '`n % 10` est le dernier chiffre, `n / 10` enlève ce chiffre.',
      correction: [`\`f\` additionne le dernier chiffre et le résultat sur les chiffres restants : c’est la somme des chiffres.`, `${[...String(n)].join(' + ')} = ${s}.`],
      explication: 'Somme des chiffres.',
      pieges: [
        [String(n).length, 'C’est le nombre de chiffres.'],
        [Number([...String(n)].reverse().join('')), 'Ce serait le nombre écrit à l’envers.'],
        [s - Number(String(n)[0]), 'Le cas de base renvoie le premier chiffre : il est compté.'],
        [n % 10, 'La récursion continue sur les autres chiffres.'],
      ],
    };
  }
  const n = randInt(rng, 5, 11);
  if (d === 2)
    return {
      code: `int f(int n) {\n    if (n <= 1)\n        return n;\n    return f(n - 1) + f(n - 2);\n}\n\nprintf("%d\\n", f(${n}));`,
      valeur: fib(n),
      indice: 'Calcule f(0), f(1), f(2)… de proche en proche.',
      correction: [`f(0) = 0, f(1) = 1, puis chaque valeur est la somme des deux précédentes (suite de Fibonacci).`, `f(${n}) = ${fib(n)}.`],
      explication: `Fibonacci : f(${n}) = ${fib(n)}.`,
      pieges: [
        [fib(n + 1), 'Décalage d’un rang : f(1) = 1 et f(2) = 1.'],
        [fib(n - 1), 'Décalage d’un rang.'],
        [2 ** (n - 1), 'Chaque appel n’en fait pas deux de même taille.'],
        [n * (n - 1), 'Ce n’est pas un produit.'],
      ],
    };
  return {
    question: 'Combien d’appels de `f` ce programme effectue-t-il (appel initial compris) ?',
    code: `#include <stdio.h>\n\nint appels = 0;\n\nint f(int n) {\n    appels++;\n    if (n <= 1)\n        return 1;\n    return f(n - 1) + f(n - 2);\n}\n\nint main(void) {\n    f(${n});\n    printf("%d\\n", appels);\n    return 0;\n}`,
    valeur: appelsFib(n),
    indice: 'Si A(n) est le nombre d’appels pour f(n) : A(0) = A(1) = 1 et A(n) = 1 + A(n − 1) + A(n − 2).',
    correction: [`A(0) = A(1) = 1, puis A(n) = 1 + A(n − 1) + A(n − 2).`, `A(${n}) = ${appelsFib(n)} : l’arbre des appels grossit comme Fibonacci (coût exponentiel).`],
    explication: `${appelsFib(n)} appels.`,
    pieges: [
      [fib(n + 1), 'C’est la valeur renvoyée, pas le nombre d’appels.'],
      [n, 'Chaque appel en déclenche deux : l’arbre est bien plus grand.'],
      [2 ** n, 'L’arbre n’est pas complet : f(n − 2) est moins profond.'],
      [appelsFib(n) - 1, 'L’appel initial compte aussi.'],
    ],
  };
});

/* ------------------------------------------------------------------ */
/* Listes, piles, files (QCM, opérations décrites en mots)             */
/* ------------------------------------------------------------------ */

type Operation = { quoi: 'tete' | 'queue' | 'retirer-tete'; v?: number };

/** Applique les opérations à une liste (tableau JS : début = tête). */
export function appliquerListe(ops: readonly Operation[]): number[] {
  const l: number[] = [];
  for (const o of ops) {
    if (o.quoi === 'tete') l.unshift(o.v!);
    else if (o.quoi === 'queue') l.push(o.v!);
    else l.shift();
  }
  return l;
}

const dire = (o: Operation) => (o.quoi === 'tete' ? `insérer ${o.v} en tête` : o.quoi === 'queue' ? `insérer ${o.v} en queue` : 'supprimer la tête');
const afficherListe = (l: number[]) => (l.length ? `\`${l.join(' → ')}\`` : 'la liste vide');

export const listes: Generateur = {
  id: 'c-listes-operations',
  titre: 'Opérations sur une liste chaînée',
  chapitre: 'c-listes-chainees',
  formes: ['qcm'],
  generer(rng, difficulte): Question {
    const n = difficulte + 3;
    const valeurs = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng).slice(0, n);
    const ops: Operation[] = [];
    for (const v of valeurs) {
      ops.push({ quoi: difficulte === 1 ? 'tete' : pick(rng, ['tete', 'queue'] as const), v });
      if (difficulte === 3 && rng() < 0.3) ops.push({ quoi: 'retirer-tete' });
    }
    const resultat = appliquerListe(ops);
    const tousQueue = appliquerListe(ops.map((o) => (o.quoi === 'tete' ? { ...o, quoi: 'queue' } : o)));
    const tousTete = appliquerListe(ops.map((o) => (o.quoi === 'queue' ? { ...o, quoi: 'tete' } : o)));
    const sansSuppression = appliquerListe(ops.filter((o) => o.quoi !== 'retirer-tete'));
    const cand = (l: number[], explication: string) => ({ texte: afficherListe(l), explication, cle: l.join(',') });
    return construireQcm(
      {
        difficulte,
        enonce: `On part de la liste chaînée vide, puis on effectue dans l’ordre : ${ops.map(dire).join(', ')}. Que contient la liste, de la tête à la queue ?`,
        indice: 'Insérer en tête place l’élément AVANT tous les autres ; en queue, après.',
        correction: [`Étape par étape : ${ops.map((o, k) => `${dire(o)} → ${afficherListe(appliquerListe(ops.slice(0, k + 1)))}`).join(' ; ')}.`],
      },
      cand(resultat, 'On applique les opérations dans l’ordre.'),
      [
        cand(tousQueue, 'Les insertions en tête placent l’élément au début, pas à la fin.'),
        cand(tousTete, 'Les insertions en queue placent l’élément à la fin.'),
        cand([...resultat].reverse(), 'Liste lue à l’envers (de la queue à la tête).'),
        cand(sansSuppression, 'Les suppressions de tête ont été oubliées.'),
        cand([...valeurs], 'Ce serait l’ordre d’arrivée, comme si tout était inséré en queue.'),
        cand([...resultat.slice(1), ...resultat.slice(0, 1)], 'La tête de liste est le dernier élément inséré en tête, pas le premier.'),
        cand([...resultat].sort((a, b) => a - b), 'Une liste chaînée n’est pas triée : elle garde l’ordre des insertions.'),
        cand(resultat.length > 1 ? [resultat[1], resultat[0], ...resultat.slice(2)] : [...resultat, valeurs[0]], 'Les deux premières insertions ont été inversées.'),
      ],
    );
  },
};

export const GENERATEURS_INFORMATIQUE: readonly Generateur[] = [operateurs, boucles, tableaux, pointeurs, chaines, recursion, listes];
