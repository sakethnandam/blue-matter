import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';

const watch = process.argv.includes('--watch');
const require = createRequire(import.meta.url);

// Copy sql.js WASM to out/ so it is reachable at runtime via __dirname.
// sql.js is hoisted to the workspace root node_modules by npm workspaces.
mkdirSync('out', { recursive: true });
const sqlJsMain = require.resolve('sql.js');
// sql.js main resolves to dist/sql-wasm.js; the WASM sits alongside it
const sqlJsWasm = path.join(path.dirname(sqlJsMain), 'sql-wasm.wasm');
if (!existsSync(sqlJsWasm)) {
  throw new Error(`sql-wasm.wasm not found at ${sqlJsWasm}. Run npm install first.`);
}
copyFileSync(sqlJsWasm, 'out/sql-wasm.wasm');

const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],        // provided by VS Code host — never bundle
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: false,            // no source maps — do not reveal source structure
  minify: !watch,
  logLevel: 'info',
});

if (watch) {
  await ctx.watch();
  console.log('[blue-matter] watching...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
