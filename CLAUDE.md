# CLAUDE.md — Math Quest

Application de révision gamifiée (pré-ing 1 : algèbre, analyse, physique, informatique). Vite 6 + TypeScript strict, **sans framework ni backend**. Interface et contenu **en français** (identifiants de code compris : `chapitre`, `enonce`, `corriger`…). Garder cette convention.

## Commandes

```bash
npm run dev         # serveur de dev
npm test            # Vitest (doit rester vert : le déploiement en dépend)
npm run typecheck   # tsc --noEmit
npm run build       # tsc + vite build → dist/ (base /math-quest/)
npm run schema      # régénère content/schema.json depuis le schéma Zod
```

Node 18 en local : ne pas passer à Vite 7 ou Vitest 4 (ils exigent Node ≥ 20). La CI utilise Node 20.

## Architecture

```
content/catalogue.json             niveaux (années) → matières (id, nom, emblème, couleurs)
content/<matière>/*.json           1 fichier = 1 chapitre (« monde » = id de matière), validé au chargement
src/core/
  schema.ts      SOURCE DE VÉRITÉ du format (Zod → types TS + validation + schema.json)
  loader.ts      import.meta.glob des JSON, validation, CONTENU global, clé « chapitre/id »
  checker.ts     vérification math.js : normalisation de la saisie, équivalence
                 d'expressions par échantillonnage (dans ℂ), numériques, listes, constante
  grading.ts     corriger(question, reponse) pour les 5 types ; indices = ordre du JSON
  random.ts      RNG à graine (mulberry32), shuffle, pick
src/generators/  générateurs aléatoires ; outils.ts (rationnels Q, LaTeX, construireQcm)
  index.ts       registre GENERATEURS, generer(g, difficulte, forme?, graine)
src/game/        logique pure (testable sans DOM)
  leitner.ts     5 boîtes, intervalles 1/2/4/8/16 j, erreur → boîte 1, due aujourd'hui
  xp.ts          XP par difficulté, seuils 50·n·(n−1), titres, points éclair
  progres.ts     enregistrerReponse / payerIndice / enregistrerFlashcard / streak
  badges.ts      badges = prédicats sur la Progression (+ « 100 % » par chapitre)
  modes.ts       séries : entraînement, boss, survie, éclair, révision du jour, stats
src/storage/progression.ts   modèle Progression (Zod), localStorage, export/import,
                             récupération partielle + copies de sécurité
src/storage/migrations.ts    VERSION_PROGRESSION + migrations n → n+1 du format
src/ui/
  dom.ts (h(), ajouter())  texte.ts (KaTeX + **gras**, HTML échappé)
  etat.ts        état global : etat.modifier(f) sauvegarde + niveaux/badges/toasts
  effets.ts      sons WebAudio, confettis, toasts (désactivables)
  components/    question.ts (composant central), flashcards.ts, hud.ts
  screens/       accueil (carte), chapitre, session (tous les modes), revision, stats, badges, reglages
src/router.ts    routeur par hash (#/chapitre/:id/:onglet, #/jouer/:mode/:chap/:diff…)
tests/           Vitest ; tests/tex.ts convertit LaTeX → math.js pour vérifier l'affiché
```

## Conventions et pièges

- **Le streak 🔥 n'avance QUE via `validerSerie`** (bilan d'une séance, ou chaque tranche de 10 réponses en mode infini) — jamais à chaque réponse ni pour une flashcard.
- **Toute modification de la progression passe par `etat.modifier(p => …)`**. Elle sauvegarde, détecte les passages de niveau et débloque les badges.
- **Format de sauvegarde** : changement incompatible ⇒ incrémenter `VERSION_PROGRESSION`, ajouter la migration dans `storage/migrations.ts` **et** une sauvegarde d'exemple `tests/fixtures/sauvegardes/vN.json` (le test l'exige). Au chargement, seuls les éléments invalides sont réinitialisés et l'original est copié sous `math-quest:copie-securite:<date>` (téléchargeable dans Réglages).
- Les **indices de choix** passés à `corriger` sont ceux du JSON. Le mélange est fait uniquement dans `components/question.ts`.
- Ids des questions générées : `gen~<générateur>~<graine>~<difficulté>`. Elles ne vont **pas** dans Leitner (`cle: null`), seulement dans les stats.
- Un générateur renvoie `id: ''` ; c'est `generer()` qui pose l'id. Il fournit son LaTeX (affichage) **et** sa chaîne math.js (vérification). Les tests relisent le LaTeX affiché : les deux doivent donc rester cohérents.
- Distracteurs de QCM : `construireQcm` dédoublonne par `cle`, qui doit être une valeur canonique (`cleNum`, `cleExpr`). Prévoir 4 à 6 candidats pour toujours avoir 4 choix.
- Les éléments du DOM sont construits avec `h()` ; utiliser `ajouter()` quand des enfants peuvent être `null` (`append(null)` est refusé par TS).
- Pas de `innerHTML` avec du texte brut : passer par `rendreHtml`/`riche` (texte échappé + KaTeX + code `…` / ```python … ```).
- **Informatique** : les vérifications de `tests/contenu-maths.test.ts` exécutent le code Python de l'énoncé avec `python3` (`codeDe`, `executer`) ; garder le code de l'énoncé exécutable tel quel.
- **Physique** : réponses numériques avec `tolerance: 0.01` (arrondis de $g$…) et en unités où la valeur est ≥ 1 (la tolérance devient absolue sous 1).
- CSS : un seul fichier `src/styles/main.css`, jetons de couleur sur `:root` (thème sombre unique). Mobile d'abord (360 px).

## Niveaux et matières

- **Rien n'est codé en dur** : l'accueil, les statistiques, les badges « Conquérant » et la couleur des en-têtes viennent de `content/catalogue.json`. On y accède via `toutesLesMatieres()`, `matiereParId()`, `chapitresDe()` et `styleMatiere()` dans `core/loader.ts`.
- Accueil : carrousel à points des matières (`creerCarrousel` dans `screens/accueil.ts`, scroll-snap + flèches + clavier) ; la diapo affichée devient la matière sélectionnée et seul le chemin est re-rendu.
- La couleur d'une matière passe par les variables CSS `--couleur` et `--couleur-fonce`, posées en style inline. Aucune classe CSS n'est propre à une matière.
- La matière affichée sur la carte est mémorisée dans `localStorage` (`ui/selection.ts`), par simple confort.

## Décor et effets

- **Fond** : thème sombre global (jetons sur `:root`, plus de mode clair) avec une grille de points très légère sur `body` (opacité réglable via `--points`).
- **Effets de survol** : uniquement sous `@media (hover: hover) and (pointer: fine)`. L'état `:active` (enfoncé) reste prioritaire.
- **Ne pas mettre de `backdrop-filter` ni de `transform` sur `.hud`** : la barre d'onglets mobile (`position: fixed`) ne serait plus collée en bas.
- **Icône d'onglet** : `public/favicon.svg`. Le Σ y est un tracé vectoriel, sans dépendance à une police.

## Ajouter du contenu

Voir le README, qui documente le format avec un exemple de chaque type. Après tout ajout :
1. `npm test` ;
2. pour une question `numerique` ou `expression`, **ajouter une vérification indépendante** dans `tests/contenu-maths.test.ts`. Le test échoue sinon.

Vérifier soi-même l'exactitude mathématique de chaque réponse, correction et distracteur. Un distracteur ne doit pas être « vrai aussi » (piège classique : un équivalent juste, une solution particulière qui est aussi solution).

## Ajouter un générateur

1. Créer `src/generators/<theme>.ts`, qui exporte un `Generateur` : `id`, `titre`, `chapitre`, `formes`, `generer(rng, difficulte, forme)`.
2. L'enregistrer dans `GENERATEURS` (`src/generators/index.ts`).
3. Ajouter un test mathématique dans `tests/generators.test.ts`, qui relit l'énoncé affiché. Les tests structurels s'appliquent automatiquement.
