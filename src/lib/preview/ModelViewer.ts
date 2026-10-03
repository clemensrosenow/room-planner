import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { cssVar } from '#lib/planner/format.ts';
import type { ConvertedModel } from './modelIndex.ts';

export type ViewerView = 'persp' | 'front' | 'side' | 'top';

/** Height (cm) at which ceiling pieces hang, so their drop reads against a real room. */
export const CEILING = 250;
/** Gap (cm) between models shown side by side */
const GAP = 40;

/** What the viewer measured on a model once it's shown, to compare with the index. */
export interface ShownModel {
	id: string;
	/** cm, bounding box in the browser */
	size: { w: number; d: number; h: number };
	/** Triangles drawn, counting every instance */
	triangles: number;
	/** ms from request to ready (0 when cached) */
	loadMs: number;
}

const DIRECTIONS: Record<ViewerView, THREE.Vector3> = {
	persp: new THREE.Vector3(0.9, 0.55, 1.4),
	front: new THREE.Vector3(0, 0.05, 1),
	side: new THREE.Vector3(1, 0.05, 0),
	top: new THREE.Vector3(0, 1, 0.001)
};

const round = (v: number) => Math.round(v * 10) / 10;

/**
 * Standalone viewer for the converted furniture models (dev page). Units are cm like the planner;
 * y up, front facing +z. Shows one model or several in a row, with dimensions and a front arrow.
 */
export class ModelViewer {
	private renderer = new THREE.WebGLRenderer({ antialias: true });
	private labels = new CSS2DRenderer();
	private scene = new THREE.Scene();
	private camera = new THREE.PerspectiveCamera(35, 1, 1, 20000);
	private controls: OrbitControls;
	private loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
	private cache = new Map<string, Promise<THREE.Group>>();
	/** The shown models */
	private content = new THREE.Group();
	/** Boxes, dimension labels and front arrows */
	private guides = new THREE.Group();
	/** Floor grid and ceiling, sized to the content */
	private stage = new THREE.Group();
	private sun = new THREE.DirectionalLight(0xffffff, 1.6);
	private resizeObserver: ResizeObserver;
	private frame = 0;
	/** Increases with every show() so a slow load can't replace a newer selection */
	private version = 0;
	private view: ViewerView = 'persp';
	private wireframe = false;

	constructor(private el: HTMLElement) {
		const r = this.renderer;
		r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		r.shadowMap.enabled = true;
		r.shadowMap.type = THREE.PCFSoftShadowMap;
		r.toneMapping = THREE.NeutralToneMapping;
		r.domElement.className = 'block h-full w-full touch-none';
		el.appendChild(r.domElement);
		Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0' });
		this.labels.domElement.classList.add('pointer-events-none');
		el.appendChild(this.labels.domElement);

		this.scene.background = new THREE.Color(cssVar('--scene'));
		// Even studio light for judging materials, plus one sun for contact shadows
		const pmrem = new THREE.PMREMGenerator(r);
		this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
		this.scene.environmentIntensity = 0.9;
		pmrem.dispose();
		this.sun.position.set(150, 400, 250);
		this.sun.castShadow = true;
		this.sun.shadow.mapSize.set(2048, 2048);
		this.sun.shadow.bias = -0.0005;
		this.scene.add(this.sun, this.sun.target, this.content, this.guides, this.stage);

		this.controls = new OrbitControls(this.camera, r.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.12;

		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(el);
		this.resize();
		this.loop();
	}

	/** Shows the given models side by side (one model: centered) and frames them. */
	async show(models: ConvertedModel[]): Promise<ShownModel[]> {
		const version = ++this.version;
		const loaded = await Promise.all(
			models.map(async (m) => {
				const cached = this.cache.has(m.file);
				const start = performance.now();
				const source = await this.load(m.file);
				return { m, source, loadMs: cached ? 0 : Math.round(performance.now() - start) };
			})
		);
		if (version !== this.version) return [];

		clear(this.content);
		clear(this.guides);
		const shown: ShownModel[] = [];
		const widths = loaded.map(({ m }) => m.size.w);
		let x = -(widths.reduce((a, b) => a + b, 0) + GAP * (widths.length - 1)) / 2;
		for (const [i, { m, source, loadMs }] of loaded.entries()) {
			const obj = source.clone();
			obj.scale.setScalar(100); // GLB meters → cm
			obj.position.set(x + widths[i] / 2, m.mount === 'ceiling' ? CEILING : 0, 0);
			x += widths[i] + GAP;
			this.content.add(obj);
			obj.updateMatrixWorld(true);

			const box = exactBox(obj);
			const size = box.getSize(new THREE.Vector3());
			this.addGuides(box, models.length > 1 ? m.id : null);
			shown.push({
				id: m.id,
				size: { w: round(size.x), d: round(size.z), h: round(size.y) },
				triangles: countTriangles(obj),
				loadMs
			});
		}
		this.setWireframe(this.wireframe);
		this.buildStage(models.some((m) => m.mount === 'ceiling'));
		this.frameContent();
		return shown;
	}

	setView(view: ViewerView) {
		this.view = view;
		this.frameContent();
	}

	setGuides(on: boolean) {
		this.guides.visible = on;
	}

	setWireframe(on: boolean) {
		this.wireframe = on;
		this.content.traverse((o) => {
			if (!(o instanceof THREE.Mesh)) return;
			for (const mat of [o.material].flat()) mat.wireframe = on;
		});
	}

	dispose() {
		cancelAnimationFrame(this.frame);
		this.resizeObserver.disconnect();
		this.controls.dispose();
		this.renderer.dispose();
		this.renderer.domElement.remove();
		this.labels.domElement.remove();
	}

	private load(file: string): Promise<THREE.Group> {
		let p = this.cache.get(file);
		if (!p) {
			p = this.loader.loadAsync(file).then((gltf) => {
				gltf.scene.traverse((o) => {
					if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
				});
				return gltf.scene;
			});
			p.catch(() => this.cache.delete(file));
			this.cache.set(file, p);
		}
		return p;
	}

	/** Bounding box with its width, depth and height written on it, plus an arrow to the front. */
	private addGuides(box: THREE.Box3, name: string | null) {
		const accent = new THREE.Color(cssVar('--accent'));
		this.guides.add(new THREE.Box3Helper(box, accent));
		const size = box.getSize(new THREE.Vector3());
		const { min, max } = box;
		const mid = box.getCenter(new THREE.Vector3());
		this.guides.add(
			label(`${round(size.x)} cm`, new THREE.Vector3(mid.x, min.y, max.z)),
			label(`${round(size.z)} cm`, new THREE.Vector3(max.x, min.y, mid.z)),
			label(`${round(size.y)} cm`, new THREE.Vector3(max.x, mid.y, max.z))
		);
		if (name) this.guides.add(label(name, new THREE.Vector3(mid.x, max.y, mid.z), true));

		// Arrow on the floor (or ceiling) pointing to +z, the model's front
		const y = min.y < CEILING / 2 ? 0.3 : CEILING - 0.3;
		const length = Math.min(30, size.z / 2 + 25);
		const arrow = new THREE.ArrowHelper(
			new THREE.Vector3(0, 0, 1),
			new THREE.Vector3(mid.x, y, max.z + 6),
			length,
			accent,
			8,
			6
		);
		this.guides.add(arrow, label('front', new THREE.Vector3(mid.x, y, max.z + 10 + length)));
	}

	/** Floor grid (10 cm cells) under the content, and a see-through ceiling when anything hangs. */
	private buildStage(ceiling: boolean) {
		clear(this.stage);
		const box = new THREE.Box3().setFromObject(this.content);
		const size =
			Math.ceil((Math.max(box.max.x - box.min.x, box.max.z - box.min.z) + 200) / 100) * 100;
		const grid = new THREE.GridHelper(
			size,
			size / 10,
			new THREE.Color(cssVar('--line-strong')),
			new THREE.Color(cssVar('--grid-strong'))
		);
		const shadow = new THREE.Mesh(
			new THREE.PlaneGeometry(size, size),
			new THREE.ShadowMaterial({ opacity: 0.18 })
		);
		shadow.rotation.x = -Math.PI / 2;
		shadow.receiveShadow = true;
		this.stage.add(grid, shadow);
		if (ceiling) {
			const plane = new THREE.Mesh(
				new THREE.PlaneGeometry(size, size),
				new THREE.MeshBasicMaterial({
					color: cssVar('--line-strong'),
					transparent: true,
					opacity: 0.25,
					side: THREE.DoubleSide,
					depthWrite: false
				})
			);
			plane.rotation.x = Math.PI / 2;
			plane.position.y = CEILING;
			this.stage.add(
				plane,
				label(`ceiling ${CEILING} cm`, new THREE.Vector3(-size / 2 + 40, CEILING, 0))
			);
		}
		const half = size / 2;
		Object.assign(this.sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half });
		this.sun.shadow.camera.near = 10;
		this.sun.shadow.camera.far = 2000;
		this.sun.shadow.camera.updateProjectionMatrix();
	}

	/** Points the camera at the content from the current view's direction, fitting it in. */
	private frameContent() {
		const box = new THREE.Box3().setFromObject(this.content);
		if (box.isEmpty()) return;
		const center = box.getCenter(new THREE.Vector3());
		const radius = box.getSize(new THREE.Vector3()).length() / 2;
		const fov = THREE.MathUtils.degToRad(this.camera.fov);
		const fit = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * this.camera.aspect));
		// Margin keeps the content clear of the floating header and panels
		const distance = (radius / Math.sin(fit / 2)) * 1.3;
		this.camera.position
			.copy(center)
			.addScaledVector(DIRECTIONS[this.view].clone().normalize(), distance);
		this.camera.near = distance / 100;
		this.camera.far = distance * 20;
		this.camera.updateProjectionMatrix();
		this.controls.target.copy(center);
		this.controls.update();
	}

	private resize() {
		const { clientWidth: w, clientHeight: h } = this.el;
		if (!w || !h) return;
		this.renderer.setSize(w, h, false);
		this.labels.setSize(w, h);
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
	}

	private loop = () => {
		this.frame = requestAnimationFrame(this.loop);
		this.controls.update();
		this.renderer.render(this.scene, this.camera);
		this.labels.render(this.scene, this.camera);
	};
}

function label(text: string, at: THREE.Vector3, strong = false): CSS2DObject {
	const div = document.createElement('div');
	div.textContent = text;
	div.className = [
		'rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap shadow-sm',
		strong ? 'bg-ink text-sheet' : 'bg-sheet/90 text-ink ring-1 ring-line'
	].join(' ');
	const obj = new CSS2DObject(div);
	obj.position.copy(at);
	return obj;
}

/**
 * Bounding box from every vertex, instances included. Three's own boxes are conservative for
 * instanced meshes, which inflates lamps whose shade is made of rotated copies.
 */
function exactBox(root: THREE.Object3D): THREE.Box3 {
	const box = new THREE.Box3();
	const v = new THREE.Vector3();
	const instance = new THREE.Matrix4();
	const world = new THREE.Matrix4();
	root.updateMatrixWorld(true);
	root.traverse((o) => {
		if (!(o instanceof THREE.Mesh)) return;
		const count = o instanceof THREE.InstancedMesh ? o.count : 1;
		const pos = (o.geometry as THREE.BufferGeometry).attributes.position;
		for (let i = 0; i < count; i++) {
			world.copy(o.matrixWorld);
			if (o instanceof THREE.InstancedMesh) {
				o.getMatrixAt(i, instance);
				world.multiply(instance);
			}
			for (let j = 0; j < pos.count; j++) {
				box.expandByPoint(v.fromBufferAttribute(pos, j).applyMatrix4(world));
			}
		}
	});
	return box;
}

function countTriangles(root: THREE.Object3D): number {
	let total = 0;
	root.traverse((o) => {
		if (!(o instanceof THREE.Mesh)) return;
		const g = o.geometry as THREE.BufferGeometry;
		const tris = (g.index ?? g.attributes.position).count / 3;
		total += tris * (o instanceof THREE.InstancedMesh ? o.count : 1);
	});
	return total;
}

/** Removes all children, including CSS2D labels (which only leave the DOM when removed). */
function clear(group: THREE.Group) {
	for (const child of [...group.children]) {
		child.traverse((o) => {
			if (o instanceof CSS2DObject) o.element.remove();
		});
		group.remove(child);
	}
}
