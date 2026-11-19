/**
 * Migrations du format de sauvegarde.
 *
 * Quand le format de la progression change de façon INCOMPATIBLE (champ renommé,
 * type modifié, contrainte plus stricte…), il faut :
 *   1. incrémenter VERSION_PROGRESSION ;
 *   2. ajouter ici une migration `n → n + 1` qui convertit une ancienne sauvegarde ;
 *   3. ajouter une sauvegarde d'exemple de l'ancienne version dans
 *      tests/fixtures/sauvegardes/ (le test de non-régression la chargera).
 *
 * Ajouter un champ AVEC une valeur par défaut ne demande pas de migration.
 */

export type DonneesBrutes = Record<string, unknown>;
export type Migration = (d: DonneesBrutes) => DonneesBrutes;

/** Version actuelle du format de sauvegarde. */
export const VERSION_PROGRESSION = 1;

/**
 * MIGRATIONS[n] convertit une sauvegarde de la version n vers la version n + 1.
 * Exemple pour une future v2 :
 *   2 ← 1 : 1: (d) => ({ ...d, version: 2, records: { ...d.records, nouveau: 0 } }),
 */
export const MIGRATIONS: Record<number, Migration> = {};

/** Version d'une sauvegarde brute (les toutes premières n'avaient pas toujours ce champ). */
export function versionDe(d: DonneesBrutes): number {
  return typeof d.version === 'number' && Number.isInteger(d.version) && d.version >= 1 ? d.version : 1;
}

export type ResultatMigration =
  | { ok: true; donnees: DonneesBrutes; appliquees: number[] }
  /** Sauvegarde créée par une version PLUS RÉCENTE de l'application (ou migration manquante). */
  | { ok: false; raison: 'version-future' | 'migration-manquante'; version: number; donnees: DonneesBrutes };

/** Applique les migrations successives jusqu'à la version `cible`. */
export function migrer(d: DonneesBrutes, migrations: Record<number, Migration> = MIGRATIONS, cible = VERSION_PROGRESSION): ResultatMigration {
  let v = versionDe(d);
  if (v > cible) return { ok: false, raison: 'version-future', version: v, donnees: d };
  let donnees = { ...d, version: v };
  const appliquees: number[] = [];
  while (v < cible) {
    const m = migrations[v];
    if (!m) return { ok: false, raison: 'migration-manquante', version: v, donnees };
    donnees = { ...m(donnees), version: v + 1 };
    appliquees.push(v);
    v++;
  }
  return { ok: true, donnees, appliquees };
}
