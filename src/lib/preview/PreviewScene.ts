import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { buildWalls, type Geometry } from '../planner/geometry';
import type { Furniture } from '../planner/types';
import * as mat from './materials';
import type { Shot } from './shots';
import { dayOfYear, sunDirection, sunLight } from './sun';
import { WalkControls } from './WalkControls';

export type CameraMode = 'orbit' | 'tour' | 'walk';

interface CameraState {
	pos: THREE.Vector3;
	target: THREE.Vector3;
}

const GLIDE = 2.2; // seconds between shots
const HOLD = 5; // seconds per tour shot
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Plan [x, height, y] in cm → world vector in meters. */
const toWorld = ([x, h, y]: [number, number, number]) =>
	new THREE.Vector3(x, h, y).multiplyScalar(0.01);

/**
 * Realistic, closed version of the room for cinematic previews. Everything is modelled
 * in cm inside `root` (scaled to meters), so physical light units work.
 */
export class PreviewScene {
	mode: CameraMode = 'orbit';
	/** Called when the mode changes by itself (e.g. the user interrupts the tour) */
	onModeChange: (mode: CameraMode) => void = () => {};

	private renderer: THREE.WebGLRenderer;
	private composer: EffectComposer;
	private scene = new THREE.Scene();
	private camera = new THREE.PerspectiveCamera(55, 1, 0.05, 3000);
	private controls: OrbitControls;
	private walk: WalkControls;
	private root = new THREE.Group();
	private sky = new Sky();
	private sun = new THREE.DirectionalLight(0xffffff, 3);
	private lamp = new THREE.PointLight(0xffd6a6, 0, 0, 2);
	private lampShade = new THREE.MeshStandardMaterial({
		color: 0xffffff,
		emissive: 0xffd9a8,
		emissiveIntensity: 0
	});
	private ceiling: THREE.Object3D | null = null;
	private geo: Geometry | null = null;
	private hours = 9;
	private resizeObserver: ResizeObserver;
	private lastTime = performance.now();
	private frame = 0;

	private glide: { from: CameraState; to: CameraState; t: number } | null = null;
	private tour: { shots: Shot[]; index: number; t: number; base: CameraState } | null = null;

	constructor(private el: HTMLElement) {
		const r = (this.renderer = new THREE.WebGLRenderer({
			antialias: true,
			preserveDrawingBuffer: false
		}));
		r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
		r.shadowMap.enabled = true;
		r.shadowMap.type = THREE.PCFShadowMap;
		r.toneMapping = THREE.ACESFilmicToneMapping;
		r.toneMappingExposure = 0.85;
		r.domElement.className = 'block h-full w-full touch-none';
		el.appendChild(r.domElement);

		this.root.scale.setScalar(0.01);
		this.scene.add(this.root);

		// Sky dome and ground far below the window
		this.sky.scale.setScalar(1000);
		this.sky.material.uniforms.turbidity.value = 3;
		this.sky.material.uniforms.rayleigh.value = 1.2;
		this.sky.material.uniforms.cloudCoverage.value = 0.25;
		this.scene.add(this.sky);
		const ground = new THREE.Mesh(
			new THREE.PlaneGeometry(800, 800),
			new THREE.MeshStandardMaterial({ color: 0x75825f, roughness: 1 })
		);
		ground.rotation.x = -Math.PI / 2;
		ground.position.y = -9;
		ground.receiveShadow = true;
		this.scene.add(ground);

		// Indirect light approximation: neutral studio environment, scaled by daylight
		const pmrem = new THREE.PMREMGenerator(r);
		this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
		pmrem.dispose();

		this.sun.castShadow = true;
		this.sun.shadow.mapSize.set(2048, 2048);
		Object.assign(this.sun.shadow.camera, {
			left: -6,
			right: 6,
			top: 6,
			bottom: -6,
			near: 0.5,
			far: 40
		});
		this.sun.shadow.bias = -0.0004;
		this.sun.shadow.normalBias = 0.02;
		this.sun.shadow.radius = 3;
		this.scene.add(this.sun, this.sun.target);

		this.lamp.castShadow = true;
		this.lamp.shadow.mapSize.set(1024, 1024);
		this.lamp.shadow.radius = 4;
		this.lamp.shadow.bias = -0.002;
		this.scene.add(this.lamp);

		this.composer = new EffectComposer(r);
		this.composer.addPass(new RenderPass(this.scene, this.camera));
		const ao = new GTAOPass(this.scene, this.camera, 1, 1);
		ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1 });
		ao.blendIntensity = 0.85;
		this.composer.addPass(ao);
		this.composer.addPass(new OutputPass());

		this.controls = new OrbitControls(this.camera, r.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.minDistance = 0.3;
		this.controls.maxDistance = 25;
		this.controls.maxPolarAngle = Math.PI * 0.95;
		// Any manual camera input ends the tour
		r.domElement.addEventListener('pointerdown', () => {
			if (this.mode === 'tour') this.setMode('orbit', true);
		});
		this.controls.addEventListener('start', () => (this.glide = null));

		this.walk = new WalkControls(this.camera, r.domElement, (x, y) => this.canStand(x, y));

		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(el);
		this.resize();

		const loop = () => {
			this.frame = requestAnimationFrame(loop);
			const now = performance.now();
			const dt = Math.min((now - this.lastTime) / 1000, 0.1);
			this.lastTime = now;
			if (!this.el.offsetParent) return;
			this.update(dt);
			this.composer.render();
		};
		loop();
	}

	dispose() {
		cancelAnimationFrame(this.frame);
		this.resizeObserver.disconnect();
		this.controls.dispose();
		this.walk.dispose();
		disposeTree(this.scene);
		this.composer.dispose();
		this.renderer.dispose();
		this.renderer.domElement.remove();
	}

	private resize() {
		const w = this.el.clientWidth || 1;
		const h = this.el.clientHeight || 1;
		this.renderer.setSize(w, h, false);
		this.composer.setSize(w, h);
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
	}

	/* ---------- Room ---------- */

	build(g: Geometry, furn: Furniture[]) {
		this.geo = g;
		disposeTree(this.root);
		const grp = this.root;
		const wallMat = mat.plaster();

		// Floor and ceiling
		const floorGeo = new THREE.ShapeGeometry(
			new THREE.Shape(g.poly.map((p) => new THREE.Vector2(p[0], -p[1])))
		);
		floorGeo.rotateX(-Math.PI / 2);
		const floor = new THREE.Mesh(floorGeo, mat.woodFloor());
		floor.receiveShadow = true;
		grp.add(floor);

		const ceilGeo = new THREE.ShapeGeometry(
			new THREE.Shape(g.poly.map((p) => new THREE.Vector2(p[0], p[1])))
		);
		ceilGeo.rotateX(Math.PI / 2);
		const ceiling = new THREE.Mesh(ceilGeo, mat.plaster(0xf7f6f3));
		ceiling.material.side = THREE.DoubleSide;
		ceiling.position.y = g.H;
		ceiling.castShadow = ceiling.receiveShadow = true;
		grp.add(ceiling);
		this.ceiling = ceiling;

		// Walls with openings
		for (const s of buildWalls(g, g.H).segs) {
			const { S, d, n, t } = s.e;
			const um = (s.u0 + s.u1) / 2;
			box(
				grp,
				[S[0] + d[0] * um + (n[0] * t) / 2, (s.h0 + s.h1) / 2, S[1] + d[1] * um + (n[1] * t) / 2],
				[s.u1 - s.u0, s.h1 - s.h0, t],
				Math.atan2(-d[1], d[0]),
				wallMat
			);
		}

		// Room door, closed, with handle
		const dr = g.doors[0];
		const dz = dr.y - g.tI / 2;
		box(grp, [(dr.x0 + dr.x1) / 2, dr.h / 2, dz], [dr.w, dr.h, 4], 0, mat.doorLeaf());
		const handleX = dr.hinge[0] === dr.x0 ? dr.x1 - 8 : dr.x0 + 8;
		box(grp, [handleX, 105, dz + 4], [12, 2, 2], 0, mat.frame());

		// Glass front: panes, closed balcony door, frames
		const fr = g.front;
		const zc = g.L + g.tE / 2;
		const glass = mat.glass();
		const frame = mat.frame();
		const paneEdges = [fr.gx0, fr.bOff, fr.bOff + fr.bW, fr.gx1];
		for (let i = 0; i < 3; i++) {
			const a = paneEdges[i];
			const b = paneEdges[i + 1];
			if (b - a <= 0.5) continue;
			const pane = box(grp, [(a + b) / 2, fr.gH / 2, zc], [b - a, fr.gH, 1.5], 0, glass);
			pane.castShadow = pane.receiveShadow = false;
		}
		for (const x of [fr.gx0 + 3, fr.bOff, fr.bOff + fr.bW, fr.gx1 - 3])
			box(grp, [x, fr.gH / 2, zc], [6, fr.gH, 8], 0, frame);
		box(grp, [(fr.gx0 + fr.gx1) / 2, fr.gH - 3, zc], [fr.gx1 - fr.gx0, 6, 8], 0, frame);
		box(grp, [(fr.gx0 + fr.gx1) / 2, 2, zc], [fr.gx1 - fr.gx0, 4, 8], 0, frame);

		// Loggia: floor, parapet, side walls up to the ceiling
		if (g.D > 0) {
			const ly0 = g.L + g.tE;
			const lf = box(grp, [g.W / 2, -2, ly0 + g.D / 2], [g.W, 4, g.D], 0, mat.concrete());
			lf.castShadow = false;
			const ph = Math.max(1, g.PH);
			box(grp, [g.W / 2, ph / 2, ly0 + g.D + 7.5], [g.W + 2 * g.tI, ph, 15], 0, wallMat);
			box(grp, [-g.tI / 2, g.H / 2, ly0 + g.D / 2], [g.tI, g.H, g.D], 0, wallMat);
			box(grp, [g.W + g.tI / 2, g.H / 2, ly0 + g.D / 2], [g.tI, g.H, g.D], 0, wallMat);
			box(grp, [g.W / 2, g.H + 10, ly0 + g.D / 2], [g.W + 2 * g.tI, 20, g.D], 0, wallMat);
		}

		// Furniture as soft-edged boxes
		for (const f of furn) {
			const r = Math.min(2.5, f.w / 4, f.d / 4, f.h / 4);
			const m = new THREE.Mesh(new RoundedBoxGeometry(f.w, f.h, f.d, 3, r), mat.furniture(f.color));
			m.position.set(f.cx, f.h / 2, f.cy);
			m.rotation.y = (-f.rot * Math.PI) / 180;
			m.castShadow = m.receiveShadow = true;
			grp.add(m);
		}

		// Flush ceiling light in the center of the main room part
		const lx = g.W / 2;
		const lz = g.hasNotch ? (g.N + g.L) / 2 : g.L / 2;
		const shade = new THREE.Mesh(new THREE.CylinderGeometry(20, 22, 7, 48), this.lampShade);
		shade.position.set(lx, g.H - 3.5, lz);
		grp.add(shade);
		this.lamp.position.set(lx / 100, (g.H - 20) / 100, lz / 100);

		this.sun.target.position.set(g.W / 200, 0, g.L / 200);
		this.setTime(this.hours);
	}

	/* ---------- Lighting ---------- */

	setTime(hours: number) {
		this.hours = hours;
		const dir = sunDirection(hours, dayOfYear());
		const light = sunLight(dir.y);
		this.sun.color.copy(light.color);
		this.sun.intensity = light.intensity;
		this.sun.visible = light.intensity > 0.01;
		this.sun.position.copy(this.sun.target.position).addScaledVector(dir, 15);
		this.sky.material.uniforms.sunPosition.value.copy(dir);
		this.scene.environmentIntensity = 0.03 + 0.4 * light.daylight;
	}

	setLamp(on: boolean) {
		this.lamp.intensity = on ? 18 : 0;
		this.lampShade.emissiveIntensity = on ? 2.5 : 0;
	}

	/* ---------- Camera ---------- */

	setMode(mode: CameraMode, notify = false) {
		if (this.mode === mode) return;
		if (this.mode === 'walk') {
			// Orbit around a point just in front of where we stood
			const ahead = new THREE.Vector3(0, 0, -1.5).applyQuaternion(this.camera.quaternion);
			this.controls.target.copy(this.camera.position).add(ahead);
		}
		this.mode = mode;
		this.tour = null;
		this.walk.enabled = mode === 'walk';
		this.controls.enabled = mode === 'orbit';
		if (mode === 'walk') {
			this.glide = null;
			this.walk.start();
		}
		if (notify) this.onModeChange(mode);
	}

	/** Glides to a shot (orbit mode). */
	goTo(shot: Shot) {
		this.setMode('orbit', true);
		this.startGlide(shot);
	}

	startTour(shots: Shot[]) {
		this.setMode('tour');
		this.controls.enabled = false;
		this.tour = { shots, index: 0, t: 0, base: this.shotState(shots[0]) };
		this.startGlide(shots[0]);
	}

	private shotState(shot: Shot): CameraState {
		return { pos: toWorld(shot.pos), target: toWorld(shot.target) };
	}

	private startGlide(shot: Shot) {
		this.glide = {
			from: { pos: this.camera.position.clone(), target: this.controls.target.clone() },
			to: this.shotState(shot),
			t: 0
		};
	}

	private update(dt: number) {
		if (this.mode === 'walk') {
			this.walk.update(dt);
		} else if (this.glide) {
			const gl = this.glide;
			gl.t = Math.min(1, gl.t + dt / GLIDE);
			const k = ease(gl.t);
			this.camera.position.lerpVectors(gl.from.pos, gl.to.pos, k);
			this.controls.target.lerpVectors(gl.from.target, gl.to.target, k);
			this.camera.lookAt(this.controls.target);
			if (gl.t >= 1) this.glide = null;
		} else if (this.tour) {
			this.updateTour(dt);
		} else {
			this.controls.update();
		}
		// Look into the room from above
		if (this.ceiling && this.geo)
			this.ceiling.visible = this.camera.position.y < this.geo.H / 100 + 0.02;
	}

	/** Slow push-in and drift around the target, then glide to the next shot. */
	private updateTour(dt: number) {
		const tour = this.tour!;
		tour.t = Math.min(1, tour.t + dt / HOLD);
		const k = ease(tour.t);
		const { pos, target } = tour.base;
		const offset = pos.clone().sub(target);
		offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(10) * (k - 0.5) * 2);
		offset.multiplyScalar(1 - 0.12 * k);
		this.camera.position.copy(target).add(offset);
		this.controls.target.copy(target);
		this.camera.lookAt(target);
		if (tour.t >= 1) {
			tour.index = (tour.index + 1) % tour.shots.length;
			tour.t = 0;
			const next = tour.shots[tour.index];
			// Start the drift at its beginning so the glide ends where the hold starts
			const state = this.shotState(next);
			const start = state.pos.clone().sub(state.target);
			start.applyAxisAngle(new THREE.Vector3(0, 1, 0), -THREE.MathUtils.degToRad(10));
			tour.base = state;
			this.glide = {
				from: { pos: this.camera.position.clone(), target: this.controls.target.clone() },
				to: { pos: state.target.clone().add(start), target: state.target },
				t: 0
			};
		}
	}

	/** Walk mode collision: stay 25 cm away from the walls. Plan coordinates in cm. */
	private canStand(x: number, y: number) {
		const g = this.geo;
		if (!g) return true;
		const m = 25;
		const inMain = x > m && x < g.W - m && y > (g.hasNotch ? g.N : 0) + m && y < g.L - m;
		const inNotch = g.hasNotch && x > g.NW + m && x < g.W - m && y > m && y < g.L - m;
		return inMain || inNotch;
	}

	/** Holds a walk key from the on-screen pad. */
	press(key: string, down: boolean) {
		this.walk.press(key, down);
	}

	walkFrom(shot: Shot) {
		this.walk.place(shot.pos, shot.target);
	}
}

function box(
	group: THREE.Object3D,
	pos: [number, number, number],
	size: [number, number, number],
	rotY: number,
	material: THREE.Material
) {
	const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
	m.position.set(...pos);
	m.rotation.y = rotY;
	m.castShadow = m.receiveShadow = true;
	group.add(m);
	return m;
}

function disposeTree(obj: THREE.Object3D) {
	obj.traverse((o) => {
		const mesh = o as THREE.Mesh;
		if (o === obj && obj.type === 'Scene') return;
		mesh.geometry?.dispose();
		const mats = Array.isArray(mesh.material)
			? mesh.material
			: mesh.material
				? [mesh.material]
				: [];
		for (const m of mats) {
			const s = m as THREE.MeshStandardMaterial;
			s.map?.dispose();
			m.dispose();
		}
	});
	if (obj.type !== 'Scene') obj.clear();
}
