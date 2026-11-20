/**
 * Atelier C : compilateur xcc (WebAssembly) exécuté par notre environnement WASI.
 *
 * - `completerExtrait` transforme un extrait de cours en programme complet ;
 * - le compilateur compile et exécute de vrais programmes (sortie, scanf, code de retour, erreurs) ;
 * - TOUT le code C du contenu (énoncés et cours) compile avec ce compilateur, pour que le bouton
 *   « Essayer dans l'atelier » fonctionne partout, et les programmes complets affichent la même
 *   chose qu'avec gcc.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chargerCompilateur, compiler, compilerEtExecuter, completerExtrait, type Compilateur } from '../src/c/compilateur';
import { CONTENU } from './outils/contenu';

/** Blocs ```c``` d'une liste de textes. */
const extraire = (t: string) => [...t.matchAll(/```c\n([\s\S]+?)\n```/g)].map((m) => m[1]);
/** Blocs C des cours (avec les blocs précédents du même cours, comme le bouton « Essayer »). */
const blocsCours = CONTENU.chapitres.flatMap((ch) => {
  const codes = ch.cours.flatMap((s) => s.blocs.flatMap((b) => extraire(b.texte).map((code) => ({ ou: `${ch.id}/cours/${s.titre}`, code }))));
  return codes.map((b, i) => ({ ...b, precedents: codes.slice(0, i).map((x) => x.code) }));
});
/** Programmes complets donnés dans les énoncés. */
const programmesEnonces = CONTENU.chapitres.flatMap((ch) =>
  ch.exercices.flatMap((q) => extraire(q.enonce).filter((code) => /\bmain\s*\(/.test(code)).map((code) => ({ ou: `${ch.id}/${q.id}`, code }))),
);

describe('extraits complétés en programmes', () => {
  it('ajoute les #include et un main autour de simples instructions', () => {
    const p = completerExtrait('int x = 5;\nprintf("%d\\n", x);');
    expect(p).toContain('#include <stdio.h>');
    expect(p).toMatch(/int main\(void\) \{\n {4}int x = 5;\n {4}printf/);
    expect(p).toContain('return 0;');
  });
  it('ajoute un main vide après des définitions de fonctions ou de types', () => {
    expect(completerExtrait('int carre(int x) {\n    return x * x;\n}')).toMatch(/\}\n\nint main\(void\) \{\n {4}\/\* Appelle/);
    expect(completerExtrait('typedef struct {\n    int x;\n} Point;')).toContain('int main(void)');
  });
  it('laisse tel quel un programme complet (sauf includes manquants)', () => {
    const complet = '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\nint main(void) {\n    return 0;\n}';
    expect(completerExtrait(complet)).toBe(`${complet}\n`);
  });
  it('sépare définitions et instructions, et reprend les types des blocs précédents', () => {
    const p = completerExtrait('typedef struct {\n    int x;\n} P;\n\nP a = {1};\na.x = 2;');
    expect(p).toMatch(/\} P;\n\nint main\(void\) \{\n {4}P a = \{1\};\n {4}a\.x = 2;/);
    const q = completerExtrait('void f(T *t) {\n}', ['typedef struct {\n    int v;\n} T;']);
    expect(q.indexOf('} T;')).toBeLessThan(q.indexOf('void f(T *t)'));
  });
  it('ne prend pas `else if (…)`, `while (…)` ou `for (…)` pour une définition de fonction', () => {
    const p = completerExtrait('int x = 3;\nif (x > 5)\n    x = 1;\nelse if (x > 2)\n    x = 2;\nwhile (x < 9)\n    x *= 2;\nfor (int i = 0; i < 2; i++)\n    x++;');
    expect(p).toMatch(/int main\(void\) \{\n {4}int x = 3;[\s\S]*else if \(x > 2\)[\s\S]*while \(x < 9\)[\s\S]*for \(int i/);
  });
  it('trouve du code C dans les cours et les énoncés', () => {
    expect(blocsCours.length).toBeGreaterThanOrEqual(14);
    expect(programmesEnonces.length).toBeGreaterThan(2);
  });
});

describe('compilateur C en WebAssembly', () => {
  let c: Compilateur;
  beforeAll(() => {
    c = chargerCompilateur(new Uint8Array(readFileSync('public/compilateur-c/wccfiles.zip')));
  });
  const lancer = (source: string, entree = '') => {
    let sortie = '';
    const r = compilerEtExecuter(c, source, { entree, sortie: (t) => (sortie += t) });
    return { ...r, sortie };
  };

  it('compile et exécute un programme, avec printf de réels et de chaînes', () => {
    const r = lancer('#include <stdio.h>\nint main(void) {\n    printf("%d %.2f %s %c\\n", 6 * 7, 3.14159, "ok", 65);\n    return 0;\n}');
    expect(r).toMatchObject({ etape: 'execution', code: 0, sortie: '42 3.14 ok A\n' });
  });
  it("lit l'entrée standard avec scanf", () => {
    const r = lancer('#include <stdio.h>\nint main(void) {\n    int a, b;\n    scanf("%d %d", &a, &b);\n    printf("%d\\n", a * b);\n    return 0;\n}', '6 7');
    expect(r.sortie).toBe('42\n');
  });
  it('renvoie le code de retour de main et de exit', () => {
    expect(lancer('int main(void) {\n    return 3;\n}').code).toBe(3);
    expect(lancer('#include <stdlib.h>\nint main(void) {\n    exit(5);\n}').code).toBe(5);
  });
  it('signale une erreur de compilation avec un message', () => {
    const r = lancer('int main(void) {\n    return x;\n}');
    expect(r.etape).toBe('compilation');
    if (r.etape === 'compilation') expect(r.messages).toMatch(/x/);
  });
  it('coupe une sortie infinie', () => {
    const r = lancer('#include <stdio.h>\nint main(void) {\n    for (;;) printf("boucle\\n");\n}');
    expect(r).toMatchObject({ etape: 'execution', trop: true });
  });
  it('gère malloc, free, struct et pointeurs', () => {
    const r = lancer(
      '#include <stdio.h>\n#include <stdlib.h>\ntypedef struct { int x, y; } P;\nint main(void) {\n    P *p = malloc(10 * sizeof(P));\n    for (int i = 0; i < 10; i++) { p[i].x = i; (p + i)->y = i * i; }\n    int s = 0;\n    for (int i = 0; i < 10; i++) s += p[i].x + p[i].y;\n    free(p);\n    printf("%d\\n", s);\n    return 0;\n}',
    );
    expect(r.sortie).toBe('330\n');
  });

  it('compile chaque bloc de code des cours, tel que l’ouvre « Essayer dans l’atelier »', () => {
    const echecs = blocsCours.flatMap(({ ou, code, precedents }) => {
      const r = compiler(c, completerExtrait(code, precedents));
      return 'module' in r ? [] : [`${ou} :\n${r.messages}\n${code}`];
    });
    expect(echecs, echecs.join('\n\n')).toEqual([]);
  });

  it('les programmes complets des énoncés affichent la même chose qu’avec gcc', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'atelier-c-'));
    programmesEnonces.forEach(({ ou, code }, i) => {
      const source = completerExtrait(code);
      writeFileSync(join(dossier, `p${i}.c`), source);
      execFileSync('gcc', ['-std=c11', '-w', '-o', join(dossier, `p${i}`), join(dossier, `p${i}.c`)]);
      const attendu = execFileSync(join(dossier, `p${i}`), { encoding: 'utf8' });
      expect(lancer(source).sortie, ou).toBe(attendu);
    });
  });

  /*
   * scanf de remplacement (src/c/scanf.ts) : chaque programme est exécuté avec
   * gcc (la vraie glibc) puis avec xcc ; les sorties doivent être identiques.
   */
  const CAS_SCANF: [string, string, string][] = [
    ['%d jusqu’à EOF (!= EOF)', 'int x;\nwhile (scanf("%d", &x) != EOF) printf("[%d]", x);', '3 -4\n 5\n'],
    ['%d jusqu’à EOF (== 1)', 'int x, r;\nwhile ((r = scanf("%d", &x)) == 1) printf("[%d]", x);\nprintf(" r=%d", r);', '7 8'],
    ['%s : mots séparés', 'char m[50];\nwhile (scanf("%s", m) == 1) printf("[%s]", m);', '  un deux\ttrois\n'],
    ['%99s', 'char m[100];\nint r = scanf("%99s", m);\nprintf("%d [%s]", r, m);', 'kayak'],
    ['%5s : largeur', 'char a[10], b[30];\nint r = scanf("%5s%s", a, b);\nprintf("%d [%s][%s]", r, a, b);', 'anticonstitution'],
    ['%c sans sauter les espaces', 'char a, b, c;\nint r = scanf("%c%c%c", &a, &b, &c);\nprintf("%d [%c%c%c]", r, a, b, c);', 'a b'],
    ['" %c" saute les espaces', 'char a, b;\nint r = scanf(" %c %c", &a, &b);\nprintf("%d [%c%c]", r, a, b);', '\n  x   y'],
    ['%[^\\n] puis fgets', 'char l[50], s[50];\nscanf("%49[^\\n]", l);\ngetchar();\nfgets(s, 50, stdin);\nprintf("[%s][%s]", l, s);', 'deux mots\nsuite'],
    ['%[a-z]', 'char m[50];\nint r = scanf("%[a-z]", m);\nprintf("%d [%s]", r, m);', 'abcDEF'],
    ['réels %f %lf %e', 'float a; double b, c;\nint r = scanf("%f %lf %le", &a, &b, &c);\nprintf("%d %.3f %.3f %.4f", r, a, b, c);', '3.5 -2e3 .25'],
    ['littéraux "%d,%d"', 'int a = 0, b = 0;\nint r = scanf("%d,%d", &a, &b);\nprintf("%d %d %d", r, a, b);', '4,5'],
    ['littéral absent', 'int a = 0, b = 0;\nint r = scanf("%d,%d", &a, &b);\nprintf("%d %d %d", r, a, b);', '4;5'],
    ['%d sur du texte', 'int x = 9;\nchar m[20];\nint r = scanf("%d", &x);\nscanf("%s", m);\nprintf("%d %d [%s]", r, x, m);', 'abc'],
    ['%x avec préfixe', 'unsigned a;\nint r = scanf("%x", &a);\nprintf("%d %u", r, a);', '0XfF'],
    ['%x %o %i', 'int a, b, c, d, e;\nint r = scanf("%x %o %i %i %i", &a, &b, &c, &d, &e);\nprintf("%d %d %d %d %d %d", r, a, b, c, d, e);', 'ff 17 0x1A 010 -12'],
    ['%*d (ignoré)', 'int x = 0;\nint r = scanf("%*d %d", &x);\nprintf("%d %d", r, x);', '1 2'],
    ['largeur %3d%2d', 'int a, b;\nint r = scanf("%3d%2d", &a, &b);\nprintf("%d %d %d", r, a, b);', '12345'],
    ['%u %ld %lld %hd', 'unsigned u; long l; long long ll; short h;\nint r = scanf("%u %ld %lld %hd", &u, &l, &ll, &h);\nprintf("%d %u %ld %lld %d", r, u, l, ll, (int)h);', '4000000000 -900000000 123456789012 -7'],
    ['entrée vide', 'int x; char m[9], c;\nprintf("%d ", scanf("%d", &x));\nprintf("%d ", scanf("%s", m));\nprintf("%d", scanf("%c", &c));', ''],
    ['sscanf %s %d %n', 'char v[20]; int cp, n;\nint r = sscanf("Paris 75000", "%s %n%d", v, &n, &cp);\nprintf("%d [%s] %d %d", r, v, n, cp);', ''],
    ['TP : n notes puis moyenne', 'int n;\nscanf("%d", &n);\ndouble s = 0, x;\nfor (int i = 0; i < n; i++) {\n    scanf("%lf", &x);\n    s += x;\n}\nprintf("%.2f\\n", s / n);', '4\n12 15.5 9\n17'],
    ['TP : menu (%d puis %c)', 'int choix; char rep;\nscanf("%d", &choix);\nscanf(" %c", &rep);\nprintf("%d %c", choix, rep);', '2\no'],
  ];

  it('scanf : mêmes sorties que la glibc (gcc) sur tous les cas', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'scanf-'));
    const echecs = CAS_SCANF.flatMap(([nom, corps, entree], i) => {
      const source = `#include <stdio.h>\n#include <stdlib.h>\nint main(void) {\n${corps}\nreturn 0;\n}\n`;
      writeFileSync(join(dossier, `s${i}.c`), source);
      execFileSync('gcc', ['-std=c11', '-w', '-o', join(dossier, `s${i}`), join(dossier, `s${i}.c`)]);
      const attendu = execFileSync(join(dossier, `s${i}`), { input: entree, encoding: 'utf8' });
      const obtenu = lancer(source, entree).sortie;
      return obtenu === attendu ? [] : [`${nom} : glibc ${JSON.stringify(attendu)}, xcc ${JSON.stringify(obtenu)}`];
    });
    expect(echecs, echecs.join('\n')).toEqual([]);
  });

  it('scanf : les erreurs de compilation gardent les numéros de ligne de l’élève', () => {
    const r = compiler(c, '#include <stdio.h>\nint main(void) {\n    int x = ;\n    scanf("%d", &x);\n}');
    expect('messages' in r && r.messages).toMatch(/main\.c\(3\)/);
  });
});
