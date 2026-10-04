import {
	checkFurniture,
	keepInside,
	moveTo,
	normalizeAngle,
	type FurnitureCheck
} from './furniture';
import {
	conflictIds,
	defaultPlacements,
	designFurniture,
	GEO,
	placementsOf,
	samePlacements,
	type Placements
} from './room';
import { loadDraft, saveDraft, type RemixSource } from './storage';
import type { Furniture } from './types';

/**
 * Central app state: the Draft, i.e. every Piece of the Inventory with its position, plus the
 * Design it was remixed from. The selection mirrors the URL (`/furnish?item=…`) and is set by
 * that page.
 */
class Planner {
	readonly geo = GEO;
	furn = $state<Furniture[]>(designFurniture(defaultPlacements()));
	remixedFrom = $state<RemixSource | undefined>();

	selectedId = $state<string | null>(null);
	saved = $state(true);
	canUndo = $state(false);
	canRedo = $state(false);

	/* Undo history as JSON snapshots of the placements; `current` is the state shown now */
	private past: string[] = [];
	private future: string[] = [];
	private current = '';
	private latest = '';
	private pending: ReturnType<typeof setTimeout> | undefined;

	checks = $derived<Record<string, FurnitureCheck>>(
		Object.fromEntries(this.furn.map((f) => [f.id, checkFurniture(f, this.furn, this.geo)]))
	);
	/** Pieces with a Conflict; the Draft can only be published without any */
	conflicts = $derived(conflictIds(this.furn));
	selected = $derived(this.furn.find((f) => f.id === this.selectedId) ?? null);

	constructor() {
		if (typeof localStorage === 'undefined') return;
		const draft = loadDraft();
		this.furn = designFurniture(draft.placements);
		this.remixedFrom = draft.remixedFrom;
	}

	get placements(): Placements {
		return placementsOf($state.snapshot(this.furn));
	}

	/** Whether the Draft still is the starting arrangement (nothing would be lost replacing it). */
	get isDefault() {
		return samePlacements(this.placements, defaultPlacements());
	}

	/** Persists the Draft and records an undo step. Called on every change. */
	save() {
		const placements = this.placements;
		this.saved = saveDraft({
			placements,
			...(this.remixedFrom && { remixedFrom: $state.snapshot(this.remixedFrom) })
		});
		this.latest = JSON.stringify(placements);
		if (!this.current) this.current = this.latest;
		// Changes in quick succession (a drag, typing) become one undo step
		clearTimeout(this.pending);
		this.pending = setTimeout(() => this.commit(), 400);
	}

	private commit() {
		clearTimeout(this.pending);
		this.pending = undefined;
		if (this.latest === this.current) return;
		this.past.push(this.current);
		if (this.past.length > 100) this.past.shift();
		this.current = this.latest;
		this.future = [];
		this.updateHistoryFlags();
	}

	undo() {
		this.commit();
		const prev = this.past.pop();
		if (!prev) return;
		this.future.push(this.current);
		this.restore(prev);
	}

	redo() {
		this.commit();
		const next = this.future.pop();
		if (!next) return;
		this.past.push(this.current);
		this.restore(next);
	}

	private restore(json: string) {
		this.current = this.latest = json;
		this.furn = designFurniture(JSON.parse(json));
		this.updateHistoryFlags();
	}

	private updateHistoryFlags() {
		this.canUndo = this.past.length > 0;
		this.canRedo = this.future.length > 0;
	}

	/** Replaces the Draft with a Published Design's placements (Remix). Can't be undone. */
	remix(placements: Placements, from: RemixSource) {
		clearTimeout(this.pending);
		this.pending = undefined;
		this.past = [];
		this.future = [];
		this.current = '';
		this.updateHistoryFlags();
		this.furn = designFurniture(placements);
		this.remixedFrom = from;
	}

	/** After publishing, the next Design is no longer a remix. */
	published() {
		this.remixedFrom = undefined;
	}

	/** Drag move; snaps to walls and other pieces unless `snap` is false. */
	move(id: string, cx: number, cy: number, snap: boolean) {
		const f = this.furn.find((x) => x.id === id);
		if (f) moveTo(f, cx, cy, this.furn, this.geo, snap);
	}

	rotate(f: Furniture, deg: number) {
		f.rot = normalizeAngle(f.rot + deg);
		keepInside(f, this.geo);
	}

	/** Pushes every piece back inside the walls (after rotating or nudging with the keys). */
	keepAllInside() {
		for (const f of this.furn) keepInside(f, this.geo);
	}
}

export const planner = new Planner();
