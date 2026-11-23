import { describe, expect, it } from 'vitest';
import { keyBetween } from '../src/modules/nodes/fractional-index.js';

describe('keyBetween', () => {
  it('gera primeira chave entre vazios, sem usar o menor caractere', () => {
    const first = keyBetween(null, null);
    expect(first.length).toBeGreaterThan(0);
    expect(first.endsWith('0')).toBe(false);
  });

  it('permite inserir antes da primeira chave, repetidamente', () => {
    let first = keyBetween(null, null);
    for (let i = 0; i < 200; i++) {
      const before = keyBetween(null, first);
      expect(before < first).toBe(true);
      expect(before.endsWith('0')).toBe(false);
      first = before;
    }
  });

  it('permite inserir entre duas chaves adjacentes, repetidamente', () => {
    const a = keyBetween(null, null);
    let b = keyBetween(a, null);
    for (let i = 0; i < 200; i++) {
      const mid = keyBetween(a, b);
      expect(mid > a).toBe(true);
      expect(mid < b).toBe(true);
      b = mid;
    }
  });

  it('gera chave depois de outra', () => {
    const a = keyBetween(null, null);
    const b = keyBetween(a, null);
    expect(b > a).toBe(true);
  });

  it('gera chave entre duas existentes', () => {
    const a = keyBetween(null, null); // '0'
    const c = keyBetween(a, null); // depois de '0'
    const b = keyBetween(a, c);
    expect(b > a).toBe(true);
    expect(b < c).toBe(true);
  });

  it('gera muitas chaves ordenadas', () => {
    let prev: string | null = null;
    const keys: string[] = [];
    for (let i = 0; i < 100; i++) {
      const key = keyBetween(prev, null);
      keys.push(key);
      prev = key;
    }
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]! > keys[i - 1]!).toBe(true);
    }
  });
});
