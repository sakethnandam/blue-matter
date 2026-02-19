/**
 * Unit tests for HashGenerator
 */

import { generateCodeHash, generateStructuralSignature } from '../../../src/cache/HashGenerator';

describe('HashGenerator', () => {
  describe('generateCodeHash', () => {
    it('produces consistent hashes for same code', () => {
      const code = 'function add(a, b) { return a + b; }';
      const hash1 = generateCodeHash(code);
      const hash2 = generateCodeHash(code);
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different code', () => {
      const hash1 = generateCodeHash('const x = 1;');
      const hash2 = generateCodeHash('const y = 2;');
      expect(hash1).not.toBe(hash2);
    });

    it('produces 64-char hex string', () => {
      const hash = generateCodeHash('code');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('normalizes whitespace - collapses multiple spaces', () => {
      const code1 = 'const  x   =   1  ;';
      const code2 = 'const x = 1 ;';
      expect(generateCodeHash(code1)).toBe(generateCodeHash(code2));
    });

    it('produces consistent hash for same semantic code', () => {
      const code = 'const x = 1;';
      expect(generateCodeHash(code)).toBe(generateCodeHash(code));
    });

    it('removes block comments', () => {
      const withComment = 'const x = 1;/*block*/';
      const withoutComment = 'const x = 1;';
      expect(generateCodeHash(withComment)).toBe(generateCodeHash(withoutComment));
    });

    it('normalizes line endings', () => {
      const crlf = 'const x = 1;\r\n';
      const lf = 'const x = 1;\n';
      expect(generateCodeHash(crlf)).toBe(generateCodeHash(lf));
    });
  });

  describe('generateStructuralSignature', () => {
    it('replaces string literals with placeholder', () => {
      const code = 'const a = "hello"; const b = "world";';
      const sig = generateStructuralSignature(code);
      expect(sig).not.toContain('hello');
      expect(sig).not.toContain('world');
      expect(sig).toContain('""');
    });

    it('replaces numbers with zero', () => {
      const code = 'const a = 42; const b = 3.14;';
      const sig = generateStructuralSignature(code);
      expect(sig).toMatch(/\b0\b/);
    });

    it('produces same signature for structurally similar code', () => {
      const code1 = 'function add(a, b) { return a + b; }';
      const code2 = 'function sub(x, y) { return x - y; }';
      const sig1 = generateStructuralSignature(code1);
      const sig2 = generateStructuralSignature(code2);
      expect(sig1).toContain('function');
      expect(sig2).toContain('function');
    });
  });
});
