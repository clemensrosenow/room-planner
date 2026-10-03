import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { furnitureKind, modelInfo } from '../planner/catalog';
import type { Furniture } from '../planner/types';
import * as mat from './materials';

/** Shared materials for one build, so a room with many books stays cheap. */
export class MaterialKit {
	private cache = new Map<string, THREE.Material>();

	private get<T extends THREE.Material>(key: string, make: () => T): T {
		let m = this.cache.get(key);
		if (!m) this.cache.set(key, (m = make()));
		return m as T;
	}
	oak = () => this.get('oak', mat.oak);
	linen = () => this.get('linen', mat.linen);
	steel = () => this.get('steel', mat.steel);
	fabric = (c: number) => this.get('fabric' + c, () => mat.fabric(c));
	lacquer = (c: number) => this.get('lacquer' + c, () => mat.lacquer(c));
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
	const legs = (material: THREE.Material, size: number, height: number, inset: number) => {
		for (const sx of [-1, 1])
			for (const sz of [-1, 1])
				add(material, [size, height, size], [sx * (w / 2 - inset), 0, sz * (d / 2 - inset)]);
	};

	switch (furnitureKind(f)) {
		case 'bed': {
			// Boxspring: upholstered base up to 30 cm, mattress on top, cushioned headboard
			const head = Math.min(10, d * 0.1);
			const inner = d - head;
			const z = head / 2;
			const feet = 3;
			const baseTop = Math.min(30, h * 0.6);
			for (const sx of [-1, 1])
				for (const sz of [-1, 1])
					add(kit.oak(), [4, feet, 4], [sx * (w / 2 - 6), 0, z + sz * (inner / 2 - 6)]);
			add(kit.fabric(f.color), [w, baseTop - feet, inner], [0, feet, z], 2);
			add(kit.linen(), [w - 1, h - baseTop, inner - 1], [0, baseTop, z], 5);
			// Duvet over the lower two thirds, folded over the foot end
			const duvet = inner * 0.66;
			add(kit.fabric(f.color), [w + 1, 5, duvet], [0, h - 1.5, d / 2 - duvet / 2 - 1], 2.5);
			add(kit.fabric(f.color), [w + 1, h - baseTop - 2, 3], [0, baseTop + 1, d / 2 - 1], 1.4);
			// Pillows at the head end
			const n = w >= 120 ? 2 : 1;
			const pw = Math.min(62, (w - 12) / n - 4);
			for (let i = 0; i < n; i++) {
				const x = (i - (n - 1) / 2) * (pw + 4);
				add(kit.linen(), [pw, 12, 40], [x, h - 3, -d / 2 + head + 23], 5.5);
			}
			add(kit.fabric(f.color), [w, Math.max(h, 103), head], [0, 0, -d / 2 + head / 2], 3);
			break;
		}
		case 'desk': {
			// Top on two flat side boards; drawer unit with three drawers on the right
			const top = 2.5;
			const board = 2;
			const bd = Math.min(40, d);
			const legH = h - top;
			add(kit.oak(), [w, top, d], [0, legH, 0], 0.6);
			const frame = kit.lacquer(f.color);
			for (const sx of [-1, 1]) add(frame, [board, legH, bd], [sx * (w / 2 - board / 2), 0, 0]);
			const uw = Math.min(40, w / 2);
			const ux = w / 2 - board - uw / 2;
			add(frame, [board, legH, bd], [w / 2 - board - uw - board / 2, 0, 0]);
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
		case 'chair': {
			const seatH = Math.min(46, h * 0.5);
			add(kit.fabric(f.color), [w, 5, d], [0, seatH - 5, 0], 2);
			legs(kit.oak(), 3, seatH - 5, 2.5);
			for (const sx of [-1, 1])
				add(kit.oak(), [3, h - seatH, 3], [sx * (w / 2 - 2.5), seatH, -d / 2 + 2.5]);
			const backH = Math.min(24, (h - seatH) * 0.6);
			add(kit.fabric(f.color), [w - 4, backH, 3], [0, h - backH - 1, -d / 2 + 2.5], 1.4);
			break;
		}
		case 'wardrobe': {
			const plinth = 6;
			add(kit.gap(), [w - 4, plinth, d - 6], [0, 0, -1]);
			add(kit.lacquer(f.color), [w, h - plinth, d], [0, plinth, 0], 0.4);
			const n = Math.max(1, Math.round(w / 50));
			const dw = w / n;
			for (let i = 1; i < n; i++)
				add(kit.gap(), [0.5, h - plinth - 4, 0.4], [-w / 2 + i * dw, plinth + 2, d / 2]);
			for (let i = 0; i < n; i++) {
				const edge = i % 2 === 0 ? -w / 2 + (i + 1) * dw - 4 : -w / 2 + i * dw + 4;
				add(kit.steel(), [1.2, 30, 2.4], [edge, plinth + (h - plinth) * 0.45, d / 2 + 1.2], 0.5);
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
			const legH = Math.min(8, h * 0.2);
			legs(kit.oak(), 3, legH, 3);
			add(kit.lacquer(f.color), [w, h - legH, d], [0, legH, 0], 0.5);
			const drawer = h - (h - legH) * 0.42;
			add(kit.gap(), [w - 3, 0.5, 0.4], [0, drawer, d / 2]);
			add(kit.steel(), [6, 1.4, 1.6], [0, (h + drawer) / 2, d / 2 + 0.8], 0.6);
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
			add(kit.fabric(f.color), [w, h, d], [0, 0, 0], Math.min(2.5, w / 4, d / 4, h / 4));
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
