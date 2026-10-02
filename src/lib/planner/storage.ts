import { DEFAULT_CFG, DEFAULT_FURN } from './defaults';
import { newId } from './format';
import type { Furniture, PlannerData, RoomConfig } from './types';

const KEY = 'room-planner-v1';
const VIEW_KEY = KEY + '-view';
const STEP_KEY = KEY + '-step';

export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

/** Fills missing or invalid values from the defaults (shape follows `def`). */
function normalizeConfig<T extends object>(src: unknown, def: T): T {
	const s = (src && typeof src === 'object' ? src : {}) as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const [k, dv] of Object.entries(def)) {
		const sv = s[k];
		if (dv && typeof dv === 'object') out[k] = normalizeConfig(sv, dv);
		else if (typeof dv === 'number') out[k] = Number.isFinite(Number(sv)) ? Number(sv) : dv;
		else out[k] = typeof sv === 'string' && sv ? sv : dv;
	}
	return out as T;
}

function normalizeFurniture(arr: unknown): Furniture[] {
	if (!Array.isArray(arr)) return clone(DEFAULT_FURN);
	const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
	return arr
		.filter((f) => f && typeof f === 'object')
		.map((f) => ({
			id: String(f.id || newId()),
			name: String(f.name ?? 'Box'),
			w: Math.max(1, num(f.w, 100)),
			d: Math.max(1, num(f.d, 60)),
			h: Math.max(1, num(f.h, 75)),
			cx: num(f.cx, 175),
			cy: num(f.cy, 300),
			rot: num(f.rot, 0),
			color: Math.abs(Math.round(num(f.color, 0))) % 5
		}));
}

export function loadData(): PlannerData {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const d = JSON.parse(raw);
			return {
				cfg: normalizeConfig<RoomConfig>(d.cfg, DEFAULT_CFG),
				furn: normalizeFurniture(d.furn),
				measured: !!d.measured
			};
		}
	} catch {
		// Storage blocked or corrupt: fall back to defaults
	}
	return { cfg: clone(DEFAULT_CFG), furn: clone(DEFAULT_FURN), measured: false };
}

/** Returns false if saving failed (storage blocked or full). */
export function saveData(data: PlannerData): boolean {
	try {
		localStorage.setItem(KEY, JSON.stringify({ schema: 1, ...data }));
		return true;
	} catch {
		return false;
	}
}

/** Last visited step (path + query), so the app reopens where you left off. */
export function loadStep(): string {
	try {
		const step = localStorage.getItem(STEP_KEY);
		if (step?.startsWith('/')) return step;
		// Before steps existed, only the view was remembered
		const view = localStorage.getItem(VIEW_KEY);
		if (view === 'preview') return '/experience';
		if (view) return view === 'plan' ? '/furnish?view=plan' : '/furnish';
	} catch {
		// Storage blocked: start at the beginning
	}
	return '/room';
}

export function saveStep(step: string) {
	try {
		localStorage.setItem(STEP_KEY, step);
	} catch {
		// ignore
	}
}
