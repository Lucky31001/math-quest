# CLAUDE.md — Math Quest

Application de révision gamifiée (pré-ing 1 : algèbre, analyse, physique, informatique). Vite 8 + TypeScript 7 strict, **sans framework ni backend**. Interface et contenu **en français** (identifiants de code compris : `chapitre`, `enonce`, `corriger`…). Garder cette convention.

## Commandes

```bash
npm run dev         # serveur de dev
npm test            # Vitest (doit rester vert : le déploiement en dépend)
npm run typecheck   # tsc --noEmit
npm run build       # tsc + vite build → dist/ (base /math-quest/)
npm run schema      # régénère content/schema.json depuis le schéma Zod
npm run e2e         # Playwright : le vrai build (service worker, worker C) dans Chromium, mobile + bureau
```

Node 24 (fichier `.nvmrc`, partagé avec la CI) : `nvm use` avant toute commande npm, le Node du système (18) est trop vieux. Zod 4 : `z.record(clé, valeur)` à deux arguments, et `.prefault({})` (pas `.default({})`) pour un objet dont les champs ont leurs propres valeurs par défaut.

## Façon de travailler : une PR par modification

**Toute modification, même petite, passe par une pull request** : branche depuis `main` (`contenu/…`, `ui/…`, `fix/…`), commit, push, `gh pr create`. Ne jamais pousser directement sur `main`.
Une fois **validée** (CI verte : `tests` et `e2e`), la PR est fusionnée sans attendre de nouvelle confirmation : `gh pr merge <n> --squash --delete-branch` (un commit par modification dans l'historique de `main`), puis `git checkout main && git pull`. CI rouge : corriger sur la même branche, jamais fusionner.

## Architecture

```
content/catalogue.json             niveaux (années) → matières (id, nom, emblème, couleurs)
content/<matière>/*.json           1 fichier = 1 chapitre (« monde » = id de matière), validé AU BUILD
src/core/
  schema.ts      SOURCE DE VÉRITÉ du format (Zod → types TS + validation + schema.json)
  validation.ts  validation Zod du contenu, AU BUILD (plugin « contenu » de vite.config.ts) et dans les tests
  loader.ts      sans Zod : INDEX (catalogue + résumés, chargé au démarrage) ;
                 chargerChapitre(id) / chargerTout() : chapitre complet (déjà validé) à la demande, en cache
  resume.ts      résumé d'un chapitre (ids/types/difficultés), calculé au build
  types-question.ts  TYPES_QUESTION, LIBELLES_TYPE (sans Zod : à importer d'ici, pas de schema.ts)
  checker.ts     vérification math.js : normalisation de la saisie, équivalence
                 d'expressions par échantillonnage (dans ℂ), numériques, listes, constante
  grading.ts     corriger(question, reponse) pour les 6 types ; indices = ordre du JSON ;
                 « programme » : l'UI exécute d'abord (src/c/client.ts › executerTests), corriger compare
  random.ts      RNG à graine (mulberry32), shuffle, pick
src/generators/  générateurs aléatoires ; outils.ts (rationnels Q, LaTeX, construireQcm)
  index.ts       registre GENERATEURS, generer(g, difficulte, forme?, graine)
src/game/        logique pure (testable sans DOM)
  leitner.ts     5 boîtes, intervalles 1/2/4/8/16 j, erreur → boîte 1, due aujourd'hui
  xp.ts          XP par difficulté, seuils 50·n·(n−1), titres, points éclair
  progres.ts     enregistrerReponse / payerIndice / enregistrerFlashcard / streak
  badges.ts      badges = prédicats sur la Progression (+ « 100 % » par chapitre)
  modes.ts       LÉGER (sans générateurs ni math.js) : types, maîtrise, éléments dus, points faibles, examen (constantes)
  series.ts      séries : entraînement, boss, survie, éclair, révision du jour, examen blanc (générateurs → math.js)
  defi.ts        défi entre camarades : code « D1-… » (matière, clés des questions, note à battre)
src/storage/progression.ts   modèle Progression (Zod), localStorage, export/import,
                             récupération partielle + copies de sécurité
src/storage/migrations.ts    VERSION_PROGRESSION + migrations n → n+1 du format
src/storage/transfert.ts     lien de transfert entre appareils (#/transfert/MQ1-…) : export compressé (fflate), base64url
src/storage/persistance.ts   navigator.storage.persist(), rappel d'export
src/ui/
  dom.ts (h(), ajouter())  texte.ts (KaTeX + **gras**, HTML échappé)
  etat.ts        état global : etat.modifier(f) sauvegarde + niveaux/badges/toasts
  effets.ts      sons WebAudio, confettis, toasts (désactivables)
  components/    question.ts (composant central), flashcards.ts, hud.ts
  screens/       accueil (carte), chapitre, session (tous les modes), revision, stats, badges, reglages
src/router.ts    routeur par hash (#/chapitre/:id/:onglet, #/jouer/:mode/:chap/:diff…)
src/pwa.ts       service worker (hors ligne) ; mise à jour différée hors séance (#/jouer, #/revision, #/atelier)
src/c/           atelier C : wasi.ts (WASI en mémoire), compilateur.ts (xcc), worker.ts, client.ts,
                 scanf.ts (scanf/fscanf/sscanf de remplacement : celui de la libc de xcc est défaillant)
tests/           Vitest ; tests/tex.ts convertit LaTeX → math.js pour vérifier l'affiché
  outils/        tout-verifier.ts (un test, toutes les vérifications), verification.ts, generateurs.ts
  verifications/ maths.ts, physique.ts, informatique.ts : réponses recalculées indépendamment ;
                 generateurs.ts : une vérification par générateur de maths (VERIFICATIONS_GENERATEURS)
```

## Conventions et pièges

- **Examen blanc** (`#/jouer/examen/<matière>`) : `afficherQuestion({ differe: true })` enregistre la réponse sans la corriger ; la séance garde les contrôleurs (`figer()`) et appelle `reveler()` au bilan. Rien ne doit trahir la justesse pendant l'épreuve : les réponses sont passées à `enregistrerReponse` toutes ensemble au bilan (sinon les toasts de niveau/badge fuiteraient).
- **Défi** (`#/defi/<code>` puis `#/jouer/examen/<matière>/<code>`) : le lien transmet les CLÉS des questions (pas une graine) ; `serieDepuisCles` les retrouve, et régénère les questions générées depuis leur id. Une clé inconnue est ignorée (contenu d'une autre version).
- **Pièges** (`game/pieges.ts`, `progression.pieges`) : un choix faux sélectionné (QCM, justification de vrai/faux) est mémorisé avec son explication. Clé `chapitre/question#choix`, ou `gen~<générateur>#<explication>` pour une question générée : **l'explication d'un distracteur doit donc nommer l'erreur typique**, de façon identique d'une génération à l'autre. Affichés dans les Statistiques à partir de 2 occurrences.
- **Partie juste** : `Resultat.credit` (0..1), seulement pour les QCM à réponses multiples ; `enregistrerReponse` donne `credit` × XP de base sans faire monter la boîte Leitner.
- **Le streak 🔥 n'avance QUE via `validerSerie`** (bilan d'une séance, ou chaque tranche de 10 réponses en mode infini) — jamais à chaque réponse ni pour une flashcard.
- **math.js hors du démarrage** : seuls les écrans `chapitre` et `jouer` (chargés à la demande dans `main.ts`) importent la correction et les générateurs. Ne pas importer `core/checker`, `core/grading`, `generators/` ni `game/series` depuis l'accueil, les stats, les badges, la révision ou les réglages (le test e2e « accueil léger » le vérifie).
- **Validation au build** : l'application n'importe de `core/schema.ts` que des **types** (`import type`). Importer une valeur de `schema.ts` embarquerait tous les schémas Zod dans le bundle. Les modules chargés par `vite.config.ts` (`resume.ts`, `validation.ts`, `schema.ts`, `types-question.ts`) importent avec l'extension `.ts`.
- **Contenu chargé à la demande** : au démarrage, seul `INDEX` (résumés) existe. Un écran qui a besoin des textes (cours, énoncés, flashcards) charge ses chapitres avec `chargerChapitre`/`chargerChapitres`/`chargerTout`, via `ecranApresChargement` (`ui/chargement.ts`). Les fonctions de `game/` qui ne lisent que les identifiants acceptent un `ChapitreResume`. Les tests utilisent `tests/outils/contenu.ts` (tout le contenu, synchrone).
- **Toute modification de la progression passe par `etat.modifier(p => …)`**. Elle sauvegarde, détecte les passages de niveau et débloque les badges.
- **Format de sauvegarde** : changement incompatible ⇒ incrémenter `VERSION_PROGRESSION`, ajouter la migration dans `storage/migrations.ts` **et** une sauvegarde d'exemple `tests/fixtures/sauvegardes/vN.json` (le test l'exige). Au chargement, seuls les éléments invalides sont réinitialisés et l'original est copié sous `math-quest:copie-securite:<date>` (téléchargeable dans Réglages).
- Les **indices de choix** passés à `corriger` sont ceux du JSON. Le mélange est fait uniquement dans `components/question.ts`.
- Ids des questions générées : `gen~<générateur>~<graine>~<difficulté>`. Elles ne vont **pas** dans Leitner (`cle: null`), seulement dans les stats.
- Un générateur renvoie `id: ''` ; c'est `generer()` qui pose l'id. Il fournit son LaTeX (affichage) **et** sa chaîne math.js (vérification). Les tests relisent le LaTeX affiché : les deux doivent donc rester cohérents.
- Distracteurs de QCM : `construireQcm` dédoublonne par `cle`, qui doit être une valeur canonique (`cleNum`, `cleExpr`). Prévoir 4 à 6 candidats pour toujours avoir 4 choix.
- Les éléments du DOM sont construits avec `h()` ; utiliser `ajouter()` quand des enfants peuvent être `null` (`append(null)` est refusé par TS).
- Pas de `innerHTML` avec du texte brut : passer par `rendreHtml`/`riche` (texte échappé + KaTeX + code `…` / ```c … ```).
- **Informatique = langage C** (programme CY Tech, pas de Python). Les vérifications de `tests/verifications/informatique.ts` compilent le code de l'énoncé ou du cours avec `gcc -Wall -Werror` puis l'exécutent (`codeDe`, `codeCours`, `instructionsC`, `definitionsC`) : garder ce code compilable tel quel, sans comportement indéfini (sauf piège volontaire, compilé avec `executerC(…, true)`).
- **Exercices `programme`** (C) : `code` (départ) + `harnais` (main caché) + `solution` + `tests` (entrée → sortie). Hors Boss et Survie.
- **Libc de xcc** : `scanf` est remplacé (`src/c/scanf.ts`, testé contre la glibc dans `tests/atelier-c.test.ts`). Reste non géré : `printf("%hd")` (afficher avec `%d`).
- **Physique** : réponses numériques avec `tolerance: 0.01` (arrondis de $g$…) et en unités où la valeur est ≥ 1 (la tolérance devient absolue sous 1).
- **Tests de bout en bout** (`e2e/`, Playwright) : parcours réels avec de vrais clics (un bouton caché sous un autre fait échouer le test). Lancés dans la CI à chaque PR. À compléter pour toute fonctionnalité visible (nouveau mode, nouvel écran). La config marque l'**avertissement de première visite** (`ui/avertissement-evolution.ts`, `<dialog>` modal) comme déjà vu (`storageState`) : sinon il bloquerait tous les clics.
- **Tests : pas de test généré par élément** (un `it` par chapitre, question ou générateur). Utiliser `toutVerifier` : un seul test, qui liste les éléments fautifs.
- CSS : un seul fichier `src/styles/main.css`, jetons de couleur sur `:root` (thème sombre unique). Mobile d'abord (360 px).

## Niveaux et matières

- **Rien n'est codé en dur** : l'accueil, les statistiques, les badges « Conquérant » et la couleur des en-têtes viennent de `content/catalogue.json`. On y accède via `toutesLesMatieres()`, `matiereParId()`, `chapitresDe()` et `styleMatiere()` dans `core/loader.ts`.
- Accueil : carrousel à points des matières (`creerCarrousel` dans `screens/accueil.ts`, scroll-snap + flèches + clavier) ; la diapo affichée devient la matière sélectionnée et seul le chemin est re-rendu.
- **Semestres** : champ optionnel `semestre` (1 ou 2) d'un chapitre. Le contenu suit le programme de pré-ing 1 de CY Tech (polys d'Algèbre 1, Analyse 1 et « Panorama sur la Physique » au S1) ; les chapitres du S2 viennent après (`ordre`), et la carte pose un jalon « Semestre 2 » au changement.
- La couleur d'une matière passe par les variables CSS `--couleur` et `--couleur-fonce`, posées en style inline. Aucune classe CSS n'est propre à une matière.
- La matière affichée sur la carte est mémorisée dans `localStorage` (`ui/selection.ts`), par simple confort.

## Décor et effets

- **Fond** : thème sombre global (jetons sur `:root`, plus de mode clair) avec une grille de points très légère sur `body` (opacité réglable via `--points`).
- **Effets de survol** : uniquement sous `@media (hover: hover) and (pointer: fine)`. L'état `:active` (enfoncé) reste prioritaire.
- **Ne pas mettre de `backdrop-filter` ni de `transform` sur `.hud`** : la barre d'onglets mobile (`position: fixed`) ne serait plus collée en bas.
- **Icône d'onglet** : `public/favicon.svg`. Le Σ y est un tracé vectoriel, sans dépendance à une police.
- **Icônes de l'app installée** : `public/pwa-*.png`, `maskable-512x512.png`, `apple-touch-icon-180x180.png`, rendues depuis `favicon.svg` (à régénérer si le logo change).
- **Police** : Nunito auto-hébergée (`@fontsource-variable/nunito`), aucune ressource externe : l'app doit marcher hors ligne.

## Hors ligne (PWA)

- `vite-plugin-pwa` pré-cache tout le build (`workbox.globPatterns` dans `vite.config.ts`), compilateur C compris. Un nouveau type de fichier statique doit y être ajouté, sinon il manquera hors ligne.
- Le service worker n'est enregistré qu'en production (`import.meta.env.PROD`) : pour le tester, `npm run build && npm run preview`.

## Ajouter du contenu

Voir le README, qui documente le format avec un exemple de chaque type. Après tout ajout :
1. `npm test` ;
2. pour une question `numerique` ou `expression`, **ajouter une vérification indépendante** dans `tests/verifications/<maths|physique|informatique>.ts` (clé « chapitre/question »). Le test de couverture échoue sinon.

Vérifier soi-même l'exactitude mathématique de chaque réponse, correction et distracteur. Un distracteur ne doit pas être « vrai aussi » (piège classique : un équivalent juste, une solution particulière qui est aussi solution).

## Ajouter un générateur

1. Créer `src/generators/<theme>.ts`, qui exporte un `Generateur` : `id`, `titre`, `chapitre`, `formes`, `generer(rng, difficulte, forme)`.
2. L'enregistrer dans `GENERATEURS` (`src/generators/index.ts`).
3. Ajouter sa vérification dans `VERIFICATIONS_GENERATEURS` (`tests/verifications/generateurs.ts`) : elle reçoit une question (libre ou QCM), relit l'énoncé affiché et recalcule la réponse. Réutiliser les familles `parValeur` (réponse numérique) ou `parCritere` (fonction, matrice… testée par un critère). Le test de couverture échoue s'il en manque une ; les tests structurels s'appliquent automatiquement.

Informatique : `src/generators/informatique.ts` (un extrait de code C par question, réponse = ce qu'il affiche). `tests/generators-informatique.test.ts` compile l'extrait AFFICHÉ avec gcc (via `completerExtrait`, comme l'atelier) : le code doit rester compilable avec `-Wall -Werror`.

Physique : `src/generators/physique.ts` (un générateur par chapitre calculatoire, via `generateur()` + `produire()`). Les données s'écrivent toujours `donnee('X', valeur, unité)` → « $X = valeur\ unité$ » : `tests/generators-physique.test.ts` les relit et recalcule la réponse (table `ATTENDU`, à compléter pour tout nouveau générateur). Les distracteurs à moins de 2 % de la réponse sont écartés automatiquement : prévoir 4 à 5 pièges.
