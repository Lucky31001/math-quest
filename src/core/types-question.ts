/**
 * Types de question : liste et libellés. Module sans Zod : l'application
 * l'importe sans embarquer les schémas du contenu (validés au build).
 */
import type { TypeQuestion } from './schema';

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
