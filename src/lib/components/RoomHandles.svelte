<svelte:options namespace="svg" />

<script lang="ts" module>
	export type RoomPart = 'walls' | 'door' | 'front' | 'loggia' | 'more';
</script>

<script lang="ts">
	import { planner } from '#lib/planner/planner.svelte.ts';
	import type { Point } from '#lib/planner/types.ts';
	import type { PlanApi } from './PlanView.svelte';

	/**
	 * Grips for shaping the room on the floor plan: walls, hallway corner, doors, glass
	 * front and loggia. Grabbing or tapping anything focuses its part.
	 */
	interface Props {
		api: PlanApi;
		focus: RoomPart;
		onfocus: (part: RoomPart) => void;
	}
	let { api, focus, onfocus }: Props = $props();

	const g = $derived(planner.geo);
	const cfg = $derived(planner.cfg);
	const px = $derived(1 / api.scale);
	const door = $derived(g.doors[0]);
	const bal = $derived(g.doors[1]);
	const fr = $derived(g.front);

	type Grip =
		| 'W'
		| 'L'
		| 'notch'
		| 'door'
		| 'door-l'
		| 'door-r'
		| 'wl'
		| 'wr'
		| 'bal'
		| 'bal-l'
		| 'bal-r'
		| 'D';
	const PART: Record<Grip, RoomPart> = {
		W: 'walls',
		L: 'walls',
		notch: 'walls',
		door: 'door',
		'door-l': 'door',
		'door-r': 'door',
		wl: 'front',
		wr: 'front',
		bal: 'front',
		'bal-l': 'front',
		'bal-r': 'front',
		D: 'loggia'
	};

	const TITLES: Partial<Record<Grip, string>> = {
		'door-l': 'Drag to move the left side of the door',
		'door-r': 'Drag to move the right side of the door',
		'bal-l': 'Drag to move the left side of the balcony door',
		'bal-r': 'Drag to move the right side of the balcony door',
		wl: 'Drag where the glass starts',
		wr: 'Drag where the glass ends'
	};

	let drag: { grip: Grip; p0: Point; start: typeof cfg } | null = null;
	let active = $state<Grip | null>(null);

	const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

	function down(e: PointerEvent, grip: Grip) {
		if (e.button !== 0) return;
		e.stopPropagation();
		onfocus(PART[grip]);
		drag = { grip, p0: api.toPlan(e), start: $state.snapshot(cfg) };
		active = grip;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}

	function move(e: PointerEvent) {
		if (!drag) return;
		const [x, y] = api.toPlan(e);
		// 1 cm steps, Shift for 10 cm
		const step = e.shiftKey ? 10 : 1;
		const r = (v: number) => Math.round(v / step) * step;
		const dx = r(x - drag.p0[0]);
		const dy = r(y - drag.p0[1]);
		const s = drag.start;
		const wallLen = s.NW > 0 && s.N > 0 ? s.NW : s.W;
		const gx0 = s.front.wl;
		const gx1 = s.W - s.front.wr;
		switch (drag.grip) {
			case 'W':
				cfg.W = clamp(s.W + dx, Math.max(100, s.NW + 40, s.front.wl + s.front.wr + 40), 2000);
				break;
			case 'L':
				cfg.L = clamp(s.L + dy, Math.max(100, s.N + 40), 2000);
				break;
			case 'notch': {
				// Close to the walls the corner disappears (rectangular room)
				const nw = clamp(s.NW + dx, 0, s.W - 40);
				const n = clamp(s.N + dy, 0, s.L - 40);
				cfg.NW = nw < 10 ? 0 : nw;
				cfg.N = n < 10 ? 0 : n;
				break;
			}
			case 'door':
				cfg.door.off = clamp(s.door.off + dx, 0, wallLen - s.door.w);
				break;
			case 'door-l': {
				const x0 = clamp(s.door.off + dx, 0, s.door.off + s.door.w - 40);
				cfg.door.w = s.door.off + s.door.w - x0;
				cfg.door.off = x0;
				break;
			}
			case 'door-r':
				cfg.door.w = clamp(s.door.w + dx, 40, wallLen - s.door.off);
				break;
			case 'wl': {
				cfg.front.wl = clamp(s.front.wl + dx, 0, s.W - s.front.wr - 40);
				// Push the balcony door along instead of letting it stick out
				const lo = cfg.front.wl;
				const hi = s.W - s.front.wr - s.front.door.w;
				cfg.front.door.off = clamp(s.front.door.off, lo, hi);
				break;
			}
			case 'wr': {
				cfg.front.wr = clamp(s.front.wr - dx, 0, s.W - s.front.wl - 40);
				const hi = s.W - cfg.front.wr - s.front.door.w;
				cfg.front.door.off = clamp(s.front.door.off, s.front.wl, hi);
				break;
			}
			case 'bal':
				cfg.front.door.off = clamp(s.front.door.off + dx, gx0, gx1 - s.front.door.w);
				break;
			case 'bal-l': {
				const x0 = clamp(s.front.door.off + dx, gx0, s.front.door.off + s.front.door.w - 40);
				cfg.front.door.w = s.front.door.off + s.front.door.w - x0;
				cfg.front.door.off = x0;
				break;
			}
			case 'bal-r':
				cfg.front.door.w = clamp(s.front.door.w + dx, 40, gx1 - s.front.door.off);
				break;
			case 'D':
				cfg.loggia.D = clamp(s.loggia.D + dy, 0, 1000);
				break;
		}
	}

	function up() {
		drag = null;
		active = null;
	}

	/** Pill-shaped grip; `vertical` when it sits on a vertical wall */
	const pill = (x: number, y: number, vertical: boolean) => {
		const long = 30 * px;
		const short = 11 * px;
		const [w, h] = vertical ? [short, long] : [long, short];
		return { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: short / 2 };
	};

	/** Front-wall grip for the length sits on a solid wall piece if there is one */
	const lenX = $derived(fr.wr >= 25 ? g.W - fr.wr / 2 : fr.wl >= 25 ? fr.wl / 2 : g.W / 2);
	const loggiaEnd = $derived(g.L + g.tE + g.D);
</script>

<g class="handles" onpointermove={move} onpointerup={up} onpointercancel={up} role="presentation">
	<!-- Focus targets: tap a part to edit it -->
	<polygon
		class="hit"
		points={g.poly.map((p) => p.join(',')).join(' ')}
		onpointerdown={() => onfocus('walls')}
		role="presentation"
	/>
	{#if g.D > 0}
		<rect
			class="hit"
			x="0"
			y={g.L + g.tE}
			width={g.W}
			height={g.D}
			onpointerdown={() => onfocus('loggia')}
			role="presentation"
		/>
	{/if}
	<rect
		class="hit"
		x={fr.gx0}
		y={g.L - 4 * px}
		width={fr.gx1 - fr.gx0}
		height={g.tE + 8 * px}
		onpointerdown={() => onfocus('front')}
		role="presentation"
	/>

	<!-- Highlight of the focused part -->
	{#if focus === 'walls'}
		<polygon
			class="focus"
			vector-effect="non-scaling-stroke"
			points={g.poly.map((p) => p.join(',')).join(' ')}
		/>
	{:else if focus === 'door'}
		<rect
			class="focus"
			vector-effect="non-scaling-stroke"
			x={door.x0}
			y={door.y - g.tI}
			width={door.x1 - door.x0}
			height={g.tI}
		/>
	{:else if focus === 'front'}
		<rect
			class="focus"
			vector-effect="non-scaling-stroke"
			x={fr.gx0}
			y={g.L}
			width={fr.gx1 - fr.gx0}
			height={g.tE}
		/>
	{:else if focus === 'loggia' && g.D > 0}
		<rect
			class="focus"
			vector-effect="non-scaling-stroke"
			x="0"
			y={g.L + g.tE}
			width={g.W}
			height={g.D}
		/>
	{/if}

	<!-- Doors: drag the opening to move it, its ends to change the width -->
	<rect
		class="door-hit"
		x={door.x0}
		y={door.y - g.tI - 6 * px}
		width={door.x1 - door.x0}
		height={g.tI + 12 * px}
		onpointerdown={(e) => down(e, 'door')}
		role="presentation"
	>
		<title>Drag to move the door</title>
	</rect>
	<rect
		class="door-hit"
		x={bal.x0}
		y={g.L - 6 * px}
		width={bal.x1 - bal.x0}
		height={g.tE + 12 * px}
		onpointerdown={(e) => down(e, 'bal')}
		role="presentation"
	>
		<title>Drag to move the balcony door</title>
	</rect>
	<!-- Room size: right wall, front wall, hallway corner (drawn first, so the edge
		 grips of a focused door lie on top where they meet the corner) -->
	<rect
		class={['grip', focus === 'walls' && 'on', active === 'W' && 'active']}
		{...pill(g.W + g.tI / 2, g.L / 2, true)}
		vector-effect="non-scaling-stroke"
		style:cursor="ew-resize"
		onpointerdown={(e) => down(e, 'W')}
		role="presentation"
	>
		<title>Drag to change the width</title>
	</rect>
	<rect
		class={['grip', focus === 'walls' && 'on', active === 'L' && 'active']}
		{...pill(lenX, g.L + g.tE / 2, false)}
		vector-effect="non-scaling-stroke"
		style:cursor="ns-resize"
		onpointerdown={(e) => down(e, 'L')}
		role="presentation"
	>
		<title>Drag to change the length</title>
	</rect>
	<circle
		class={['grip', focus === 'walls' && 'on', active === 'notch' && 'active']}
		cx={g.hasNotch ? g.NW : 0}
		cy={g.hasNotch ? g.N : 0}
		r={7 * px}
		vector-effect="non-scaling-stroke"
		style:cursor="nwse-resize"
		onpointerdown={(e) => down(e, 'notch')}
		role="presentation"
	>
		<title>Drag to shape the hallway corner</title>
	</circle>

	<!-- Loggia depth -->
	<rect
		class={['grip', focus === 'loggia' && 'on', active === 'D' && 'active']}
		{...pill(g.W / 2, g.D > 0 ? loggiaEnd + 7.5 : loggiaEnd + 10 * px, false)}
		vector-effect="non-scaling-stroke"
		style:cursor="ns-resize"
		onpointerdown={(e) => down(e, 'D')}
		role="presentation"
	>
		<title>Drag to change the loggia depth</title>
	</rect>
	<!-- Edge grips only for the part being edited, the others stay calm -->
	{#each focus === 'door' ? ([['door-l', door.x0], ['door-r', door.x1]] as const) : [] as [grip, x] (grip)}
		<circle
			class={['grip', focus === 'door' && 'on', active === grip && 'active']}
			cx={x}
			cy={door.y - g.tI / 2}
			r={6 * px}
			vector-effect="non-scaling-stroke"
			style:cursor="ew-resize"
			onpointerdown={(e) => down(e, grip)}
			role="presentation"
		>
			<title>{TITLES[grip]}</title>
		</circle>
	{/each}
	{#each focus === 'front' ? ([['bal-l', bal.x0], ['bal-r', bal.x1]] as const) : [] as [grip, x] (grip)}
		<circle
			class={['grip', focus === 'front' && 'on', active === grip && 'active']}
			cx={x}
			cy={g.L - 9 * px}
			r={6 * px}
			vector-effect="non-scaling-stroke"
			style:cursor="ew-resize"
			onpointerdown={(e) => down(e, grip)}
			role="presentation"
		>
			<title>{TITLES[grip]}</title>
		</circle>
	{/each}

	<!-- Glass front: where the solid wall pieces end -->
	{#each focus === 'front' ? ([['wl', fr.gx0], ['wr', fr.gx1]] as const) : [] as [grip, x] (grip)}
		<rect
			class={['grip', focus === 'front' && 'on', active === grip && 'active']}
			{...pill(x, g.L + g.tE + 9 * px, true)}
			vector-effect="non-scaling-stroke"
			style:cursor="ew-resize"
			onpointerdown={(e) => down(e, grip)}
			role="presentation"
		>
			<title>{TITLES[grip]}</title>
		</rect>
	{/each}
</g>

<style>
	.hit {
		fill: transparent;
	}
	.door-hit {
		fill: transparent;
		cursor: grab;
	}
	.door-hit:active {
		cursor: grabbing;
	}
	.focus {
		fill: var(--accent);
		fill-opacity: 0.06;
		stroke: var(--accent);
		stroke-width: 2;
		pointer-events: none;
	}
	.grip {
		fill: var(--sheet);
		stroke: var(--accent);
		stroke-width: 1.75;
		opacity: 0.75;
		transition: opacity 0.15s;
	}
	.grip:hover,
	.grip.on {
		opacity: 1;
	}
	.grip.on {
		fill: var(--accent-soft);
	}
	.grip.active {
		fill: var(--accent);
	}
</style>
