/**
 * Atelier C : écrire, compiler et exécuter du C dans le navigateur
 * (compilateur xcc en WebAssembly, dans un Web Worker : rien n'est envoyé à un serveur).
 */
import { h } from '../dom';
import { executerC, arreter, DUREE_MAX, type Issue } from '../../c/client';
import { completerExtrait } from '../../c/compilateur';

const CLE_BROUILLON = 'math-quest:atelier-c';

const EXEMPLES: { nom: string; code: string; entree?: string }[] = [
  {
    nom: 'Bonjour',
    code: `#include <stdio.h>

int main(void) {
    printf("Bonjour depuis l'atelier C !\\n");
    return 0;
}
`,
  },
  {
    nom: 'Lire des nombres (scanf)',
    entree: '7 5',
    code: `#include <stdio.h>

int main(void) {
    int a, b;
    printf("Deux entiers : ");
    if (scanf("%d %d", &a, &b) != 2) {
        printf("saisie invalide\\n");
        return 1;
    }
    printf("\\n%d / %d = %d, reste %d\\n", a, b, a / b, a % b);
    printf("%d / %d = %.3f en réels\\n", a, b, (double)a / b);
    return 0;
}
`,
  },
  {
    nom: 'Tableau et fonction',
    code: `#include <stdio.h>

int somme(int t[], int n) {
    int s = 0;
    for (int i = 0; i < n; i++)
        s += t[i];
    return s;
}

int main(void) {
    int t[] = {3, 1, 4, 1, 5, 9};
    int n = sizeof(t) / sizeof(t[0]);
    printf("somme = %d\\n", somme(t, n));
    return 0;
}
`,
  },
  {
    nom: 'Pointeurs : échange',
    code: `#include <stdio.h>

void echange(int *a, int *b) {
    int t = *a;
    *a = *b;
    *b = t;
}

int main(void) {
    int x = 1, y = 2;
    echange(&x, &y);
    printf("x = %d, y = %d\\n", x, y);
    return 0;
}
`,
  },
  {
    nom: 'Liste chaînée (malloc / free)',
    code: `#include <stdio.h>
#include <stdlib.h>

typedef struct Maillon {
    int val;
    struct Maillon *suiv;
} Maillon;

Maillon *ajouter_tete(Maillon *l, int x) {
    Maillon *m = malloc(sizeof(Maillon));
    m->val = x;
    m->suiv = l;
    return m;
}

int main(void) {
    Maillon *l = NULL;
    for (int i = 1; i <= 5; i++)
        l = ajouter_tete(l, i * i);
    for (Maillon *p = l; p != NULL; p = p->suiv)
        printf("%d -> ", p->val);
    printf("NULL\\n");
    while (l != NULL) {
        Maillon *s = l->suiv;
        free(l);
        l = s;
    }
    return 0;
}
`,
  },
  {
    nom: 'Récursivité : factorielle',
    code: `#include <stdio.h>

long long fact(int n) {
    if (n == 0)
        return 1;
    return n * fact(n - 1);
}

int main(void) {
    for (int n = 0; n <= 15; n++)
        printf("%2d! = %lld\\n", n, fact(n));
    return 0;
}
`,
  },
];

/** Code à ouvrir au prochain affichage de l'atelier (bouton « Essayer » d'un cours). */
let aOuvrir: string | null = null;

/** Ouvre un extrait de code dans l'atelier (complété en programme compilable). */
export function ouvrirDansAtelier(code: string, precedents: string[] = []): void {
  aOuvrir = completerExtrait(code, precedents);
  location.hash = '#/atelier';
}

function lireBrouillon(): { code: string; entree: string } | null {
  try {
    const b = JSON.parse(localStorage.getItem(CLE_BROUILLON) ?? 'null');
    return b && typeof b.code === 'string' ? { code: b.code, entree: typeof b.entree === 'string' ? b.entree : '' } : null;
  } catch {
    return null;
  }
}

function ecrireBrouillon(code: string, entree: string): void {
  try {
    localStorage.setItem(CLE_BROUILLON, JSON.stringify({ code, entree }));
  } catch {
    /* stockage indisponible : le brouillon n'est pas conservé */
  }
}

export function ecranAtelier(main: HTMLElement): () => void {
  const brouillon = lireBrouillon();
  const depart = aOuvrir ?? brouillon?.code ?? EXEMPLES[0].code;
  // Le code venu d'un cours devient le brouillon : on le retrouve en revenant sur l'atelier.
  if (aOuvrir !== null) ecrireBrouillon(aOuvrir, '');
  aOuvrir = null;

  const editeur = h('textarea', {
    class: 'editeur-c',
    spellcheck: 'false',
    autocapitalize: 'off',
    autocomplete: 'off',
    wrap: 'off',
    'aria-label': 'Code C',
  });
  editeur.value = depart;
  const entree = h('textarea', { class: 'entree-c', rows: 2, spellcheck: 'false', 'aria-label': 'Entrée standard', placeholder: 'Ex. : 7 5' });
  entree.value = brouillon?.entree ?? '';
  const details = h('details', { class: 'details-entree' }, h('summary', null, 'Entrée standard (pour scanf)'), entree);
  if (entree.value) details.open = true;

  const statut = h('p', { class: 'statut-c', role: 'status', 'aria-live': 'polite' }, 'Prêt. Ctrl + Entrée pour exécuter.');
  const consoleC = h('pre', { class: 'console-c', 'aria-label': 'Sortie du programme', tabindex: '0' });
  const boutonExecuter = h('button', { class: 'btn btn-primaire', type: 'button' }, '▶ Exécuter');
  const boutonArreter = h('button', { class: 'btn', type: 'button', disabled: true }, '■ Arrêter');

  const choixExemple = h(
    'select',
    { class: 'exemples-c', 'aria-label': 'Charger un exemple' },
    h('option', { value: '' }, 'Charger un exemple…'),
    EXEMPLES.map((e, i) => h('option', { value: String(i) }, e.nom)),
  );
  choixExemple.addEventListener('change', () => {
    const ex = EXEMPLES[Number(choixExemple.value)];
    choixExemple.value = '';
    if (!ex) return;
    if (editeur.value.trim() && editeur.value !== depart && !confirm('Remplacer ton code par cet exemple ?')) return;
    editeur.value = ex.code;
    entree.value = ex.entree ?? '';
    details.open = !!ex.entree;
    sauver();
    editeur.focus();
  });

  const sauver = () => ecrireBrouillon(editeur.value, entree.value);
  editeur.addEventListener('input', sauver);
  entree.addEventListener('input', sauver);

  const ecrireConsole = (texte: string, classe?: string) => {
    if (classe) consoleC.append(h('span', { class: classe }, texte));
    else consoleC.append(texte);
    consoleC.scrollTop = consoleC.scrollHeight;
  };

  const lancer = async () => {
    boutonExecuter.disabled = true;
    boutonArreter.disabled = false;
    consoleC.replaceChildren();
    const issue: Issue = await executerC(editeur.value, entree.value, {
      etape: (e) =>
        (statut.textContent = { chargement: '⏳ Chargement du compilateur…', compilation: '⚙️ Compilation…', execution: '▶️ Exécution…' }[e]),
      sortie: (texte, fd) => ecrireConsole(texte, fd === 2 ? 'console-erreur' : undefined),
    });
    boutonExecuter.disabled = false;
    boutonArreter.disabled = true;
    switch (issue.etape) {
      case 'compilation':
        statut.textContent = '❌ Erreur de compilation';
        ecrireConsole(issue.messages, 'console-erreur');
        break;
      case 'execution':
        if (issue.trop) {
          statut.textContent = '⚠️ Sortie trop longue : programme interrompu';
          ecrireConsole('\n[sortie tronquée]', 'console-info');
        } else statut.textContent = issue.code === 0 ? '✅ Terminé (code de retour 0)' : `⚠️ Terminé avec le code de retour ${issue.code}`;
        if (!consoleC.textContent) ecrireConsole('(aucune sortie)', 'console-info');
        break;
      case 'arret':
        statut.textContent =
          issue.raison === 'temps' ? `⏱️ Interrompu après ${DUREE_MAX / 1000} s (boucle infinie ?)` : '⏹️ Arrêté';
        break;
      case 'erreur':
        statut.textContent = '❌ Le programme a planté';
        ecrireConsole(
          /unreachable|out of bounds|memory access/i.test(issue.message)
            ? `Erreur à l'exécution : accès mémoire invalide (pointeur NULL, tableau dépassé…).\n(${issue.message})`
            : issue.message,
          'console-erreur',
        );
        break;
    }
  };
  boutonExecuter.addEventListener('click', () => void lancer());
  boutonArreter.addEventListener('click', () => arreter('utilisateur'));

  // Tabulation = 4 espaces ; Entrée conserve l'indentation ; Ctrl/Cmd + Entrée exécute.
  editeur.addEventListener('keydown', (e) => {
    const { selectionStart: debut, selectionEnd: fin, value } = editeur;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!boutonExecuter.disabled) void lancer();
    } else if (e.key === 'Tab' && !e.shiftKey && debut === fin) {
      e.preventDefault();
      editeur.setRangeText('    ', debut, fin, 'end');
      sauver();
    } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      const ligne = value.slice(value.lastIndexOf('\n', debut - 1) + 1, debut);
      const indentation = /^\s*/.exec(ligne)![0] + (/\{\s*$/.test(ligne) ? '    ' : '');
      if (!indentation) return;
      e.preventDefault();
      editeur.setRangeText(`\n${indentation}`, debut, fin, 'end');
      sauver();
    }
  });

  main.append(
    h('h1', null, '🧪 Atelier C'),
    h(
      'p',
      { class: 'intro-atelier' },
      "Écris un programme C, puis exécute-le. Il est compilé et lancé ",
      h('strong', null, 'dans ton navigateur'),
      ' (compilateur xcc en WebAssembly) : rien n’est envoyé à un serveur.',
    ),
    h('div', { class: 'barre-atelier' }, choixExemple),
    editeur,
    details,
    h('div', { class: 'actions' }, boutonExecuter, boutonArreter),
    statut,
    consoleC,
    h(
      'p',
      { class: 'note-atelier' },
      'Limites : pas de saisie interactive (l’entrée standard est lue dans le champ ci-dessus), exécution limitée à ',
      `${DUREE_MAX / 1000} s. Le compilateur gère le C usuel (pointeurs, struct, malloc, printf, scanf, math.h…) ; quelques fonctionnalités avancées peuvent manquer.`,
      ' Compilateur : ',
      h('a', { href: 'https://github.com/tyfkda/xcc', target: '_blank', rel: 'noopener' }, 'xcc'),
      ' (licence MIT).',
    ),
  );

  return () => arreter('utilisateur');
}
