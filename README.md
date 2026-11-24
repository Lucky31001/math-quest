# Σ Math Quest

**👉 Essayer en ligne : [lucky31001.github.io/math-quest](https://lucky31001.github.io/math-quest/)**

Application web **gamifiée** de révision pour la prépa intégrée (pré-ing 1) : **algèbre**, **analyse**, **physique** et **informatique** (langage C), selon le programme de pré-ing 1 de CY Tech. Tout fonctionne dans le navigateur, sans serveur, et sur téléphone.

- **33 chapitres** suivant le programme de pré-ing 1 de CY Tech, rangés par semestre : 8 en algèbre (logique, ensembles et relations, applications, complexes, polynômes, fractions rationnelles… d'après le poly et les TD d'Algèbre 1) et 9 en analyse (rappels, ensemble ℝ, suites, limites et continuité, dérivabilité… d'après Analyse 1), avec 12 à 21 flashcards et 17 à 40 exercices chacun ; 9 en physique (mécanique, électricité, optique, thermodynamique, analyse dimensionnelle, pensée scientifique) et 7 en informatique (bases du C, boucles, fonctions et tableaux, chaînes, pointeurs, algorithmes, listes chaînées), avec 12 à 14 flashcards et 13 à 16 exercices chacun ; tous ont une fiche de cours.
- **5 types de questions** : QCM (réponse unique ou multiple), réponse numérique, réponse expression (`2x+2` = `2(x+1)`), vrai/faux justifié, « trouve l'erreur ».
- **32 générateurs** d'exercices aléatoires (tables de vérité, négations, dénombrement, dérivées, tangentes, DL, racines complexes, matrices, systèmes, primitives, EDO…) : exercices infinis, en QCM ou à saisir.
- **Atelier C** : écrire, compiler et exécuter du C directement dans le navigateur (compilateur [xcc](https://github.com/tyfkda/xcc) en WebAssembly, rien n'est envoyé à un serveur), avec un bouton « Essayer » sous chaque exemple de code du cours.
- **Gamification** : XP, niveaux et titres, streak 🔥, badges, carte de progression, modes **Boss**, **Survie** et **QCM éclair**.
- **Examen blanc** (au bout du chemin de chaque matière) : 20 questions de tous les chapitres en 30 min, sans correction pendant l'épreuve, puis note sur 20 et copie corrigée. Les Statistiques montrent la courbe des notes par matière (dernière, meilleure, tendance). Après l'examen, « Défier un camarade » partage un lien vers **le même sujet**, avec la note à battre.
- **Pièges récurrents** : le distracteur choisi dit quelle erreur a été faite ; les erreurs qui reviennent s'affichent dans les Statistiques avec leur explication et un lien d'entraînement.
- **QCM à réponses multiples notés en partie juste** : chaque bonne case cochée rapporte, chaque mauvaise enlève autant (jamais moins de 0) ; une part des XP est gagnée, mais la question ne monte de boîte Leitner que si tout est juste.
- **Révision efficace** : répétition espacée (Leitner, 5 boîtes), « Révision du jour », tableau de bord avec points faibles.
- Progression sauvegardée dans le navigateur, **export / import JSON**.

## Installation et lancement

Prérequis : Node.js ≥ 18.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm test` | tests unitaires (Vitest) |
| `npm run typecheck` | vérification TypeScript |
| `npm run build` | build de production dans `dist/` |
| `npm run preview` | sert le build (`http://localhost:4173/math-quest/`) |
| `npm run schema` | régénère `content/schema.json` |

## Raccourcis clavier

| Touche | Action |
|---|---|
| `1` … `9` | choisir une réponse (QCM unique : choisit **et** valide) |
| `V` / `F` | vrai / faux |
| `Entrée` | valider, puis question suivante |
| `H` | indice (−5 XP) |
| `Espace`, puis `1` / `2` | flashcards : retourner, puis « À revoir » / « Je savais » |

## Ajouter des exercices et des QCM

Le contenu est dans `content/<matière>/*.json` : **un fichier par chapitre**. Les fichiers sont **validés à la compilation** (plugin `contenu` de `vite.config.ts`) :
- en développement (`npm run dev`), un fichier invalide s'affiche en surimpression, avec le fichier et le champ fautif (ex. `exercices.2.enonce`) ;
- `npm run build` et `npm test` échouent, avec le même détail : un contenu invalide ne peut pas être déployé.

L'application reçoit le contenu déjà validé (valeurs par défaut comprises) et ne charge au démarrage qu'un résumé de chaque chapitre ; le chapitre complet est chargé à son ouverture.

Grâce à `"$schema": "../schema.json"`, VS Code propose l'autocomplétion et signale les erreurs pendant la saisie.

**Règles d'écriture :**
- tous les textes acceptent du **LaTeX** entre `$…$` (en ligne) ou `$$…$$` (bloc), ainsi que `**gras**` ;
- du **code** : `` `x / 2` `` en ligne, ou un bloc ` ```c ` … ` ``` ` (indentation conservée, ni LaTeX ni gras à l'intérieur). Pour une question d'informatique, les vérifications (`tests/verifications/informatique.ts`) compilent avec `gcc` et exécutent le bloc de code de l'énoncé ;
- en JSON, chaque antislash est doublé : `"$\\frac{1}{2}$"` ;
- les `id` sont en minuscules avec tirets, et uniques dans le chapitre.

### Structure d'un chapitre

```json
{
  "$schema": "../schema.json",
  "id": "complexes",
  "monde": "algebre",
  "ordre": 3,
  "semestre": 1,
  "titre": "Nombres complexes",
  "icone": "🌀",
  "resume": "Forme algébrique, module, forme exponentielle…",
  "cours": [
    { "titre": "Forme algébrique", "blocs": [
      { "type": "definition", "titre": "Module", "texte": "$|z| = \\sqrt{a^2 + b^2}$" }
    ] }
  ],
  "flashcards": [
    { "id": "f-module", "recto": "Module de $a + ib$ ?", "verso": "$\\sqrt{a^2 + b^2}$" }
  ],
  "exercices": [ "… questions, voir ci-dessous …" ]
}
```

Les types de blocs de cours sont : `definition`, `theoreme`, `propriete`, `methode`, `remarque`, `exemple`.

### Champs communs à toutes les questions

| Champ | Obligatoire | Description |
|---|---|---|
| `id` | oui | identifiant unique dans le chapitre |
| `type` | oui | `qcm`, `numerique`, `expression`, `vrai-faux`, `trouve-erreur`, `programme` |
| `difficulte` | oui | `1`, `2` ou `3` |
| `enonce` | oui | l'énoncé |
| `indice` | non | indice (coûte 5 XP) |
| `correction` | oui | liste d'étapes de la correction détaillée |

### QCM à réponse unique

Mets **4 choix**. Ils sont mélangés à chaque affichage. Les mauvais choix doivent correspondre à des **erreurs classiques d'étudiant**, et chaque choix a son `explication`.

```json
{
  "id": "module-3-4i",
  "type": "qcm",
  "difficulte": 1,
  "enonce": "Que vaut $|3 - 4i|$ ?",
  "indice": "$|a + ib| = \\sqrt{a^2 + b^2}$.",
  "correction": ["$|3 - 4i| = \\sqrt{9 + 16} = 5$."],
  "choix": [
    { "texte": "$5$", "correct": true, "explication": "$\\sqrt{9 + 16} = 5$." },
    { "texte": "$7$", "correct": false, "explication": "Le module n'est pas $|a| + |b|$." },
    { "texte": "$25$", "correct": false, "explication": "C'est $|z|^2$ : il manque la racine." },
    { "texte": "$\\sqrt{7}$", "correct": false, "explication": "On a calculé $\\sqrt{|a^2 - b^2|}$." }
  ]
}
```

### QCM à réponses multiples

Ajoute `"multiple": true`. Pour avoir juste, il faut cocher **toutes** les bonnes réponses et **aucune** mauvaise.

```json
{
  "id": "racines-4-unite",
  "type": "qcm",
  "multiple": true,
  "difficulte": 2,
  "enonce": "Lesquels sont des racines quatrièmes de l'unité ?",
  "correction": ["Ce sont $1, i, -1, -i$."],
  "choix": [
    { "texte": "$i$", "correct": true, "explication": "$i^4 = 1$." },
    { "texte": "$-1$", "correct": true, "explication": "$(-1)^4 = 1$." },
    { "texte": "$e^{i\\pi/4}$", "correct": false, "explication": "Sa puissance 4 vaut $-1$." },
    { "texte": "$e^{2i\\pi/3}$", "correct": false, "explication": "C'est une racine cubique de l'unité." }
  ]
}
```

### Réponse numérique

`reponse` est un nombre, ou une expression constante en syntaxe math.js : `"5*sqrt(2)"`, `"2*pi/3"`, `"1+2i"`, `"e^2"`, `"3/4"`.

L'élève peut répondre sous une forme exacte équivalente (`5√2`, `sqrt(50)`…), ou en décimal avec au moins 3 décimales. Option : `tolerance` (relative, 10⁻⁶ par défaut).

Pour **plusieurs valeurs**, donne une liste : l'élève les sépare par « ; » et l'ordre n'a pas d'importance.

```json
{
  "id": "second-degre",
  "type": "numerique",
  "difficulte": 2,
  "enonce": "Résoudre $z^2 + 2z + 5 = 0$. Donne les deux solutions séparées par « ; ».",
  "correction": ["$\\Delta = -16 = (4i)^2$", "$z = -1 \\pm 2i$."],
  "reponse": ["-1+2i", "-1-2i"]
}
```

### Réponse expression

L'expression attendue est en syntaxe math.js. La réponse est vérifiée par **évaluation en une douzaine de points aléatoires**, donc toute forme équivalente est acceptée.

| Champ | Défaut | Rôle |
|---|---|---|
| `variables` | `["x"]` | variables de l'expression |
| `domaine` | `[-3, 3]` | intervalle d'échantillonnage (utile pour `ln`, `sqrt`) |
| `aConstantePres` | — | `true` pour accepter une primitive à une constante près |

```json
{
  "id": "primitive-x-ln",
  "type": "expression",
  "difficulte": 2,
  "enonce": "Donner une primitive de $x \\ln x$ sur $]0, +\\infty[$.",
  "correction": ["IPP avec $u = \\ln x$, $v' = x$.", "$\\frac{x^2}{2}\\ln x - \\frac{x^2}{4}$."],
  "reponse": "x^2/2*log(x) - x^2/4",
  "domaine": [0.2, 3],
  "aConstantePres": true
}
```

**Saisie acceptée** : multiplication implicite (`2x`, `x(x+1)`), `ln`, `exp`, `e^x`, `sqrt` / `√`, `pi` / `π`, `arctan`, `ch` / `sh`, virgule décimale, `X` pour `x`.

### Vrai / faux avec justification

L'élève choisit **Vrai ou Faux**, puis la bonne justification parmi celles proposées. **Exactement une** justification est correcte.

```json
{
  "id": "vf-module-additif",
  "type": "vrai-faux",
  "difficulte": 1,
  "enonce": "Pour tous $z, z'$ : $|z + z'| = |z| + |z'|$.",
  "correction": ["Faux : $z = 1$, $z' = -1$."],
  "reponse": false,
  "justifications": [
    { "texte": "Contre-exemple : $z = 1$, $z' = -1$.", "correct": true, "explication": "$0 \\neq 2$." },
    { "texte": "C'est l'inégalité triangulaire.", "correct": false, "explication": "Elle donne $\\leq$." }
  ]
}
```

### Trouve l'erreur

L'élève clique sur la ligne fausse de la démonstration. `etapeFausse` est l'index de cette ligne, **compté à partir de 0**.

```json
{
  "id": "erreur-changement-indice",
  "type": "trouve-erreur",
  "difficulte": 2,
  "enonce": "Calcul de $\\sum_{k=1}^{n}(k+1)^2$. Où est l'erreur ?",
  "correction": ["Avec $j = k + 1$, $j$ va de 2 à $n + 1$."],
  "etapes": [
    "On pose $j = k + 1$.",
    "Quand $k$ va de $1$ à $n$, $j$ va de $1$ à $n$.",
    "Donc $S = \\sum_{j=1}^{n} j^2$."
  ],
  "etapeFausse": 1,
  "explication": "Les bornes doivent aussi être décalées."
}
```

### Programme C (« écris le programme »)

L'élève complète `code` dans un éditeur. « Vérifier » compile `code` + `harnais` **dans le navigateur** et compare la sortie à chaque test (espaces de fin de ligne et lignes vides finales ignorés). Le premier test sert d'exemple visible ; une erreur de compilation n'est pas comptée. Ces exercices ne sont pas proposés en mode Boss, Survie ni Examen blanc (chronomètre).

```json
{
  "id": "prog-maximum",
  "type": "programme",
  "difficulte": 1,
  "enonce": "Écris la fonction `int maximum(int t[], int n)` qui renvoie le plus grand élément de `t`.",
  "correction": ["On initialise `max = t[0]` (pas 0 : les éléments peuvent être négatifs)."],
  "code": "int maximum(int t[], int n) {\n    /* À compléter */\n    return 0;\n}",
  "harnais": "#include <stdio.h>\n\nint main(void) {\n    int t[100], n;\n    scanf(\"%d\", &n);\n    for (int i = 0; i < n; i++)\n        scanf(\"%d\", &t[i]);\n    printf(\"%d\\n\", maximum(t, n));\n    return 0;\n}",
  "solution": "int maximum(int t[], int n) {\n    int max = t[0];\n    for (int i = 1; i < n; i++)\n        if (t[i] > max)\n            max = t[i];\n    return max;\n}",
  "tests": [
    { "entree": "5\n3 9 2 9 1", "sortie": "9" },
    { "entree": "4\n-7 -3 -9 -5", "sortie": "-3" }
  ]
}
```

`tests/programmes.test.ts` vérifie que la solution réussit tous les tests (gcc avec sanitizers **et** le compilateur du navigateur) et que le code de départ compile sans les réussir tous.

### Ajouter une matière ou un niveau

Les niveaux (années) et leurs matières sont décrits dans `content/catalogue.json`. L'accueil s'en sert pour afficher :
- un sélecteur de niveau, seulement s'il y en a plusieurs ;
- un carrousel à points des matières (une carte par matière, à faire glisser) ;
- le chemin de chapitres de la matière choisie.

Aucun code n'est à modifier.

```json
{
  "$schema": "./catalogue.schema.json",
  "niveaux": [
    {
      "id": "pre-ing-1",
      "nom": "Pré-ing 1",
      "description": "Prépa intégrée, 1re année",
      "matieres": [
        { "id": "algebre", "nom": "Algèbre", "sousTitre": "Structures, calculs et raisonnements",
          "embleme": "🏰", "couleur": "#ce82ff", "couleurFonce": "#a568cc" }
      ]
    },
    {
      "id": "pre-ing-2",
      "nom": "Pré-ing 2",
      "matieres": [
        { "id": "physique", "nom": "Physique", "sousTitre": "Mécanique et électricité",
          "embleme": "⚛️", "couleur": "#ff9600", "couleurFonce": "#e08500" }
      ]
    }
  ]
}
```

**Pour ajouter une matière :**
1. Ajoute-la dans un niveau du catalogue. Son `id` doit être **unique dans tout le catalogue** : pour une « Algèbre » de 2e année, prends par exemple `algebre-2`.
2. Crée le dossier `content/<id>/`.
3. Mets-y les chapitres, avec `"monde": "<id>"`.

Une matière sans chapitre s'affiche « Bientôt ».

Le badge « Conquérant » (tous les boss de la matière vaincus) est créé automatiquement pour chaque matière.

### Ajouter un chapitre

1. Crée `content/<matière>/<id>.json`. Le dossier doit correspondre au champ `monde` (l'identifiant de la matière dans le catalogue).
2. Choisis un `ordre` pour sa place sur le chemin de la matière.
3. Il apparaît automatiquement sur la carte et dans tous les modes.

Après avoir ajouté du contenu, lance `npm test`, qui vérifie :
- le schéma ;
- que tout le LaTeX compile avec KaTeX ;
- que les réponses attendues sont évaluables ;
- le volume minimal par chapitre : ≥ 10 questions courtes (hors `programme`) dont ≥ 4 QCM, ≥ 10 flashcards.

## Tests

Une vérification qui porte sur beaucoup d'éléments (chapitres, questions, générateurs) est **un seul test** : `toutVerifier` (`tests/outils/tout-verifier.ts`) exécute tout et, en cas d'échec, liste chaque élément fautif par son nom. Environ 180 tests au total.

- **Contenu** : `tests/contenu.test.ts` (schéma, volume, LaTeX, QCM) et `tests/contenu-verifie.test.ts`, qui recalcule chaque réponse par une méthode indépendante. Les vérifications sont rangées par matière dans `tests/verifications/` (`maths.ts`, `physique.ts`, `informatique.ts`) ; leurs outils (Simpson, Runge-Kutta, Gauss, gcc, tracé de rayons) sont dans `tests/outils/verification.ts`.
- **Générateurs** : `tests/generators.test.ts` et `tests/generators-extra.test.ts`. On relit l'énoncé LaTeX *affiché*, on recalcule la réponse, et on vérifie que la bonne réponse est juste et que **chaque distracteur est faux**.
- **Atelier C** : `tests/atelier-c.test.ts`. Le compilateur WebAssembly compile chaque bloc de code des cours et donne les mêmes sorties que gcc.
- **Exercices « programme »** : `tests/programmes.test.ts` (solution validée par gcc + sanitizers et par xcc, code de départ insuffisant).
- **Vérification des saisies** : `tests/checker.test.ts` ; **correction** : `tests/grading.test.ts` ; **logique de jeu** : `tests/jeu.test.ts` ; **sauvegarde** : `tests/sauvegarde.test.ts` ; **interface** : `tests/ui.test.ts` (DOM simulé).

- **Bout en bout** : `npm run e2e` (Playwright) construit le site et le teste dans Chromium, en mobile et en bureau : navigation et chargement à la demande, hors ligne, exercice programme, transfert entre deux appareils, examen blanc. Première fois : `npx playwright install chromium`.

Les tests ont besoin de `gcc` (présent sur les runners GitHub `ubuntu-latest`).

## Déploiement (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` s'exécute à chaque push sur `main` : il lance les tests, construit le site et le publie sur GitHub Pages. Le site est servi sous `https://<utilisateur>.github.io/math-quest/`.

Si tu renommes le dépôt, adapte `base` dans `vite.config.ts`.

Pour l'activer sur un nouveau dépôt : **Settings → Pages → Source : GitHub Actions**.

## Sauvegarde

La progression est stockée dans le `localStorage` du navigateur. Pour passer de l'ordinateur au téléphone, sans serveur :
- **lien de transfert** : **Réglages → Changer d'appareil → Créer un lien de transfert**, puis l'ouvrir sur l'autre appareil (partage natif, copie, ou QR code tant que la progression est assez petite, environ 100 questions suivies). La progression, compressée, est dans le fragment `#` du lien : elle n'est jamais envoyée au serveur. Dans l'app installée sur iPhone, coller le lien dans « Recevoir une progression » ;
- **fichier** : **Réglages → Exporter** sur l'appareil de départ, puis **Réglages → Importer** sur le nouveau.
