/**
 * Mini-environnement WASI (preview 1) en mémoire, sans dépendance.
 *
 * Suffisant pour faire tourner le compilateur C `cc` (xcc, compilé en WebAssembly)
 * et les programmes qu'il produit : arguments, variables d'environnement, fichiers
 * en mémoire, entrée standard fournie d'avance, sorties standard et d'erreur.
 * Aucun accès au disque ni au réseau : le programme ne voit que `SystemeFichiers`.
 * Utilisable dans un Web Worker comme dans Node (tests).
 */

/** Codes d'erreur WASI utilisés. */
const E = { SUCCES: 0, BADF: 8, EXIST: 20, INVAL: 28, ISDIR: 31, NOENT: 44, NOSYS: 52, NOTDIR: 54 } as const;
/** Types de fichiers WASI. */
const TYPE = { CARACTERES: 2, DOSSIER: 3, FICHIER: 4 } as const;

/** Contenu d'un fichier (toujours adossé à un ArrayBuffer, comme l'exige WebAssembly.Module). */
export type Octets = Uint8Array<ArrayBuffer>;

/** Système de fichiers en mémoire : chemins absolus normalisés → contenu. */
export class SystemeFichiers {
  readonly fichiers = new Map<string, Octets>();
  readonly dossiers = new Set<string>(['/']);

  static normaliser(chemin: string): string {
    const pile: string[] = [];
    for (const m of chemin.split('/')) {
      if (!m || m === '.') continue;
      if (m === '..') pile.pop();
      else pile.push(m);
    }
    return `/${pile.join('/')}`;
  }

  creerDossier(chemin: string): void {
    const morceaux = SystemeFichiers.normaliser(chemin).split('/').filter(Boolean);
    let courant = '';
    for (const m of morceaux) {
      courant += `/${m}`;
      this.dossiers.add(courant);
    }
  }

  ecrire(chemin: string, contenu: Octets | string): void {
    const c = SystemeFichiers.normaliser(chemin);
    this.creerDossier(c.slice(0, c.lastIndexOf('/')) || '/');
    this.fichiers.set(c, typeof contenu === 'string' ? new TextEncoder().encode(contenu) : contenu);
  }

  lire(chemin: string): Octets | undefined {
    return this.fichiers.get(SystemeFichiers.normaliser(chemin));
  }

  /** Copie indépendante (les contenus sont partagés tant qu'ils ne sont pas réécrits). */
  copier(): SystemeFichiers {
    const s = new SystemeFichiers();
    for (const [k, v] of this.fichiers) s.fichiers.set(k, v);
    for (const d of this.dossiers) s.dossiers.add(d);
    return s;
  }
}

/** Levée par `proc_exit` pour interrompre l'exécution. */
export class FinProgramme extends Error {
  constructor(readonly code: number) {
    super(`exit(${code})`);
  }
}

/** Levée quand la sortie dépasse la limite autorisée (boucle d'affichage infinie…). */
export class SortieTropLongue extends Error {}

export interface OptionsWasi {
  args: string[];
  env?: Record<string, string>;
  fs: SystemeFichiers;
  /** Dossier courant (préouvert comme « . »). */
  dossierCourant?: string;
  /** Texte fourni sur l'entrée standard (scanf, getchar…). */
  entree?: string;
  /** Reçoit les sorties au fil de l'eau : fd 1 (stdout) ou 2 (stderr). */
  sortie?: (texte: string, fd: 1 | 2) => void;
  /** Nombre maximal d'octets écrits sur stdout + stderr (défaut 200 000). */
  limiteSortie?: number;
}

interface Descripteur {
  chemin: string;
  dossier: boolean;
  position: number;
  ajout: boolean;
}

/**
 * Exécute un module WebAssembly WASI jusqu'à sa fin ; renvoie le code de sortie.
 * Exécution synchrone : dans le navigateur, l'appeler depuis un Web Worker.
 */
export function executerWasi(module: WebAssembly.Module, options: OptionsWasi): number {
  const { fs, args } = options;
  const env = Object.entries(options.env ?? {}).map(([k, v]) => `${k}=${v}`);
  const dossierCourant = SystemeFichiers.normaliser(options.dossierCourant ?? '/');
  const entree = new TextEncoder().encode(options.entree ?? '');
  let positionEntree = 0;
  const limite = options.limiteSortie ?? 200_000;
  let ecrits = 0;
  const decodeurs = { 1: new TextDecoder(), 2: new TextDecoder() };

  // 0, 1, 2 : flux standard ; 3 : « / » ; 4 : « . » (dossier courant).
  const preouverts = new Map<number, string>([
    [3, '/'],
    [4, '.'],
  ]);
  const fds = new Map<number, Descripteur>([
    [3, { chemin: '/', dossier: true, position: 0, ajout: false }],
    [4, { chemin: dossierCourant, dossier: true, position: 0, ajout: false }],
  ]);
  let prochainFd = 5;

  let memoire: WebAssembly.Memory | undefined;
  const vue = () => new DataView(memoire!.buffer);
  const octets = () => new Uint8Array(memoire!.buffer);
  const chaine = (ptr: number, len: number) => new TextDecoder().decode(octets().subarray(ptr, ptr + len));
  const resoudre = (fd: number, ptr: number, len: number): string | null => {
    const base = fds.get(fd);
    if (!base || !base.dossier) return null;
    const p = chaine(ptr, len);
    return SystemeFichiers.normaliser(p.startsWith('/') ? p : `${base.chemin}/${p}`);
  };
  const ecrireChaines = (liste: string[], ptrs: number, buf: number) => {
    const v = vue();
    const o = octets();
    let pos = buf;
    liste.forEach((s, i) => {
      v.setUint32(ptrs + 4 * i, pos, true);
      const b = new TextEncoder().encode(s);
      o.set(b, pos);
      o[pos + b.length] = 0;
      pos += b.length + 1;
    });
    return E.SUCCES;
  };
  const tailles = (liste: string[], pNombre: number, pTaille: number) => {
    const v = vue();
    v.setUint32(pNombre, liste.length, true);
    v.setUint32(pTaille, liste.reduce((s, x) => s + new TextEncoder().encode(x).length + 1, 0), true);
    return E.SUCCES;
  };
  const ecrireStat = (buf: number, type: number, taille: number) => {
    const v = vue();
    for (let i = 0; i < 64; i += 8) v.setBigUint64(buf + i, 0n, true);
    v.setUint8(buf + 16, type);
    v.setBigUint64(buf + 24, 1n, true);
    v.setBigUint64(buf + 32, BigInt(taille), true);
  };
  const iovecs = (ptr: number, n: number) => {
    const v = vue();
    return Array.from({ length: n }, (_, i) => ({ buf: v.getUint32(ptr + 8 * i, true), len: v.getUint32(ptr + 8 * i + 4, true) }));
  };

  const wasi: Record<string, (...a: never[]) => number> = {
    args_sizes_get: (pn: number, pt: number) => tailles(args, pn, pt),
    args_get: (ptrs: number, buf: number) => ecrireChaines(args, ptrs, buf),
    environ_sizes_get: (pn: number, pt: number) => tailles(env, pn, pt),
    environ_get: (ptrs: number, buf: number) => ecrireChaines(env, ptrs, buf),

    fd_prestat_get: (fd: number, buf: number) => {
      const nom = preouverts.get(fd);
      if (nom === undefined) return E.BADF;
      const v = vue();
      v.setUint8(buf, 0);
      v.setUint32(buf + 4, new TextEncoder().encode(nom).length, true);
      return E.SUCCES;
    },
    fd_prestat_dir_name: (fd: number, ptr: number, len: number) => {
      const nom = preouverts.get(fd);
      if (nom === undefined) return E.BADF;
      octets().set(new TextEncoder().encode(nom).subarray(0, len), ptr);
      return E.SUCCES;
    },

    path_open: (dirfd: number, _dirflags: number, ptr: number, len: number, oflags: number, _rb: bigint, _ri: bigint, fdflags: number, pFd: number) => {
      const chemin = resoudre(dirfd, ptr, len);
      if (chemin === null) return E.BADF;
      const estDossier = fs.dossiers.has(chemin);
      if (oflags & 2 && !estDossier) return E.NOTDIR; // O_DIRECTORY
      if (!estDossier) {
        const existe = fs.fichiers.has(chemin);
        if (!existe && !(oflags & 1)) return E.NOENT; // O_CREAT
        if (existe && oflags & 1 && oflags & 4) return E.EXIST; // O_EXCL
        const parent = chemin.slice(0, chemin.lastIndexOf('/')) || '/';
        if (!fs.dossiers.has(parent)) return E.NOENT;
        if (!existe || oflags & 8) fs.fichiers.set(chemin, new Uint8Array(0)); // O_TRUNC
      }
      const fd = prochainFd++;
      fds.set(fd, { chemin, dossier: estDossier, position: 0, ajout: !!(fdflags & 1) });
      vue().setUint32(pFd, fd, true);
      return E.SUCCES;
    },
    fd_close: (fd: number) => (fds.delete(fd) || fd <= 2 ? E.SUCCES : E.BADF),

    fd_read: (fd: number, iovs: number, n: number, pLus: number) => {
      let total = 0;
      if (fd === 0) {
        for (const { buf, len } of iovecs(iovs, n)) {
          const morceau = entree.subarray(positionEntree, positionEntree + len);
          octets().set(morceau, buf);
          positionEntree += morceau.length;
          total += morceau.length;
          if (morceau.length < len) break;
        }
      } else {
        const d = fds.get(fd);
        if (!d) return E.BADF;
        if (d.dossier) return E.ISDIR;
        const contenu = fs.fichiers.get(d.chemin) ?? new Uint8Array(0);
        for (const { buf, len } of iovecs(iovs, n)) {
          const morceau = contenu.subarray(d.position, d.position + len);
          octets().set(morceau, buf);
          d.position += morceau.length;
          total += morceau.length;
          if (morceau.length < len) break;
        }
      }
      vue().setUint32(pLus, total, true);
      return E.SUCCES;
    },
    fd_write: (fd: number, iovs: number, n: number, pEcrits: number) => {
      let total = 0;
      for (const { buf, len } of iovecs(iovs, n)) {
        const donnees = octets().slice(buf, buf + len);
        total += len;
        if (fd === 1 || fd === 2) {
          ecrits += len;
          if (ecrits > limite) throw new SortieTropLongue();
          options.sortie?.(decodeurs[fd].decode(donnees, { stream: true }), fd);
        } else {
          const d = fds.get(fd);
          if (!d) return E.BADF;
          if (d.dossier) return E.ISDIR;
          const ancien = fs.fichiers.get(d.chemin) ?? new Uint8Array(0);
          const pos = d.ajout ? ancien.length : d.position;
          const nouveau = new Uint8Array(Math.max(ancien.length, pos + len));
          nouveau.set(ancien);
          nouveau.set(donnees, pos);
          fs.fichiers.set(d.chemin, nouveau);
          d.position = pos + len;
        }
      }
      vue().setUint32(pEcrits, total, true);
      return E.SUCCES;
    },
    fd_seek: (fd: number, decalage: bigint, depuis: number, pNouvelle: number) => {
      const d = fds.get(fd);
      if (!d || d.dossier) return fd <= 2 ? E.INVAL : E.BADF;
      const taille = fs.fichiers.get(d.chemin)?.length ?? 0;
      const base = depuis === 0 ? 0 : depuis === 1 ? d.position : taille;
      const pos = base + Number(decalage);
      if (pos < 0) return E.INVAL;
      d.position = pos;
      vue().setBigUint64(pNouvelle, BigInt(pos), true);
      return E.SUCCES;
    },
    fd_tell: (fd: number, p: number) => {
      const d = fds.get(fd);
      if (!d) return E.BADF;
      vue().setBigUint64(p, BigInt(d.position), true);
      return E.SUCCES;
    },
    fd_fdstat_get: (fd: number, buf: number) => {
      const d = fds.get(fd);
      if (fd > 2 && !d) return E.BADF;
      const v = vue();
      v.setUint8(buf, fd <= 2 ? TYPE.CARACTERES : d!.dossier ? TYPE.DOSSIER : TYPE.FICHIER);
      v.setUint16(buf + 2, 0, true);
      v.setBigUint64(buf + 8, 0xffffffffffffffffn, true);
      v.setBigUint64(buf + 16, 0xffffffffffffffffn, true);
      return E.SUCCES;
    },
    fd_filestat_get: (fd: number, buf: number) => {
      if (fd <= 2) {
        ecrireStat(buf, TYPE.CARACTERES, 0);
        return E.SUCCES;
      }
      const d = fds.get(fd);
      if (!d) return E.BADF;
      ecrireStat(buf, d.dossier ? TYPE.DOSSIER : TYPE.FICHIER, fs.fichiers.get(d.chemin)?.length ?? 0);
      return E.SUCCES;
    },
    path_filestat_get: (fd: number, _flags: number, ptr: number, len: number, buf: number) => {
      const chemin = resoudre(fd, ptr, len);
      if (chemin === null) return E.BADF;
      if (fs.dossiers.has(chemin)) ecrireStat(buf, TYPE.DOSSIER, 0);
      else if (fs.fichiers.has(chemin)) ecrireStat(buf, TYPE.FICHIER, fs.fichiers.get(chemin)!.length);
      else return E.NOENT;
      return E.SUCCES;
    },
    path_unlink_file: (fd: number, ptr: number, len: number) => {
      const chemin = resoudre(fd, ptr, len);
      if (chemin === null) return E.BADF;
      return fs.fichiers.delete(chemin) ? E.SUCCES : E.NOENT;
    },
    path_create_directory: (fd: number, ptr: number, len: number) => {
      const chemin = resoudre(fd, ptr, len);
      if (chemin === null) return E.BADF;
      fs.creerDossier(chemin);
      return E.SUCCES;
    },

    clock_time_get: (_id: number, _precision: bigint, p: number) => {
      vue().setBigUint64(p, BigInt(Date.now()) * 1_000_000n, true);
      return E.SUCCES;
    },
    clock_res_get: (_id: number, p: number) => {
      vue().setBigUint64(p, 1_000_000n, true);
      return E.SUCCES;
    },
    random_get: (buf: number, len: number) => {
      const o = octets();
      for (let i = 0; i < len; i++) o[buf + i] = Math.floor(Math.random() * 256);
      return E.SUCCES;
    },
    sched_yield: () => E.SUCCES,
    proc_exit: (code: number) => {
      throw new FinProgramme(code);
    },
  };

  // Toute autre fonction WASI demandée par le module répond « non disponible ».
  const imports: WebAssembly.Imports = {};
  for (const imp of WebAssembly.Module.imports(module)) {
    if (imp.kind !== 'function') continue;
    imports[imp.module] ??= {};
    (imports[imp.module] as Record<string, unknown>)[imp.name] =
      imp.module === 'wasi_snapshot_preview1' && wasi[imp.name] ? wasi[imp.name] : () => E.NOSYS;
  }

  const instance = new WebAssembly.Instance(module, imports);
  memoire = instance.exports.memory as WebAssembly.Memory;
  const vider = () => {
    for (const fd of [1, 2] as const) {
      const reste = decodeurs[fd].decode();
      if (reste) options.sortie?.(reste, fd);
    }
  };
  try {
    (instance.exports._start as () => void)();
    vider();
    return 0;
  } catch (e) {
    vider();
    if (e instanceof FinProgramme) return e.code;
    throw e;
  }
}
