import { BufferGeometry, Material, Mesh, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Bake opaque, owned sibling meshes into material batches. Groups and shared GLBs stay intact. */
export function batchStaticMeshes(parent: Object3D, excluded = new Set<Object3D>()) {
	const batches = new Map<string, Mesh<BufferGeometry, Material>[]>();
	for (const child of parent.children) {
		if (
			!(child instanceof Mesh) ||
			child.children.length ||
			child.userData.shared ||
			!child.visible ||
			excluded.has(child)
		)
			continue;
		const material = child.material;
		if (Array.isArray(material) || material.transparent) continue;
		const key = `${material.uuid}/${child.castShadow}/${child.receiveShadow}/${!!child.geometry.index}/${Object.keys(child.geometry.attributes).sort()}`;
		const batch = batches.get(key) ?? [];
		batch.push(child);
		batches.set(key, batch);
	}
	for (const meshes of batches.values()) {
		if (meshes.length < 2) continue;
		const sources = meshes.map((mesh) => {
			mesh.updateMatrix();
			return mesh.geometry.clone().applyMatrix4(mesh.matrix);
		});
		const geometry = mergeGeometries(sources);
		for (const source of sources) source.dispose();
		if (!geometry) continue;
		const first = meshes[0];
		const merged = new Mesh(geometry, first.material);
		merged.castShadow = first.castShadow;
		merged.receiveShadow = first.receiveShadow;
		parent.add(merged);
		for (const mesh of meshes) mesh.removeFromParent();
		for (const original of new Set(meshes.map((mesh) => mesh.geometry))) original.dispose();
	}
}
