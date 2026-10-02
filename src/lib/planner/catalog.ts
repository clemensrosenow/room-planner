/** Furniture types: decide the icon and the realistic model in the preview. */
export type Kind = 'bed' | 'sofa' | 'desk' | 'chair' | 'wardrobe' | 'shelf' | 'nightstand' | 'box';

export const KINDS: { kind: Kind; label: string }[] = [
	{ kind: 'bed', label: 'Bed' },
	{ kind: 'sofa', label: 'Sofa' },
	{ kind: 'desk', label: 'Desk / table' },
	{ kind: 'chair', label: 'Chair' },
	{ kind: 'wardrobe', label: 'Wardrobe' },
	{ kind: 'shelf', label: 'Shelf' },
	{ kind: 'nightstand', label: 'Nightstand' },
	{ kind: 'box', label: 'Plain box' }
];

export const isKind = (v: unknown): v is Kind => KINDS.some((k) => k.kind === v);

/** Guess by name (English and German), first match wins. For pieces saved without a kind. */
const BY_NAME: [Kind, RegExp][] = [
	['nightstand', /night|bedside|nacht/i],
	['wardrobe', /wardrobe|closet|cabinet|dresser|schrank|kommode/i],
	['shelf', /shelf|book|regal|rack/i],
	['sofa', /sofa|couch|sessel|armchair/i],
	['chair', /chair|stool|stuhl|hocker/i],
	['bed', /bed|bett/i],
	['desk', /desk|table|tisch/i]
];

export function furnitureKind(f: { kind?: Kind; name: string }): Kind {
	return f.kind ?? BY_NAME.find(([, re]) => re.test(f.name))?.[0] ?? 'box';
}

export interface Preset {
	name: string;
	kind: Kind;
	w: number;
	d: number;
	h: number;
	color: number;
}

/** The catalog dock, with typical sizes in cm. */
export const CATALOG: Preset[] = [
	{ name: 'Bed 90', kind: 'bed', w: 90, d: 200, h: 45, color: 0 },
	{ name: 'Bed 140', kind: 'bed', w: 140, d: 200, h: 45, color: 0 },
	{ name: 'Sofa', kind: 'sofa', w: 200, d: 90, h: 85, color: 2 },
	{ name: 'Armchair', kind: 'sofa', w: 85, d: 85, h: 80, color: 3 },
	{ name: 'Desk', kind: 'desk', w: 140, d: 70, h: 75, color: 1 },
	{ name: 'Chair', kind: 'chair', w: 50, d: 50, h: 90, color: 3 },
	{ name: 'Wardrobe', kind: 'wardrobe', w: 100, d: 60, h: 200, color: 4 },
	{ name: 'Shelf', kind: 'shelf', w: 80, d: 30, h: 180, color: 0 },
	{ name: 'Nightstand', kind: 'nightstand', w: 45, d: 40, h: 50, color: 4 },
	{ name: 'Box', kind: 'box', w: 100, d: 60, h: 75, color: 2 }
];
