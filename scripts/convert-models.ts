/**
 * Converts the raw furniture models in `/models` (zip/rar archives with SketchUp .dae or .fbx)
 * into small, normalized GLBs in `static/models/`.
 *
 * Requires the `assimp` CLI (brew install assimp). Run with `npm run models`.
 *
 * Every output follows the `buildFurniture` convention: meters, y up, origin at floor center
 * (ceiling pieces: at the top center, where they hang), width along x, front facing +z. Front
 * direction can't be detected, so each source has a `turn` that is checked by eye in the app.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	Document,
	NodeIO,
	Primitive,
	getBounds,
	type mat4,
	type Node,
	type vec4
} from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
	center,
	dedup,
	flatten,
	instance,
	join as joinPrimitives,
	meshopt,
	prune,
	simplify,
	transformMesh,
	weld
} from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { Matrix4 } from 'three';
import type { ConvertedModel } from '../src/lib/preview/modelIndex.ts';

interface Source {
	id: string;
	archive: string;
	/** Model file inside the archive. */
	entry: string;
	/** Keep only the subtree whose node name starts with this (for files holding several variants). */
	keep?: string;
	/** Extra scale when assimp doesn't apply the file's units (FBX). */
	scale?: number;
	/** Real width in cm (x, after `turn`); scales the model uniformly to match. */
	width?: number;
	/** Degrees around y that turn the model's front to +z. */
	turn?: 0 | 90 | 180 | 270;
	/** Where the origin goes: floor center (default) or top center for hanging pieces. */
	mount?: 'floor' | 'ceiling';
	/**
	 * Shortens a pole or cable to match the real piece: cuts out a horizontal slab starting `at` cm
	 * above the model's bottom so the whole model ends up `height` cm tall. The slab must only cross
	 * the pole, so the parts above and below keep their shape.
	 */
	shorten?: { at: number; height: number };
	/** Material changes by material name: new color (sRGB hex) and/or name. */
	materials?: Record<string, { color?: string; rename?: string }>;
	/**
	 * Scales parts to their real size in cm. Axes left out scale like the first given one (w, d, h).
	 * The parts' bottom (default) or top stays where it is.
	 */
	resize?: {
		parts?: Parts;
		size: { w?: number; d?: number; h?: number };
		anchor?: 'bottom' | 'top';
	}[];
	/** Replaces parts with a closed tube of the same outer size, e.g. a perforated shade that is solid. */
	tube?: { parts: Parts; name: string; color: string };
}

/**
 * Picks parts (scene nodes after flattening) for an edit; `npm run models -- --parts <id>` lists
 * them. A part matches when all its materials are listed and it lies within `y` (cm above the
 * model's bottom, before `shorten`). Left-out fields match everything.
 */
interface Parts {
	materials?: string[];
	y?: [number, number];
}

const BLACK = '#1b1a19';
const WHITE = '#f1efea';

const SOURCES: Source[] = [
	{
		id: 'ikea-kallax',
		archive: 'KALLAX.zip',
		entry: 'model.dae',
		turn: 90,
		resize: [{ size: { w: 69, d: 31, h: 132 } }]
	},
	{
		id: 'ikea-nymo-lamp',
		archive: 'NYMO_TABLE_LAMP.zip',
		entry: 'model.dae',
		materials: {
			_00_Preto_metalico: { color: BLACK, rename: 'shade' },
			_204_black: { color: WHITE }
		},
		resize: [
			{
				parts: { materials: ['_00_Preto_metalico', '_00_Bronze'] },
				size: { w: 25, h: 23 },
				anchor: 'top'
			}
		],
		// The model has a 141 cm floor stand; the real lamp is 70 cm.
		shorten: { at: 20, height: 70 }
	},
	{
		id: 'ikea-skaftet-lamp',
		archive: 'SKAFTET_LAMP.zip',
		entry: 'model.dae',
		materials: { _0128_White: { color: BLACK }, _00_Preto_metalico: { color: BLACK } },
		// The model's shade is perforated; the real one is closed fabric
		tube: { parts: { materials: ['_0128_White', '_00_Bronze'] }, name: 'shade', color: BLACK }
	},
	{
		id: 'ikea-ps2014-lamp',
		archive: '2914733.5ef5003162be4.rar',
		entry: 'IKEA PC 2014/IKEA PC 2014.FBX',
		keep: 'Closed PC2014', // the file also has open Gold and White variants
		scale: 0.001, // the FBX declares UnitScaleFactor 0.1 (cm), i.e. mm; assimp ignores it
		width: 36,
		mount: 'ceiling',
		// The ceiling cup is smaller in reality; its bottom stays, so the cable cut below absorbs it
		resize: [{ parts: { materials: ['plastic 1'], y: [125, 140] }, size: { w: 11 } }],
		// The real globe's top hangs 25 cm below the ceiling. Below the cut sit the pull cord and the
		// globe (60.5 cm together after scaling), above it the ceiling cup; the cut shortens the cable.
		shorten: { at: 70, height: 60.5 + 25 }
	}
];

/** R2 budget per model. */
const MAX_TRIANGLES = 100_000;
const MAX_BYTES = 5 * 1024 * 1024;

const RAW_DIR = 'models';
const OUT_DIR = 'static/models';
const WORK_DIR = join(tmpdir(), 'room-planner-models');

const io = new NodeIO()
	.registerExtensions(ALL_EXTENSIONS)
	.registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

/** Unpacks the archive and lets assimp turn the entry into a GLB next to its textures. */
function toGlb(source: Source): string {
	const dir = join(WORK_DIR, source.id);
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(dir, { recursive: true });
	execFileSync('bsdtar', ['-xf', join(RAW_DIR, source.archive), '-C', dir]);
	const glb = join(dir, `${source.id}.raw.glb`);
	execFileSync('assimp', ['export', join(dir, source.entry), glb, '-fglb2', '-jiv', '-tri'], {
		stdio: 'ignore'
	});
	return glb;
}

/** SketchUp exports its edge lines as line primitives. They'd render as black wireframe. */
function dropLines(doc: Document) {
	for (const mesh of doc.getRoot().listMeshes()) {
		for (const prim of mesh.listPrimitives()) {
			if (prim.getMode() !== Primitive.Mode.TRIANGLES) {
				mesh.removePrimitive(prim);
				prim.dispose();
			}
		}
	}
}

/** assimp's name for the material SketchUp puts on back faces. */
const BACK_MATERIAL = 'material';

/** Order-independent fingerprint of a primitive's vertices: count, bounds and sum. */
function shapeKey(prim: Primitive): string {
	const pos = prim.getAttribute('POSITION')!;
	const v = [0, 0, 0];
	const sum = [0, 0, 0];
	for (let i = 0; i < pos.getCount(); i++) {
		pos.getElement(i, v);
		for (let k = 0; k < 3; k++) sum[k] += v[k];
	}
	const round = (n: number) => n.toFixed(4);
	return [pos.getCount(), ...pos.getMin([]), ...pos.getMax([]), ...sum].map(round).join();
}

/**
 * SketchUp exports every surface twice, front and back face, as two primitives with the same
 * vertices in a different order. Keeps the front and makes its material double-sided.
 */
function dropBackFaces(doc: Document) {
	const sameShape = (a: Primitive, b: Primitive) => shapeKey(a) === shapeKey(b);
	for (const mesh of doc.getRoot().listMeshes()) {
		const prims = mesh.listPrimitives();
		const removed = new Set<Primitive>();
		for (const [i, a] of prims.entries()) {
			if (removed.has(a)) continue;
			const b = prims.slice(i + 1).find((p) => !removed.has(p) && sameShape(a, p));
			if (!b) continue;
			const back = a.getMaterial()?.getName() === BACK_MATERIAL ? a : b;
			const front = back === a ? b : a;
			front.getMaterial()?.setDoubleSided(true);
			mesh.removePrimitive(back);
			removed.add(back);
		}
	}
}

function findNode(doc: Document, prefix: string): Node {
	const node = doc
		.getRoot()
		.listNodes()
		.find((n) => n.getName().startsWith(prefix));
	if (!node) throw new Error(`no node named "${prefix}…"`);
	return node;
}

/** Puts every root under one node carrying scale, turn and (later) the centering offset. */
function wrap(doc: Document, source: Source): Node {
	const scene = sceneOf(doc);
	let roots = scene.listChildren();
	if (source.keep) {
		const kept = findNode(doc, source.keep);
		const world = kept.getWorldMatrix();
		kept.getParentNode()?.removeChild(kept);
		kept.setMatrix(world);
		roots = [kept];
		for (const child of scene.listChildren()) scene.removeChild(child);
	}
	const s = source.scale ?? 1;
	const a = ((source.turn ?? 0) * Math.PI) / 180;
	const wrapper = doc
		.createNode(source.id)
		.setScale([s, s, s])
		.setRotation([0, Math.sin(a / 2), 0, Math.cos(a / 2)]);
	for (const root of roots) {
		scene.removeChild(root);
		wrapper.addChild(root);
	}
	scene.addChild(wrapper);
	if (source.width) {
		const { min, max } = getBounds(scene);
		const f = source.width / 100 / (max[0] - min[0]);
		wrapper.setScale([s * f, s * f, s * f]);
	}
	return wrapper;
}

/** Triangles as drawn: a mesh used by 30 nodes counts 30 times. */
function renderedTriangles(doc: Document): number {
	let total = 0;
	for (const node of doc.getRoot().listNodes()) {
		for (const prim of node.getMesh()?.listPrimitives() ?? []) {
			const indices = prim.getIndices();
			total += (indices ?? prim.getAttribute('POSITION')!).getCount() / 3;
		}
	}
	return total;
}

/**
 * Removes the horizontal slab from `at` to `at + by` (m) and moves everything above it down by `by`.
 * Expects a flattened scene. Nodes entirely above move as a whole (keeping instancing); nodes
 * crossing the slab get their own baked copy of the mesh, with the slab's vertices collapsed.
 */
function removeSlab(doc: Document, at: number, by: number) {
	const scene = sceneOf(doc);
	for (const node of scene.listChildren()) {
		const mesh = node.getMesh();
		if (!mesh) continue;
		const { min, max } = getBounds(node);
		if (max[1] <= at) continue;
		if (min[1] >= at + by) {
			const [x, y, z] = node.getTranslation();
			node.setTranslation([x, y - by, z]);
			continue;
		}
		bake(node, new Matrix4());
		for (const prim of node.getMesh()!.listPrimitives()) {
			const pos = prim.getAttribute('POSITION')!;
			const v = [0, 0, 0];
			for (let i = 0; i < pos.getCount(); i++) {
				pos.getElement(i, v);
				v[1] = v[1] < at ? v[1] : v[1] < at + by ? at : v[1] - by;
				pos.setElement(i, v);
			}
		}
	}
}

const sceneOf = (doc: Document) => doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];

/**
 * Gives the node its own copy of its mesh with `matrix` × its transform baked into the vertices,
 * so the vertices can be edited without touching other nodes that share the mesh.
 * Expects a flattened scene (the node's transform is its world transform).
 */
function bake(node: Node, matrix: Matrix4) {
	const mesh = node.getMesh()!.clone();
	for (const prim of mesh.listPrimitives()) {
		const copy = prim.clone();
		for (const semantic of copy.listSemantics()) {
			copy.setAttribute(semantic, copy.getAttribute(semantic)!.clone());
		}
		copy.setIndices(copy.getIndices()?.clone() ?? null);
		mesh.removePrimitive(prim).addPrimitive(copy);
	}
	node.setMesh(mesh);
	const world = matrix.clone().multiply(new Matrix4().fromArray(node.getMatrix()));
	transformMesh(mesh, world.toArray() as mat4);
	node.setMatrix(new Matrix4().toArray() as mat4);
}

function selectParts(doc: Document, parts: Parts = {}): Node[] {
	return sceneOf(doc)
		.listChildren()
		.filter((node) => {
			const mesh = node.getMesh();
			if (!mesh) return false;
			const names = mesh.listPrimitives().map((p) => p.getMaterial()?.getName() ?? '');
			if (parts.materials && !names.every((n) => parts.materials!.includes(n))) return false;
			if (!parts.y) return true;
			const { min, max } = getBounds(node);
			return min[1] * 100 >= parts.y[0] && max[1] * 100 <= parts.y[1];
		});
}

function boundsOf(nodes: Node[]) {
	if (!nodes.length) throw new Error('no parts match');
	const min = [Infinity, Infinity, Infinity];
	const max = [-Infinity, -Infinity, -Infinity];
	for (const node of nodes) {
		const b = getBounds(node);
		for (let k = 0; k < 3; k++) {
			min[k] = Math.min(min[k], b.min[k]);
			max[k] = Math.max(max[k], b.max[k]);
		}
	}
	return { min, max };
}

/** sRGB hex color → linear RGBA, as glTF stores it. */
function linearColor(hex: string): vec4 {
	const n = parseInt(hex.slice(1), 16);
	const channel = (c: number) => {
		const v = c / 255;
		return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	return [channel(n >> 16), channel((n >> 8) & 255), channel(n & 255), 1];
}

function editMaterials(doc: Document, edits: NonNullable<Source['materials']> = {}) {
	for (const material of doc.getRoot().listMaterials()) {
		// Some exports carry out-of-range roughness (e.g. -1.7), which renders as a mirror
		material.setRoughnessFactor(Math.min(1, Math.max(0, material.getRoughnessFactor())));
		const edit = edits[material.getName()];
		if (!edit) continue;
		if (edit.color) {
			material.setBaseColorFactor(linearColor(edit.color)).setBaseColorTexture(null);
		}
		if (edit.rename) material.setName(edit.rename);
	}
}

function resizeParts(doc: Document, resize: NonNullable<Source['resize']>[number]) {
	const nodes = selectParts(doc, resize.parts);
	const { min, max } = boundsOf(nodes);
	const { w, d, h } = resize.size;
	const given = [w, d, h].find((v) => v !== undefined)!;
	const first =
		given / 100 / [max[0] - min[0], max[2] - min[2], max[1] - min[1]][[w, d, h].indexOf(given)];
	const sx = w !== undefined ? w / 100 / (max[0] - min[0]) : first;
	const sz = d !== undefined ? d / 100 / (max[2] - min[2]) : first;
	const sy = h !== undefined ? h / 100 / (max[1] - min[1]) : first;
	const pivot = [
		(min[0] + max[0]) / 2,
		resize.anchor === 'top' ? max[1] : min[1],
		(min[2] + max[2]) / 2
	];
	const matrix = new Matrix4()
		.makeTranslation(pivot[0], pivot[1], pivot[2])
		.multiply(new Matrix4().makeScale(sx, sy, sz))
		.multiply(new Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]));
	for (const node of nodes) bake(node, matrix);
}

/** Replaces the parts with an open-ended tube around the same vertical axis and height. */
function replaceWithTube(doc: Document, tube: NonNullable<Source['tube']>) {
	const nodes = selectParts(doc, tube.parts);
	const { min, max } = boundsOf(nodes);
	for (const node of nodes) node.dispose();

	const SEGMENTS = 64;
	const r = Math.max(max[0] - min[0], max[2] - min[2]) / 2;
	const [cx, cz] = [(min[0] + max[0]) / 2, (min[2] + max[2]) / 2];
	const positions: number[] = [];
	const normals: number[] = [];
	const indices: number[] = [];
	for (let i = 0; i <= SEGMENTS; i++) {
		const a = (i / SEGMENTS) * Math.PI * 2;
		const [x, z] = [Math.cos(a), Math.sin(a)];
		positions.push(cx + x * r, min[1], cz + z * r, cx + x * r, max[1], cz + z * r);
		normals.push(x, 0, z, x, 0, z);
		if (i < SEGMENTS) {
			const [b0, t0, b1, t1] = [2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 3];
			indices.push(b0, t0, b1, t0, t1, b1);
		}
	}
	const buffer = doc.getRoot().listBuffers()[0];
	const accessor = (type: 'VEC3' | 'SCALAR', array: Float32Array | Uint16Array) =>
		doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
	const material = doc
		.createMaterial(tube.name)
		.setBaseColorFactor(linearColor(tube.color))
		.setRoughnessFactor(0.85)
		.setMetallicFactor(0)
		.setDoubleSided(true);
	const prim = doc
		.createPrimitive()
		.setAttribute('POSITION', accessor('VEC3', new Float32Array(positions)))
		.setAttribute('NORMAL', accessor('VEC3', new Float32Array(normals)))
		.setIndices(accessor('SCALAR', new Uint16Array(indices)))
		.setMaterial(material);
	sceneOf(doc).addChild(
		doc.createNode(tube.name).setMesh(doc.createMesh(tube.name).addPrimitive(prim))
	);
}

/** Simplifies harder until the model fits the triangle budget, loosening the error cap each round. */
async function fitBudget(doc: Document) {
	let error = 0.001;
	for (let round = 0; round < 10; round++) {
		const tris = renderedTriangles(doc);
		if (tris <= MAX_TRIANGLES) return;
		const ratio = Math.min(1, (MAX_TRIANGLES * 0.9) / tris);
		await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error }));
		error *= 2;
	}
}

/** `npm run models -- --parts <id>` prints each part, to find what `Parts` selectors should target. */
const SHOW_PARTS = process.argv.includes('--parts');

function listParts(doc: Document, id: string) {
	const scene = sceneOf(doc);
	const rows = new Map<string, { part: string; copies: number; tris: number }>();
	const cm = (v: number) => Math.round(v * 1000) / 10;
	for (const node of scene.listChildren()) {
		const mesh = node.getMesh();
		if (!mesh) continue;
		const { min, max } = getBounds(node);
		const materials = mesh.listPrimitives().map((p) => p.getMaterial()?.getName() ?? '?');
		const key = `${[...new Set(materials)].join(' + ')} | y ${cm(min[1])}…${cm(max[1])} | w ${cm(max[0] - min[0])}`;
		const tris = mesh
			.listPrimitives()
			.reduce((t, p) => t + (p.getIndices() ?? p.getAttribute('POSITION')!).getCount() / 3, 0);
		const row = rows.get(key) ?? { part: key, copies: 0, tris: 0 };
		row.copies++;
		row.tris += tris;
		rows.set(key, row);
	}
	console.log(`\n${id} parts (cm above the bottom, before shorten):`);
	console.table([...rows.values()].sort((a, b) => b.tris - a.tris));
}

async function convert(source: Source) {
	const doc = await io.read(toGlb(source));
	dropLines(doc);
	dropBackFaces(doc);
	wrap(doc, source);
	await doc.transform(prune(), dedup(), weld(), center({ pivot: 'below' }), flatten());
	if (SHOW_PARTS) listParts(doc, source.id);
	const before = renderedTriangles(doc);
	for (const resize of source.resize ?? []) resizeParts(doc, resize);
	if (source.tube) replaceWithTube(doc, source.tube);
	editMaterials(doc, source.materials);
	await doc.transform(prune());
	await fitBudget(doc);
	const triangles = renderedTriangles(doc);

	const scene = sceneOf(doc);
	if (source.shorten) {
		const { at, height } = source.shorten;
		removeSlab(doc, at / 100, getBounds(scene).max[1] - height / 100);
	}
	await doc.transform(center({ pivot: source.mount === 'ceiling' ? 'above' : 'below' }));
	const { min, max } = getBounds(scene);

	await doc.transform(
		instance({ min: 5 }),
		joinPrimitives(),
		prune(),
		meshopt({ encoder: MeshoptEncoder, level: 'medium' })
	);
	const file = join(OUT_DIR, `${source.id}.glb`);
	await io.write(file, doc);

	const cm = (v: number) => Math.round(v * 1000) / 10;
	const bytes = statSync(file).size;
	return {
		id: source.id,
		file: `/models/${source.id}.glb`,
		size: { w: cm(max[0] - min[0]), d: cm(max[2] - min[2]), h: cm(max[1] - min[1]) },
		mount: source.mount ?? 'floor',
		triangles: Math.round(triangles),
		trianglesBefore: Math.round(before),
		bytes
	} satisfies ConvertedModel;
}

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
mkdirSync(OUT_DIR, { recursive: true });
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const indexFile = join(OUT_DIR, 'index.json');
const index = new Map<string, ConvertedModel>(
	existsSync(indexFile) && only.length
		? (JSON.parse(readFileSync(indexFile, 'utf8')) as ConvertedModel[]).map((m) => [m.id, m])
		: []
);
for (const source of SOURCES.filter((s) => !only.length || only.includes(s.id))) {
	index.set(source.id, await convert(source));
}
const models = SOURCES.flatMap((s) => index.get(s.id) ?? []);
writeFileSync(indexFile, JSON.stringify(models, null, '\t') + '\n');

console.table(
	models.map((m) => ({
		id: m.id,
		'w × d × h cm': `${m.size.w} × ${m.size.d} × ${m.size.h}`,
		mount: m.mount,
		tris: `${m.trianglesBefore} → ${m.triangles}`,
		KB: Math.round(m.bytes / 1024),
		ok: m.triangles <= MAX_TRIANGLES && m.bytes <= MAX_BYTES ? '✓' : 'over budget'
	}))
);
