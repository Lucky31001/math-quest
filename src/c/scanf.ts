/**
 * `scanf` de remplacement pour le compilateur du navigateur (xcc).
 *
 * La bibliothèque C de xcc gère mal `scanf` : `%s` déborde (voire plante),
 * `%c` et `%[…]` ne lisent rien, et en fin d'entrée elle renvoie 0 au lieu de
 * EOF (`while (scanf(…) != EOF)` boucle alors à l'infini). Quand un programme
 * utilise scanf/fscanf/sscanf, on compile en plus cette implémentation (en C,
 * sur getc/ungetc/strtol/strtod qui fonctionnent) dans un fichier séparé, et
 * les appels sont renommés par le préprocesseur (-Dscanf=mq_scanf…). Le code
 * de l'élève n'est pas modifié : les erreurs gardent ses numéros de ligne.
 *
 * Vérifiée par comparaison avec la glibc (gcc) : tests/atelier-c.test.ts.
 */

/** Fichier C compilé avec le programme (les -D renomment aussi les déclarations de stdio.h). */
export const SOURCE_SCANF = String.raw`#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <ctype.h>

/* Math Quest : scanf de remplacement (voir src/c/scanf.ts). */
typedef struct { FILE *f; const char *s; int lus; } MqSource;

static int mq_get(MqSource *src) {
    int c = src->f ? getc(src->f) : (*src->s ? (unsigned char)*src->s++ : EOF);
    if (c != EOF) src->lus++;
    return c;
}

static void mq_unget(MqSource *src, int c) {
    if (c == EOF) return;
    src->lus--;
    if (src->f) ungetc(c, src->f);
    else src->s--;
}

static int mq_chiffre(int c, int base) {
    if (base == 16) return isxdigit(c);
    if (base == 8) return c >= '0' && c <= '7';
    return isdigit(c);
}

static int mq_vscan(MqSource *src, const char *f, va_list ap) {
    int assignes = 0, conversions = 0, c;
    while (*f) {
        if (isspace((unsigned char)*f)) {
            while (isspace((unsigned char)*f)) f++;
            while ((c = mq_get(src)) != EOF && isspace(c)) {}
            mq_unget(src, c);
            continue;
        }
        if (*f != '%' || f[1] == '%') {
            if (*f == '%') f++;
            c = mq_get(src);
            if (c == EOF) return conversions ? assignes : EOF;
            if (c != (unsigned char)*f) { mq_unget(src, c); return assignes; }
            f++;
            continue;
        }
        f++;
        int supprime = 0, largeur = 0, taille = 0;
        if (*f == '*') { supprime = 1; f++; }
        while (isdigit((unsigned char)*f)) largeur = largeur * 10 + (*f++ - '0');
        if (*f == 'h') { taille = -1; f++; if (*f == 'h') { taille = -2; f++; } }
        else if (*f == 'l') { taille = 1; f++; if (*f == 'l') { taille = 2; f++; } }
        else if (*f == 'L' || *f == 'z' || *f == 'j' || *f == 't') { taille = 1; f++; }
        char conv = *f++;
        if (conv == 'n') {
            if (!supprime) *va_arg(ap, int *) = src->lus;
            continue;
        }
        if (conv != 'c' && conv != '[') {
            while ((c = mq_get(src)) != EOF && isspace(c)) {}
            mq_unget(src, c);
        }
        if (conv == 'c') {
            if (largeur == 0) largeur = 1;
            char *dest = supprime ? NULL : va_arg(ap, char *);
            int i = 0;
            for (; i < largeur; i++) {
                c = mq_get(src);
                if (c == EOF) break;
                if (dest) dest[i] = (char)c;
            }
            if (i == 0) return conversions ? assignes : EOF;
            if (i < largeur) return assignes;
            conversions++;
            if (dest) assignes++;
        } else if (conv == 's' || conv == '[') {
            char ensemble[256] = {0};
            int inverse = 0;
            if (conv == '[') {
                if (*f == '^') { inverse = 1; f++; }
                if (*f == ']') { ensemble[']'] = 1; f++; }
                while (*f && *f != ']') {
                    if (f[1] == '-' && f[2] && f[2] != ']') {
                        for (int k = (unsigned char)f[0]; k <= (unsigned char)f[2]; k++) ensemble[k] = 1;
                        f += 3;
                    } else ensemble[(unsigned char)*f++] = 1;
                }
                if (*f == ']') f++;
            }
            char *dest = supprime ? NULL : va_arg(ap, char *);
            int i = 0;
            while (largeur == 0 || i < largeur) {
                c = mq_get(src);
                if (c == EOF) break;
                int accepte = conv == 's' ? !isspace(c) : (ensemble[c] != inverse);
                if (!accepte) { mq_unget(src, c); break; }
                if (dest) dest[i] = (char)c;
                i++;
            }
            if (i == 0) return (c == EOF && !conversions) ? EOF : assignes;
            if (dest) { dest[i] = '\0'; assignes++; }
            conversions++;
        } else if (conv == 'f' || conv == 'e' || conv == 'g' || conv == 'a' || conv == 'E' || conv == 'G' || conv == 'F') {
            char tampon[128];
            int i = 0, max = largeur && largeur < 127 ? largeur : 127, chiffres = 0;
            c = mq_get(src);
            if ((c == '+' || c == '-') && i < max) { tampon[i++] = (char)c; c = mq_get(src); }
            while (isdigit(c) && i < max) { tampon[i++] = (char)c; chiffres++; c = mq_get(src); }
            if (c == '.' && i < max) {
                tampon[i++] = (char)c; c = mq_get(src);
                while (isdigit(c) && i < max) { tampon[i++] = (char)c; chiffres++; c = mq_get(src); }
            }
            if (chiffres && (c == 'e' || c == 'E') && i < max) {
                tampon[i++] = (char)c; c = mq_get(src);
                if ((c == '+' || c == '-') && i < max) { tampon[i++] = (char)c; c = mq_get(src); }
                while (isdigit(c) && i < max) { tampon[i++] = (char)c; c = mq_get(src); }
            }
            mq_unget(src, c);
            if (!chiffres) return (c == EOF && !conversions) ? EOF : assignes;
            tampon[i] = '\0';
            double v = strtod(tampon, NULL);
            if (!supprime) {
                if (taille >= 1) *va_arg(ap, double *) = v;
                else *va_arg(ap, float *) = (float)v;
                assignes++;
            }
            conversions++;
        } else if (conv == 'd' || conv == 'i' || conv == 'u' || conv == 'x' || conv == 'X' || conv == 'o' || conv == 'p') {
            char tampon[128];
            int i = 0, max = largeur && largeur < 127 ? largeur : 127, chiffres = 0;
            int base = (conv == 'x' || conv == 'X' || conv == 'p') ? 16 : conv == 'o' ? 8 : 10;
            c = mq_get(src);
            if ((c == '+' || c == '-') && i < max) { tampon[i++] = (char)c; c = mq_get(src); }
            if (c == '0' && (base == 16 || conv == 'i') && i < max) {
                tampon[i++] = (char)c; chiffres++; c = mq_get(src);
                /* Préfixe 0x : on ne le garde pas (le strtoll de xcc ne l'accepte pas en base 16). */
                if ((c == 'x' || c == 'X') && i < max) { base = 16; i--; chiffres--; c = mq_get(src); }
                else if (conv == 'i') base = 8;
            }
            while (mq_chiffre(c, base) && i < max) { tampon[i++] = (char)c; chiffres++; c = mq_get(src); }
            mq_unget(src, c);
            if (!chiffres) return (c == EOF && !conversions) ? EOF : assignes;
            tampon[i] = '\0';
            if (!supprime) {
                if (conv == 'd' || conv == 'i') {
                    long long v = strtoll(tampon, NULL, base);
                    if (taille == 2) *va_arg(ap, long long *) = v;
                    else if (taille == 1) *va_arg(ap, long *) = (long)v;
                    else if (taille == -1) *va_arg(ap, short *) = (short)v;
                    else if (taille == -2) *va_arg(ap, signed char *) = (signed char)v;
                    else *va_arg(ap, int *) = (int)v;
                } else {
                    unsigned long long v = strtoull(tampon, NULL, base);
                    if (conv == 'p') *va_arg(ap, void **) = (void *)(unsigned long)v;
                    else if (taille == 2) *va_arg(ap, unsigned long long *) = v;
                    else if (taille == 1) *va_arg(ap, unsigned long *) = (unsigned long)v;
                    else if (taille == -1) *va_arg(ap, unsigned short *) = (unsigned short)v;
                    else if (taille == -2) *va_arg(ap, unsigned char *) = (unsigned char)v;
                    else *va_arg(ap, unsigned *) = (unsigned)v;
                }
                assignes++;
            }
            conversions++;
        } else {
            return assignes; /* conversion inconnue */
        }
    }
    return assignes;
}

int mq_scanf(const char *f, ...) {
    MqSource src = { stdin, NULL, 0 };
    va_list ap;
    va_start(ap, f);
    int r = mq_vscan(&src, f, ap);
    va_end(ap);
    return r;
}

int mq_fscanf(FILE *fl, const char *f, ...) {
    MqSource src = { fl, NULL, 0 };
    va_list ap;
    va_start(ap, f);
    int r = mq_vscan(&src, f, ap);
    va_end(ap);
    return r;
}

int mq_sscanf(const char *s, const char *f, ...) {
    MqSource src = { NULL, s, 0 };
    va_list ap;
    va_start(ap, f);
    int r = mq_vscan(&src, f, ap);
    va_end(ap);
    return r;
}
`;

const UTILISE_SCANF = /\b[fs]?scanf\s*\(/;

/** Nom du fichier ajouté à la compilation. */
export const FICHIER_SCANF = 'mq_scanf.c';

/** Le programme a-t-il besoin du scanf de remplacement ? */
export const utiliseScanf = (source: string): boolean => UTILISE_SCANF.test(source);

/** Options du compilateur qui renomment les appels. */
export const DEFINITIONS_SCANF = ['-Dscanf=mq_scanf', '-Dfscanf=mq_fscanf', '-Dsscanf=mq_sscanf'];
