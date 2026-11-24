# Σ Math Quest

**👉 [lucky31001.github.io/math-quest](https://lucky31001.github.io/math-quest/)**

Application de révision **gamifiée** pour la pré-ing 1 de CY Tech : **algèbre**, **analyse**, **physique** et **informatique** (C). Tout tourne dans le navigateur, sans serveur, sur ordinateur comme sur téléphone, et hors ligne une fois installée.

- **33 chapitres** rangés par semestre (8 en algèbre, 9 en analyse, 9 en physique, 7 en informatique), chacun avec une fiche de cours, des flashcards et des exercices.
- **6 types de questions** : QCM (réponse unique ou multiple), numérique, expression (`2x+2` = `2(x+1)`), vrai/faux justifié, « trouve l'erreur », programme C.
- **32 générateurs** d'exercices aléatoires : des exercices sans fin, en QCM ou à saisir.
- **Atelier C** : compiler et exécuter du C dans le navigateur ([xcc](https://github.com/tyfkda/xcc) en WebAssembly).
- **Jeu** : XP, niveaux, streak 🔥, badges, modes Boss, Survie et QCM éclair.
- **Examen blanc** noté sur 20, courbe des notes, et **défi** : un lien pour donner le même sujet à un camarade.
- **Révision** : répétition espacée (Leitner), révision du jour, points faibles, pièges récurrents.
- **Sauvegarde** dans le navigateur, avec transfert entre appareils (lien ou QR code) et export/import JSON.

## Lancer le projet

Node 24 (`nvm use`, voir `.nvmrc`). Les tests ont aussi besoin de `gcc`.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Commande | Rôle |
|---|---|
| `npm test` | tests unitaires (Vitest) |
| `npm run typecheck` | vérification TypeScript |
| `npm run build` / `npm run preview` | build de production (`dist/`) et aperçu |
| `npm run e2e` | tests de bout en bout (Playwright ; la première fois : `npx playwright install chromium`) |
| `npm run schema` | régénère `content/schema.json` |

**Clavier** : `1`…`9` choisir une réponse, `V`/`F` vrai/faux, `Entrée` valider puis suivante, `H` indice (−5 XP), `Espace` puis `1`/`2` pour les flashcards.

## Ajouter du contenu

Un chapitre = un fichier `content/<matière>/<id>.json`, **validé au build** : en dev, une erreur s'affiche avec le fichier et le champ fautif ; `npm run build` et `npm test` échouent. Avec `"$schema": "../schema.json"`, VS Code complète et signale les erreurs pendant la saisie.

**Règles** :
- textes en LaTeX (`$…$`, `$$…$$`), `**gras**`, code `` `x / 2` `` ou en bloc ` ```c ` ;
- en JSON, les antislashs sont doublés : `"$\\frac{1}{2}$"` ;
- `id` en minuscules avec tirets, uniques dans le chapitre ;
- les distracteurs de QCM correspondent à des **erreurs classiques**, expliquées dans `explication`.

### Chapitre

```json
{
  "$schema": "../schema.json",
  "id": "complexes", "monde": "algebre", "ordre": 3, "semestre": 1,
  "titre": "Nombres complexes", "icone": "🌀", "resume": "Forme algébrique, module…",
  "cours": [{ "titre": "Forme algébrique", "blocs": [
    { "type": "definition", "titre": "Module", "texte": "$|z| = \\sqrt{a^2 + b^2}$" }
  ] }],
  "flashcards": [{ "id": "f-module", "recto": "Module de $a + ib$ ?", "verso": "$\\sqrt{a^2 + b^2}$" }],
  "exercices": []
}
```

`monde` est l'id de la matière (= le dossier) et `ordre` la place sur le chemin. Blocs de cours : `definition`, `theoreme`, `propriete`, `methode`, `remarque`, `exemple`.

### Questions

Champs communs : `id`, `type`, `difficulte` (1 à 3), `enonce`, `correction` (liste d'étapes), `indice` (facultatif).

**QCM** : 4 choix, mélangés à l'affichage. Avec `"multiple": true`, plusieurs bonnes réponses, notées en partie juste.

```json
{ "id": "module-3-4i", "type": "qcm", "difficulte": 1,
  "enonce": "Que vaut $|3 - 4i|$ ?", "correction": ["$\\sqrt{9 + 16} = 5$."],
  "choix": [
    { "texte": "$5$", "correct": true, "explication": "$\\sqrt{9 + 16} = 5$." },
    { "texte": "$7$", "correct": false, "explication": "Le module n'est pas $|a| + |b|$." },
    { "texte": "$25$", "correct": false, "explication": "C'est $|z|^2$ : il manque la racine." },
    { "texte": "$\\sqrt{7}$", "correct": false, "explication": "On a calculé $\\sqrt{|a^2 - b^2|}$." }
  ] }
```

**Numérique** : `reponse` est un nombre ou une expression math.js constante (`"5*sqrt(2)"`, `"1+2i"`) ; une liste pour plusieurs valeurs (saisies séparées par « ; », dans n'importe quel ordre). Toute forme exacte équivalente est acceptée, ou un décimal à 3 décimales. Option : `tolerance` (relative, 10⁻⁶ par défaut).

```json
{ "id": "second-degre", "type": "numerique", "difficulte": 2,
  "enonce": "Résoudre $z^2 + 2z + 5 = 0$ (solutions séparées par « ; »).",
  "correction": ["$\\Delta = -16 = (4i)^2$, donc $z = -1 \\pm 2i$."],
  "reponse": ["-1+2i", "-1-2i"] }
```

**Expression** : `reponse` en syntaxe math.js, comparée par évaluation en une douzaine de points. Options : `variables` (`["x"]`), `domaine` (`[-3, 3]`), `aConstantePres` (primitives).

```json
{ "id": "primitive-x-ln", "type": "expression", "difficulte": 2,
  "enonce": "Une primitive de $x \\ln x$ sur $]0, +\\infty[$ ?",
  "correction": ["IPP avec $u = \\ln x$, $v' = x$."],
  "reponse": "x^2/2*log(x) - x^2/4", "domaine": [0.2, 3], "aConstantePres": true }
```

**Vrai/faux** : `reponse` booléenne et des `justifications`, dont exactement une est correcte.

```json
{ "id": "vf-module-additif", "type": "vrai-faux", "difficulte": 1,
  "enonce": "Pour tous $z, z'$ : $|z + z'| = |z| + |z'|$.", "correction": ["Faux : $z = 1$, $z' = -1$."],
  "reponse": false,
  "justifications": [
    { "texte": "Contre-exemple : $z = 1$, $z' = -1$.", "correct": true, "explication": "$0 \\neq 2$." },
    { "texte": "C'est l'inégalité triangulaire.", "correct": false, "explication": "Elle donne $\\leq$." }
  ] }
```

**Trouve l'erreur** : `etapeFausse` est l'indice de la ligne fausse, **à partir de 0**.

```json
{ "id": "erreur-changement-indice", "type": "trouve-erreur", "difficulte": 2,
  "enonce": "Calcul de $\\sum_{k=1}^{n}(k+1)^2$. Où est l'erreur ?",
  "correction": ["Avec $j = k + 1$, $j$ va de 2 à $n + 1$."],
  "etapes": ["On pose $j = k + 1$.", "$j$ va de $1$ à $n$.", "Donc $S = \\sum_{j=1}^{n} j^2$."],
  "etapeFausse": 1, "explication": "Les bornes doivent aussi être décalées." }
```

**Programme C** : l'élève complète `code` ; « Vérifier » compile `code` + `harnais` dans le navigateur et compare la sortie à chaque test. Pas proposé en Boss, Survie ni Examen blanc.

```json
{ "id": "prog-maximum", "type": "programme", "difficulte": 1,
  "enonce": "Écris `int maximum(int t[], int n)`.", "correction": ["On part de `t[0]`, pas de 0."],
  "code": "int maximum(int t[], int n) {\n    return 0;\n}",
  "harnais": "#include <stdio.h>\nint main(void) {\n    int t[100], n;\n    scanf(\"%d\", &n);\n    for (int i = 0; i < n; i++)\n        scanf(\"%d\", &t[i]);\n    printf(\"%d\\n\", maximum(t, n));\n    return 0;\n}",
  "solution": "int maximum(int t[], int n) {\n    int m = t[0];\n    for (int i = 1; i < n; i++)\n        if (t[i] > m)\n            m = t[i];\n    return m;\n}",
  "tests": [{ "entree": "5\n3 9 2 9 1", "sortie": "9" }, { "entree": "2\n-7 -3", "sortie": "-3" }] }
```

### Matières et niveaux

Tout est décrit dans `content/catalogue.json` (niveaux → matières : `id`, `nom`, `sousTitre`, `embleme`, `couleur`, `couleurFonce`), sans code à modifier. Pour une nouvelle matière : l'ajouter au catalogue (id unique dans tout le catalogue), créer `content/<id>/` et y mettre les chapitres. Une matière sans chapitre s'affiche « Bientôt ».

### Après un ajout

Lancer `npm test`. Toute question `numerique` ou `expression` doit avoir sa **vérification indépendante** dans `tests/verifications/<maths|physique|informatique>.ts` : le test de couverture échoue sinon.

## Tests

Une vérification qui porte sur beaucoup d'éléments (chapitres, questions, générateurs) est **un seul test** (`toutVerifier`), qui liste les éléments fautifs.

- **Contenu** : schéma, volume, LaTeX, QCM ; chaque réponse est recalculée indépendamment (`tests/verifications/`).
- **Générateurs** : on relit l'énoncé *affiché*, on recalcule la réponse, et chaque distracteur doit être faux (`tests/verifications/generateurs.ts` pour les maths).
- **C** : le compilateur du navigateur donne les mêmes sorties que gcc ; les solutions des exercices « programme » passent sous gcc avec sanitizers.
- **Jeu, sauvegarde, interface** : logique pure et DOM simulé.
- **Bout en bout** (`npm run e2e`) : le vrai build dans Chromium, en mobile et en bureau.

## Déploiement

Chaque push sur `main` lance les tests, construit le site et le publie sur GitHub Pages (`.github/workflows/deploy.yml`). Le site est servi sous `/math-quest/` (`base` dans `vite.config.ts`). Sur un nouveau dépôt : **Settings → Pages → Source : GitHub Actions**.
