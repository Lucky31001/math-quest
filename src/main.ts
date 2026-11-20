/** Point d'entrée : en-tête, routes, démarrage. */
import '@fontsource-variable/nunito';
import './styles/main.css';
import { h } from './ui/dom';
import { creerHud } from './ui/components/hud';
import { route, demarrer } from './router';
import { ecranAccueil } from './ui/screens/accueil';
import { ecranChapitre } from './ui/screens/chapitre';
import { ecranSession } from './ui/screens/session';
import { ecranRevision } from './ui/screens/revision';
import { ecranStats } from './ui/screens/stats';
import { ecranBadges } from './ui/screens/badges';
import { ecranReglages } from './ui/screens/reglages';
import { ecranAtelier } from './ui/screens/atelier';
import { brancherReglages, toast } from './ui/effets';
import { etat, avertissementChargement, rapportChargement } from './ui/etat';
import { demanderProtection, statutStockage, rappelExportNecessaire, dernierExport, dernierRappel, noterRappel } from './storage/persistance';

brancherReglages(() => etat.p.reglages);

route('', ecranAccueil);
route('chapitre', ecranChapitre);
route('jouer', ecranSession);
route('revision', ecranRevision);
route('stats', ecranStats);
route('badges', ecranBadges);
route('reglages', ecranReglages);
route('atelier', ecranAtelier);

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
