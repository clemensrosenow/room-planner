/** Furniture types: decide the icon and the realistic model in the preview. */
export type Kind = 'bed' | 'desk' | 'chair' | 'wardrobe' | 'shelf' | 'nightstand' | 'lamp' | 'box';

export const KINDS: { kind: Kind; label: string }[] = [
	{ kind: 'bed', label: 'Bed' },
	{ kind: 'desk', label: 'Desk / table' },
	{ kind: 'chair', label: 'Chair' },
	{ kind: 'wardrobe', label: 'Wardrobe' },
	{ kind: 'shelf', label: 'Shelf' },
	{ kind: 'nightstand', label: 'Nightstand' },
	{ kind: 'lamp', label: 'Lamp' },
	{ kind: 'box', label: 'Plain box' }
];

export const isKind = (v: unknown): v is Kind => KINDS.some((k) => k.kind === v);

/** Guess by name (English and German), first match wins. For pieces saved without a kind. */
const BY_NAME: [Kind, RegExp][] = [
	['nightstand', /night|bedside|nacht/i],
	['wardrobe', /wardrobe|closet|cabinet|dresser|schrank|kommode/i],
	['shelf', /shelf|book|regal|rack|kallax/i],
	['lamp', /lamp|leuchte/i],
	['chair', /chair|stool|stuhl|hocker/i],
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
		light: { pos: [39, 170, -42], intensity: 10 }
	},
	'ikea-ps2014-lamp': {
		label: 'PS 2014 ceiling lamp',
		kind: 'lamp',
		size: { w: 36, d: 36, h: 85.5 },
		mount: 'ceiling',
		light: { pos: [0, -43, 0], intensity: 18, glow: 'plastic 1' }
	}
};

export const modelInfo = (f: { model?: string }) => (f.model ? MODELS[f.model] : undefined);

export interface Preset {
	name: string;
	kind: Kind;
	w: number;
	d: number;
	h: number;
	color: number;
	/** Id in MODELS */
	model?: string;
}

const fromModel = (name: string, model: string, color = 0): Preset => {
	const m = MODELS[model];
	return { name, kind: m.kind, ...m.size, color, model };
};

/** The catalog dock: the real pieces of the room, sizes in cm. */
export const CATALOG: Preset[] = [
	{ name: 'Boxspring bed', kind: 'bed', w: 140, d: 210, h: 50, color: 0 },
	{ name: 'Wardrobe', kind: 'wardrobe', w: 150, d: 70, h: 218, color: 4 },
	{ name: 'Desk', kind: 'desk', w: 125, d: 50, h: 78, color: 1 },
	{ name: 'Chair', kind: 'chair', w: 50, d: 50, h: 90, color: 3 },
	fromModel('Kallax', 'ikea-kallax'),
	{ name: 'Nightstand', kind: 'nightstand', w: 38, d: 43, h: 63, color: 4 },
	fromModel('Nymo lamp', 'ikea-nymo-lamp', 2),
	fromModel('Floor lamp', 'ikea-skaftet-lamp', 2),
	fromModel('Ceiling lamp', 'ikea-ps2014-lamp', 2)
];
