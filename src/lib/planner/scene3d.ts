import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadModel, modelClone } from '../preview/modelLoader';
import { modelInfo } from './catalog';
import { PALETTE } from './defaults';
import { cm, cssVar } from './format';
import { elevation, type FurnitureCheck } from './furniture';
import { buildWalls, type Geometry } from './geometry';
import type { Furniture, Point } from './types';

export interface SceneEvents {
	/** Pointer went down on a piece (start of a drag) */
	onSelect: (id: string | null) => void;
	/** Piece dragged to a new center; `snap` is false while Alt is held */
	onDrag: (id: string, cx: number, cy: number, snap: boolean) => void;
	/** Double-click on a piece */
	onOpen?: (id: string) => void;
	/** Screen position (px, relative to the canvas) above the selected piece, every frame it moves */
	onAnchor?: (p: { x: number; y: number } | null) => void;
}

const color = (v: string) => new THREE.Color(cssVar(v));

/**
 * Three.js scene of the room. Plan coordinates (x, y) map to world (x, z); y is up.
 * The Svelte component calls setRoom / setFurniture whenever the state changes.
 */
export class RoomScene {
	private renderer: THREE.WebGLRenderer;
	private scene = new THREE.Scene();
	private camera = new THREE.PerspectiveCamera(40, 1, 5, 20000);
	private controls: OrbitControls;
	private sun = new THREE.DirectionalLight(0xffffff, 1.95);
	private roomGroup = new THREE.Group();
	private furnGroup = new THREE.Group();
	/** Furniture objects by id, for picking and fast position updates */
	private pieces = new Map<string, THREE.Group>();
	private resizeObserver: ResizeObserver;
	private frame = 0;
	/** Swing area materials by door name, tinted when furniture blocks the door */
	private sectors = new Map<string, THREE.MeshBasicMaterial>();
	private selected: { id: string; h: number } | null = null;
	/** Ceiling height, where ceiling lamps hang */
	private ceilingH = 250;
	/** Last furniture shown, rebuilt once a real model has loaded */
	private last: Parameters<RoomScene['setFurniture']> | null = null;
	private lastAnchor = '';
	private glowTexture: THREE.Texture | null = null;

	constructor(
		private el: HTMLElement,
		private events: SceneEvents
	) {
		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;
		this.renderer.domElement.className = 'block h-full w-full touch-none';
		el.appendChild(this.renderer.domElement);

		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.12;
		this.controls.maxPolarAngle = Math.PI * 0.49;
		this.controls.minDistance = 60;
		this.controls.maxDistance = 4000;

		this.sun.castShadow = true;
		this.sun.shadow.mapSize.set(2048, 2048);
		Object.assign(this.sun.shadow.camera, {
			left: -700,
			right: 700,
			top: 700,
			bottom: -700,
			near: 10,
			far: 4000
		});
		this.sun.shadow.bias = -0.0008;
		this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a909a, 2.3), this.sun, this.sun.target);
		this.scene.add(this.roomGroup, this.furnGroup);

		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(el);
		this.resize();
		this.setupDrag();

		const loop = () => {
			this.frame = requestAnimationFrame(loop);
			if (!this.el.offsetParent) {
				// Hidden: report the anchor again once visible
				this.lastAnchor = 'hidden';
				return;
			}
			this.controls.update();
			this.renderer.render(this.scene, this.camera);
			this.reportAnchor();
		};
		loop();
	}

	dispose() {
		cancelAnimationFrame(this.frame);
		this.resizeObserver.disconnect();
		this.controls.dispose();
		disposeGroup(this.roomGroup);
		disposeGroup(this.furnGroup);
		this.glowTexture?.dispose();
		this.renderer.dispose();
		this.renderer.domElement.remove();
	}

	resize() {
		const w = this.el.clientWidth || 1;
		const h = this.el.clientHeight || 1;
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
	}

	/** Looks at the room from the front left, just far enough away to fit it into the view. */
	fitCamera(g: Geometry) {
		const depth = g.L + g.tE + g.D;
		const target = new THREE.Vector3(g.W / 2, 40, depth / 2);
		const radius = 0.5 * Math.hypot(g.W, depth, g.H);
		const vFov = THREE.MathUtils.degToRad(this.camera.fov);
		const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
		const dist = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.2;
		const dir = new THREE.Vector3(-0.55, 1.05, 1).normalize();
		this.controls.target.copy(target);
		this.camera.position.copy(target).addScaledVector(dir, dist);
		this.controls.update();
	}

	/* ---------- Room ---------- */

	/** Builds the room; `dims` shows wall lengths and the loggia label. */
	setRoom(g: Geometry, lowWalls: boolean, dims = true) {
		const grp = this.roomGroup;
		disposeGroup(grp);
		this.ceilingH = g.H;
		const wallH = lowWalls ? Math.min(g.H, 110) : g.H;
		const side = new THREE.MeshStandardMaterial({ color: color('--wall3d'), roughness: 0.92 });
		const cap = new THREE.MeshStandardMaterial({ color: color('--wall'), roughness: 0.9 });
		// Dark top face makes wall cuts readable from above
		const wallMats = [side, side, cap, side, side, side];
		const edgeMat = new THREE.LineBasicMaterial({
			color: color('--wall'),
			transparent: true,
			opacity: 0.55
		});

		// Floor
		const shape = new THREE.Shape(g.poly.map((p) => new THREE.Vector2(p[0], -p[1])));
		const floorGeo = new THREE.ShapeGeometry(shape);
		floorGeo.rotateX(-Math.PI / 2);
		const floor = new THREE.Mesh(
			floorGeo,
			new THREE.MeshStandardMaterial({ map: this.gridTexture(), roughness: 0.95 })
		);
		floor.receiveShadow = true;
		grp.add(floor);

		// Walls
		const walls = buildWalls(g, wallH);
		for (const s of walls.segs) {
			const { S, d, n, t } = s.e;
			const um = (s.u0 + s.u1) / 2;
			addBox(
				grp,
				[S[0] + d[0] * um + (n[0] * t) / 2, (s.h0 + s.h1) / 2, S[1] + d[1] * um + (n[1] * t) / 2],
				[s.u1 - s.u0, s.h1 - s.h0, t],
				Math.atan2(-d[1], d[0]),
				wallMats,
				{ edges: edgeMat }
			);
		}
		// Wall length labels
		for (const e of dims ? walls.edges : []) {
			const sp = labelSprite(cm(e.len), 15, false);
			sp.position.set(
				(e.S[0] + e.E[0]) / 2 + e.n[0] * (e.t + 22),
				wallH + 8,
				(e.S[1] + e.E[1]) / 2 + e.n[1] * (e.t + 22)
			);
			grp.add(sp);
		}

		// Loggia
		const ly0 = g.L + g.tE;
		if (g.D > 0) {
			const lmat = new THREE.MeshStandardMaterial({ color: color('--loggia'), roughness: 0.95 });
			addBox(grp, [g.W / 2, -1, ly0 + g.D / 2], [g.W, 2, g.D], 0, lmat, { cast: false });
			const ph = Math.max(1, g.PH);
			addBox(grp, [g.W / 2, ph / 2, ly0 + g.D + 7.5], [g.W + 2 * g.tI, ph, 15], 0, wallMats, {
				edges: edgeMat
			});
			addBox(grp, [-g.tI / 2, ph / 2, ly0 + g.D / 2], [g.tI, ph, g.D], 0, wallMats, {
				edges: edgeMat
			});
			addBox(grp, [g.W + g.tI / 2, ph / 2, ly0 + g.D / 2], [g.tI, ph, g.D], 0, wallMats, {
				edges: edgeMat
			});
			if (dims) {
				const sp = labelSprite('Loggia', 16, true);
				sp.position.set(g.W / 2, 20, ly0 + g.D / 2);
				grp.add(sp);
			}
		}

		// Glass front with frame
		const fr = g.front;
		const gH = Math.min(fr.gH, wallH);
		const zc = g.L + g.tE / 2;
		const glass = new THREE.MeshStandardMaterial({
			color: color('--glass'),
			transparent: true,
			opacity: 0.28,
			roughness: 0.1,
			depthWrite: false
		});
		const frame = new THREE.MeshStandardMaterial({ color: color('--wall'), roughness: 0.6 });
		for (const [a, b] of [
			[fr.gx0, fr.bOff],
			[fr.bOff + fr.bW, fr.gx1]
		]) {
			if (b - a <= 0.5) continue;
			const m = addBox(grp, [(a + b) / 2, gH / 2, zc], [b - a, gH, 2], 0, glass, { cast: false });
			m.receiveShadow = false;
		}
		for (const x of [fr.gx0 + 2.5, fr.bOff, fr.bOff + fr.bW, fr.gx1 - 2.5])
			addBox(grp, [x, gH / 2, zc], [5, gH, g.tE * 0.5], 0, frame);
		if (fr.gH <= wallH)
			addBox(
				grp,
				[(fr.gx0 + fr.gx1) / 2, fr.gH - 2.5, zc],
				[fr.gx1 - fr.gx0, 5, g.tE * 0.5],
				0,
				frame
			);

		// Doors: leaf standing fully open, plus swing area on the floor
		const leafMat = new THREE.MeshStandardMaterial({ color: color('--wall3d'), roughness: 0.7 });
		this.sectors.clear();
		const arcMat = new THREE.LineBasicMaterial({
			color: color('--accent'),
			transparent: true,
			opacity: 0.7
		});
		for (const dr of g.doors) {
			const [hx, hy] = dr.hinge;
			const c = dr.closed;
			const op = dr.open;
			const w = dr.w;
			const arc: Point[] = [];
			for (let k = 0; k <= 32; k++) {
				const a = ((k / 32) * Math.PI) / 2;
				arc.push([
					hx + (c[0] * Math.cos(a) + op[0] * Math.sin(a)) * w,
					hy + (c[1] * Math.cos(a) + op[1] * Math.sin(a)) * w
				]);
			}
			const sh = new THREE.Shape();
			sh.moveTo(hx, -hy);
			arc.forEach((p) => sh.lineTo(p[0], -p[1]));
			sh.closePath();
			const sg = new THREE.ShapeGeometry(sh);
			sg.rotateX(-Math.PI / 2);
			const sectorMat = new THREE.MeshBasicMaterial({
				color: color('--accent'),
				transparent: true,
				opacity: 0.1,
				depthWrite: false,
				side: THREE.DoubleSide
			});
			this.sectors.set(dr.name, sectorMat);
			const sector = new THREE.Mesh(sg, sectorMat);
			sector.position.y = 0.6;
			grp.add(sector);
			const lineGeo = new THREE.BufferGeometry().setFromPoints(
				arc.map((p) => new THREE.Vector3(p[0], 0.9, p[1]))
			);
			grp.add(new THREE.Line(lineGeo, arcMat));
			const h = Math.min(dr.h, wallH);
			addBox(
				grp,
				[hx + (op[0] * w) / 2 + c[0] * 2, h / 2, hy + (op[1] * w) / 2 + c[1] * 2],
				[w, h, 4],
				Math.atan2(-op[1], op[0]),
				dr.glass ? glass : leafMat,
				{ edges: edgeMat, cast: !dr.glass }
			);
		}

		this.sun.position.set(g.W * 0.2 - 300, 900, g.L + 600);
		this.sun.target.position.set(g.W / 2, 0, g.L / 2);
		this.scene.background = color('--scene');
		// Ceiling lamps follow the ceiling height
		if (this.last) this.setPositions(this.last[0]);
	}

	private gridTexture() {
		const c = document.createElement('canvas');
		c.width = c.height = 400;
		const x = c.getContext('2d')!;
		x.fillStyle = cssVar('--floor');
		x.fillRect(0, 0, 400, 400);
		// Thin lines every 10 cm (texture covers 1 m)
		x.strokeStyle = cssVar('--grid');
		x.lineWidth = 1.5;
		for (let i = 0; i <= 10; i++) {
			const p = i * 40;
			x.beginPath();
			x.moveTo(p, 0);
			x.lineTo(p, 400);
			x.moveTo(0, p);
			x.lineTo(400, p);
			x.stroke();
		}
		// Stronger lines every 50 cm
		x.strokeStyle = cssVar('--grid-strong');
		x.lineWidth = 3;
		x.globalAlpha = 0.55;
		x.beginPath();
		for (const p of [0, 200]) {
			x.moveTo(p, 0);
			x.lineTo(p, 400);
			x.moveTo(0, p);
			x.lineTo(400, p);
		}
		x.stroke();
		const t = new THREE.CanvasTexture(c);
		t.colorSpace = THREE.SRGBColorSpace;
		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		t.repeat.set(0.01, 0.01);
		t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
		return t;
	}

	/* ---------- Furniture ---------- */

	/** Rebuilds all furniture meshes (call when size, color, name, selection or checks change). */
	setFurniture(
		furn: Furniture[],
		checks: Record<string, FurnitureCheck>,
		selectedId: string | null
	) {
		disposeGroup(this.furnGroup);
		this.pieces.clear();
		this.last = [furn, checks, selectedId];
		const accent = color('--accent');
		const warn = color('--warn');
		const ink = color('--wall');
		const sel = furn.find((f) => f.id === selectedId);
		this.selected = sel ? { id: sel.id, h: sel.h + this.baseY(sel, furn) } : null;
		for (const f of furn) {
			const isSel = selectedId === f.id;
			const bad = checks[f.id]?.bad;
			const geo = new THREE.BoxGeometry(f.w, f.h, f.d);
			const mat = new THREE.MeshStandardMaterial({
				color: color(PALETTE[f.color % PALETTE.length]),
				roughness: 0.8
			});
			if (isSel || bad) {
				mat.emissive = (bad ? warn : accent).clone();
				mat.emissiveIntensity = bad ? 0.3 : 0.22;
			}
			const mesh = new THREE.Mesh(geo, mat);
			mesh.position.y = f.h / 2;
			mesh.castShadow = mesh.receiveShadow = true;
			const edges = new THREE.LineSegments(
				new THREE.EdgesGeometry(geo),
				new THREE.LineBasicMaterial({ color: bad ? warn : isSel ? accent : ink })
			);
			edges.position.y = f.h / 2;
			const piece = new THREE.Group();
			piece.add(mesh, edges);
			// Real model: shown instead of the box, which stays as an invisible hit area
			const info = modelInfo(f);
			if (info) {
				const model = modelClone(f.model!);
				if (model) {
					model.position.y = info.mount === 'ceiling' ? f.h : 0;
					piece.add(model);
					mat.colorWrite = mat.depthWrite = false;
					mesh.castShadow = mesh.receiveShadow = false;
					edges.visible = isSel || !!bad;
				} else {
					loadModel(f.model!).then((ok) => ok && this.last && this.setFurniture(...this.last));
				}
			}
			// Name only on the selected piece, the room stays calm
			if (isSel) {
				const label = labelSprite(f.name || 'Box', 14, true);
				label.position.y = f.h + 16;
				if (modelInfo(f)?.mount === 'ceiling') label.position.y = -16;
				piece.add(label);
			}
			// Soft red glow on the floor around pieces with a problem
			if (bad) {
				const glow = new THREE.Mesh(
					new THREE.PlaneGeometry(f.w + 50, f.d + 50),
					new THREE.MeshBasicMaterial({
						map: this.glow(),
						color: warn,
						transparent: true,
						opacity: 0.85,
						depthWrite: false
					})
				);
				glow.rotation.x = -Math.PI / 2;
				glow.position.y = 0.8 - this.baseY(f, furn);
				glow.raycast = () => {};
				piece.add(glow);
			}
			piece.userData.fid = f.id;
			mesh.userData.fid = f.id;
			this.furnGroup.add(piece);
			this.pieces.set(f.id, piece);
		}
		this.setPositions(furn);
	}

	/** Tints the swing areas of doors that furniture blocks. */
	setBlockedDoors(names: string[]) {
		for (const [name, m] of this.sectors) {
			const blocked = names.includes(name);
			m.color = color(blocked ? '--warn' : '--accent');
			m.opacity = blocked ? 0.28 : 0.1;
		}
	}

	/** Soft rounded-rectangle falloff, shared by all glow planes. */
	private glow() {
		if (this.glowTexture) return this.glowTexture;
		const c = document.createElement('canvas');
		c.width = c.height = 128;
		const x = c.getContext('2d')!;
		x.filter = 'blur(10px)';
		x.fillStyle = '#fff';
		x.beginPath();
		x.roundRect(26, 26, 76, 76, 12);
		x.fill();
		this.glowTexture = new THREE.CanvasTexture(c);
		this.glowTexture.userData.shared = true;
		return this.glowTexture;
	}

	/** Floor point (plan cm) under a screen point, or null outside the canvas. */
	planPoint(clientX: number, clientY: number): Point | null {
		const r = this.renderer.domElement.getBoundingClientRect();
		if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
		const ray = new THREE.Raycaster();
		ray.setFromCamera(
			new THREE.Vector2(
				((clientX - r.left) / r.width) * 2 - 1,
				-((clientY - r.top) / r.height) * 2 + 1
			),
			this.camera
		);
		const hit = new THREE.Vector3();
		if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return null;
		return [hit.x, hit.z];
	}

	/** Tells the page where to float the selection toolbar (only when it moved). */
	private reportAnchor() {
		const piece = this.selected && this.pieces.get(this.selected.id);
		let key = '';
		let p: { x: number; y: number } | null = null;
		if (piece && this.selected) {
			const v = new THREE.Vector3(piece.position.x, this.selected.h + 10, piece.position.z);
			v.project(this.camera);
			if (v.z < 1) {
				p = {
					x: Math.round(((v.x + 1) / 2) * this.el.clientWidth),
					y: Math.round(((1 - v.y) / 2) * this.el.clientHeight)
				};
				key = `${p.x},${p.y}`;
			}
		}
		if (key === this.lastAnchor) return;
		this.lastAnchor = key;
		this.events.onAnchor?.(p);
	}

	/** Height of the piece's bottom: on the floor, on another piece, or hanging from the ceiling. */
	private baseY(f: Furniture, furn: Furniture[]) {
		return modelInfo(f)?.mount === 'ceiling' ? this.ceilingH - f.h : elevation(f, furn);
	}

	/** Cheap update for moves and rotations. */
	setPositions(furn: Furniture[]) {
		for (const f of furn) {
			const piece = this.pieces.get(f.id);
			if (!piece) continue;
			const y = this.baseY(f, furn);
			piece.position.set(f.cx, y, f.cy);
			piece.rotation.y = (-f.rot * Math.PI) / 180;
			if (this.selected?.id === f.id) this.selected.h = f.h + y;
		}
	}

	private setupDrag() {
		const el = this.renderer.domElement;
		const ray = new THREE.Raycaster();
		const ndc = new THREE.Vector2();
		const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
		const hit = new THREE.Vector3();
		let drag: { id: string; ox: number; oz: number } | null = null;
		let down: { x: number; y: number } | null = null;

		const aim = (e: PointerEvent) => {
			const r = el.getBoundingClientRect();
			ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
			ray.setFromCamera(ndc, this.camera);
		};

		el.addEventListener('pointerdown', (e) => {
			down = { x: e.clientX, y: e.clientY };
			aim(e);
			const meshes = [...this.pieces.values()].map((p) => p.children[0]);
			const hits = ray.intersectObjects(meshes, false);
			if (!hits.length || !ray.ray.intersectPlane(floor, hit)) return;
			const id = hits[0].object.userData.fid as string;
			const piece = this.pieces.get(id)!;
			this.events.onSelect(id);
			drag = { id, ox: piece.position.x - hit.x, oz: piece.position.z - hit.z };
			this.controls.enabled = false;
			el.setPointerCapture(e.pointerId);
		});

		el.addEventListener('pointermove', (e) => {
			if (!drag) return;
			aim(e);
			if (!ray.ray.intersectPlane(floor, hit)) return;
			this.events.onDrag(drag.id, hit.x + drag.ox, hit.z + drag.oz, !e.altKey);
		});

		const end = (e: PointerEvent | null) => {
			if (drag) {
				drag = null;
				this.controls.enabled = true;
			} else if (down && e && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) {
				// Plain click on empty space clears the selection
				this.events.onSelect(null);
			}
			down = null;
		};
		el.addEventListener('dblclick', (e) => {
			aim(e as PointerEvent);
			const hits = ray.intersectObjects(
				[...this.pieces.values()].map((p) => p.children[0]),
				false
			);
			if (hits.length) this.events.onOpen?.(hits[0].object.userData.fid as string);
		});
		el.addEventListener('pointerup', end);
		el.addEventListener('pointercancel', () => end(null));
	}
}

/* ---------- Helpers ---------- */

function addBox(
	group: THREE.Group,
	pos: [number, number, number],
	size: [number, number, number],
	rotY: number,
	mat: THREE.Material | THREE.Material[],
	opts: { cast?: boolean; edges?: THREE.LineBasicMaterial } = {}
) {
	const geo = new THREE.BoxGeometry(...size);
	const m = new THREE.Mesh(geo, mat);
	m.position.set(...pos);
	m.rotation.y = rotY;
	m.castShadow = opts.cast !== false;
	m.receiveShadow = true;
	group.add(m);
	if (opts.edges) {
		const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), opts.edges);
		e.position.copy(m.position);
		e.rotation.copy(m.rotation);
		group.add(e);
	}
	return m;
}

/** Text label that always faces the camera. */
function labelSprite(text: string, size: number, strong: boolean) {
	const c = document.createElement('canvas');
	const x = c.getContext('2d')!;
	const px = 44;
	const pad = 16;
	const font = `${strong ? 600 : 500} ${px}px Manrope, system-ui, sans-serif`;
	x.font = font;
	const w = Math.ceil(x.measureText(text).width) + pad * 2;
	const h = px + pad * 1.2;
	c.width = w;
	c.height = h;
	x.font = font;
	x.fillStyle = cssVar('--sheet');
	x.globalAlpha = 0.9;
	x.beginPath();
	x.roundRect(0, 0, w, h, 10);
	x.fill();
	x.globalAlpha = 1;
	x.fillStyle = cssVar('--ink');
	x.textBaseline = 'middle';
	x.fillText(text, pad, h / 2 + 2);
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	const sp = new THREE.Sprite(
		new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
	);
	sp.scale.set((size * w) / h, size, 1);
	sp.renderOrder = 10;
	return sp;
}

function disposeGroup(group: THREE.Group) {
	group.traverse((o) => {
		const obj = o as THREE.Mesh;
		// Real models share geometry and materials with the loader's cache
		if (obj.userData.shared) return;
		obj.geometry?.dispose();
		const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
		for (const m of mats) {
			const map = (m as THREE.MeshStandardMaterial).map;
			if (map && !map.userData.shared) map.dispose();
			m.dispose();
		}
	});
	group.clear();
}
