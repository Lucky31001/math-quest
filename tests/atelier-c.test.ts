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
import { CONTENU } from '../src/core/loader';

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
});
