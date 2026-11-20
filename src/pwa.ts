/**
 * Service worker (mode hors ligne) et mises à jour de l'application.
 *
 * Une nouvelle version est téléchargée en arrière-plan. Elle n'est pas
 * appliquée au milieu d'une séance (la page serait rechargée et la série
 * perdue) : on attend que l'élève revienne sur un écran sans exercice en cours.
 */
import { registerSW } from 'virtual:pwa-register';
import { toast } from './ui/effets';

/** Écrans où un rechargement ferait perdre quelque chose (séance, flashcards, code en cours). */
const ECRANS_OCCUPES = ['#/jouer', '#/revision', '#/atelier'];

export const ecranOccupe = (hash: string): boolean => ECRANS_OCCUPES.some((e) => hash === e || hash.startsWith(`${e}/`));

export function installerServiceWorker(): void {
  let enAttente = false;
  const appliquer = (): void => {
    if (!enAttente || ecranOccupe(location.hash)) return;
    enAttente = false;
    toast('✨ Nouvelle version de Math Quest installée.', 'info');
    void mettreAJour(true);
  };
  const mettreAJour = registerSW({
    immediate: true, // module chargé après l'événement « load » : sans ça, rien ne serait enregistré
    onNeedRefresh() {
      enAttente = true;
      appliquer();
    },
    onOfflineReady() {
      toast('📴 Math Quest est prêt à fonctionner hors ligne.', 'info');
    },
  });
  window.addEventListener('hashchange', appliquer);
}
