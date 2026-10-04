import { INVENTORY, parsePlacements, ROOM_ID, type Placements } from './room';
import type { Furniture } from './types';

const KEY = 'room-planner-v1';
const VIEW_KEY = KEY + '-view';
const STEP_KEY = KEY + '-step';

export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

/** The Published Design a Draft was remixed from, for "Remix of X by Y". */
export interface RemixSource {
	id: string;
	title: string;
	designer: string | null;
}

/** The Draft: where each Piece stands, and what it was remixed from. */
export interface Draft {
	placements: Placements;
	remixedFrom?: RemixSource;
}

/**
 * Schema 1 stored free furniture (any name, size, number of pieces). Each Piece keeps the
 * position of the old piece that matches it best: same model, then same name, then same type.
 */
function migrateV1(furn: unknown): Placements {
	const old = (Array.isArray(furn) ? furn : []).filter(
		(f): f is Partial<Furniture> => !!f && typeof f === 'object'
	);
	const used = new Set<Partial<Furniture>>();
	const out: Record<string, unknown> = {};
	const tests: ((o: Partial<Furniture>, p: (typeof INVENTORY)[number]) => boolean)[] = [
		(o, p) => !!p.model && o.model === p.model,
		(o, p) => o.name === p.name,
		(o, p) => !p.model && o.kind === p.kind
	];
	for (const test of tests)
		for (const p of INVENTORY) {
			if (p.id in out) continue;
			const match = old.find((o) => !used.has(o) && test(o, p));
			if (!match) continue;
			used.add(match);
			out[p.id] = { cx: match.cx, cy: match.cy, rot: match.rot };
		}
	return parsePlacements(out, true);
}

function parseRemix(v: unknown): RemixSource | undefined {
	const r = v as Partial<RemixSource> | null;
	if (!r || typeof r.id !== 'string' || typeof r.title !== 'string') return undefined;
	return { id: r.id, title: r.title, designer: typeof r.designer === 'string' ? r.designer : null };
}

export function loadDraft(): Draft {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const d = JSON.parse(raw);
			// A Draft of an older Room (other Inventory) starts over from the default arrangement
			if (d.schema === 2 && d.roomId === ROOM_ID) {
				const remixedFrom = parseRemix(d.remixedFrom);
				return {
					placements: parsePlacements(d.placements, true),
					...(remixedFrom && { remixedFrom })
				};
			}
			if (d.schema !== 2) return { placements: migrateV1(d.furn) };
		}
	} catch {
		// Storage blocked or corrupt: start from the default arrangement
	}
	return { placements: parsePlacements({}, true) };
}

/** Returns false if saving failed (storage blocked or full). */
export function saveDraft(draft: Draft): boolean {
	try {
		localStorage.setItem(KEY, JSON.stringify({ schema: 2, roomId: ROOM_ID, ...draft }));
		return true;
	} catch {
		return false;
	}
}

/** Last visited step (path + query), so the app reopens where you left off. */
export function loadStep(): string {
	try {
		const step = localStorage.getItem(STEP_KEY);
		// The Shape step is gone
		if (step?.startsWith('/') && !step.startsWith('/room')) return step;
		const view = localStorage.getItem(VIEW_KEY);
		if (view === 'preview') return '/experience';
		if (view === 'plan') return '/furnish?view=plan';
	} catch {
		// Storage blocked: start at the beginning
	}
	return '/furnish';
}

export function saveStep(step: string) {
	try {
		localStorage.setItem(STEP_KEY, step);
	} catch {
		// ignore
	}
}
