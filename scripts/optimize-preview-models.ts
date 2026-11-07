/** Run after `npm run models`: remove sub-millimetre tessellation from smooth fixtures. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import type { ConvertedModel } from '../src/lib/preview/modelIndex.ts';

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
	'meshopt.decoder': MeshoptDecoder,
	'meshopt.encoder': MeshoptEncoder
});
const indexPath = 'static/models/index.json';
const index: ConvertedModel[] = JSON.parse(await readFile(indexPath, 'utf8'));
const triangles = (doc: Document) =>
	doc
		.getRoot()
		.listNodes()
		.reduce(
			(sum, node) =>
				sum +
				(node.getMesh()?.listPrimitives() ?? []).reduce(
					(n, p) => n + (p.getIndices() ?? p.getAttribute('POSITION')!).getCount() / 3,
					0
				),
			0
		);

// These models are predominantly smooth poles/shells. Preserve material/normal seams;
// stop at 0.05% geometric error even if the requested 90% reduction cannot be reached.
const sources = [
	{
		id: 'ikea-ps2014-lamp',
		original: '467ea32f2322e9922a6aca9f675ba6eff997a7241fd75940097bf5ee712fd624',
		optimized: '6fc359505485f14e6ab427c391c96b982c80c2eb49313065e131d2c412f32cbf'
	},
	{
		id: 'keyboard-stand',
		original: '124112d6baeadbe3794704a8bbae2d3f89affe325f8a5c3329fccfdffdbaa89a',
		optimized: 'cc89d5be75ac55e4148cef5e55774b711c589c9571cfe584b5bd79b858f8d5a0'
	}
];
for (const { id, original, optimized } of sources) {
	const path = `static/models/${id}.glb`;
	const hash = createHash('sha256')
		.update(await readFile(path))
		.digest('hex');
	if (hash === optimized) {
		console.log(`${id}: already optimized`);
		continue;
	}
	if (hash !== original)
		throw new Error(
			`${id}: source changed; review the optimization and its visual error before updating its hash`
		);
	const doc = await io.read(path);
	const before = triangles(doc);
	await doc.transform(
		weld(),
		simplify({ simplifier: MeshoptSimplifier, ratio: 0.1, error: 0.0005 }),
		prune(),
		meshopt({ encoder: MeshoptEncoder, level: 'high' })
	);
	const bytes = await io.writeBinary(doc);
	await writeFile(path, bytes);
	const entry = index.find((m) => m.id === id)!;
	entry.triangles = triangles(doc);
	entry.bytes = bytes.byteLength;
	console.log(`${id}: ${before} → ${entry.triangles} triangles (${bytes.byteLength} bytes)`);
}
await writeFile(indexPath, JSON.stringify(index, null, '\t') + '\n');
