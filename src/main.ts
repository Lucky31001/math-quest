/** Point d'entrée : en-tête, routes, démarrage. */
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
import { brancherReglages, toast } from './ui/effets';
import { etat, avertissementChargement, rapportChargement } from './ui/etat';

brancherReglages(() => etat.p.reglages);

route('', ecranAccueil);
route('chapitre', ecranChapitre);
route('jouer', ecranSession);
route('revision', ecranRevision);
route('stats', ecranStats);
route('badges', ecranBadges);
route('reglages', ecranReglages);

const app = document.getElementById('app')!;
const main = h('main', { id: 'contenu', tabindex: '-1' });
app.append(creerHud(), main);
demarrer(main);

const avertissement = avertissementChargement();
if (avertissement) toast(`${avertissement}${rapportChargement.copie ? ' Une copie de sécurité est disponible dans les Réglages.' : ''}`, 'erreur', 9000);
