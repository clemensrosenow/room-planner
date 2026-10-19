import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { furnitureKind, modelInfo, MODELS } from '../planner/catalog';
import { elevation } from '../planner/furniture';
import { buildWalls, floorRects, type Geometry } from '../planner/geometry';
import type { Furniture } from '../planner/types';
import * as mat from './materials';
import { loadModel, modelClone } from './modelLoader';
import { buildLoggiaSet, buildPiece, MaterialKit } from './models';
import { currentScreen, isPhone } from './quality';
import type { Shot } from './shots';
import { dayOfYear, sunDirection, sunLight } from './sun';
import { WalkControls } from './WalkControls';

/** walk: first person inside the room; overview: orbit above the room (the only view outside) */
export type CameraMode = 'walk' | 'tour' | 'overview';

interface CameraState {
	pos: THREE.Vector3;
	target: THREE.Vector3;
}

interface Pose {
	pos: THREE.Vector3;
	quat: THREE.Quaternion;
}

const GLIDE = 2.2; // seconds between shots
/** Overview orbit: lowest view, measured from straight down */
const OVERVIEW_MAX_POLAR = Math.PI * 0.3;
const UP = new THREE.Vector3(0, 1, 0);
/** While the camera stands still only the clouds drift, so a few frames a second are enough */
const IDLE_FRAME_MS = 1000 / 15;

/** Replaces NaN/Infinity with black and caps extreme HDR values. */
const SanitizeShader = {
	uniforms: { tDiffuse: { value: null } },
	vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}`,
	fragmentShader: /* glsl */ `
		uniform sampler2D tDiffuse;
		varying vec2 vUv;
		void main() {
			vec4 c = texture2D(tDiffuse, vUv);
			if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
			gl_FragColor = vec4(min(c.rgb, vec3(64.0)), c.a);
		}`
};
const HOLD = 5; // seconds per tour shot
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Plan [x, height, y] in cm → world vector in meters. */
const toWorld = ([x, h, y]: [number, number, number]) =>
	new THREE.Vector3(x, h, y).multiplyScalar(0.01);

/** Camera orientation at `pos` looking at `target`. */
const lookQuat = (pos: THREE.Vector3, target: THREE.Vector3) =>
	new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, target, UP));

/** Point at fraction `k` of the way along a polyline. */
function along(path: THREE.Vector3[], k: number, out: THREE.Vector3) {
	const lens = path.slice(1).map((p, i) => p.distanceTo(path[i]));
	let d = k * lens.reduce((a, b) => a + b, 0);
	for (let i = 0; i < lens.length; i++) {
		if (d <= lens[i] || i === lens.length - 1)
			return out.lerpVectors(path[i], path[i + 1], lens[i] ? Math.min(1, d / lens[i]) : 1);
		d -= lens[i];
	}
	return out.copy(path[0]);
}

/**
 * Realistic, closed version of the room for cinematic previews. Everything is modelled
 * in cm inside `root` (scaled to meters), so physical light units work.
 */
export class PreviewScene {
	mode: CameraMode = 'walk';
	/** Called when the mode changes by itself (e.g. the user interrupts the tour) */
	onModeChange: (mode: CameraMode) => void = () => {};
	/** Called when the user moves or turns by hand, leaving the chosen viewpoint */
	onManual: () => void = () => {};

	private renderer: THREE.WebGLRenderer;
	private composer: EffectComposer;
	private scene = new THREE.Scene();
	private camera = new THREE.PerspectiveCamera(55, 1, 0.05, 3000);
	private controls: OrbitControls;
	private walk: WalkControls;
	private root = new THREE.Group();
	private sky = new Sky();
	/** Copy of the sky that only feeds reflections and ambient light */
	private envSky = new Sky();
	private envScene = new THREE.Scene();
	private pmrem: THREE.PMREMGenerator;
	private envTarget: THREE.WebGLRenderTarget | null = null;
	private envGround = new THREE.MeshBasicMaterial({ color: 0x4a5040 });
	private envDirty = true;
	private envUpdated = 0;
	private sun = new THREE.DirectionalLight(0xffffff, 3);
	/** Soft daylight through the glass front */
	private windowLight = new THREE.RectAreaLight(0xffffff, 0, 1, 1);
	/** Warm light bounced off the sunlit patch of floor (cheap global illumination) */
	private bounce = new THREE.PointLight(0xffd2a0, 0, 6, 2);
	/** Warm light reflected by the wooden floor onto walls and ceiling */
	private floorBounce = new THREE.HemisphereLight(0xfff6ec, 0xc59a6c, 0);
	private lampOn = false;
	private daylight = 1;
	private bloom: UnrealBloomPass;
	private lamp = new THREE.PointLight(0xffd6a6, 0, 0, 2);
	private lampShade = new THREE.MeshStandardMaterial({
		color: 0xffffff,
		emissive: 0xffd9a8,
		emissiveIntensity: 0
	});
	/** Ceilings of room and loggia, and what hangs from them: hidden when looking from above */
	private roof: THREE.Object3D[] = [];
	/** Built-in ceiling light, used while no lamp is placed */
	private shade: THREE.Object3D | null = null;
	/** Lights of the placed lamps (in meters, outside `root`) */
	private lampLights: THREE.PointLight[] = [];
	/** Glowing parts of the placed lamp models */
	private lampGlow: THREE.MeshStandardMaterial[] = [];
	/** Last room built, rebuilt once a real model has loaded */
	private last: { g: Geometry; furn: Furniture[] } | null = null;
	private geo: Geometry | null = null;
	private hours = 9;
	private resizeObserver: ResizeObserver;
	private lastTime = performance.now();
	private frame = 0;
	/** Something other than the camera changed since the last frame */
	private dirty = true;
	private rendered = 0;
	/** Camera at the last frame, to tell whether it moved */
	private seen = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 0 };
	/** Phones skip ambient occlusion and use smaller shadow maps */
	private phone = isPhone(currentScreen());

	private glide: {
		path: THREE.Vector3[];
		from: THREE.Quaternion;
		to: THREE.Quaternion;
		t: number;
	} | null = null;
	private tour: { shots: Shot[]; index: number; t: number; base: CameraState } | null = null;

	constructor(private el: HTMLElement) {
		const r = (this.renderer = new THREE.WebGLRenderer({
			antialias: true,
			preserveDrawingBuffer: false
		}));
		r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.phone ? 1.25 : 1.5));
		r.shadowMap.enabled = true;
		r.shadowMap.type = THREE.PCFShadowMap;
		// Nothing moves in the room: shadows are only redrawn after a change (see invalidate)
		r.shadowMap.autoUpdate = false;
		// Neutral keeps whites white and colors true, while rolling off bright windows
		r.toneMapping = THREE.NeutralToneMapping;
		r.toneMappingExposure = 1;
		r.domElement.className = 'block h-full w-full touch-none';
		el.appendChild(r.domElement);

		this.root.scale.setScalar(0.01);
		this.scene.add(this.root);

		// Sky dome with drifting clouds, and ground far below the window
		for (const sky of [this.sky, this.envSky]) {
			const u = sky.material.uniforms;
			u.turbidity.value = 3;
			u.rayleigh.value = 1.2;
			u.cloudCoverage.value = 0.3;
		}
		this.sky.scale.setScalar(1000);
		this.scene.add(this.sky);
		const ground = new THREE.Mesh(
			new THREE.PlaneGeometry(800, 800),
			new THREE.MeshStandardMaterial({ color: 0x6f7a5c, roughness: 1 })
		);
		ground.rotation.x = -Math.PI / 2;
		ground.position.y = -9;
		ground.receiveShadow = true;
		this.scene.add(ground, surroundings());

		// Reflections and ambient light come from the same sky (see updateEnvironment)
		this.envSky.scale.setScalar(50);
		this.envSky.material.uniforms.showSunDisc.value = 0;
		const envGround = new THREE.Mesh(new THREE.CircleGeometry(40, 32), this.envGround);
		envGround.rotation.x = -Math.PI / 2;
		envGround.position.y = -2;
		this.envScene.add(this.envSky, envGround);
		this.pmrem = new THREE.PMREMGenerator(r);

		RectAreaLightUniformsLib.init();
		this.scene.add(this.windowLight, this.bounce);

		this.sun.castShadow = true;
		this.sun.shadow.mapSize.setScalar(this.phone ? 1024 : 2048);
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

		this.lamp.shadow.mapSize.setScalar(this.phone ? 512 : 1024);
		this.lamp.shadow.radius = 4;
		this.lamp.shadow.bias = -0.006;
		this.lamp.shadow.normalBias = 0.03;
		this.scene.add(this.lamp, this.floorBounce);

		// HDR pipeline with 4× MSAA: render, ambient occlusion, bloom, tone mapping, vignette.
		// Phones get 2× MSAA and no ambient occlusion, which renders the whole scene once more
		this.composer = new EffectComposer(
			r,
			new THREE.WebGLRenderTarget(1, 1, {
				type: THREE.HalfFloatType,
				samples: this.phone ? 2 : 4
			})
		);
		this.composer.addPass(new RenderPass(this.scene, this.camera));
		if (!this.phone) {
			const ao = new GTAOPass(this.scene, this.camera, 1, 1);
			ao.updateGtaoMaterial({ radius: 0.25, distanceExponent: 1.5, thickness: 1, scale: 1 });
			ao.blendIntensity = 0.7;
			this.composer.addPass(ao);
		}
		// The sky shader can produce NaN or huge values at sunset; bloom would smear them
		// over the whole frame, so they are cleaned up first
		this.composer.addPass(new ShaderPass(SanitizeShader));
		this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.12, 0.4, 1.6);
		this.composer.addPass(this.bloom);
		this.composer.addPass(new OutputPass());
		const vignette = new ShaderPass(VignetteShader);
		vignette.uniforms.offset.value = 0.9;
		vignette.uniforms.darkness.value = 0.85;
		this.composer.addPass(vignette);

		// Only used for the overview: orbit above the room, never down past the walls
		this.controls = new OrbitControls(this.camera, r.domElement);
		this.controls.enabled = false;
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.enablePan = false;
		this.controls.maxPolarAngle = OVERVIEW_MAX_POLAR;
		this.controls.addEventListener('start', () => (this.glide = null));

		this.walk = new WalkControls(this.camera, r.domElement, (x, y) => this.canStand(x, y));
		this.walk.enabled = true;
		this.walk.onInput = () => this.onWalkInput();

		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(el);
		this.resize();

		const loop = () => {
			this.frame = requestAnimationFrame(loop);
			const now = performance.now();
			const dt = Math.min((now - this.lastTime) / 1000, 0.1);
			this.lastTime = now;
			if (!this.el.offsetParent) {
				this.dirty = true;
				return;
			}
			this.update(dt);
			// Seconds: the cloud speed is tuned for them. Milliseconds made the clouds race
			// across the sky and flicker
			this.sky.material.uniforms.time.value += dt;
			if (this.envDirty && now - this.envUpdated > 250) this.updateEnvironment(now);
			if (!this.cameraMoved() && !this.dirty && now - this.rendered < IDLE_FRAME_MS) return;
			this.dirty = false;
			this.rendered = now;
			this.composer.render();
		};
		loop();
	}

	/** Draws the next frame in full, with fresh shadows when `shadows` is set. */
	private invalidate(shadows = false) {
		this.dirty = true;
		if (shadows) this.renderer.shadowMap.needsUpdate = true;
	}

	/** Whether the camera moved or zoomed since the last call. */
	private cameraMoved() {
		const c = this.camera;
		const s = this.seen;
		if (c.position.equals(s.pos) && c.quaternion.equals(s.quat) && c.fov === s.fov) return false;
		s.pos.copy(c.position);
		s.quat.copy(c.quaternion);
		s.fov = c.fov;
		return true;
	}

	dispose() {
		cancelAnimationFrame(this.frame);
		this.resizeObserver.disconnect();
		this.controls.dispose();
		this.walk.dispose();
		this.clearLamps();
		disposeTree(this.scene);
		disposeTree(this.envScene);
		this.envTarget?.dispose();
		this.pmrem.dispose();
		this.composer.dispose();
		this.renderer.dispose();
		// Browsers allow only a few live WebGL contexts (iOS Safari about 16): free it now
		this.renderer.forceContextLoss();
		this.renderer.domElement.remove();
	}

	private resize() {
		const w = this.el.clientWidth || 1;
		const h = this.el.clientHeight || 1;
		this.renderer.setSize(w, h, false);
		this.composer.setSize(w, h);
		this.bloom.resolution.set(w, h);
		this.camera.aspect = w / h;
		this.updateFov(1);
		this.invalidate();
	}

	/**
	 * Inside, the horizontal view stays the same on any screen shape: wider in small rooms,
	 * narrower in big ones, scaled by the user's zoom. Above the room a calmer lens is used.
	 */
	private updateFov(dt: number) {
		const g = this.geo;
		const deg = THREE.MathUtils.degToRad;
		const fromH = (h: number) => (2 * Math.atan(h / this.camera.aspect) * 180) / Math.PI;
		let fov: number;
		if (!g || this.camera.position.y > g.H / 100) {
			fov = THREE.MathUtils.clamp(fromH(Math.tan(deg(37.5))), 50, 90);
		} else {
			const size = Math.max(g.W, g.L);
			const hfov = THREE.MathUtils.clamp(95 - ((size - 300) * 25) / 400, 70, 95);
			fov = THREE.MathUtils.clamp(fromH(Math.tan(deg(hfov / 2)) * this.walk.zoom), 25, 95);
		}
		const next = this.camera.fov + (fov - this.camera.fov) * Math.min(1, dt * 8);
		if (Math.abs(next - this.camera.fov) < 1e-3 && dt < 1) return;
		this.camera.fov = next;
		this.camera.updateProjectionMatrix();
	}

	/* ---------- Room ---------- */

	build(g: Geometry, furn: Furniture[]) {
		this.geo = g;
		this.last = { g, furn };
		this.clearLamps();
		disposeTree(this.root);
		const grp = this.root;
		// Real models still loading: their stand-ins are swapped in one rebuild once all settle
		const missing = new Set<string>();
		const wallMat = mat.plaster();
		// Both faces cast shadows, so no sunlight leaks along wall joints
		wallMat.shadowSide = THREE.DoubleSide;

		// Floor and ceiling
		const floorGeo = new THREE.ShapeGeometry(
			new THREE.Shape(g.poly.map((p) => new THREE.Vector2(p[0], -p[1])))
		);
		floorGeo.rotateX(-Math.PI / 2);
		const floor = new THREE.Mesh(floorGeo, mat.woodFloor());
		floor.receiveShadow = true;
		grp.add(floor);

		// Ceiling as a solid slab resting on the walls, so no light leaks along the joint
		const ceiling = box(
			grp,
			[g.W / 2, g.H + 8, (g.L + g.tE - g.tI) / 2],
			[g.W + 2 * g.tI, 16, g.L + g.tE + g.tI],
			0,
			new THREE.MeshStandardMaterial({ color: 0xf7f6f3, roughness: 0.95 })
		);
		this.roof = [ceiling];

		// Walls with openings, skirting boards along every wall that reaches the floor
		const trim = mat.trim();
		for (const s of buildWalls(g, g.H).segs) {
			const { S, d, n, t } = s.e;
			// Pieces above openings overlap their neighbours a little, which hides the seam
			const lap = s.h0 > 0 ? 0.5 : 0;
			const um = (s.u0 + s.u1) / 2;
			const rot = Math.atan2(-d[1], d[0]);
			box(
				grp,
				[S[0] + d[0] * um + (n[0] * t) / 2, (s.h0 + s.h1) / 2, S[1] + d[1] * um + (n[1] * t) / 2],
				[s.u1 - s.u0 + 2 * lap, s.h1 - s.h0, t],
				rot,
				wallMat
			);
			if (s.h0 === 0)
				box(
					grp,
					[S[0] + d[0] * um - n[0] * 0.75, 3.5, S[1] + d[1] * um - n[1] * 0.75],
					[s.u1 - s.u0, 7, 1.5],
					rot,
					trim
				);
		}

		// Room door, closed, with handle
		const dr = g.doors[0];
		const dz = dr.y - g.tI / 2;
		box(grp, [(dr.x0 + dr.x1) / 2, dr.h / 2, dz], [dr.w, dr.h, 4], 0, mat.doorLeaf());
		const handleRight = dr.hinge[0] === dr.x0;
		const handleX = handleRight ? dr.x1 - 8 : dr.x0 + 8;
		const steel = mat.steel();
		box(grp, [handleX, 105, dz + 4], [12, 2, 2], 0, steel);
		box(grp, [handleX + (handleRight ? 5 : -5), 105, dz + 2.5], [3, 16, 1], 0, steel);
		// Door casing on the room side, and a light switch next to the handle
		const cz = dr.y + 0.75;
		for (const x of [dr.x0 - 3.5, dr.x1 + 3.5])
			box(grp, [x, (dr.h + 7) / 2, cz], [7, dr.h + 7, 1.5], 0, trim);
		box(grp, [(dr.x0 + dr.x1) / 2, dr.h + 3.5, cz], [dr.w + 14, 7, 1.5], 0, trim);
		const switchX = handleRight ? dr.x1 + 16 : dr.x0 - 16;
		if (switchX > 6 && switchX < g.doorWallLen - 6)
			box(grp, [switchX, 105, dr.y + 0.5], [8, 8, 1], 0, trim);

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
		// 7 cm frames on all sides
		for (const x of [fr.gx0 + 3.5, fr.bOff, fr.bOff + fr.bW, fr.gx1 - 3.5])
			box(grp, [x, fr.gH / 2, zc], [7, fr.gH, 8], 0, frame);
		box(grp, [(fr.gx0 + fr.gx1) / 2, fr.gH - 3.5, zc], [fr.gx1 - fr.gx0, 7, 8], 0, frame);
		box(grp, [(fr.gx0 + fr.gx1) / 2, 3.5, zc], [fr.gx1 - fr.gx0, 7, 8], 0, frame);

		// Curtains gathered at both ends of a bar above the glass front, which is mounted on the
		// face of the wall pieces beside it
		if (g.curtains) {
			const barY = Math.min(g.H - 6, fr.gH + 10);
			const wall = g.L - fr.bay;
			const z = wall - 6;
			const { x0, x1 } = g.curtains;
			const bar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, x1 - x0, 16), steel);
			bar.rotation.z = Math.PI / 2;
			bar.position.set((x0 + x1) / 2, barY, z);
			grp.add(bar);
			for (const x of [x0 + 4, x1 - 4])
				box(grp, [x, barY + 1, (z + wall) / 2], [2, 2, 6], 0, steel);
			const cloth = new THREE.MeshPhysicalMaterial({
				color: g.curtains.color,
				roughness: 0.95,
				sheen: 0.5,
				sheenRoughness: 0.7,
				side: THREE.DoubleSide
			});
			// Each curtain hangs in deep folds from just under the bar to 1 cm above the floor
			const cw = 55;
			const ch = barY - 3;
			for (const a of [x0, x1 - cw]) {
				const geo = new THREE.PlaneGeometry(cw, ch, 64, 1);
				const pos = geo.attributes.position;
				for (let i = 0; i < pos.count; i++)
					pos.setZ(i, Math.sin((pos.getX(i) / cw) * Math.PI * 14) * 3.5);
				geo.computeVertexNormals();
				const curtain = new THREE.Mesh(geo, cloth);
				curtain.position.set(a + cw / 2, 1 + ch / 2, z);
				curtain.castShadow = curtain.receiveShadow = true;
				grp.add(curtain);
			}
		}

		// Loggia: floor, parapet, side walls up to the ceiling
		if (g.D > 0) {
			const ly0 = g.L + g.tE;
			const lf = box(grp, [g.W / 2, -2, ly0 + g.D / 2], [g.W, 4, g.D], 0, mat.concrete());
			lf.castShadow = false;
			const ph = Math.max(1, g.PH);
			box(grp, [g.W / 2, ph / 2, ly0 + g.D + 7.5], [g.W + 2 * g.tI, ph, 15], 0, wallMat);
			box(grp, [-g.tI / 2, g.H / 2, ly0 + g.D / 2], [g.tI, g.H, g.D], 0, wallMat);
			box(grp, [g.W + g.tI / 2, g.H / 2, ly0 + g.D / 2], [g.tI, g.H, g.D], 0, wallMat);
			this.roof.push(
				box(grp, [g.W / 2, g.H + 10, ly0 + g.D / 2], [g.W + 2 * g.tI, 20, g.D], 0, wallMat)
			);
			// The owner's table and chairs, which never move
			grp.add(buildLoggiaSet(g.loggiaSet, new MaterialKit()));
		}

		// Radiator on a side wall, its front facing the room; a white box while the model loads
		const r = g.radiator;
		if (r) {
			const [w, d] = [r.y1 - r.y0, r.x1 - r.x0];
			const center: [number, number, number] = [(r.x0 + r.x1) / 2, r.h / 2, (r.y0 + r.y1) / 2];
			const model = modelClone('radiator');
			if (model) {
				const size = MODELS.radiator.size;
				model.scale.multiply(new THREE.Vector3(w / size.w, r.h / size.h, d / size.d));
				model.position.set(center[0], 0, center[2]);
				model.rotation.y = r.x0 > 0 ? -Math.PI / 2 : Math.PI / 2;
				grp.add(model);
			} else {
				box(grp, center, [d, r.h, w], 0, trim);
				missing.add('radiator');
			}
		}

		// Furniture: real models where linked (parametric stand-ins while they load), else
		// parametric models picked by type
		const kit = new MaterialKit();
		const lamps: { pos: THREE.Vector3; intensity: number; ceiling: boolean }[] = [];
		// The fixed ceiling lamp is part of the Room, but lights like any lamp piece
		const lamp = g.ceilingLamp;
		const fixtures: Furniture[] = lamp
			? [
					{
						...{ id: 'ceiling-lamp', name: 'Ceiling lamp', kind: 'lamp', model: lamp.model },
						...{ ...MODELS[lamp.model].size, cx: lamp.x, cy: lamp.y, rot: 0, color: 2 }
					}
				]
			: [];
		for (const f of [...fixtures, ...furn]) {
			const info = modelInfo(f);
			const ceiling = info?.mount === 'ceiling';
			const loading: string[] = [];
			const piece = buildPiece(f, kit, loading);
			for (const id of loading) missing.add(id);
			const model = info && !loading.length ? piece : null;
			piece.position.set(f.cx, ceiling ? g.H : elevation(f, furn), f.cy);
			piece.rotation.y = (-f.rot * Math.PI) / 180;
			grp.add(piece);
			if (ceiling) this.roof.push(piece);
			if (model && info?.light?.glow) this.glowParts(model, info.light.glow);

			if (furnitureKind(f) !== 'lamp') continue;
			// The light sits inside the shade, which must not block it
			piece.traverse((o) => (o.castShadow = false));
			piece.updateWorldMatrix(true, true);
			// Bulb: from the model, else just under the top of the stand-in's shade
			// (cm from the piece's origin; a bare model clone is scaled to meters)
			const foot = model ? info?.footprint?.[0] : undefined;
			const local = info?.light
				? new THREE.Vector3(...info.light.pos).sub(new THREE.Vector3(foot?.x ?? 0, 0, foot?.z ?? 0))
				: new THREE.Vector3(0, ceiling ? -f.h + 10 : f.h - 10, 0);
			const bulb = piece.localToWorld(local.divideScalar(piece.scale.x));
			const sphere = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 12), this.lampShade);
			sphere.position.copy(grp.worldToLocal(bulb.clone()));
			grp.add(sphere);
			if (ceiling) this.roof.push(sphere);
			lamps.push({ pos: bulb, intensity: info?.light?.intensity ?? 8, ceiling });
		}

		// One light per lamp; only one casts shadows (the brightest), which keeps it fast
		lamps.sort((a, b) => b.intensity - a.intensity);
		for (const [i, l] of lamps.entries()) {
			const light = new THREE.PointLight(0xffd6a6, 0, 0, 2);
			light.position.copy(l.pos);
			light.userData.intensity = l.intensity;
			if (i === 0) {
				light.shadow.mapSize.setScalar(this.phone ? 512 : 1024);
				light.shadow.radius = 4;
				light.shadow.bias = -0.006;
				light.shadow.normalBias = 0.03;
			}
			this.scene.add(light);
			this.lampLights.push(light);
		}

		// Without placed lamps: flush ceiling light in the center of the main room part
		const lx = g.W / 2;
		const lz = g.hasNotch ? (g.N + g.L) / 2 : g.L / 2;
		const shade = new THREE.Mesh(new THREE.CylinderGeometry(20, 22, 7, 48), this.lampShade);
		shade.position.set(lx, g.H - 3.5, lz);
		grp.add(shade);
		this.shade = shade;
		this.shade.visible = lamps.length === 0;
		this.roof.push(shade);
		this.lamp.position.set(lx / 100, (g.H - 20) / 100, lz / 100);
		this.setLamp(this.lampOn);

		// Daylight panel just inside the glass, shining into the room
		const wx = (fr.gx0 + fr.gx1) / 200;
		this.windowLight.width = Math.max(0.1, (fr.gx1 - fr.gx0) / 100);
		this.windowLight.height = fr.gH / 100;
		this.windowLight.position.set(wx, fr.gH / 200, g.L / 100 - 0.01);
		this.windowLight.lookAt(wx, fr.gH / 200, 0);

		this.sun.target.position.set(g.W / 200, 0, g.L / 200);
		this.setTime(this.hours);

		// Overview distance: close enough to fill the view, never below the top of the walls
		const size = Math.max(g.W, g.L) / 100;
		this.controls.minDistance = Math.max(size, (g.H / 100 + 0.5) / Math.cos(OVERVIEW_MAX_POLAR));
		this.controls.maxDistance = Math.max(size * 2.5, this.controls.minDistance * 1.5);
		this.updateFov(1);
		this.invalidate(true);

		// loadModel never rejects; a model that failed stays a stand-in and brings no rebuild
		if (missing.size)
			Promise.all([...missing].map(loadModel)).then((ok) => {
				if (ok.some(Boolean) && this.last?.furn === furn) this.build(this.last.g, furn);
			});
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
		this.envSky.material.uniforms.sunPosition.value.copy(dir);
		// The ground only reflects daylight; at night it would glow green otherwise
		this.envGround.color.setHex(0x4a5040).multiplyScalar(0.03 + 0.97 * light.daylight);
		this.envDirty = true;
		this.scene.environmentIntensity = 0.02 + 0.14 * light.daylight;

		// Skylight through the glass: blue-white by day, warm at sunrise and sunset
		const high = THREE.MathUtils.smoothstep(dir.y, 0, 0.4);
		this.windowLight.color.setRGB(1, 0.8, 0.62).lerp(new THREE.Color(0.95, 0.97, 1), high);
		this.windowLight.intensity = 3.2 * light.daylight;

		// The glass front faces east (+z); sunlight only enters while the sun is on that side
		const g = this.geo;
		const facing = THREE.MathUtils.smoothstep(dir.z, 0, 0.25);
		if (g && dir.y > 0.01 && facing > 0) {
			// Where the beam through the middle of the glass lands on the floor
			const t = Math.min(g.front.gH / 200 / dir.y, g.L / 100 / Math.max(dir.z, 0.01));
			// Kept away from walls and floor, so it spreads instead of making hot spots
			const x = THREE.MathUtils.clamp(g.W / 200 - dir.x * t, 0.9, g.W / 100 - 0.9);
			const z = THREE.MathUtils.clamp(g.L / 100 - dir.z * t, 0.9, g.L / 100 - 0.9);
			this.bounce.position.set(x, 0.9, z);
			this.bounce.color.copy(light.color).multiply(new THREE.Color(1, 0.82, 0.62));
			this.bounce.intensity = 0.7 * light.intensity * facing;
		} else {
			this.bounce.intensity = 0;
		}

		this.daylight = light.daylight;
		this.updateBounce();
		this.invalidate(true);
	}

	/** Re-renders the sky into the reflection map (throttled, it costs a few ms). */
	private updateEnvironment(now: number) {
		this.envDirty = false;
		this.envUpdated = now;
		const old = this.envTarget;
		this.envTarget = this.pmrem.fromScene(this.envScene, 0.02, 0.1, 100);
		this.scene.environment = this.envTarget.texture;
		old?.dispose();
		this.invalidate();
	}

	/** Switches all lights: the placed lamps, or the built-in ceiling light without any. */
	setLamp(on: boolean) {
		this.lampOn = on;
		const builtIn = this.lampLights.length === 0;
		this.lamp.intensity = on && builtIn ? 18 : 0;
		// A point light's shadow draws the scene six times: only while the lights are on, and
		// only for the brightest lamp
		this.lamp.castShadow = on && builtIn;
		for (const [i, l] of this.lampLights.entries()) {
			l.intensity = on ? l.userData.intensity : 0;
			l.castShadow = on && i === 0;
		}
		this.lampShade.emissiveIntensity = on ? 2.5 : 0;
		for (const m of this.lampGlow) m.emissiveIntensity = on ? 1.2 : 0;
		this.updateBounce();
		this.invalidate(true);
	}

	/** Gives the model's parts with the named material their own copy that can glow. */
	private glowParts(model: THREE.Object3D, material: string) {
		model.traverse((o) => {
			const mesh = o as THREE.Mesh;
			const m = mesh.material as THREE.MeshStandardMaterial | undefined;
			if (!m || Array.isArray(m) || m.name !== material) return;
			const glow = m.clone();
			glow.emissive = new THREE.Color(0xffd9a8);
			glow.emissiveIntensity = 0;
			mesh.material = glow;
			this.lampGlow.push(glow);
		});
	}

	private clearLamps() {
		for (const l of this.lampLights) {
			l.removeFromParent();
			l.dispose();
		}
		for (const m of this.lampGlow) m.dispose();
		this.lampLights = [];
		this.lampGlow = [];
	}

	/** Floor bounce and exposure follow daylight and the lamp. */
	private updateBounce() {
		this.floorBounce.intensity = 0.45 * this.daylight + (this.lampOn ? 0.12 : 0);
		// Eyes adapt to the overall brightness: twilight and lamp light still read well
		const brightness = this.daylight + (this.lampOn ? 0.5 : 0);
		this.renderer.toneMappingExposure = Math.min(12, 0.9 / Math.max(brightness, 0.01) ** 0.75);
	}

	/* ---------- Camera ---------- */

	setMode(mode: CameraMode, notify = false) {
		if (this.mode === mode) return;
		this.mode = mode;
		this.tour = null;
		this.walk.enabled = mode === 'walk';
		this.controls.enabled = mode === 'overview';
		if (mode === 'walk') {
			// A glide that is still outside the room (coming down from above) finishes first
			if (this.glide && this.isInside()) this.glide = null;
			this.walk.reset();
		}
		if (notify) this.onModeChange(mode);
	}

	/** Glides to a shot, or jumps there with `instant`. The cutaway shot opens the overview. */
	goTo(shot: Shot, instant = false) {
		this.setMode(shot.cutaway ? 'overview' : 'walk', true);
		const state = this.shotState(shot);
		if (shot.cutaway) this.controls.target.copy(state.target);
		const quat = lookQuat(state.pos, state.target);
		if (!instant) return this.startGlide({ pos: state.pos, quat });
		this.glide = null;
		this.camera.position.copy(state.pos);
		this.camera.quaternion.copy(quat);
		this.walk.sync();
	}

	startTour(shots: Shot[]) {
		this.setMode('tour');
		this.tour = { shots, index: 0, t: 0, base: this.shotState(shots[0]) };
		this.startGlide(this.holdPose(this.tour.base, 0));
	}

	private shotState(shot: Shot): CameraState {
		const state = { pos: toWorld(shot.pos), target: toWorld(shot.target) };
		if (shot.cutaway) {
			// Keep the overview within the orbit limits, so it doesn't jump when touched
			const off = state.pos.clone().sub(state.target);
			const { minDistance, maxDistance } = this.controls;
			off.setLength(THREE.MathUtils.clamp(off.length(), minDistance, maxDistance));
			state.pos.copy(state.target).add(off);
		}
		return state;
	}

	private startGlide(to: Pose) {
		this.glide = {
			path: this.route(this.camera.position.clone(), to.pos),
			from: this.camera.quaternion.clone(),
			to: to.quat,
			t: 0
		};
	}

	/**
	 * Path between two camera positions that never leaves the room: around the inner corner
	 * of an L-shaped room, and up or down through the ceiling to the overview.
	 */
	private route(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
		const g = this.geo;
		if (!g) return [from, to];
		const ceiling = g.H / 100;
		const fromAbove = from.y > ceiling;
		const toAbove = to.y > ceiling;
		if (fromAbove && toAbove) return [from, to];
		if (fromAbove || toAbove) {
			const inside = fromAbove ? to : from;
			return [from, new THREE.Vector3(inside.x, ceiling + 0.6, inside.z), to];
		}
		if (this.isClear(from, to) || !g.hasNotch) return [from, to];
		// A point in both the main part and the strip beside the hallway corner sees everywhere
		const via = new THREE.Vector3(
			Math.min(g.NW + 60, (g.NW + g.W) / 2) / 100,
			(from.y + to.y) / 2,
			Math.min(g.N + 60, (g.N + g.L) / 2) / 100
		);
		return [from, via, to];
	}

	/** Whether a straight walk between two points (meters) stays inside the room. */
	private isClear(a: THREE.Vector3, b: THREE.Vector3) {
		const steps = Math.ceil(a.distanceTo(b) / 0.1);
		for (let i = 0; i <= steps; i++) {
			const k = steps ? i / steps : 0;
			if (!this.canStand((a.x + (b.x - a.x) * k) * 100, (a.z + (b.z - a.z) * k) * 100))
				return false;
		}
		return true;
	}

	private isInside() {
		const p = this.camera.position;
		return !this.geo || (p.y <= this.geo.H / 100 && this.canStand(p.x * 100, p.z * 100));
	}

	/** Keys, drag, wheel or pinch: ends the tour and any glide, so the user takes over. */
	private onWalkInput() {
		if (this.mode === 'tour') this.setMode('walk', true);
		if (this.mode !== 'walk') return;
		if (this.glide && this.isInside()) {
			this.glide = null;
			this.walk.sync();
		}
		this.onManual();
	}

	private update(dt: number) {
		if (this.glide) {
			const gl = this.glide;
			gl.t = Math.min(1, gl.t + dt / GLIDE);
			const k = ease(gl.t);
			along(gl.path, k, this.camera.position);
			this.camera.quaternion.slerpQuaternions(gl.from, gl.to, k);
			if (gl.t >= 1) {
				this.glide = null;
				if (this.mode === 'walk') this.walk.sync();
			}
		} else if (this.mode === 'walk') {
			this.walk.update(dt);
		} else if (this.tour) {
			this.updateTour(dt);
		} else {
			this.controls.update();
		}
		this.updateFov(dt);
		// Look into the room (and the loggia) from above
		if (this.geo) {
			const inside = this.camera.position.y < this.geo.H / 100 + 0.02;
			for (const o of this.roof)
				o.visible = inside && (o !== this.shade || !this.lampLights.length);
		}
	}

	/** Slow push-in while panning across the view, then glide to the next shot. */
	private updateTour(dt: number) {
		const tour = this.tour!;
		tour.t = Math.min(1, tour.t + dt / HOLD);
		const pose = this.holdPose(tour.base, ease(tour.t));
		this.camera.position.copy(pose.pos);
		this.camera.quaternion.copy(pose.quat);
		if (tour.t >= 1) {
			tour.index = (tour.index + 1) % tour.shots.length;
			tour.t = 0;
			tour.base = this.shotState(tour.shots[tour.index]);
			// The glide ends where the next hold starts
			this.startGlide(this.holdPose(tour.base, 0));
		}
	}

	/** Camera during a tour shot at progress `k`: 12% closer to the target, panning 20°. */
	private holdPose({ pos, target }: CameraState, k: number): Pose {
		const dir = target.clone().sub(pos);
		const end = pos.clone().addScaledVector(dir, 0.12);
		const push = this.isClear(pos, end) ? 0.12 : 0;
		const p = pos.clone().addScaledVector(dir, push * k);
		dir.applyAxisAngle(UP, THREE.MathUtils.degToRad(10) * (2 * k - 1));
		return { pos: p, quat: lookQuat(p, p.clone().add(dir)) };
	}

	/** Walk collision: stay 20 cm away from the walls. Plan coordinates in cm. */
	private canStand(x: number, y: number) {
		const g = this.geo;
		if (!g) return true;
		const m = 20;
		return floorRects(g).some((r) => x > r.x0 + m && x < r.x1 - m && y > r.y0 + m && y < r.y1 - m);
	}

	/** Holds a walk key from the on-screen pad. */
	press(key: string, down: boolean) {
		this.walk.press(key, down);
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
		// Real models share geometry and materials with the loader's cache
		if (o.userData.shared) return;
		mesh.geometry?.dispose();
		const mats = Array.isArray(mesh.material)
			? mesh.material
			: mesh.material
				? [mesh.material]
				: [];
		for (const m of mats) {
			const s = m as THREE.MeshStandardMaterial;
			s.map?.dispose();
			s.bumpMap?.dispose();
			m.dispose();
		}
	});
	if (obj.type !== 'Scene') obj.clear();
}

/**
 * Trees and a few distant buildings around the flat (in meters, ground at -9 m), so the view
 * through the window has depth. Deterministic, so the scenery never jumps between builds.
 */
function surroundings() {
	const grp = new THREE.Group();
	let seed = 4242;
	const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
	const leaves = [0x4f6b3a, 0x5d7a44, 0x46613a, 0x6b8048].map(
		(color) => new THREE.MeshStandardMaterial({ color, roughness: 1 })
	);
	const bark = new THREE.MeshStandardMaterial({ color: 0x5a4a3c, roughness: 1 });
	const blob = new THREE.IcosahedronGeometry(1, 3);
	const trunk = new THREE.CylinderGeometry(0.15, 0.25, 1, 6);
	for (let i = 0; i < 70; i++) {
		const angle = rnd() * Math.PI * 2;
		const dist = 30 + rnd() * 60;
		const x = Math.cos(angle) * dist;
		const z = Math.sin(angle) * dist;
		const h = 6 + rnd() * 7;
		const t = new THREE.Mesh(trunk, bark);
		t.scale.set(1, h * 0.5, 1);
		t.position.set(x, -9 + h * 0.25, z);
		grp.add(t);
		// Crown from a few overlapping blobs
		const crown = leaves[i % leaves.length];
		for (let k = 0; k < 4; k++) {
			const r = h * (0.16 + rnd() * 0.1);
			const b = new THREE.Mesh(blob, crown);
			b.scale.set(r, r * (0.8 + rnd() * 0.3), r);
			b.position.set(x + (rnd() - 0.5) * r, -9 + h * (0.6 + rnd() * 0.25), z + (rnd() - 0.5) * r);
			grp.add(b);
		}
	}
	const facades = [0xd9d2c5, 0xc9c3b8, 0xe4ddd0, 0xb8b2a8].map(
		(color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
	);
	for (let i = 0; i < 16; i++) {
		const angle = rnd() * Math.PI * 2;
		const dist = 75 + rnd() * 60;
		const w = 14 + rnd() * 20;
		const h = 10 + rnd() * 16;
		const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 10 + rnd() * 8), facades[i % 4]);
		b.position.set(Math.cos(angle) * dist, -9 + h / 2, Math.sin(angle) * dist);
		b.rotation.y = angle + Math.PI / 2;
		grp.add(b);
	}
	return grp;
}
