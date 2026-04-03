import { describe, it, expect } from '@jest/globals';
import { NotebookContextBuilder } from './NotebookContextBuilder.js';
import type { NotebookCellContext } from '../models/Context.js';

const builder = new NotebookContextBuilder();

function makeCtx(cells: Array<{ kind: 'code' | 'markup'; source: string }>, activeCellIndex: number): NotebookCellContext {
  return {
    cellIndex: activeCellIndex,
    cellKind: 'code',
    totalCells: cells.length + 1,
    precedingCells: cells.map((c, i) => ({ index: i, kind: c.kind, source: c.source })),
  };
}

describe('NotebookContextBuilder.buildSummary', () => {
  it('returns empty string when there are no preceding cells', () => {
    const ctx: NotebookCellContext = {
      cellIndex: 0,
      cellKind: 'code',
      totalCells: 1,
      precedingCells: [],
    };
    expect(builder.buildSummary(ctx)).toBe('');
  });

  it('returns empty string when preceding cells have no extractable symbols', () => {
    const ctx = makeCtx([{ kind: 'code', source: '# just a comment\npass' }], 1);
    expect(builder.buildSummary(ctx)).toBe('');
  });

  it('includes imports in summary', () => {
    const ctx = makeCtx([{ kind: 'code', source: 'import pandas as pd\nimport numpy as np' }], 1);
    const summary = builder.buildSummary(ctx);
    expect(summary).toContain('imports');
    expect(summary).toContain('pandas as pd');
  });

  it('includes function names in summary', () => {
    const ctx = makeCtx([{ kind: 'code', source: 'def clean_data(df):\n    return df' }], 1);
    const summary = builder.buildSummary(ctx);
    expect(summary).toContain('clean_data');
  });

  it('includes class names in summary', () => {
    const ctx = makeCtx([{ kind: 'code', source: 'class MyModel:\n    pass' }], 1);
    const summary = builder.buildSummary(ctx);
    expect(summary).toContain('MyModel');
  });

  it('includes top-level variable assignments in summary', () => {
    const ctx = makeCtx([{ kind: 'code', source: 'df = pd.read_csv("data.csv")\nX = df.drop("target", axis=1)' }], 1);
    const summary = builder.buildSummary(ctx);
    expect(summary).toContain('assigns');
    expect(summary).toContain('df');
  });

  it('skips markup cells entirely', () => {
    const ctx = makeCtx(
      [
        { kind: 'markup', source: '# Title\nThis is documentation.' },
        { kind: 'code', source: 'import os' },
      ],
      2
    );
    const summary = builder.buildSummary(ctx);
    // Markup cell content should not appear in the summary
    expect(summary).not.toContain('Title');
    expect(summary).not.toContain('documentation');
    expect(summary).toContain('os');
  });

  it('labels each cell by its index', () => {
    const ctx = makeCtx(
      [
        { kind: 'code', source: 'import pandas as pd' },
        { kind: 'code', source: 'df = pd.read_csv("data.csv")' },
      ],
      2
    );
    const summary = builder.buildSummary(ctx);
    expect(summary).toContain('Cell 0');
    expect(summary).toContain('Cell 1');
  });

  it('caps output at MAX_SUMMARY_CHARS', () => {
    // Create a cell with many imports to generate a long summary
    const imports = Array.from({ length: 100 }, (_, i) => `import module_${i}`).join('\n');
    const ctx = makeCtx([{ kind: 'code', source: imports }], 1);
    const summary = builder.buildSummary(ctx);
    expect(summary.length).toBeLessThanOrEqual(2000);
  });
});

describe('NotebookContextBuilder.buildSummaryHash', () => {
  it('returns a 64-char hex string', () => {
    const ctx = makeCtx([{ kind: 'code', source: 'import os' }], 1);
    const hash = builder.buildSummaryHash(ctx);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces the same hash for structurally identical preceding cells', () => {
    const ctx1 = makeCtx([{ kind: 'code', source: 'import pandas as pd' }], 1);
    const ctx2 = makeCtx([{ kind: 'code', source: 'import pandas as pd' }], 1);
    expect(builder.buildSummaryHash(ctx1)).toBe(builder.buildSummaryHash(ctx2));
  });

  it('produces different hash when imports change', () => {
    const ctx1 = makeCtx([{ kind: 'code', source: 'import pandas as pd' }], 1);
    const ctx2 = makeCtx([{ kind: 'code', source: 'import numpy as np' }], 1);
    expect(builder.buildSummaryHash(ctx1)).not.toBe(builder.buildSummaryHash(ctx2));
  });

  it('produces the same hash when only comments change (cache-stable)', () => {
    // Changing a comment in a prior cell must NOT invalidate downstream cache entries.
    // The summary only includes imports/functions/classes/variables — not comments.
    const ctx1 = makeCtx([{ kind: 'code', source: '# old comment\nimport os' }], 1);
    const ctx2 = makeCtx([{ kind: 'code', source: '# new comment\nimport os' }], 1);
    expect(builder.buildSummaryHash(ctx1)).toBe(builder.buildSummaryHash(ctx2));
  });
});
