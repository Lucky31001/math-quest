/** Messages échangés entre la page et le worker de l'atelier C. */
import type { Resultat } from './compilateur';
import type { SortieCas } from '../core/grading';

export interface MessageVersWorker {
  source: string;
  entree: string;
  /** URL absolue de wccfiles.zip. */
  urlCompilateur: string;
  /** Mode « tests » : compile une fois puis exécute sur chacune de ces entrées (sortie capturée). */
  entrees?: string[];
}

export type Etape = 'chargement' | 'compilation' | 'execution';

export type MessageDuWorker =
  | { type: 'etape'; etape: Etape }
  | { type: 'sortie'; texte: string; fd: 1 | 2 }
  | { type: 'fin'; resultat: Resultat }
  | { type: 'fin-tests'; sorties: SortieCas[] }
  | { type: 'erreur'; message: string };
