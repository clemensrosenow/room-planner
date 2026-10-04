/** Furniture types: decide the icon and the realistic model in the preview. */
export type Kind =
	| 'bed'
	| 'desk'
	| 'standing-desk'
	| 'chair'
	| 'stool'
	| 'wardrobe'
	| 'shelf'
	| 'nightstand'
	| 'lamp'
	| 'monitor'
	| 'laptop'
	| 'piano'
	| 'easel'
	| 'box';

/** Guess by name (English and German), first match wins. For pieces saved without a kind. */
const BY_NAME: [Kind, RegExp][] = [
	['nightstand', /night|bedside|nacht/i],
	['wardrobe', /wardrobe|closet|cabinet|dresser|schrank|kommode/i],
	['shelf', /shelf|book|regal|rack|kallax/i],
	['lamp', /lamp|leuchte/i],
	['piano', /piano|keyboard|klavier/i],
	['easel', /flipchart|easel|staffelei/i],
	['monitor', /monitor|display|screen|bildschirm/i],
	['laptop', /laptop|notebook/i],
	['stool', /stool|hocker/i],
	['chair', /chair|stuhl/i],
	['bed', /bed|bett/i],
	['desk', /desk|table|tisch/i]
];

export function furnitureKind(f: { kind?: Kind; name: string }): Kind {
	return f.kind ?? BY_NAME.find(([, re]) => re.test(f.name))?.[0] ?? 'box';
}

/** Light source of a lamp model, relative to the model origin (cm). */
export interface LampLight {
	pos: [number, number, number];
	/** Point light intensity (candela) when on */
	intensity: number;
	/** Material of the parts that glow when on, e.g. an opal globe */
	glow?: string;
}

/**
 * Real 3D models in `static/models/` (see scripts/convert-models.ts). A piece linked to one
 * takes the model's size; the GLB replaces the parametric model in both 3D views.
 */
export interface ModelInfo {
	label: string;
	kind: Kind;
	/** cm, from `static/models/index.json` */
	size: { w: number; d: number; h: number };
	/** Floor pieces have their origin at the floor center, ceiling pieces at the top center */
	mount: 'floor' | 'ceiling';
	/**
	 * Floor footprint when much smaller than the model, e.g. an arc lamp's foot: its size and the
	 * center of it in model coordinates (cm). The piece's box is the footprint, so the head can
	 * reach over other pieces without a Conflict.
	 */
	base?: { w: number; d: number; x: number; z: number };
	/** Small enough to stand on a nightstand or desk: placed over one, it sits on top */
	onTop?: boolean;
	light?: LampLight;
}

export const MODELS: Record<string, ModelInfo> = {
	'ikea-kallax': {
		label: 'Kallax',
		kind: 'shelf',
		size: { w: 69, d: 31, h: 132 },
		mount: 'floor'
	},
	'ikea-nymo-lamp': {
		label: 'Nymo lamp',
		kind: 'lamp',
		size: { w: 25, d: 25, h: 70 },
		mount: 'floor',
		onTop: true,
		light: { pos: [0, 56, 1], intensity: 5 }
	},
	'ikea-skaftet-lamp': {
		label: 'Skaftet floor lamp',
		kind: 'lamp',
		size: { w: 122.1, d: 127.3, h: 208.1 },
		mount: 'floor',
		base: { w: 48, d: 48, x: -37.1, z: 39.7 },
		light: { pos: [39, 170, -42], intensity: 10 }
	},
	'ikea-ps2014-lamp': {
		label: 'PS 2014 ceiling lamp',
		kind: 'lamp',
		size: { w: 36, d: 36, h: 85.5 },
		mount: 'ceiling',
		light: { pos: [0, -43, 0], intensity: 18, glow: 'plastic 1' }
	},
	'ikea-markus-chair': {
		label: 'Markus office chair',
		kind: 'chair',
		size: { w: 62, d: 60, h: 129 },
		mount: 'floor'
	},
	'yamaha-p45': {
		label: 'Yamaha P-45',
		kind: 'piano',
		size: { w: 132.6, d: 29.8, h: 12.6 },
		mount: 'floor'
	},
	'keyboard-stand': {
		label: 'Keyboard Z-stand',
		kind: 'piano',
		size: { w: 98.1, d: 52.5, h: 67.8 },
		mount: 'floor'
	},
	flipchart: {
		label: 'Flipchart',
		kind: 'easel',
		size: { w: 70, d: 65, h: 190 },
		mount: 'floor'
	},
	radiator: {
		label: 'Radiator',
		kind: 'box',
		size: { w: 70, d: 15, h: 90 },
		mount: 'floor'
	}
};

/**
 * One item of a packet (a Piece made of several things that always stand together, e.g. a desk
 * with its chair). Placed relative to the packet's floor center like a piece in a room: x along
 * the packet's width, z along its depth with the front at +z, y the height its bottom stands at.
 */
export interface Part {
	name: string;
	kind: Kind;
	/** Real 3D model (id in MODELS); its size replaces `size` */
	model?: string;
	/** cm, for parametric parts */
	size?: { w: number; d: number; h: number };
	at: [number, number, number];
	/** Degrees, clockwise in plan view */
	rot?: number;
	/** Real color, sRGB hex */
	color: number;
}

export const partSize = (p: Part) => (p.model ? MODELS[p.model].size : p.size!);

export const modelInfo = (f: { model?: string }) => (f.model ? MODELS[f.model] : undefined);
