import * as THREE from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Loads the real furniture models (`static/models/<id>.glb`) once per session and hands out
 * clones to both 3D views. Clones share geometry and materials with the cached original, so
 * every object in them is marked `userData.shared` and must not be disposed.
 */
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const loaded = new Map<string, THREE.Group>();
const pending = new Map<string, Promise<boolean>>();

/** Starts loading (once); resolves to whether the model is now available. */
export function loadModel(id: string): Promise<boolean> {
	let p = pending.get(id);
	if (!p) {
		p = loader
			.loadAsync(`/models/${id}.glb`)
			.then((gltf) => {
				gltf.scene.traverse((o) => {
					o.userData.shared = true;
					o.castShadow = o.receiveShadow = true;
				});
				loaded.set(id, gltf.scene);
				return true;
			})
			.catch((err) => {
				// The parametric stand-in stays
				console.warn(`Model ${id} failed to load`, err);
				return false;
			});
		pending.set(id, p);
	}
	return p;
}

/** A copy of a loaded model in cm (the GLBs are in meters), or null while it loads. */
export function modelClone(id: string): THREE.Object3D | null {
	const src = loaded.get(id);
	if (!src) return null;
	const obj = src.clone();
	obj.scale.setScalar(100);
	return obj;
}
