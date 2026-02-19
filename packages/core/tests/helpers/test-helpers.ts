/**
 * Test helpers and factories for unit tests
 */

import type { UntitledConfig } from '../../src/models/Config';
import { DEFAULT_RATE_LIMITS, DEFAULT_INDEXING_CONFIG } from '../../src/models/Config';

export const TEST_USER_ID = 'test-user-1';
export const TEST_STORAGE_PATH = '/tmp/untitled-test';
export const TEST_WORKSPACE_ROOT = '/tmp/untitled-workspace';

/**
 * Creates a minimal test configuration
 */
export function createTestConfig(overrides: Partial<UntitledConfig> = {}): UntitledConfig {
  return {
    userId: TEST_USER_ID,
    storagePath: TEST_STORAGE_PATH,
    workspaceRoot: TEST_WORKSPACE_ROOT,
    apiKey: 'sk-or-v1-test-key-not-real',
    aiProvider: 'openrouter',
    openRouterModel: 'nvidia/nemotron-3-nano-30b-a3b:free',
    cacheStrategy: 'balanced',
    privacyMode: 'standard',
    rateLimits: { ...DEFAULT_RATE_LIMITS },
    indexing: { ...DEFAULT_INDEXING_CONFIG },
    ...overrides,
  };
}

/**
 * Creates a mock database interface for testing
 */
export function createMockDatabase() {
  const storage = new Map<string, unknown[]>();
  return {
    get: jest.fn(<T>(sql: string, ...params: unknown[]): T | undefined => {
      const key = JSON.stringify({ sql, params });
      const rows = storage.get(key);
      return rows?.[0] as T | undefined;
    }),
    all: jest.fn(<T>(sql: string, ...params: unknown[]): T[] => {
      const key = JSON.stringify({ sql, params });
      return (storage.get(key) ?? []) as T[];
    }),
    run: jest.fn((_sql: string, ..._params: unknown[]) => {
      return { changes: 1, lastInsertRowid: 1 };
    }),
    _setResult: (sql: string, params: unknown[], result: unknown | unknown[]) => {
      const key = JSON.stringify({ sql, params });
      storage.set(key, Array.isArray(result) ? result : [result]);
    },
  };
}

/**
 * Simple code sample for testing
 */
export const SAMPLE_CODE = `
function hello(name) {
  return "Hello, " + name;
}
`;

/**
 * Malicious code sample for security testing - should never be executed
 */
export const MALICIOUS_CODE = `
require('child_process').execSync('rm -rf /');
console.log('pwned');
`;
