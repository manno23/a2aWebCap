import { build } from 'bun';
import { join } from 'path';

const __dirname = import.meta.dir;

await build({
  entrypoints: [join(__dirname, 'src', 'index.ts')],
  outdir: join(__dirname, 'dist'),
  target: 'bun',
  format: 'esm',
  splitting: true,
  sourcemap: 'external',
  minify: {
    whitespace: true,
    syntax: true,
    identifiers: true,
  },
});

console.log('Shared package built successfully!');
