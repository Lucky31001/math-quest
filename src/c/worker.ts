/**
 * Web Worker de l'atelier C : charge le compilateur une fois, puis compile et
 * exécute les programmes hors du fil principal (une boucle infinie ne fige pas
 * la page ; le fil principal peut arrêter le worker à tout moment).
 */
import { chargerCompilateur, compiler, executer, type Compilateur } from './compilateur';
import type { MessageVersWorker, MessageDuWorker } from './messages';
import type { SortieCas } from '../core/grading';

const portee = self as unknown as { onmessage: ((e: MessageEvent<MessageVersWorker>) => void) | null; postMessage(m: MessageDuWorker): void };
const envoyer = (m: MessageDuWorker) => portee.postMessage(m);

let compilateur: Promise<Compilateur> | null = null;

async function charger(url: string): Promise<Compilateur> {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`compilateur introuvable (${reponse.status})`);
  return chargerCompilateur(new Uint8Array(await reponse.arrayBuffer()));
}

portee.onmessage = async (e) => {
  const { source, entree, urlCompilateur, entrees } = e.data;
  try {
    if (!compilateur) {
      envoyer({ type: 'etape', etape: 'chargement' });
      compilateur = charger(urlCompilateur);
    }
    const c = await compilateur.catch((err) => {
      compilateur = null;
      throw err;
    });
    envoyer({ type: 'etape', etape: 'compilation' });
    const r = compiler(c, source);
    if (!('module' in r)) {
      envoyer({ type: 'fin', resultat: { etape: 'compilation', ...r } });
      return;
    }
    envoyer({ type: 'etape', etape: 'execution' });
    if (entrees) {
      envoyer({ type: 'fin-tests', sorties: entrees.map((x) => executerCas(r.module, x)) });
      return;
    }
    const resultat = executer(r.module, { entree, sortie: (texte, fd) => envoyer({ type: 'sortie', texte, fd }) });
    envoyer({ type: 'fin', resultat });
  } catch (err) {
    envoyer({ type: 'erreur', message: err instanceof Error ? err.message : String(err) });
  }
};

/** Une exécution d'un cas de test : sortie capturée, plantage ou sortie trop longue. */
function executerCas(module: WebAssembly.Module, entree: string): SortieCas {
  let sortie = '';
  try {
    const r = executer(module, { entree, sortie: (t) => (sortie += t) });
    return r.etape === 'execution' && r.trop ? { probleme: 'trop-long', sortie } : { sortie, code: r.etape === 'execution' ? r.code : 1 };
  } catch {
    return { probleme: 'plantage', sortie };
  }
}
