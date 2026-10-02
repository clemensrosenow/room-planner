import { DEFAULT_CFG, PRESETS, type Preset } from './defaults';
import { newId } from './format';
import { checkFurniture, moveTo, normalizeAngle, type FurnitureCheck } from './furniture';
import { computeGeometry } from './geometry';
import { clone, loadData, loadView, saveData, saveView } from './storage';
import type { Furniture, View } from './types';

/** Central app state: room inputs, furniture and UI selection. */
class Planner {
	cfg = $state(clone(DEFAULT_CFG));
	furn = $state<Furniture[]>([]);
	measured = $state(false);

	selectedId = $state<string | null>(null);
	view = $state<View>('3d');
	saved = $state(true);
	canUndo = $state(false);
	canRedo = $state(false);

	/* Undo history as JSON snapshots; `current` is the state shown now */
	private past: string[] = [];
	private future: string[] = [];
	private current = '';
	private latest = '';
	private pending: ReturnType<typeof setTimeout> | undefined;

	geo = $derived(computeGeometry(this.cfg));
	checks = $derived<Record<string, FurnitureCheck>>(
		Object.fromEntries(this.furn.map((f) => [f.id, checkFurniture(f, this.furn, this.geo)]))
	);
	selected = $derived(this.furn.find((f) => f.id === this.selectedId) ?? null);

	constructor() {
		if (typeof localStorage === 'undefined') return;
		const data = loadData();
		this.cfg = data.cfg;
		this.furn = data.furn;
		this.measured = data.measured;
		const view = loadView();
		if (view === 'plan' || view === 'preview') this.view = view;
	}

	/** Persists the data and records an undo step. Called on every change. */
	save() {
		const data = $state.snapshot({ cfg: this.cfg, furn: this.furn, measured: this.measured });
		this.saved = saveData(data);
		this.latest = JSON.stringify(data);
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
		const d = JSON.parse(json);
		this.cfg = d.cfg;
		this.furn = d.furn;
		this.measured = d.measured;
		if (!this.furn.some((f) => f.id === this.selectedId)) this.selectedId = null;
		this.updateHistoryFlags();
	}

	private updateHistoryFlags() {
		this.canUndo = this.past.length > 0;
		this.canRedo = this.future.length > 0;
	}

	setView(v: View) {
		this.view = v;
		saveView(v);
	}

	select(id: string | null) {
		this.selectedId = id;
	}

	/** Adds a piece in the middle of the room; numbered if the name is taken. */
	add(preset: Preset = PRESETS[0]) {
		const g = this.geo;
		let name = preset.name;
		for (let i = 2; this.furn.some((x) => x.name === name); i++) name = `${preset.name} ${i}`;
		const f: Furniture = {
			id: newId(),
			name,
			w: preset.w,
			d: preset.d,
			h: preset.h,
			cx: Math.round(g.W / 2),
			cy: Math.round(g.hasNotch ? (g.N + g.L) / 2 : g.L / 2),
			rot: 0,
			color: preset.color
		};
		this.furn.push(f);
		this.selectedId = f.id;
	}

	duplicate(f: Furniture) {
		const copy = {
			...$state.snapshot(f),
			id: newId(),
			name: f.name + ' (copy)',
			cx: f.cx + 20,
			cy: f.cy + 20
		};
		this.furn.push(copy);
		this.selectedId = copy.id;
	}

	remove(f: Furniture) {
		this.furn = this.furn.filter((x) => x.id !== f.id);
		if (this.selectedId === f.id) this.selectedId = null;
	}

	/** Drag move; snaps to walls and other pieces unless `snap` is false. */
	move(id: string, cx: number, cy: number, snap: boolean) {
		const f = this.furn.find((x) => x.id === id);
		if (f) moveTo(f, cx, cy, this.furn, this.geo, snap);
	}

	rotate(f: Furniture, deg: number) {
		f.rot = normalizeAngle(f.rot + deg);
	}

	resetRoom() {
		this.cfg = clone(DEFAULT_CFG);
		this.measured = false;
	}
}

export const planner = new Planner();
