/**
 * Côté page : lance les compilations dans le worker, avec un bouton « Arrêter »
 * et une limite de temps (une boucle infinie est coupée en tuant le worker).
 */
import type { Resultat } from './compilateur';
import type { ExecutionProgramme } from '../core/grading';
import type { Etape, MessageDuWorker, MessageVersWorker } from './messages';
import type { SortieCas } from '../core/grading';

/** Durée maximale d'une exécution (compilation comprise), en millisecondes. */
export const DUREE_MAX = 10_000;

export type Issue = Resultat | { etape: 'arret'; raison: 'utilisateur' | 'temps' } | { etape: 'erreur'; message: string };

export interface Rappels {
  etape?: (e: Etape) => void;
  sortie?: (texte: string, fd: 1 | 2) => void;
}

let worker: Worker | null = null;
let enCours: { terminer: (i: Issue) => void; minuterie: ReturnType<typeof setTimeout> } | null = null;

const urlCompilateur = () => new URL(`${import.meta.env.BASE_URL}compilateur-c/wccfiles.zip`, location.href).href;

function obtenirWorker(): Worker {
  worker ??= new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

/** Issue d'une exécution sur des cas de test (exercices « programme »). */
export type IssueTests = ExecutionProgramme | { etape: 'arret'; raison: 'utilisateur' | 'temps' } | { etape: 'erreur'; message: string };

/**
 * Compile `source` une fois puis l'exécute sur chaque entrée (sortie capturée).
 * Une boucle infinie coupe l'ensemble au bout de `DUREE_MAX`.
 */
export async function executerTests(source: string, entrees: string[], rappels: Pick<Rappels, 'etape'> = {}): Promise<IssueTests> {
  let sorties: ExecutionProgramme | null = null;
  const issue = await lancer({ source, entree: '', entrees, urlCompilateur: urlCompilateur() }, rappels, (s) => (sorties = { sorties: s }));
  if (sorties) return sorties;
  if (issue.etape === 'compilation') return { compilation: issue.messages };
  if (issue.etape === 'execution') return { etape: 'erreur', message: 'réponse inattendue du worker' };
  return issue;
}

/** Compile et exécute `source` ; une seule exécution à la fois. */
export function executerC(source: string, entree: string, rappels: Rappels = {}): Promise<Issue> {
  return lancer({ source, entree, urlCompilateur: urlCompilateur() }, rappels);
}

function lancer(message: MessageVersWorker, rappels: Rappels, surTests?: (s: SortieCas[]) => void): Promise<Issue> {
  arreter('utilisateur');
  return new Promise((resolve) => {
    const w = obtenirWorker();
    const terminer = (i: Issue) => {
      if (!enCours) return;
      clearTimeout(enCours.minuterie);
      enCours = null;
      w.onmessage = null;
      resolve(i);
    };
    // Le chargement initial du compilateur ne compte pas dans la limite de temps.
    let minuterie = setTimeout(() => arreter('temps'), DUREE_MAX + 20_000);
    enCours = { terminer, minuterie };
    w.onmessage = (e: MessageEvent<MessageDuWorker>) => {
      const m = e.data;
      if (m.type === 'etape') {
        if (m.etape === 'compilation' && enCours) {
          clearTimeout(minuterie);
          minuterie = setTimeout(() => arreter('temps'), DUREE_MAX);
          enCours.minuterie = minuterie;
        }
        rappels.etape?.(m.etape);
      } else if (m.type === 'sortie') rappels.sortie?.(m.texte, m.fd);
      else if (m.type === 'fin') terminer(m.resultat);
      else if (m.type === 'fin-tests') {
        surTests?.(m.sorties);
        terminer({ etape: 'execution', code: 0, trop: false });
      }
      else terminer({ etape: 'erreur', message: m.message });
    };
    w.onerror = (e) => terminer({ etape: 'erreur', message: e.message || 'erreur du worker' });
    w.postMessage(message);
  });
}

/** Interrompt l'exécution en cours (le worker est détruit puis recréé au besoin). */
export function arreter(raison: 'utilisateur' | 'temps' = 'utilisateur'): void {
  if (!enCours) return;
  const fin = enCours.terminer;
  worker?.terminate();
  worker = null;
  fin({ etape: 'arret', raison });
}
