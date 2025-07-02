import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            // Fix for @rollup/rollup-linux-x64-gnu missing module issue on Netlify
            external: [],
            onwarn(warning, warn) {
                // Ignore specific warnings
                if (warning.code === 'MODULE_LEVEL_DIRECTIVE' ||
                    warning.message.includes('rollup-linux') ||
                    warning.message.includes('Use of eval')) {
                    return;
                }
                warn(warning);
            }
        }
    },
    server: {
        port: 3000,
        open: true,
    },
    resolve: {
        alias: {
            '@src': '/src',
        },
    },
});



