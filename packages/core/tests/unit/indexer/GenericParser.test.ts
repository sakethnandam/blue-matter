/**
 * Unit tests for GenericParser (replaces PythonParser - GenericParser handles JS/TS/Python)
 */
import { GenericParser } from '../../../src/indexer/parsers/GenericParser';

describe('GenericParser', () => {
  let parser: GenericParser;

  beforeAll(() => {
    parser = new GenericParser();
  });

  describe('Python parsing', () => {
    test('extracts basic function', () => {
      const code = `
def hello_world():
    """Says hello to the world."""
    print("Hello, world!")
`;
      const result = parser.parse(code, 'test.py');
      expect(result.symbols.length).toBeGreaterThanOrEqual(1);
      const func = result.symbols.find((s) => s.name === 'hello_world');
      expect(func).toBeDefined();
      expect(func?.type).toBe('function');
    });

    test('extracts async function', () => {
      const code = `
async def fetch_data(url: str, timeout: int = 30) -> dict:
    pass
`;
      const result = parser.parse(code, 'test.py');
      const func = result.symbols.find((s) => s.name === 'fetch_data');
      expect(func).toBeDefined();
      expect(func?.type).toBe('function');
    });

    test('extracts class', () => {
      const code = `
class User:
    def __init__(self, name: str):
        self.name = name
`;
      const result = parser.parse(code, 'test.py');
      const cls = result.symbols.find((s) => s.type === 'class');
      expect(cls).toBeDefined();
      expect(cls?.name).toBe('User');
    });

    test('extracts imports', () => {
      const code = `
import os
from typing import List, Dict
`;
      const result = parser.parse(code, 'test.py');
      expect(result.imports).toContain('os');
      expect(result.imports).toContain('List');
      expect(result.imports).toContain('Dict');
    });
  });

  describe('JavaScript/TypeScript parsing', () => {
    test('extracts function', () => {
      const code = 'function add(a, b) { return a + b; }';
      const result = parser.parse(code, 'test.js');
      const func = result.symbols.find((s) => s.name === 'add');
      expect(func).toBeDefined();
      expect(func?.type).toBe('function');
    });

    test('extracts class', () => {
      const code = 'class MyClass { constructor() {} }';
      const result = parser.parse(code, 'test.ts');
      const cls = result.symbols.find((s) => s.type === 'class');
      expect(cls).toBeDefined();
      expect(cls?.name).toBe('MyClass');
    });
  });
});
