import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { furnitureKind, modelInfo, partSize } from '../planner/catalog';
import type { LoggiaItem } from '../planner/geometry';
import type { Furniture } from '../planner/types';
import * as mat from './materials';
import { modelClone } from './modelLoader';

/** Shared materials for one build, so a room with many books stays cheap. */
export class MaterialKit {
	private cache = new Map<string, THREE.Material>();

	private get<T extends THREE.Material>(key: string, make: () => T): T {
		let m = this.cache.get(key);
		if (!m) this.cache.set(key, (m = make()));
		return m as T;
	}
	oak = () => this.get('oak', () => mat.oak());
	paleOak = () => this.get('paleOak', () => mat.oak(true));
	mirror = () => this.get('mirror', mat.mirror);
	chrome = () => this.get('chrome', mat.chrome);
	aluminium = () => this.get('aluminium', mat.aluminium);
	glossWhite = () => this.get('glossWhite', mat.glossWhite);
	linen = () => this.get('linen', mat.linen);
	steel = () => this.get('steel', mat.steel);
	/** Upholstery in a color (sRGB hex) */
	cloth = (hex: number) => this.get('cloth' + hex, () => mat.fabric(hex));
	/** Woven rattan in a color (sRGB hex) */
	wicker = (hex: number) => this.get('wicker' + hex, () => mat.wicker(hex));
	/** Satin paint in a color (sRGB hex) */
	lacquer = (hex: number) => this.get('lacquer' + hex, () => mat.lacquer(hex));
	/** Plain surface in a fixed color (sRGB hex), e.g. black plastic or white powder coat */
	plain = (hex: number, roughness = 0.5, metalness = 0) =>
		this.get(`plain${hex}/${roughness}/${metalness}`, () => {
			return new THREE.MeshStandardMaterial({ color: hex, roughness, metalness });
		});
	/** Shadow gaps between doors and drawers */
	gap = () =>
		this.get('gap', () => new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.9 }));
	book = (i: number) =>
		this.get('book' + i, () => {
			const color = mat.BOOK_COLORS[i % mat.BOOK_COLORS.length];
			return new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
		});
}

/**
 * A piece in 3D: its real model where loaded, else the parametric one; a packet is the group of
 * its parts. Ids of real models that are still loading are added to `loading`.
 */
export function buildPiece(f: Furniture, kit: MaterialKit, loading: string[]): THREE.Object3D {
	if (!f.parts) return modelOrParametric(f, kit, loading);
	const g = new THREE.Group();
	for (const [i, p] of f.parts.entries()) {
		const part: Furniture = {
			...{ id: `${f.id}/${i}`, name: p.name, kind: p.kind, model: p.model, color: p.color },
			...partSize(p),
			...{ cx: 0, cy: 0, rot: 0 }
		};
		const obj = modelOrParametric(part, kit, loading);
		obj.position.set(...p.at);
		obj.rotation.y = (-(p.rot ?? 0) * Math.PI) / 180;
		g.add(obj);
	}
	return g;
}

/**
 * The Room's fixed table and chairs on the loggia, in plan coordinates (x, y → x, z): a matte top
 * on four square legs, and chairs with a woven seat and backrest on a frame of their color.
 */
export function buildLoggiaSet(items: LoggiaItem[], kit: MaterialKit): THREE.Group {
	const set = new THREE.Group();
	for (const it of items) {
		const g = new THREE.Group();
		const add = (
			material: THREE.Material,
			[sw, sh, sd]: [number, number, number],
			[x, y0, z]: [number, number, number]
		) => {
			const geo = new THREE.BoxGeometry(sw, sh, sd);
			// UVs in cm, as textured materials expect: faces are ±x, ±y, ±z, four vertices each
			const uv = geo.attributes.uv;
			const faces = [
				[sd, sh],
				[sd, sh],
				[sw, sd],
				[sw, sd],
				[sw, sh],
				[sw, sh]
			];
			for (let i = 0; i < uv.count; i++) {
				const [u, v] = faces[Math.floor(i / 4)];
				uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
			}
			const m = new THREE.Mesh(geo, material);
			m.position.set(x, y0 + sh / 2, z);
			m.castShadow = m.receiveShadow = true;
			g.add(m);
		};
		const { w, d, h } = it;
		if (it.kind === 'table') {
			const top = kit.plain(it.color, 0.6);
			add(top, [w, 3, d], [0, h - 3, 0]);
			add(top, [w - 10, 6, d - 10], [0, h - 9, 0]);
			for (const sx of [-1, 1])
				for (const sz of [-1, 1]) add(top, [5, h - 3, 5], [sx * (w / 2 - 5), 0, sz * (d / 2 - 5)]);
		} else {
			// Front at +z: front legs up to the seat, back legs running on as the backrest's posts
			const frame = kit.plain(it.color, 0.6);
			const woven = kit.wicker(it.color);
			const seatH = Math.min(45, h * 0.56);
			const leg = 3;
			const [lx, fz, bz] = [w / 2 - leg / 2, d / 2 - leg / 2 - 2, -d / 2 + leg / 2];
			for (const sx of [-1, 1]) {
				add(frame, [leg, seatH - 5, leg], [sx * lx, 0, fz]);
				add(frame, [leg, h, leg], [sx * lx, 0, bz]);
			}
			add(woven, [w, 5, d - 2], [0, seatH - 5, -1]);
			add(woven, [w - 2 * leg, h - seatH - 6, 3], [0, seatH + 2, bz]);
			add(frame, [w, 3, leg], [0, h - 3, bz]);
		}
		g.position.set(it.cx, 0, it.cy);
		g.rotation.y = (-it.rot * Math.PI) / 180;
		set.add(g);
	}
	return set;
}

/** A model with a small footprint is moved so its footprint is centered on the piece. */
function modelOrParametric(f: Furniture, kit: MaterialKit, loading: string[]) {
	const model = f.model ? modelClone(f.model) : null;
	if (f.model && !model) loading.push(f.model);
	if (!model) return buildFurniture(f, kit);
	const base = modelInfo(f)?.base;
	if (!base) return model;
	model.position.set(-base.x, 0, -base.z);
	return new THREE.Group().add(model);
}

/**
 * Parametric furniture for the realistic preview. Every model fills the piece's
 * width × depth × height box (cm). Origin is the floor center, x is width, z is depth
 * with the front at +z, y is up.
 */
export function buildFurniture(f: Furniture, kit: MaterialKit): THREE.Group {
	const g = new THREE.Group();
	const w = Math.max(2, f.w);
	const d = Math.max(2, f.d);
	const h = Math.max(2, f.h);
	const add = (
		material: THREE.Material,
		[sw, sh, sd]: [number, number, number],
		[x, y0, z]: [number, number, number],
		radius = 0
	) => {
		const size = [Math.max(0.3, sw), Math.max(0.3, sh), Math.max(0.3, sd)] as const;
		const r = Math.min(radius, ...size.map((v) => v / 2 - 0.01));
		const geo = r > 0.05 ? new RoundedBoxGeometry(...size, 3, r) : new THREE.BoxGeometry(...size);
		const m = new THREE.Mesh(geo, material);
		m.position.set(x, y0 + size[1] / 2, z);
		m.castShadow = m.receiveShadow = true;
		g.add(m);
		return m;
	};
	const cylinder = (
		material: THREE.Material,
		[radius, height]: [number, number],
		[x, y0, z]: [number, number, number]
	) => {
		const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32), material);
		m.position.set(x, y0 + height / 2, z);
		m.castShadow = m.receiveShadow = true;
		g.add(m);
		return m;
	};
	/** A box turned by `angle` around x, through its bottom edge's center at (y0, z) */
	const tilted = (
		material: THREE.Material,
		[sw, sh, sd]: [number, number, number],
		[y0, z]: [number, number],
		angle: number
	) => {
		const m = add(material, [sw, sh, sd], [0, 0, 0]);
		m.rotation.x = angle;
		m.position.set(0, y0 + (Math.cos(angle) * sh) / 2, z + (Math.sin(angle) * sh) / 2);
		return m;
	};
	const legs = (material: THREE.Material, size: number, height: number, inset: number) => {
		for (const sx of [-1, 1])
			for (const sz of [-1, 1])
				add(material, [size, height, size], [sx * (w / 2 - inset), 0, sz * (d / 2 - inset)]);
	};

	switch (furnitureKind(f)) {
		case 'bed': {
			// Boxspring: grey upholstered base up to 30 cm, mattress on top, cushioned headboard,
			// navy bedding
			const frame = kit.cloth(0x8b8d90);
			const navy = kit.cloth(0x1c2741);
			const head = Math.min(10, d * 0.1);
			const inner = d - head;
			const z = head / 2;
			const feet = 3;
			const baseTop = Math.min(30, h * 0.6);
			for (const sx of [-1, 1])
				for (const sz of [-1, 1])
					add(kit.plain(0x3a3b3d), [4, feet, 4], [sx * (w / 2 - 6), 0, z + sz * (inner / 2 - 6)]);
			add(frame, [w, baseTop - feet, inner], [0, feet, z], 2);
			add(kit.linen(), [w - 1, h - baseTop, inner - 1], [0, baseTop, z], 5);
			// Duvet over the lower two thirds, folded over the foot end
			const duvet = inner * 0.66;
			add(navy, [w + 1, 5, duvet], [0, h - 1.5, d / 2 - duvet / 2 - 1], 2.5);
			add(navy, [w + 1, h - baseTop - 2, 3], [0, baseTop + 1, d / 2 - 1], 1.4);
			// Pillows at the head end
			const n = w >= 120 ? 2 : 1;
			const pw = Math.min(62, (w - 12) / n - 4);
			for (let i = 0; i < n; i++) {
				const x = (i - (n - 1) / 2) * (pw + 4);
				add(navy, [pw, 12, 40], [x, h - 3, -d / 2 + head + 23], 5.5);
			}
			add(frame, [w, Math.max(h, 103), head], [0, 0, -d / 2 + head / 2], 3);
			break;
		}
		case 'desk': {
			// Top on two flat side boards; drawer unit with three drawers on the left
			const top = 2.5;
			const board = 2;
			const bd = Math.min(40, d);
			const legH = h - top;
			add(kit.oak(), [w, top, d], [0, legH, 0], 0.6);
			const frame = kit.lacquer(f.color);
			for (const sx of [-1, 1]) add(frame, [board, legH, bd], [sx * (w / 2 - board / 2), 0, 0]);
			const uw = Math.min(40, w / 2);
			const ux = -(w / 2 - board - uw / 2);
			add(frame, [board, legH, bd], [-(w / 2 - board - uw - board / 2), 0, 0]);
			// Drawers from 6 cm above the floor to 13 cm below the top
			const bottom = Math.min(6, legH * 0.1);
			const ceil = Math.max(bottom + 3, h - 13);
			add(kit.gap(), [uw, ceil - bottom, bd - 2], [ux, bottom, -1]);
			const dh = (ceil - bottom) / 3;
			for (let i = 0; i < 3; i++) {
				const y = bottom + i * dh;
				add(frame, [uw - 0.6, dh - 0.6, 1.6], [ux, y + 0.3, bd / 2 - 0.8], 0.3);
				add(kit.steel(), [10, 1.2, 1.6], [ux, y + dh - 4, bd / 2 + 0.8], 0.5);
			}
			break;
		}
		case 'standing-desk': {
			// TROTTEN, all white: top on a T-leg frame with feet along the depth and a crank on the right
			const top = 2;
			const frame = kit.plain(0xf1efea, 0.4);
			add(kit.plain(0xf1efea, 0.55), [w, top, d], [0, h - top, 0], 0.4);
			const lx = w / 2 - Math.min(18, w * 0.12);
			const foot = Math.min(70, d - 6);
			for (const sx of [-1, 1]) {
				add(frame, [7, h - top - 7, 5], [sx * lx, 3.5, 0]);
				add(frame, [6, 3.5, foot], [sx * lx, 0, 0], 1);
				add(frame, [5, 3.5, foot - 6], [sx * lx, h - top - 3.5, 0]);
			}
			add(frame, [2 * lx, 4, 4], [0, h - top - 4, -d / 4]);
			add(frame, [1.2, 1.2, 14], [lx - 12, h - top - 6, d / 2 - 4]);
			break;
		}
		case 'monitor': {
			// Stand at the back, panel facing +z; narrower than tall means turned upright
			const black = kit.plain(0x1b1b1c, 0.45);
			const panelH = w < h ? h - 10 : Math.min(h * 0.8, w * 0.6);
			const panelZ = Math.min(d / 2 - 2, 2);
			add(black, [Math.min(26, Math.max(20, w * 0.4)), 1.2, d - 2], [0, 0, 0], 0.5);
			add(black, [5, h - panelH / 2, 3], [0, 1.2, panelZ - 5]);
			add(black, [w, panelH, 2], [0, h - panelH, panelZ], 0.4);
			add(black, [w * 0.55, panelH * 0.6, 2.5], [0, h - panelH * 0.75, panelZ - 2]);
			add(
				kit.plain(0x0b0d10, 0.15),
				[w - 1.6, panelH - 2.4, 0.2],
				[0, h - panelH + 1.6, panelZ + 1.05]
			);
			break;
		}
		case 'laptop': {
			// Open: base with keyboard at the front, lid leaning back 15° from the hinge
			const alu = kit.plain(0xc7c9cc, 0.35, 0.8);
			const base = 1.5;
			const angle = (-15 * Math.PI) / 180;
			const lid = (h - base) / Math.cos(angle);
			const hinge = -d / 2 - Math.sin(angle) * lid + 0.3;
			const depth = d / 2 - hinge;
			add(alu, [w, base, depth], [0, 0, hinge + depth / 2], 0.5);
			add(
				kit.plain(0x26272a, 0.6),
				[w - 4, 0.2, depth * 0.45],
				[0, base, hinge + 2 + depth * 0.225]
			);
			tilted(alu, [w, lid, 0.6], [base, hinge], angle);
			// Screen on the lid's front face, 1 cm in from its edges
			const [up, out] = [1, 0.35];
			const y0 = base + Math.cos(angle) * up - Math.sin(angle) * out;
			const z0 = hinge + Math.sin(angle) * up + Math.cos(angle) * out;
			tilted(kit.plain(0x0b0d10, 0.15), [w - 2, lid - 2, 0.1], [y0, z0], angle);
			break;
		}
		case 'stool': {
			// Black cushioned seat on a chrome column and a foot plate
			const black = kit.plain(0x1e1e1f, 0.4);
			add(black, [w * 0.8, 1.5, d * 0.8], [0, 0, 0], 0.6);
			cylinder(kit.steel(), [2.5, h - 7], [0, 1.5, 0]);
			add(kit.cloth(0x1c1c1d), [w, 6, d], [0, h - 6, 0], 2.5);
			break;
		}
		case 'chair': {
			// Black office chair: five-star base on casters, gas column, padded seat, reclined
			// backrest and armrests
			const black = kit.plain(0x1a1a1b, 0.55);
			const pad = kit.cloth(0x202022);
			const seatH = Math.min(48, h * 0.47);
			const r = Math.min(w, d) / 2 - 2;
			for (let i = 0; i < 5; i++) {
				const a = (i / 5) * Math.PI * 2;
				const spoke = add(black, [3.5, 3, r], [0, 4, 0], 1);
				spoke.rotation.y = a;
				spoke.position.set((Math.sin(a) * r) / 2, 5.5, (Math.cos(a) * r) / 2);
				cylinder(black, [2.5, 4], [Math.sin(a) * (r - 1), 0, Math.cos(a) * (r - 1)]);
			}
			cylinder(kit.steel(), [2.5, seatH - 15], [0, 7, 0]);
			cylinder(black, [3.5, 6], [0, 4, 0]);
			const sw = w * 0.78;
			const sd = d * 0.75;
			add(black, [sw * 0.6, 3, sd * 0.6], [0, seatH - 11, 1]);
			add(pad, [sw, 8, sd], [0, seatH - 8, 2], 3.5);
			// Backrest leaning back 8° from a bar behind the seat
			const backH = h - seatH - 4;
			const bz = -d / 2 + 5;
			add(black, [6, 4, sd / 2], [0, seatH - 10, bz + sd / 4]);
			add(black, [6, 14, 3], [0, seatH - 8, bz]);
			tilted(pad, [sw * 0.92, backH, 6], [seatH + 2, bz + 2], (-8 * Math.PI) / 180);
			// Armrests on posts beside the seat
			for (const sx of [-1, 1]) {
				const ax = sx * (sw / 2 + 1.5);
				add(black, [2.5, 22, 4], [ax, seatH - 6, -2]);
				add(black, [5.5, 2.5, 24], [ax, seatH + 16, 0], 1);
			}
			break;
		}
		case 'wardrobe': {
			// Pale oak carcass with two mirrored sliding doors in aluminium frames. The doors run on
			// two tracks under the top and overlap in the middle.
			const t = 2;
			const zone = 6;
			const oak = kit.paleOak();
			const alu = kit.aluminium();
			for (const sx of [-1, 1]) add(oak, [t, h, d], [sx * (w / 2 - t / 2), 0, 0]);
			add(oak, [w, t, d], [0, h - t, 0]);
			add(oak, [w - 2 * t, 3, d - zone], [0, 0, -zone / 2]);
			add(kit.plain(0xb9b8b3, 0.8), [w - 2 * t, h - t - 3, 1], [0, 3, -d / 2 + 0.5]);
			add(alu, [w - 2 * t, 4, zone], [0, h - t - 4, d / 2 - zone / 2]);
			const inner = w - 2 * t;
			const dw = inner / 2 + 1.5;
			const dh = h - t - 4 - 1.5;
			for (const [i, sx] of [-1, 1].entries()) {
				const x = sx * (inner / 2 - dw / 2);
				const z = d / 2 - (i === 0 ? 1.5 : 4.5);
				for (const ex of [-1, 1]) add(alu, [2.5, dh, 2.5], [x + ex * (dw / 2 - 1.25), 1.5, z]);
				add(alu, [dw, 3, 2], [x, 1.5, z]);
				add(alu, [dw, 3, 2], [x, 1.5 + dh - 3, z]);
				// Mirror in four panels, split by thin aluminium strips
				const ph = (dh - 6) / 4;
				for (let k = 0; k < 4; k++) {
					add(kit.mirror(), [dw - 5, ph, 0.6], [x, 4.5 + k * ph, z]);
					if (k) add(alu, [dw - 5, 0.6, 0.9], [x, 4.5 + k * ph - 0.3, z]);
				}
			}
			break;
		}
		case 'shelf': {
			const t = 2;
			const frame = kit.lacquer(f.color);
			for (const sx of [-1, 1]) add(frame, [t, h, d], [sx * (w / 2 - t / 2), 0, 0]);
			add(frame, [w - 2 * t, h, 0.6], [0, 0, -d / 2 + 0.3]);
			const n = Math.max(1, Math.round(h / 35));
			const comp = (h - t) / n;
			for (let i = 0; i <= n; i++) add(frame, [w - 2 * t, t, d], [0, Math.min(i * comp, h - t), 0]);
			// Books, the same for a piece on every build
			const rnd = seeded(f.id);
			for (let i = 0; i < n; i++) {
				const room = comp - t - 2;
				if (room < 15) continue;
				const end = w / 2 - t - 1 - (w - 2 * t) * (0.1 + rnd() * 0.45);
				for (let x = -w / 2 + t + 1; ;) {
					const bw = 1.6 + rnd() * 3.4;
					if (x + bw > end) break;
					const bh = Math.min(room, 17 + rnd() * 12);
					const bd = Math.min(d - 3, 15 + rnd() * 7);
					add(
						kit.book(Math.floor(rnd() * 8)),
						[bw, bh, bd],
						[x + bw / 2, i * comp + t, -d / 2 + 1 + bd / 2]
					);
					x += bw + (rnd() < 0.06 ? 6 + rnd() * 10 : 0.15);
				}
			}
			break;
		}
		case 'nightstand': {
			// C-shaped side table: white high-gloss top on a frame of chrome square tubes, with posts
			// only on the left so the base slides under a bed
			const chrome = kit.chrome();
			const tube = 2;
			const top = 3.5;
			add(kit.glossWhite(), [w, top, d], [0, h - top, 0], 0.4);
			for (const y of [0, h - top - tube]) {
				for (const sz of [-1, 1]) add(chrome, [w, tube, tube], [0, y, sz * (d / 2 - tube / 2)]);
				for (const sx of [-1, 1]) add(chrome, [tube, tube, d], [sx * (w / 2 - tube / 2), y, 0]);
			}
			for (const sz of [-1, 1])
				add(
					chrome,
					[tube, h - top - 2 * tube, tube],
					[-(w / 2 - tube / 2), tube, sz * (d / 2 - tube / 2)]
				);
			break;
		}
		case 'lamp': {
			// Stand-in until the real model has loaded: base, pole and shade
			const shade = Math.min(w, d, 40);
			const shadeH = Math.min(25, h * 0.35);
			if (modelInfo(f)?.mount === 'ceiling') {
				// Hangs from its origin at the ceiling
				add(kit.steel(), [1, h - shadeH, 1], [0, -h + shadeH, 0]);
				add(kit.linen(), [shade, shadeH, shade], [0, -h, 0], shade / 2);
				break;
			}
			add(kit.steel(), [shade * 0.6, 2, shade * 0.6], [0, 0, 0], 1);
			add(kit.steel(), [1.5, h - shadeH - 2, 1.5], [0, 2, 0]);
			add(kit.linen(), [shade, shadeH, shade], [0, h - shadeH, 0], 3);
			break;
		}
		default:
			add(kit.cloth(f.color), [w, h, d], [0, 0, 0], Math.min(2.5, w / 4, d / 4, h / 4));
	}
	return g;
}

/** Small deterministic random generator seeded by a string. */
function seeded(key: string) {
	let s = 0;
	for (const ch of key) s = (s * 31 + ch.charCodeAt(0)) % 2147483647;
	s = s || 1;
	return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
