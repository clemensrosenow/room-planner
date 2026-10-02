import { DEFAULT_CFG } from './defaults';
import { newId } from './format';
import { checkFurniture, normalizeAngle, type FurnitureCheck } from './furniture';
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
		if (loadView() === 'plan') this.view = 'plan';
	}

	save() {
		this.saved = saveData(
			$state.snapshot({ cfg: this.cfg, furn: this.furn, measured: this.measured })
		);
	}

	setView(v: View) {
		this.view = v;
		saveView(v);
	}

	select(id: string | null) {
		this.selectedId = id;
	}

	add() {
		const g = this.geo;
		const n = this.furn.length + 1;
		const f: Furniture = {
			id: newId(),
			name: 'Box ' + n,
			w: 100,
			d: 60,
			h: 75,
			cx: Math.round(g.W / 2),
			cy: Math.round(g.hasNotch ? (g.N + g.L) / 2 : g.L / 2),
			rot: 0,
			color: (n + 1) % 5
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

	rotate(f: Furniture, deg: number) {
		f.rot = normalizeAngle(f.rot + deg);
	}

	resetRoom() {
		this.cfg = clone(DEFAULT_CFG);
		this.measured = false;
	}
}

export const planner = new Planner();
