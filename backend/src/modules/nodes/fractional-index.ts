const BASE = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE_LEN = BASE.length;
const ZERO = BASE[0]!;

function charToVal(c: string): number {
  return BASE.indexOf(c);
}

function valToChar(v: number): string {
  return BASE[v]!;
}

function isEmpty(key: string | null | undefined): boolean {
  return key === null || key === undefined || key === '';
}

/**
 * Ponto médio entre `a` (string, possivelmente vazia = "-infinito") e `b` (`null` = "+infinito").
 * Invariante: nunca devolve uma chave terminada em ZERO. Sem isso, não haveria chave possível
 * antes dela (ex.: nada fica antes de '0'), e inserir no início quebraria.
 */
function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    if (a >= b) throw new Error(`keyBetween: limites inválidos (${a} >= ${b})`);
    // Remove o prefixo comum, tratando `a` como se fosse preenchido com ZERO à direita.
    let n = 0;
    while ((a[n] ?? ZERO) === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }

  const digitA = a ? charToVal(a[0]!) : 0;
  const digitB = b !== null ? charToVal(b[0]!) : BASE_LEN;

  if (digitB - digitA > 1) {
    return valToChar(Math.round(0.5 * (digitA + digitB)));
  }

  // Primeiros caracteres consecutivos.
  if (b !== null && b.length > 1) {
    // O primeiro caractere de `b` sozinho já é maior que `a` e menor que `b`.
    return b.slice(0, 1);
  }
  return valToChar(digitA) + midpoint(a.slice(1), null);
}

/**
 * Retorna uma chave lexicográfica estritamente entre `a` e `b`.
 * `null`/`undefined`/`''` representam ausência de limite (±infinito).
 * A chave usa base 62 e cresce em precisão quando necessário.
 */
export function keyBetween(a: string | null, b: string | null): string {
  const prev = isEmpty(a) ? '' : a!;
  const next = isEmpty(b) ? null : b!;
  return midpoint(prev, next);
}
