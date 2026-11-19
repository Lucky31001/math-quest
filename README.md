# Σ Math Quest

Application web **gamifiée** de révision de mathématiques pour la prépa intégrée (pré-ing 1), centrée sur l'**algèbre** et l'**analyse**. Tout fonctionne dans le navigateur, sans serveur, et sur téléphone.

- **14 chapitres** (7 en algèbre, 7 en analyse) : fiche de cours, 15 flashcards et 18 à 23 exercices écrits à la main par chapitre (≈ 300 au total).
- **5 types de questions** : QCM (réponse unique ou multiple), réponse numérique, réponse expression (`2x+2` = `2(x+1)`), vrai/faux justifié, « trouve l'erreur ».
- **32 générateurs** d'exercices aléatoires (tables de vérité, négations, dénombrement, dérivées, tangentes, DL, racines complexes, matrices, systèmes, primitives, EDO…) : exercices infinis, en QCM ou à saisir.
- **Gamification** : XP, niveaux et titres, streak 🔥, badges, carte de progression, modes **Boss**, **Survie** et **QCM éclair**.
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

Le contenu est dans `content/algebre/*.json` et `content/analyse/*.json` : **un fichier par chapitre**. Les fichiers sont validés au chargement :
- en développement, un fichier invalide est **ignoré** et l'erreur s'affiche en haut de l'accueil ;
- `npm test` échoue aussi, avec le détail de l'erreur.

Grâce à `"$schema": "../schema.json"`, VS Code propose l'autocomplétion et signale les erreurs pendant la saisie.

**Règles d'écriture :**
- tous les textes acceptent du **LaTeX** entre `$…$` (en ligne) ou `$$…$$` (bloc), ainsi que `**gras**` ;
- en JSON, chaque antislash est doublé : `"$\\frac{1}{2}$"` ;
- les `id` sont en minuscules avec tirets, et uniques dans le chapitre.

### Structure d'un chapitre

```json
{
  "$schema": "../schema.json",
  "id": "complexes",
  "monde": "algebre",
  "ordre": 3,
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
| `type` | oui | `qcm`, `numerique`, `expression`, `vrai-faux`, `trouve-erreur` |
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
- le volume minimal par chapitre : ≥ 10 exercices dont ≥ 4 QCM, ≥ 10 flashcards.

## Tests

- **Vérification des réponses** : `tests/checker.test.ts`.
- **Correction des QCM** (unique et multiple) et des autres types : `tests/grading.test.ts`.
- **Générateurs** : `tests/generators.test.ts`. Pour chaque générateur, on relit l'énoncé LaTeX *affiché*, on recalcule la réponse, et on vérifie que la bonne réponse est juste et que **chaque distracteur est faux**.
- **Exactitude du contenu** : `tests/contenu.test.ts` et `tests/contenu-maths.test.ts`. Chaque réponse numérique ou expression est recalculée par une méthode indépendante : force brute, Simpson, Runge-Kutta, différences finies.
- **Logique de jeu** : `tests/jeu.test.ts`.
- **Interface** : `tests/ui.test.ts`, test de fumée en DOM simulé.

## Déploiement (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` s'exécute à chaque push sur `main` : il lance les tests, construit le site et le publie sur GitHub Pages. Le site est servi sous `https://<utilisateur>.github.io/math-quest/`.

Si tu renommes le dépôt, adapte `base` dans `vite.config.ts`.

Pour l'activer sur un nouveau dépôt : **Settings → Pages → Source : GitHub Actions**.

## Sauvegarde

La progression est stockée dans le `localStorage` du navigateur. Pour passer de l'ordinateur au téléphone :
1. sur l'appareil de départ, **Réglages → Exporter** ;
2. sur le nouvel appareil, **Réglages → Importer** le fichier obtenu.
