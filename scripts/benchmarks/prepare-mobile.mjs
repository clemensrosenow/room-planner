// Temporary, isolated benchmark inputs. Never serve benchmark files in a production build.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';

const baseline = '4478db13b0c21f8ac58297b139057aaf2cad2210';
const files = ['PreviewScene', 'AntialiasedRenderPass', 'models', 'modelLoader'];
const generated = files.map((name) => `src/lib/preview/${name}.baseline.ts`);
generated.push(
	'src/lib/preview/mobile-benchmark.js',
	'static/mobile-benchmark.html',
	'static/benchmark-models'
);
if (process.argv.includes('--clean')) {
	for (const path of generated) await rm(path, { recursive: true, force: true });
} else {
	for (const name of files) {
		let source = execFileSync('git', ['show', `${baseline}:src/lib/preview/${name}.ts`], {
			encoding: 'utf8'
		});
		for (const dependency of files)
			source = source.replaceAll(`from './${dependency}'`, `from './${dependency}.baseline'`);
		if (name === 'modelLoader')
			source = source.replace('`/models/${id}.glb`', '`/benchmark-models/${id}.glb`');
		await writeFile(`src/lib/preview/${name}.baseline.ts`, source, { flag: 'wx' });
	}
	await mkdir('static/benchmark-models', { recursive: true });
	const assets = execFileSync('git', ['ls-tree', '--name-only', `${baseline}:static/models`], {
		encoding: 'utf8'
	})
		.trim()
		.split('\n');
	for (const asset of assets.filter((file) => file.endsWith('.glb'))) {
		await writeFile(
			`static/benchmark-models/${asset}`,
			execFileSync('git', ['show', `${baseline}:static/models/${asset}`], {
				maxBuffer: 16 * 1024 * 1024
			}),
			{ flag: 'wx' }
		);
	}
	await writeFile(
		'src/lib/preview/mobile-benchmark.js',
		await readFile('scripts/benchmarks/mobile.js'),
		{ flag: 'wx' }
	);
	await writeFile(
		'static/mobile-benchmark.html',
		await readFile('scripts/benchmarks/mobile.html'),
		{ flag: 'wx' }
	);
}
