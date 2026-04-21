import { describe, it, expect } from '@jest/globals';
import { PyCellParser } from './PyCellParser.js';

const parser = new PyCellParser();

// ---------------------------------------------------------------------------
// extractSymbols — basic cases (preserved from original test suite)
// ---------------------------------------------------------------------------

describe('PyCellParser.extractSymbols', () => {
  it('extracts simple imports', () => {
    const src = 'import pandas\nimport numpy as np';
    const { imports } = parser.extractSymbols(src);
    expect(imports).toContain('pandas');
    expect(imports).toContain('numpy as np');
  });

  it('extracts from-imports with alias', () => {
    const src = 'from sklearn.model_selection import train_test_split, cross_val_score';
    const { imports } = parser.extractSymbols(src);
    expect(imports).toEqual(['train_test_split, cross_val_score from sklearn.model_selection']);
  });

  it('extracts top-level function definitions', () => {
    const src = 'def clean_data(df):\n    return df\n\nasync def fetch(url):\n    pass';
    const { functions } = parser.extractSymbols(src);
    expect(functions).toContain('clean_data');
    expect(functions).toContain('fetch');
  });

  it('does not extract indented functions', () => {
    const src = 'class Foo:\n    def bar(self):\n        pass';
    const { functions } = parser.extractSymbols(src);
    expect(functions).not.toContain('bar');
  });

  it('extracts top-level class definitions', () => {
    const src = 'class DataProcessor(BaseProcessor):\n    pass';
    const { classes } = parser.extractSymbols(src);
    expect(classes).toContain('DataProcessor');
  });

  it('extracts top-level variable assignments', () => {
    const src = 'df = pd.read_csv("data.csv")\nmodel = RandomForest()';
    const { variables } = parser.extractSymbols(src);
    expect(variables).toContain('df');
    expect(variables).toContain('model');
  });

  it('does not extract indented variable assignments', () => {
    const src = 'def foo():\n    x = 1';
    const { variables } = parser.extractSymbols(src);
    expect(variables).not.toContain('x');
  });

  it('skips IPython magic lines', () => {
    const src = '%matplotlib inline\n!pip install sklearn\n%%timeit\nimport os';
    const { imports } = parser.extractSymbols(src);
    expect(imports).toContain('os');
    expect(imports.join('')).not.toContain('matplotlib');
  });

  it('deduplicates repeated symbols', () => {
    const src = 'import os\nimport os';
    const { imports } = parser.extractSymbols(src);
    expect(imports.filter((i) => i === 'os').length).toBe(1);
  });

  it('handles empty source', () => {
    const sym = parser.extractSymbols('');
    expect(sym.imports).toEqual([]);
    expect(sym.variables).toEqual([]);
    expect(sym.functions).toEqual([]);
    expect(sym.classes).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // AST upgrade — patterns that regex could not handle
  // -------------------------------------------------------------------------

  it('extracts multi-line parenthesized from-imports', () => {
    const src = [
      'from sklearn.model_selection import (',
      '    train_test_split,',
      '    cross_val_score,',
      '    GridSearchCV,',
      ')',
    ].join('\n');
    const { imports } = parser.extractSymbols(src);
    expect(imports).toHaveLength(1);
    expect(imports[0]).toContain('train_test_split');
    expect(imports[0]).toContain('cross_val_score');
    expect(imports[0]).toContain('GridSearchCV');
    expect(imports[0]).toContain('from sklearn.model_selection');
  });

  it('extracts type-annotated variable assignments', () => {
    const src = 'x: int = 5\nname: str = "alice"';
    const { variables } = parser.extractSymbols(src);
    expect(variables).toContain('x');
    expect(variables).toContain('name');
  });

  it('extracts decorated function definitions', () => {
    const src = '@staticmethod\ndef helper(x):\n    return x * 2';
    const { functions } = parser.extractSymbols(src);
    expect(functions).toContain('helper');
  });

  it('extracts decorated class definitions', () => {
    const src = '@dataclass\nclass Point:\n    x: float\n    y: float';
    const { classes } = parser.extractSymbols(src);
    expect(classes).toContain('Point');
  });

  it('extracts tuple-unpacking assignment targets', () => {
    const src = 'x, y = compute_coords()';
    const { variables } = parser.extractSymbols(src);
    expect(variables).toContain('x');
    expect(variables).toContain('y');
  });

  it('extracts starred unpacking targets', () => {
    const src = 'first, *rest, last = items';
    const { variables } = parser.extractSymbols(src);
    expect(variables).toContain('first');
    expect(variables).toContain('rest');
    expect(variables).toContain('last');
  });

  it('does not extract augmented assignment targets', () => {
    const src = 'counter += 1';
    const { variables } = parser.extractSymbols(src);
    expect(variables).not.toContain('counter');
  });
});

// ---------------------------------------------------------------------------
// isCellModeFile
// ---------------------------------------------------------------------------

describe('PyCellParser.isCellModeFile', () => {
  it('returns true for files with # %% markers', () => {
    expect(parser.isCellModeFile('# %%\nx = 1\n# %%\ny = 2')).toBe(true);
  });

  it('returns false for regular Python files', () => {
    expect(parser.isCellModeFile('import os\ndef foo():\n    pass')).toBe(false);
  });

  it('requires # %% at column 0', () => {
    expect(parser.isCellModeFile('    # %%\nx = 1')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseCellBoundaries
// ---------------------------------------------------------------------------

describe('PyCellParser.parseCellBoundaries', () => {
  it('returns empty array when no markers present', () => {
    expect(parser.parseCellBoundaries('import os\nx = 1')).toEqual([]);
  });

  it('creates an implicit cell 0 for content before first marker', () => {
    const src = 'import os\n# %%\nx = 1';
    const cells = parser.parseCellBoundaries(src);
    expect(cells[0]).toMatchObject({ startLine: 0, endLine: 0, kind: 'code' });
    expect(cells[1]).toMatchObject({ startLine: 1, kind: 'code' });
  });

  it('detects markdown cells via [markdown] tag', () => {
    const src = '# %% [markdown]\n# Header\n# %%\nx = 1';
    const cells = parser.parseCellBoundaries(src);
    expect(cells[0].kind).toBe('markup');
    expect(cells[1].kind).toBe('code');
  });

  it('extracts optional title from marker', () => {
    const src = '# %% Data Loading\nx = 1';
    const cells = parser.parseCellBoundaries(src);
    expect(cells[0].title).toBe('Data Loading');
  });

  it('assigns correct line ranges for multiple cells', () => {
    const lines = ['# %%', 'a = 1', 'b = 2', '# %%', 'c = 3'];
    const src = lines.join('\n');
    const cells = parser.parseCellBoundaries(src);
    expect(cells[0]).toMatchObject({ startLine: 0, endLine: 2 });
    expect(cells[1]).toMatchObject({ startLine: 3, endLine: 4 });
  });
});

// ---------------------------------------------------------------------------
// getCellAtLine
// ---------------------------------------------------------------------------

describe('PyCellParser.getCellAtLine', () => {
  const cells = [
    { startLine: 0, endLine: 2, kind: 'code' as const },
    { startLine: 3, endLine: 5, kind: 'markup' as const },
  ];

  it('returns the correct cell for a line in the first cell', () => {
    expect(parser.getCellAtLine(cells, 1)).toBe(cells[0]);
  });

  it('returns the correct cell for a line in the second cell', () => {
    expect(parser.getCellAtLine(cells, 4)).toBe(cells[1]);
  });

  it('returns null for a line beyond all cells', () => {
    expect(parser.getCellAtLine(cells, 10)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getCellSource
// ---------------------------------------------------------------------------

describe('PyCellParser.getCellSource', () => {
  it('strips the # %% marker line', () => {
    const lines = ['# %%', 'x = 1', 'y = 2'];
    const cell = { startLine: 0, endLine: 2, kind: 'code' as const };
    const source = parser.getCellSource(lines, cell);
    expect(source).toBe('x = 1\ny = 2');
  });

  it('keeps source intact when cell does not start with a marker', () => {
    const lines = ['import os', 'x = 1'];
    const cell = { startLine: 0, endLine: 1, kind: 'code' as const };
    const source = parser.getCellSource(lines, cell);
    expect(source).toBe('import os\nx = 1');
  });
});
