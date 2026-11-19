/**
 * Regroupe de nombreuses vérifications en UN seul test : toutes sont exécutées,
 * et l'échec liste chaque vérification fautive avec son message.
 * Évite des centaines de tests générés (un par chapitre, par question…).
 */
export function toutVerifier(cas: Record<string, () => void> | [string, () => void][]): void {
  const echecs: string[] = [];
  for (const [nom, verifier] of Array.isArray(cas) ? cas : Object.entries(cas)) {
    try {
      verifier();
    } catch (e) {
      echecs.push(`✗ ${nom}\n  ${(e instanceof Error ? e.message : String(e)).split('\n').join('\n  ')}`);
    }
  }
  if (echecs.length) throw new Error(`${echecs.length} vérification(s) en échec :\n\n${echecs.join('\n\n')}`);
}
