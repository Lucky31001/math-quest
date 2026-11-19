/** Vérifications indépendantes — Informatique (langage C, compilé par gcc). Clé : « chapitre/question ». */
import { expect } from 'vitest';
import {
  attendu,
  bonChoixCode,
  codeCours,
  codeDe,
  definitionsC,
  executerC,
  fonction,
  instructionsC,
  question,
} from '../outils/verification';

export const verifications: Record<string, () => void> = {
  /* ========================= INFORMATIQUE (langage C) ========================= */
  /* ---------------- Bases ---------------- */
  'c-bases/modulo': () => expect(attendu(question('c-bases', 'modulo')).re).toBe(Number(instructionsC('', '%d', '17 % 5'))),
  'c-bases/division-negative': () => expect(attendu(question('c-bases', 'division-negative')).re).toBe(Number(instructionsC('', '%d', '-7 / 2'))),
  'c-bases/cast': () => {
    const q = question('c-bases', 'cast');
    expect(attendu(q).re).toBeCloseTo(Number(instructionsC(codeDe(q), '%f', 'x + y')), 10);
  },
  'c-bases/incrementation': () => {
    const q = question('c-bases', 'incrementation');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 'a + b')));
  },
  'c-bases/qcm': () => {
    expect(instructionsC('', '%d', '7 / 2')).toBe(bonChoixCode(question('c-bases', 'division-entiere')));
    expect(instructionsC('', '%d', '-7 % 2')).toBe(bonChoixCode(question('c-bases', 'modulo-negatif')));
    expect(instructionsC(codeDe(question('c-bases', 'char-ascii')), '%s', '""')).toBe(bonChoixCode(question('c-bases', 'char-ascii')));
    expect(instructionsC('int x = 0;', '%d', 'x != 0 && 10 / x > 1')).toBe('0');
    expect(instructionsC('int s = 12 + 15 + 10;\ndouble m = s / 3;', '%.2f', 'm')).toBe('12.00');
  },
  /* ---------------- Conditions et boucles ---------------- */
  'c-controle/somme-for': () => {
    const q = question('c-controle', 'somme-for');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 's')));
  },
  'c-controle/while-divisions': () => {
    const q = question('c-controle', 'while-divisions');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 'k')));
  },
  'c-controle/syracuse': () => {
    const q = question('c-controle', 'syracuse');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 'etapes')));
  },
  'c-controle/boucles-imbriquees': () => {
    const q = question('c-controle', 'boucles-imbriquees');
    const f = fonction(q);
    for (const n of [1, 2, 5, 9]) expect(f(n)).toBeCloseTo(Number(instructionsC(`int n = ${n};\n${codeDe(q)}`, '%d', 'c')), 10);
  },
  'c-controle/qcm': () => {
    const qc = (id: string) => question('c-controle', id);
    expect(instructionsC(codeDe(qc('do-while')), '%s', '""')).toBe(bonChoixCode(qc('do-while')));
    expect(instructionsC(codeDe(qc('switch-sans-break')), '%s', '""')).toBe(bonChoixCode(qc('switch-sans-break')));
    expect(instructionsC(codeDe(qc('break-continue')), '%d', 's')).toBe(bonChoixCode(qc('break-continue')));
    // Piège volontaire (gcc -Wall le signale : « misleading indentation »).
    expect(executerC(`int main(void) {\n${codeDe(qc('vf-point-virgule'))}\nreturn 0;\n}`, true)).toBe('10');
    // 10 additions de 0.1 ne donnent pas exactement 1.0.
    expect(instructionsC('double x = 0;\nfor (int k = 0; k < 10; k++) x += 0.1;', '%d', 'x != 1.0')).toBe('1');
  },
  /* ---------------- Fonctions et tableaux ---------------- */
  'c-fonctions-tableaux/appel-simple': () => {
    const q = question('c-fonctions-tableaux', 'appel-simple');
    expect(attendu(q).re).toBe(Number(definitionsC(codeDe(q), '%d', 'carre(3) + carre(4)')));
  },
  'c-fonctions-tableaux/somme-tableau': () => {
    const somme = codeCours('c-fonctions-tableaux', 'int somme(');
    const sortie = executerC(`${somme}\nint main(void) {\nint t[] = {3, 1, 4, 1, 5, 9};\nprintf("%d\\n", somme(t, 6));\nreturn 0;\n}`);
    expect(attendu(question('c-fonctions-tableaux', 'somme-tableau')).re).toBe(Number(sortie));
  },
  'c-fonctions-tableaux/return-boucle': () => {
    const q = question('c-fonctions-tableaux', 'return-boucle');
    expect(attendu(q).re).toBe(Number(definitionsC(codeDe(q), '%d', 'h(10)')));
  },
  'c-fonctions-tableaux/composition': () => {
    const q = question('c-fonctions-tableaux', 'composition');
    const f = fonction(q);
    for (const x of [-2, 0.5, 3]) expect(f(x)).toBeCloseTo(Number(definitionsC(codeDe(q), '%f', `g(${x})`)), 6);
  },
  'c-fonctions-tableaux/anti-diagonale': () => {
    const q = question('c-fonctions-tableaux', 'anti-diagonale');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 's')));
  },
  'c-fonctions-tableaux/qcm': () => {
    const qc = (id: string) => question('c-fonctions-tableaux', id);
    expect(executerC(codeDe(qc('passage-valeur')))).toBe(bonChoixCode(qc('passage-valeur')));
    expect(executerC(codeDe(qc('tableau-modifie')))).toBe(bonChoixCode(qc('tableau-modifie')));
    expect(instructionsC('int m[3][4];', '%zu', 'sizeof(m) / sizeof(m[0][0])')).toBe(bonChoixCode(qc('taille-2d')));
  },
  /* ---------------- Chaînes ---------------- */
  'c-chaines/strlen': () => expect(attendu(question('c-chaines', 'strlen')).re).toBe(Number(instructionsC('', '%zu', 'strlen("bonjour")'))),
  'c-chaines/octets-chaine': () => {
    const f = fonction(question('c-chaines', 'octets-chaine'));
    for (const n of [0, 1, 4, 11]) expect(f(n)).toBe(Number(instructionsC('', '%zu', `sizeof("${'x'.repeat(n)}")`)));
  },
  'c-chaines/chiffre-valeur': () => {
    const q = question('c-chaines', 'chiffre-valeur');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 'v')));
  },
  'c-chaines/compte-lettre': () => {
    const q = question('c-chaines', 'compte-lettre');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 'n')));
  },
  'c-chaines/conversion-entier': () => {
    const q = question('c-chaines', 'conversion-entier');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 'v + 1')));
  },
  'c-chaines/qcm': () => {
    const qc = (id: string) => question('c-chaines', id);
    expect(instructionsC('', '%d', "'A'")).toBe(bonChoixCode(qc('code-ascii')));
    expect(instructionsC('char s[] = "chat";', '%zu', 'sizeof(s)')).toBe(bonChoixCode(qc('taille-chaine')));
    expect(`'${instructionsC(codeDe(qc('majuscule')), '%c', 'c')}'`).toBe(bonChoixCode(qc('majuscule')));
    expect(instructionsC(codeDe(qc('inverser')), '%s', '""')).toBe(bonChoixCode(qc('inverser')));
    expect(definitionsC(codeCours('c-chaines', 'int longueur('), '%d', 'longueur("abc")')).toBe('3');
  },
  /* ---------------- Pointeurs ---------------- */
  'c-pointeurs/somme-pointeurs': () => {
    const q = question('c-pointeurs', 'somme-pointeurs');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', '*p + *q')));
  },
  'c-pointeurs/arithmetique': () => {
    const q = question('c-pointeurs', 'arithmetique');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', '*(p + 2)')));
  },
  'c-pointeurs/struct-acces': () => {
    const q = question('c-pointeurs', 'struct-acces');
    expect(attendu(q).re).toBe(Number(instructionsC(codeDe(q), '%d', 'p.x')));
  },
  'c-pointeurs/decalage-octets': () => {
    const f = fonction(question('c-pointeurs', 'decalage-octets'));
    for (const k of [0, 1, 3, 10]) expect(f(k)).toBe(Number(instructionsC('int t[32];\nint *p = t;', '%td', `(char *)(p + ${k}) - (char *)p`)));
  },
  'c-pointeurs/qcm': () => {
    const qc = (id: string) => question('c-pointeurs', id);
    expect(instructionsC(codeDe(qc('dereferencement')), '%d', 'x')).toBe(bonChoixCode(qc('dereferencement')));
    expect(instructionsC('', '%zu', 'sizeof(int *)')).toBe(bonChoixCode(qc('sizeof-pointeur')));
    const echange = codeCours('c-pointeurs', 'void echange(');
    expect(executerC(`${echange}\nint main(void) {\nint x = 1, y = 2;\nechange(&x, &y);\nprintf("%d %d\\n", x, y);\nreturn 0;\n}`)).toBe('2 1');
  },
  /* ---------------- Algorithmes ---------------- */
  'c-algorithmes/factorielle-rec': () =>
    expect(attendu(question('c-algorithmes', 'factorielle-rec')).re).toBe(Number(definitionsC(codeCours('c-algorithmes', 'int fact('), '%d', 'fact(5)'))),
  'c-algorithmes/appels-fibonacci': () => {
    const q = question('c-algorithmes', 'appels-fibonacci');
    const instrumente = codeDe(q).replace('int fib(int n) {\n', 'int fib(int n) {\n    appels++;\n');
    expect(attendu(q).re).toBe(Number(executerC(`int appels = 0;\n${instrumente}\nint main(void) {\nfib(5);\nprintf("%d\\n", appels);\nreturn 0;\n}`)));
  },
  'c-algorithmes/comparaisons-selection': () => {
    const q = question('c-algorithmes', 'comparaisons-selection');
    const f = fonction(q);
    const instrumente = codeDe(q).replace('if (t[j] < t[m])', 'if (comparaisons++, t[j] < t[m])');
    for (const n of [1, 2, 5, 9]) {
      const sortie = executerC(
        `int comparaisons = 0;\n${instrumente}\nint main(void) {\nint t[${n}];\nfor (int i = 0; i < ${n}; i++) t[i] = ${n} - i;\ntri_selection(t, ${n});\nprintf("%d\\n", comparaisons);\nreturn 0;\n}`,
      );
      expect(f(n)).toBeCloseTo(Number(sortie), 10);
    }
  },
  'c-algorithmes/dicho-tours': () => {
    // La dichotomie du cours, instrumentée, sur toutes les valeurs présentes et absentes d'un tableau de 1000 éléments.
    const dicho = codeCours('c-algorithmes', 'int dicho(').replace('while (g <= d) {', 'while (g <= d) {\n        tours++;');
    const sortie = executerC(
      `int tours;\n${dicho}\nint main(void) {\nint t[1000], pire = 0;\nfor (int i = 0; i < 1000; i++) t[i] = 2 * i;\nfor (int x = -1; x <= 2000; x++) {\ntours = 0;\ndicho(t, 1000, x);\nif (tours > pire) pire = tours;\n}\nprintf("%d\\n", pire);\nreturn 0;\n}`,
    );
    expect(attendu(question('c-algorithmes', 'dicho-tours')).re).toBe(Number(sortie));
  },
  'c-algorithmes/qcm': () => {
    const q = question('c-algorithmes', 'recursion-trace');
    expect(definitionsC(codeDe(q), '%d', 'g(7)')).toBe(bonChoixCode(q));
  },
  /* ---------------- Listes chaînées ---------------- */
  'c-listes-chainees/liste-construite': () => {
    const q = question('c-listes-chainees', 'liste-construite');
    expect(attendu(q).re).toBe(Number(executerC(codeDe(q))));
  },
  'c-listes-chainees/insertion-queue': () => {
    const q = question('c-listes-chainees', 'insertion-queue');
    const f = fonction(q);
    const type = codeCours('c-listes-chainees', 'typedef struct Maillon');
    const instrumente = codeDe(q).replace('p = p->suiv;', '{ p = p->suiv; pas++; }');
    for (const n of [1, 2, 3, 7, 12]) {
      const sortie = executerC(
        `${type}\nint pas = 0;\n${instrumente}\nint main(void) {\nMaillon *l = NULL;\nfor (int i = 0; i < ${n}; i++) l = ajouter_queue(l, i);\nprintf("%d\\n", pas);\nreturn 0;\n}`,
      );
      expect(f(n)).toBeCloseTo(Number(sortie), 10);
    }
  },
  'c-listes-chainees/pile-sequence': () => {
    const pile: number[] = [];
    const depilees: number[] = [];
    for (const op of ['+1', '+2', '+3', '-', '+4', '-', '-']) op === '-' ? depilees.push(pile.pop()!) : pile.push(Number(op));
    expect(attendu(question('c-listes-chainees', 'pile-sequence')).re).toBe(depilees.at(-1));
  },
  'c-listes-chainees/file-sequence': () => {
    const file: number[] = [];
    for (const op of ['+1', '+2', '+3', '-', '+4', '-']) op === '-' ? file.shift() : file.push(Number(op));
    expect(attendu(question('c-listes-chainees', 'file-sequence')).re).toBe(file[0]);
  },
  'c-listes-chainees/cours': () => {
    // Le code du cours compile et fonctionne : insertion en tête puis libération.
    const type = codeCours('c-listes-chainees', 'typedef struct Maillon');
    const ajout = codeCours('c-listes-chainees', 'Maillon *ajouter_tete(');
    const liberer = codeCours('c-listes-chainees', 'void liberer(');
    const sortie = executerC(
      `${type}\n${ajout}\n${liberer}\nint main(void) {\nMaillon *l = NULL;\nfor (int i = 1; i <= 3; i++) l = ajouter_tete(l, i);\nint s = 0;\nfor (Maillon *p = l; p != NULL; p = p->suiv) s = 10 * s + p->val;\nliberer(l);\nprintf("%d\\n", s);\nreturn 0;\n}`,
    );
    expect(sortie).toBe('321');
  },
};
