import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'es2023',
  platform: 'node',
  splitting: false,
  treeshake: true,
  minify: false,
  external: ['protobufjs', 'long', 'rxjs'],
})
