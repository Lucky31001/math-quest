/**
 * Protection de la sauvegarde contre l'effacement automatique du navigateur.
 *
 * Sans protection, un navigateur peut vider le localStorage pour libérer de la
 * place ; Safari (iOS, macOS) l'efface même après 7 jours sans visite du site.
 * `navigator.storage.persist()` demande au navigateur de ne plus y toucher :
 * Chrome l'accorde (ou non) en silence, Firefox affiche une demande, Safari
 * l'accorde surtout aux applications installées sur l'écran d'accueil.
 *
 * En complément, on rappelle d'exporter la progression quand elle n'est pas protégée.
 */

export type StatutStockage = 'protege' | 'non-protege' | 'inconnu';

/** Sous-ensemble de `StorageManager` utilisé ici (injectable pour les tests). */
export interface ApiStockage {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
}

const apiNavigateur = (): ApiStockage | undefined => (typeof navigator === 'undefined' ? undefined : navigator.storage);

/** La sauvegarde est-elle protégée ? Ne déclenche aucune demande. */
export async function statutStockage(api: ApiStockage | undefined = apiNavigateur()): Promise<StatutStockage> {
  if (!api?.persisted) return 'inconnu';
  try {
    return (await api.persisted()) ? 'protege' : 'non-protege';
  } catch {
    return 'inconnu';
  }
}

/**
 * Demande la protection si elle n'est pas déjà accordée. À appeler après un
 * vrai progrès (pas au démarrage) : Firefox affiche alors une demande à l'élève.
 */
export async function demanderProtection(api: ApiStockage | undefined = apiNavigateur()): Promise<StatutStockage> {
  const avant = await statutStockage(api);
  if (avant !== 'non-protege' || !api?.persist) return avant;
  try {
    return (await api.persist()) ? 'protege' : 'non-protege';
  } catch {
    return 'non-protege';
  }
}

/* ------------------------------------------------------------------ */
/* Rappel d'export                                                     */
/* ------------------------------------------------------------------ */

const CLE_EXPORT = 'math-quest:dernier-export';
const CLE_RAPPEL = 'math-quest:dernier-rappel-export';

/** Délai (jours) après lequel on rappelle d'exporter une progression non protégée. */
export const DELAI_RAPPEL = 14;
/** XP à partir de laquelle la progression vaut la peine d'être exportée. */
export const XP_RAPPEL = 100;

const ecartJours = (de: string, a: string): number => Math.round((Date.parse(a) - Date.parse(de)) / 86_400_000);

/**
 * Faut-il rappeler d'exporter ? Oui si la sauvegarde n'est pas protégée, qu'il
 * y a quelque chose à perdre, que le dernier export date (ou n'existe pas) et
 * qu'on ne l'a pas déjà rappelé récemment. Dates au format AAAA-MM-JJ.
 */
export function rappelExportNecessaire(o: {
  statut: StatutStockage;
  xp: number;
  aujourdhui: string;
  dernierExport: string | null;
  dernierRappel: string | null;
}): boolean {
  if (o.statut === 'protege' || o.xp < XP_RAPPEL) return false;
  if (o.dernierExport && ecartJours(o.dernierExport, o.aujourdhui) < DELAI_RAPPEL) return false;
  if (o.dernierRappel && ecartJours(o.dernierRappel, o.aujourdhui) < DELAI_RAPPEL) return false;
  return true;
}

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrire(cle: string, valeur: string): void {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    /* stockage indisponible */
  }
}

export const dernierExport = (): string | null => lire(CLE_EXPORT);
export const noterExport = (jour: string): void => ecrire(CLE_EXPORT, jour);
export const dernierRappel = (): string | null => lire(CLE_RAPPEL);
export const noterRappel = (jour: string): void => ecrire(CLE_RAPPEL, jour);

/* ------------------------------------------------------------------ */
/* Conseil selon l'appareil                                            */
/* ------------------------------------------------------------------ */

/** Safari sur iPhone / iPad, dans le navigateur (pas l'app installée). */
export function estIosNavigateur(nav: { userAgent: string; maxTouchPoints?: number; standalone?: boolean } | undefined = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { standalone?: boolean })): boolean {
  if (!nav || nav.standalone) return false;
  const ios = /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && (nav.maxTouchPoints ?? 0) > 1);
  return ios;
}
