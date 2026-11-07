/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

export default defineConfig({
	plugins: [
		{
			name: 'compressed-models',
			apply: 'build',
			async generateBundle() {
				if (this.environment.name !== 'client') return;
				for (const file of await readdir('static/models')) {
					if (!file.endsWith('.glb')) continue;
					this.emitFile({
						type: 'asset',
						fileName: `models/${file}.gz`,
						source: gzipSync(await readFile(`static/models/${file}`), { level: 9 })
					});
				}
			}
		},
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	test: {
		// Unit tests for pure logic only: no DOM, no three.js, no database
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
