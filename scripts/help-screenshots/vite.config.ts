import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

/** The real studio, with the sign-in and database replaced by the sample data in this folder. */
const root = path.resolve(__dirname, '../..');
export default defineConfig({
  root,
  plugins: [react(), tailwindcss(), {
    name: 'help-screenshot-data',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || importer.includes('help-screenshots') || !source.endsWith('supabase')) return;
      const target = source.startsWith('.') ? path.resolve(path.dirname(importer), source) : source;
      if (target === path.join(root, 'src/services/supabase')) return path.resolve(__dirname, 'supabaseMock.ts');
    },
  }],
  server: { port: 5299, strictPort: true, hmr: false },
});
