/**
 * Schéma du contenu pédagogique (chapitres, cours, flashcards, exercices).
 *
 * C'est la SOURCE DE VÉRITÉ du format des fichiers /content/**\/*.json :
 *  - les types TypeScript sont déduits de ces schémas (z.infer) ;
 *  - chaque fichier JSON est validé au chargement (voir loader.ts) ;
 *  - `npm run schema` exporte content/schema.json pour l'autocomplétion dans l'éditeur.
 *
 * Tous les champs texte acceptent du LaTeX entre `$…$` (en ligne) ou `$$…$$` (bloc)
 * et le gras Markdown `**…**`.
 */
import { z } from 'zod';

const MSG_ID = 'identifiant : minuscules, chiffres et tirets uniquement';
// `.meta({ errorMessage })` : message affiché par VS Code via content/schema.json.
const id = z
  .string()
  .regex(/^[a-z0-9-]+$/, MSG_ID)
  .meta({ errorMessage: { pattern: MSG_ID } });

const texte = z.string().min(1);

export const DifficulteSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Difficulte = z.infer<typeof DifficulteSchema>;

/** Un choix de QCM (ou une justification de vrai/faux). */
export const ChoixSchema = z
  .object({
    texte,
    correct: z.boolean(),
    /** Pourquoi ce choix est juste… ou pourquoi il est faux (erreur classique visée). */
    explication: texte,
  })
  .strict();
export type Choix = z.infer<typeof ChoixSchema>;

/** Champs communs à toutes les questions. */
const base = {
  id,
  difficulte: DifficulteSchema,
  enonce: texte,
  /** Indice facultatif (coûte des XP). */
  indice: texte.optional(),
  /** Correction détaillée, une étape par élément. */
  correction: z.array(texte).min(1),
};

export const QcmSchema = z
  .object({
    ...base,
    type: z.literal('qcm'),
    /** false = une seule bonne réponse (radio), true = plusieurs (cases à cocher). */
    multiple: z.boolean().default(false),
    choix: z.array(ChoixSchema).min(2).max(6),
  })
  .strict();

/** Valeur attendue : nombre, ou expression constante écrite en syntaxe math.js (ex. "sqrt(2)/2", "1+i"). */
const valeur = z.union([z.number(), z.string().min(1)]);

export const NumeriqueSchema = z
  .object({
    ...base,
    type: z.literal('numerique'),
    /** Une valeur, ou une liste de valeurs (l'élève les sépare par « ; », ordre indifférent). */
    reponse: z.union([valeur, z.array(valeur).min(1)]),
    /** Tolérance relative (défaut 1e-6). */
    tolerance: z.number().positive().optional(),
  })
  .strict();

export const ExpressionSchema = z
  .object({
    ...base,
    type: z.literal('expression'),
    /** Expression attendue en syntaxe math.js, ex. "2*(x+1)", "exp(x)*sin(x)". */
    reponse: texte,
    variables: z.array(z.string().regex(/^[a-zA-Z]\w*$/)).default(['x']),
    /** Intervalle d'échantillonnage des variables (défaut [-3, 3]). */
    domaine: z.tuple([z.number(), z.number()]).optional(),
    /** Accepter toute réponse égale à une constante près (primitives). */
    aConstantePres: z.boolean().optional(),
  })
  .strict();

export const VraiFauxSchema = z
  .object({
    ...base,
    type: z.literal('vrai-faux'),
    /** L'affirmation (enonce) est-elle vraie ? */
    reponse: z.boolean(),
    /** Justifications proposées : exactement une est correcte. */
    justifications: z.array(ChoixSchema).min(2).max(5),
  })
  .strict();

export const TrouveErreurSchema = z
  .object({
    ...base,
    type: z.literal('trouve-erreur'),
    /** La « démonstration », une ligne par étape. */
    etapes: z.array(texte).min(2),
    /** Index (à partir de 0) de l'étape fausse. */
    etapeFausse: z.number().int().nonnegative(),
    /** Pourquoi cette étape est fausse. */
    explication: texte,
  })
  .strict();

/** Un cas de test d'un exercice de programmation : entrée standard → sortie attendue. */
export const CasTestSchema = z
  .object({
    /** Entrée standard (lue avec scanf). */
    entree: z.string().default(''),
    /** Sortie attendue (comparée ligne à ligne, espaces de fin ignorés). */
    sortie: z.string(),
  })
  .strict();
export type CasTest = z.infer<typeof CasTestSchema>;

/**
 * « Écris le programme » (langage C) : l'élève complète `code` ; on compile
 * `code` + `harnais` dans le navigateur et on compare la sortie à chaque test.
 */
export const ProgrammeSchema = z
  .object({
    ...base,
    type: z.literal('programme'),
    /** Code de départ affiché dans l'éditeur (signature, commentaires « à compléter »). */
    code: texte,
    /** Code invisible ajouté après celui de l'élève, en général un `main` qui lit l'entrée et appelle sa fonction. */
    harnais: z.string().default(''),
    /** Une solution de référence (montrée après la réponse, vérifiée par les tests). */
    solution: texte,
    tests: z.array(CasTestSchema).min(1),
  })
  .strict();

/** Contrôles de cohérence qui dépendent du type de question. */
export const QuestionSchema = z
  .discriminatedUnion('type', [QcmSchema, NumeriqueSchema, ExpressionSchema, VraiFauxSchema, TrouveErreurSchema, ProgrammeSchema])
  .superRefine((q, ctx) => {
    const err = (message: string) => ctx.addIssue({ code: 'custom', message: `[${q.id}] ${message}` });
    if (q.type === 'qcm') {
      const n = q.choix.filter((c) => c.correct).length;
      if (!q.multiple && n !== 1) err(`QCM à réponse unique avec ${n} bonne(s) réponse(s)`);
      if (q.multiple && n < 1) err('QCM multiple sans bonne réponse');
    } else if (q.type === 'vrai-faux') {
      const n = q.justifications.filter((c) => c.correct).length;
      if (n !== 1) err(`vrai-faux : ${n} justification(s) correcte(s) au lieu de 1`);
    } else if (q.type === 'trouve-erreur') {
      if (q.etapeFausse >= q.etapes.length) err('etapeFausse hors des étapes');
    }
  });

export type Qcm = z.infer<typeof QcmSchema>;
export type Numerique = z.infer<typeof NumeriqueSchema>;
export type Expression = z.infer<typeof ExpressionSchema>;
export type VraiFaux = z.infer<typeof VraiFauxSchema>;
export type TrouveErreur = z.infer<typeof TrouveErreurSchema>;
export type Programme = z.infer<typeof ProgrammeSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type TypeQuestion = Question['type'];

export const TYPES_QUESTION: readonly TypeQuestion[] = [
  'qcm',
  'numerique',
  'expression',
  'vrai-faux',
  'trouve-erreur',
  'programme',
];

export const LIBELLES_TYPE: Record<TypeQuestion, string> = {
  qcm: 'QCM',
  numerique: 'Réponse numérique',
  expression: 'Expression',
  'vrai-faux': 'Vrai / Faux',
  'trouve-erreur': "Trouve l'erreur",
  programme: 'Programme C',
};

export const FlashcardSchema = z
  .object({
    id,
    recto: texte,
    verso: texte,
  })
  .strict();
export type Flashcard = z.infer<typeof FlashcardSchema>;

/** Un bloc de la fiche de cours. */
export const BlocCoursSchema = z
  .object({
    type: z.enum(['definition', 'theoreme', 'propriete', 'methode', 'remarque', 'exemple']),
    titre: z.string().optional(),
    texte,
  })
  .strict();
export type BlocCours = z.infer<typeof BlocCoursSchema>;

export const SectionCoursSchema = z
  .object({
    titre: texte,
    blocs: z.array(BlocCoursSchema).min(1),
  })
  .strict();

export const ChapitreSchema = z
  .object({
    $schema: z.string().optional(),
    id,
    /** Matière du chapitre : identifiant déclaré dans content/catalogue.json (= nom du dossier). */
    monde: id,
    /** Position du chapitre sur la carte (1 = premier). */
    ordre: z.number().int().positive(),
    titre: texte,
    /** Un emoji pour la carte. */
    icone: z.string().min(1),
    resume: texte,
    cours: z.array(SectionCoursSchema).min(1),
    flashcards: z.array(FlashcardSchema),
    exercices: z.array(QuestionSchema),
  })
  .strict();

export type Chapitre = z.infer<typeof ChapitreSchema>;

/**
 * Résumé d'un chapitre, chargé au démarrage (voir src/core/resume.ts) : de quoi
 * afficher la carte, les statistiques et les badges. Le reste (cours, énoncés,
 * flashcards) est chargé à l'ouverture du chapitre.
 */
export const ChapitreResumeSchema = z.object({
  id,
  monde: id,
  ordre: z.number().int().positive(),
  titre: texte,
  icone: z.string().min(1),
  resume: texte,
  exercices: z.array(
    z.object({
      id,
      type: z.enum(['qcm', 'numerique', 'expression', 'vrai-faux', 'trouve-erreur', 'programme']),
      difficulte: DifficulteSchema,
    }),
  ),
  flashcards: z.array(z.object({ id })),
});
export type ChapitreResume = z.infer<typeof ChapitreResumeSchema>;
/** Forme « en entrée » (avant valeurs par défaut) — utile pour écrire du contenu en TS. */
export type ChapitreInput = z.input<typeof ChapitreSchema>;
export type Monde = Chapitre['monde'];

/* ------------------------------------------------------------------ */
/* Catalogue : niveaux (années) et matières                            */
/* ------------------------------------------------------------------ */

const MSG_COULEUR = 'couleur au format #rrggbb';
const couleur = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, MSG_COULEUR)
  .meta({ errorMessage: { pattern: MSG_COULEUR } });

export const MatiereSchema = z
  .object({
    /** Identifiant unique (= nom du dossier content/<id>/ et champ « monde » des chapitres). */
    id,
    nom: texte,
    sousTitre: texte,
    /** Emoji de la matière. */
    embleme: z.string().min(1),
    couleur,
    /** Teinte plus sombre, pour le relief des boutons et bannières. */
    couleurFonce: couleur,
  })
  .strict();

export const NiveauSchema = z
  .object({
    id,
    nom: texte,
    description: z.string().optional(),
    matieres: z.array(MatiereSchema).min(1),
  })
  .strict();

export const CatalogueSchema = z
  .object({
    $schema: z.string().optional(),
    niveaux: z.array(NiveauSchema).min(1),
  })
  .strict()
  .superRefine((c, ctx) => {
    const ids = c.niveaux.flatMap((n) => n.matieres.map((m) => m.id));
    const doublons = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (doublons.length) ctx.addIssue({ code: 'custom', message: `matières en double : ${doublons.join(', ')}` });
  });

export type Matiere = z.infer<typeof MatiereSchema>;
export type Niveau = z.infer<typeof NiveauSchema>;
export type Catalogue = z.infer<typeof CatalogueSchema>;
