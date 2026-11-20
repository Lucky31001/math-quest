/** Point d'entrée : en-tête, routes, démarrage. */
import '@fontsource-variable/nunito';
import './styles/main.css';
import { h } from './ui/dom';
import { creerHud } from './ui/components/hud';
import { route, demarrer, type Ecran } from './router';
import { ecranAccueil } from './ui/screens/accueil';
import { ecranRevision } from './ui/screens/revision';
import { ecranStats } from './ui/screens/stats';
import { ecranBadges } from './ui/screens/badges';
import { ecranReglages } from './ui/screens/reglages';
import { ecranAtelier } from './ui/screens/atelier';
import { ecranTransfert } from './ui/screens/transfert';
import { brancherReglages, toast } from './ui/effets';
import { ecranApresChargement } from './ui/chargement';
import { etat, avertissementChargement, rapportChargement } from './ui/etat';
import { demanderProtection, statutStockage, rappelExportNecessaire, dernierExport, dernierRappel, noterRappel } from './storage/persistance';

brancherReglages(() => etat.p.reglages);

route('', ecranAccueil);
// Écrans qui corrigent des réponses : chargés à la demande, avec le moteur de
// correction (math.js, ~180 Ko compressés) et les générateurs d'exercices.
const aLaDemande = (charger: () => Promise<Ecran>): Ecran => (main, params) => ecranApresChargement(main, charger, (ecran) => ecran(main, params));
route('chapitre', aLaDemande(() => import('./ui/screens/chapitre').then((m) => m.ecranChapitre)));
route('jouer', aLaDemande(() => import('./ui/screens/session').then((m) => m.ecranSession)));
route('revision', ecranRevision);
route('stats', ecranStats);
route('badges', ecranBadges);
route('reglages', ecranReglages);
route('atelier', ecranAtelier);
route('transfert', ecranTransfert);

const app = document.getElementById('app')!;
const main = h('main', { id: 'contenu', tabindex: '-1' });
app.append(creerHud(), main);
demarrer(main);

const avertissement = avertissementChargement();
if (avertissement) toast(`${avertissement}${rapportChargement.copie ? ' Une copie de sécurité est disponible dans les Réglages.' : ''}`, 'erreur', 9000);

// Protection de la sauvegarde : demandée au premier vrai progrès (Firefox affiche une
// demande, autant qu'elle arrive quand il y a quelque chose à protéger).
if (etat.p.xp > 0) void demanderProtection();
else {
  const desabonner = etat.surChangement(() => {
    if (etat.p.xp <= 0) return;
    desabonner();
    void demanderProtection();
  });
}

// Rappel d'export si la progression n'est pas protégée (au plus tous les 14 jours).
void statutStockage().then((statut) => {
  const aujourdhui = etat.aujourdhui();
  if (avertissement || !rappelExportNecessaire({ statut, xp: etat.p.xp, aujourdhui, dernierExport: dernierExport(), dernierRappel: dernierRappel() })) return;
  noterRappel(aujourdhui);
  toast('💾 Ton navigateur peut effacer ta progression. Exporte-la dans ⚙️ Réglages.', 'info', 9000);
});

// Mode hors ligne : uniquement dans la version publiée (pas en dev ni dans les tests).
if (import.meta.env.PROD && 'serviceWorker' in navigator) void import('./pwa').then((m) => m.installerServiceWorker());
