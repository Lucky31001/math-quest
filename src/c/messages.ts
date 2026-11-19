/** Messages échangés entre la page et le worker de l'atelier C. */
import type { Resultat } from './compilateur';

export interface MessageVersWorker {
  source: string;
  entree: string;
  /** URL absolue de wccfiles.zip. */
  urlCompilateur: string;
}

export type Etape = 'chargement' | 'compilation' | 'execution';

export type MessageDuWorker =
  | { type: 'etape'; etape: Etape }
  | { type: 'sortie'; texte: string; fd: 1 | 2 }
  | { type: 'fin'; resultat: Resultat }
  | { type: 'erreur'; message: string };
