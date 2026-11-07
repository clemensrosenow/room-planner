import { execFileSync } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
const files = [
	'src/lib/preview/PreviewScene.startup-baseline.ts',
	'src/lib/preview/startup-benchmark.js',
	'static/startup-benchmark.html',
	'src/lib/preview/startup-compare.js'
];
if (process.argv.includes('--clean')) {
	for (const path of files) await rm(path, { force: true });
} else {
	await writeFile(
		files[0],
		execFileSync('git', [
			'show',
			'dc280f217d0a6becfb6bbc41a1848e1481951e92:src/lib/preview/PreviewScene.ts'
		]),
		{ flag: 'wx' }
	);
	await writeFile(files[1], await readFile(new URL('./startup-quality.js', import.meta.url)), {
		flag: 'wx'
	});
	await writeFile(
		files[2],
		'<!doctype html><style>body{margin:0}#bench{width:390px;height:844px}</style><div id="bench"></div><script type="module" src="/src/lib/preview/startup-benchmark.js"></script>',
		{ flag: 'wx' }
	);
	const mobile = await readFile(new URL('./mobile.js', import.meta.url), 'utf8');
	await writeFile(
		files[3],
		mobile.slice(mobile.indexOf('export function compare('), mobile.indexOf('\nwindow.show =')),
		{ flag: 'wx' }
	);
}
