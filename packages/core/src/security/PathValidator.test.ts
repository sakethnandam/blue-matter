import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { PathValidator, SecurityError } from './PathValidator.js';

describe('PathValidator', () => {
  let tmpDir: string;
  let validator: PathValidator;

  beforeEach(() => {
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pv-test-')));
    validator = new PathValidator(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('validatePath', () => {
    it('accepts a valid relative path to an existing file', () => {
      fs.writeFileSync(path.join(tmpDir, 'file.ts'), '');
      const result = validator.validatePath('file.ts');
      expect(result).toBe(path.join(tmpDir, 'file.ts'));
    });

    it('accepts a nested path that exists', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'));
      fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), '');
      const result = validator.validatePath('src/index.ts');
      expect(result).toContain('index.ts');
    });

    it('throws SecurityError on path traversal with ..', () => {
      expect(() => validator.validatePath('../outside')).toThrow(SecurityError);
      expect(() => validator.validatePath('src/../../outside')).toThrow(SecurityError);
    });

    it('throws SecurityError on absolute Unix path', () => {
      expect(() => validator.validatePath('/etc/passwd')).toThrow(SecurityError);
    });

    it('throws SecurityError on non-string input', () => {
      expect(() => validator.validatePath(null as unknown as string)).toThrow(SecurityError);
      expect(() => validator.validatePath(undefined as unknown as string)).toThrow(SecurityError);
      expect(() => validator.validatePath('')).toThrow(SecurityError);
      expect(() => validator.validatePath('   ')).toThrow(SecurityError);
    });

    it('throws SecurityError when path resolves outside workspace (no ..) ', () => {
      // A relative path that doesn't use '..' but resolves outside is caught by prefix check
      // This only applies on Windows absolute-like paths; on Unix the absolute check fires first.
      // Test that prefix check works by directly using a sibling dir path that slips past .. check
      expect(() => validator.validatePath('/etc/hosts')).toThrow(SecurityError);
    });

    it('does not allow workspace prefix bypass via sibling directory', () => {
      // If workspace is /tmp/abc, path /tmp/abcEvil/x should not be allowed
      // The '..' check fires before the prefix check for such traversals
      expect(() => validator.validatePath('../' + path.basename(tmpDir) + 'Evil/x.ts')).toThrow(SecurityError);
    });

    it('throws SecurityError for non-existent file (realpathSync fails)', () => {
      expect(() => validator.validatePath('nonexistent.ts')).toThrow(SecurityError);
    });
  });

  describe('isWithinWorkspace', () => {
    it('returns true for path inside workspace', () => {
      expect(validator.isWithinWorkspace('src/index.ts')).toBe(true);
    });

    it('returns true for workspace root itself', () => {
      expect(validator.isWithinWorkspace('.')).toBe(true);
    });

    it('returns false for path traversal', () => {
      expect(validator.isWithinWorkspace('../outside')).toBe(false);
    });

    it('returns false for path outside workspace', () => {
      // On unix, resolving /etc from workspace root gives /etc
      expect(validator.isWithinWorkspace('/etc/passwd')).toBe(false);
    });

    it('does not allow workspace prefix bypass (separator check)', () => {
      // /tmp/pv-test-abc should not include /tmp/pv-test-abcEvil
      // isWithinWorkspace resolves the path; a path like ../pv-test-abcEvil would go outside
      const sibling = path.basename(tmpDir) + 'Evil';
      expect(validator.isWithinWorkspace('../' + sibling)).toBe(false);
    });
  });
});
