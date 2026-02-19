/**
 * Unit tests for PathValidator
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PathValidator, SecurityError } from '../../../src/security/PathValidator';

describe('PathValidator', () => {
  let workspaceRoot: string;
  let validator: PathValidator;

  beforeAll(() => {
    workspaceRoot = path.join(process.cwd(), 'tmp-path-validator-' + Date.now());
    fs.mkdirSync(workspaceRoot, { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, 'file.txt'), 'content');
    validator = new PathValidator(workspaceRoot);
  });

  afterAll(() => {
    try {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('validatePath', () => {
    it('returns resolved path for valid relative path', () => {
      const result = validator.validatePath('file.txt');
      expect(result).toContain('file.txt');
      expect(result).toContain(workspaceRoot);
    });

    it('throws SecurityError for empty path', () => {
      expect(() => validator.validatePath('')).toThrow(SecurityError);
      expect(() => validator.validatePath('   ')).toThrow(SecurityError);
    });

    it('throws SecurityError for path traversal', () => {
      expect(() => validator.validatePath('../other')).toThrow('Path traversal not allowed');
    });

    it('throws SecurityError for absolute path', () => {
      expect(() => validator.validatePath('/etc/passwd')).toThrow('Absolute paths not allowed');
    });
  });

  describe('isWithinWorkspace', () => {
    it('returns true for path in workspace', () => {
      expect(validator.isWithinWorkspace('file.txt')).toBe(true);
    });

    it('returns false for path outside workspace', () => {
      expect(validator.isWithinWorkspace('../../../etc')).toBe(false);
    });
  });
});
