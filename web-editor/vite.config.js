import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds the tentap WebView editor into a SINGLE inlined HTML file.
// scripts/emit-html.mjs then wraps dist/index.html into mobile/src/editorHtml.js
// (a JS string module), which EditorScreen passes to useEditorBridge as customSource.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  // Force a single React copy — tentap peer-deps can pull a second react-dom,
  // which causes "invalid hook call" / ReactCurrentDispatcher errors at runtime.
  resolve: { dedupe: ['react', 'react-dom', '@tiptap/react'] },
  build: {
    target: 'es2015',
    outDir: 'dist',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
});
