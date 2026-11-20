/**
 * Contenu COMPLET pour les tests, chargé et validé d'un coup (l'application,
 * elle, ne charge au démarrage que les résumés : voir src/core/loader.ts).
 */
import { validerContenu, type Contenu } from '../../src/core/validation';

const fichiers = import.meta.glob('/content/**/*.json', { eager: true, import: 'default' });

export const CONTENU: Contenu = validerContenu(fichiers, fichiers['/content/catalogue.json']);
