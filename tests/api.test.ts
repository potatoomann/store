import { describe, it, expect } from 'vitest';
import { hashToken, generateOpaqueToken } from '../lib/api';

// Minimal tests for helpers that don't depend on Next.js runtime

describe('token helpers', () => {
  it('hashToken produces stable sha256 hex', () => {
    const out = hashToken('abc');
    expect(out).toMatch(/^[a-f0-9]{64}$/);
    expect(out).toBe(hashToken('abc'));
    expect(out).not.toBe(hashToken('abcd'));
  });

  it('generateOpaqueToken returns hex of expected size', () => {
    const t = generateOpaqueToken(16); // 16 bytes -> 32 hex chars
    expect(t).toMatch(/^[a-f0-9]+$/);
    expect(t.length).toBe(32);
    expect(t).not.toBe(generateOpaqueToken(16));
  });
});
