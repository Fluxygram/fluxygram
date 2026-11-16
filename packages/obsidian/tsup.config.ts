import { defineConfig } from 'tsup';

// Obsidian loads a single CommonJS main.js next to manifest.json; `obsidian` is provided by the app.
export default defineConfig({
  entry: { main: 'src/main.ts' },
  format: 'cjs',
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  external: ['obsidian'],
  noExternal: [/^@fluxygram\//, 'lucide'],
  target: 'es2020',
  minify: true,
  clean: true,
  onSuccess: 'node -e "require(\'fs\').copyFileSync(\'manifest.json\',\'dist/manifest.json\')"',
});
