<script lang="ts">
	import { PALETTE } from '#lib/planner/defaults.ts';
	import { cm, m2 } from '#lib/planner/format.ts';
	import { bbox, describeCheck, normalizeAngle } from '#lib/planner/furniture.ts';
	import { buildWalls, segmentPolygon } from '#lib/planner/geometry.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import type { Furniture, Point } from '#lib/planner/types.ts';
	import { selectItem } from '#lib/url.ts';

	interface Props {
		showDims: boolean;
		/** Pieces to show; the Draft (selectable and draggable) when omitted */
		furn?: Furniture[];
		/** Double-click on a piece */
		onopen?: (id: string) => void;
		/** Screen position above the selected piece (px within this view) */
		onanchor?: (p: { x: number; y: number } | null) => void;
	}
	let { showDims, furn, onopen, onanchor }: Props = $props();

	/** Only the Draft can be edited; a Published Design is read-only */
	const editable = $derived(!furn);
	const pieces = $derived(furn ?? planner.furn);
	const checks = $derived(editable ? planner.checks : {});

	let wrap = $state<HTMLDivElement>();
	let svg = $state<SVGSVGElement>();
	let width = $state(600);
	let height = $state(500);

	const g = $derived(planner.geo);
	const walls = $derived(buildWalls(g, g.H).segs.filter((s) => s.h0 === 0));

	// View box with room for dimension lines around the room
	const vb = $derived.by(() => {
		const minX = -g.tI - 82;
		const minY = -g.tI - 78;
		const w = g.W + g.tI + 92 - minX;
		const h = g.L + g.tE + g.D + 15 + 70 - minY;
		return { minX, minY, w, h, maxY: minY + h };
	});
	// Font sizes and tick size in plan units, so they look constant on screen
	const scale = $derived(Math.min((width || 600) / vb.w, (height || 500) / vb.h));

	const fs = $derived(11.5 / scale);
	const fsS = $derived(10.5 / scale);
	const tk = $derived(4 / scale);

	// Scale bar position (bottom left)
	const sx = $derived(vb.minX + 14);
	const sy = $derived(vb.maxY - 16);

	const pts = (p: Point[]) => p.map((q) => q.join(',')).join(' ');
	const loggiaY = $derived(g.L + g.tE);

	/** Glass panes left and right of the balcony door. */
	const panes = $derived(
		(
			[
				[g.front.gx0, g.front.bOff],
				[g.front.bOff + g.front.bW, g.front.gx1]
			] as Point[]
		).filter(([a, b]) => b - a > 0.5)
	);

	/* ---------- Dimension lines ---------- */
	interface Dim {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		label: string;
	}
	const dims = $derived.by(() => {
		const out: Dim[] = [];
		const h = (x1: number, x2: number, y: number) => {
			if (Math.abs(x2 - x1) >= 0.5) out.push({ x1, y1: y, x2, y2: y, label: cm(x2 - x1) });
		};
		const v = (y1: number, y2: number, x: number) => {
			if (Math.abs(y2 - y1) >= 0.5) out.push({ x1: x, y1, x2: x, y2, label: cm(y2 - y1) });
		};
		const chainH = (xs: number[], y: number) => xs.slice(1).forEach((x, i) => h(xs[i], x, y));
		const chainV = (ys: number[], x: number) => ys.slice(1).forEach((y, i) => v(ys[i], y, x));
		const door = g.doors[0];
		const fr = g.front;
		if (g.hasNotch) {
			h(g.NW, g.W, -g.tI - 26);
			chainH([0, door.x0, door.x1, g.NW], g.N - g.tI - 24);
			h(0, g.NW, g.N - g.tI - 50);
			v(g.N, g.L, -g.tI - 26);
			chainV([0, g.N, g.L], g.W + g.tI + 26);
		} else {
			chainH([0, door.x0, door.x1, g.W], -g.tI - 26);
			h(0, g.W, -g.tI - 52);
			v(0, g.L, -g.tI - 26);
			v(0, g.L, g.W + g.tI + 26);
		}
		v(0, g.L, g.W + g.tI + 54);
		if (g.D > 0) chainV([g.L, g.L + g.tE, g.L + g.tE + g.D], g.W + g.tI + 26);
		const frontXs = [0, fr.gx0, fr.bOff, fr.bOff + fr.bW, fr.gx1, g.W].filter(
			(x, i, a) => i === 0 || x - a[i - 1] > 0.5
		);
		chainH(frontXs, g.L + g.tE + (g.D > 30 ? 20 : g.D + 40));
		h(0, g.W, g.L + g.tE + g.D + 15 + 34);
		return out;
	});

	/** Distances from the selected piece to the walls. */
	const distances = $derived.by(() => {
		const f = sel;
		if (!f) return [];
		const b = bbox(f);
		const cx = (b.minX + b.maxX) / 2;
		const cy = (b.minY + b.maxY) / 2;
		const wallX = g.hasNotch && cy < g.N ? g.NW : 0;
		const wallY = g.hasNotch && cx < g.NW ? g.N : 0;
		return [
			{ x1: wallX, y1: cy, x2: b.minX, y2: cy, v: b.minX - wallX },
			{ x1: b.maxX, y1: cy, x2: g.W, y2: cy, v: g.W - b.maxX },
			{ x1: cx, y1: wallY, x2: cx, y2: b.minY, v: b.minY - wallY },
			{ x1: cx, y1: b.maxY, x2: cx, y2: g.L, v: g.L - b.maxY }
		].filter((d) => d.v > 0.5);
	});

	function labelFits(f: Furniture) {
		const b = bbox(f);
		const bw = b.maxX - b.minX;
		const nameFs = Math.min(fs, bw / Math.max(4, f.name.length * 0.58));
		return { show: bw > 30 && b.maxY - b.minY > 24 && nameFs > fs * 0.55, nameFs };
	}

	/** Doors whose swing area any piece blocks */
	const blocked = $derived(new Set(Object.values(checks).flatMap((c) => c.doors)));

	/* ---------- Selection: rotate with the knob ---------- */
	const sel = $derived(editable ? planner.selected : null);
	const knob = $derived(sel ? sel.d / 2 + 26 / scale : 0);

	/** Angle shown only while rotating */
	let live = $state('');

	// Tell the page where the selected piece is on screen, for the floating toolbar
	$effect(() => {
		const f = sel;
		void [f?.cx, f?.cy, f?.w, f?.d, f?.rot, width, height, vb];
		if (!f || !svg || !wrap) return onanchor?.(null);
		const m = svg.getScreenCTM();
		if (!m) return;
		const top = new DOMPoint(f.cx, bbox(f).minY).matrixTransform(m);
		const r = wrap.getBoundingClientRect();
		// Leave room for the rotation knob above the piece
		onanchor?.({ x: top.x - r.left, y: top.y - r.top - 40 });
	});
	$effect(() => () => onanchor?.(null));

	/* ---------- Dragging ---------- */
	type Drag =
		| { mode: 'move'; f: Furniture; x: number; y: number; cx: number; cy: number }
		| { mode: 'rotate'; f: Furniture };
	let drag: Drag | null = null;

	function toPlan(e: PointerEvent): Point {
		const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg!.getScreenCTM()!.inverse());
		return [p.x, p.y];
	}

	function onpointerdown(e: PointerEvent) {
		if (!editable) return;
		const target = e.target as Element;
		const handle = target.closest<SVGElement>('[data-handle]')?.dataset.handle;
		if (handle && sel) {
			drag = { mode: 'rotate', f: sel };
		} else {
			const el = target.closest<SVGElement>('[data-fid]');
			const f = el && planner.furn.find((x) => x.id === el.dataset.fid);
			if (!f) {
				selectItem(null);
				return;
			}
			selectItem(f.id);
			const [x, y] = toPlan(e);
			drag = { mode: 'move', f, x, y, cx: f.cx, cy: f.cy };
		}
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		e.preventDefault();
	}

	function onpointermove(e: PointerEvent) {
		if (!drag) return;
		const [x, y] = toPlan(e);
		if (drag.mode === 'move') {
			planner.move(drag.f.id, drag.cx + x - drag.x, drag.cy + y - drag.y, !e.altKey);
		} else if (drag.mode === 'rotate') {
			const deg = (Math.atan2(y - drag.f.cy, x - drag.f.cx) * 180) / Math.PI + 90;
			// 15° steps, Alt for any angle
			drag.f.rot = normalizeAngle(e.altKey ? Math.round(deg) : Math.round(deg / 15) * 15);
			live = `${drag.f.rot}°`;
		}
	}

	function onpointerup() {
		drag = null;
		live = '';
	}
</script>

<div
	bind:this={wrap}
	class="relative h-full w-full touch-none select-none"
	bind:clientWidth={width}
	bind:clientHeight={height}
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	onpointercancel={onpointerup}
	role="presentation"
>
	<svg
		bind:this={svg}
		class={['block h-full w-full', !editable && 'readonly']}
		viewBox="{vb.minX} {vb.minY} {vb.w} {vb.h}"
		preserveAspectRatio="xMidYMid meet"
		role="img"
		aria-label="Floor plan of the room"
	>
		<defs>
			<pattern id="grid50" width="50" height="50" patternUnits="userSpaceOnUse">
				<path d="M50 0H0V50" class="grid" vector-effect="non-scaling-stroke" />
			</pattern>
			<filter id="furn-glow" x="-50%" y="-50%" width="200%" height="200%">
				<feGaussianBlur stdDeviation="7" />
			</filter>
		</defs>

		<!-- Loggia -->
		{#if g.D > 0}
			<rect class="loggia" x="0" y={loggiaY} width={g.W} height={g.D} />
			<rect class="wall" x={-g.tI} y={loggiaY + g.D} width={g.W + 2 * g.tI} height="15" />
			<rect class="wall" x={-g.tI} y={loggiaY} width={g.tI} height={g.D} />
			<rect class="wall" x={g.W} y={loggiaY} width={g.tI} height={g.D} />
			{#if showDims}
				<text
					class="label"
					x={g.W / 2}
					y={loggiaY + g.D / 2 + fs * 1.1}
					font-size={fs * 1.05}
					text-anchor="middle"
				>
					Loggia · {m2(g.loggiaArea)}
				</text>
			{/if}
		{/if}

		<!-- Floor and walls -->
		<polygon class="floor" points={pts(g.poly)} />
		<polygon fill="url(#grid50)" points={pts(g.poly)} />
		{#each walls as s, i (i)}
			<polygon class="wall" points={pts(segmentPolygon(s))} />
		{/each}

		<!-- Glass -->
		{#each panes as [a, b], i (i)}
			{#each [0.38, 0.62] as k (k)}
				<line
					class="glass"
					vector-effect="non-scaling-stroke"
					x1={a}
					x2={b}
					y1={g.L + g.tE * k}
					y2={g.L + g.tE * k}
				/>
			{/each}
		{/each}

		<!-- Doors: swing area, arc and leaf -->
		{#each g.doors as dr (dr.key)}
			{@const [hx, hy] = dr.hinge}
			{@const c = dr.closed}
			{@const op = dr.open}
			{@const sweep = c[0] * op[1] - c[1] * op[0] > 0 ? 1 : 0}
			{@const arc = `A${dr.w} ${dr.w} 0 0 ${sweep} ${dr.openEnd.join(' ')}`}
			{@const leaf = [
				[hx, hy],
				[hx + op[0] * dr.w, hy + op[1] * dr.w],
				[hx + op[0] * dr.w + c[0] * 4, hy + op[1] * dr.w + c[1] * 4],
				[hx + c[0] * 4, hy + c[1] * 4]
			] as Point[]}
			<path
				class={['sector', blocked.has(dr.name) && 'blocked']}
				d="M{hx} {hy}L{dr.closedEnd.join(' ')}{arc}Z"
			/>
			<path class="arc" vector-effect="non-scaling-stroke" d="M{dr.closedEnd.join(' ')}{arc}" />
			<polygon
				class={['leaf', dr.glass && 'glass-leaf']}
				vector-effect="non-scaling-stroke"
				points={pts(leaf)}
			/>
		{/each}

		{#if showDims}
			<text
				class="label"
				x={g.W / 2}
				y={g.hasNotch ? (g.N + g.L) / 2 : g.L / 2}
				font-size={fs * 1.2}
				text-anchor="middle"
				opacity=".55">Room · {m2(g.area)}</text
			>
		{/if}

		<!-- Dimension chains -->
		{#if showDims}
			{#each dims as d, i (i)}
				{#if d.y1 === d.y2}
					<path
						class="dim"
						vector-effect="non-scaling-stroke"
						d="M{d.x1} {d.y1}H{d.x2}M{d.x1 - tk} {d.y1 + tk}L{d.x1 + tk} {d.y1 - tk}M{d.x2 -
							tk} {d.y1 + tk}L{d.x2 + tk} {d.y1 - tk}"
					/>
					<text
						class="dimt"
						x={(d.x1 + d.x2) / 2}
						y={d.y1 - fsS * 0.45}
						font-size={fsS}
						text-anchor="middle">{d.label}</text
					>
				{:else}
					<path
						class="dim"
						vector-effect="non-scaling-stroke"
						d="M{d.x1} {d.y1}V{d.y2}M{d.x1 - tk} {d.y1 + tk}L{d.x1 + tk} {d.y1 - tk}M{d.x1 -
							tk} {d.y2 + tk}L{d.x1 + tk} {d.y2 - tk}"
					/>
					<text
						class="dimt"
						transform="translate({d.x1 - fsS * 0.45} {(d.y1 + d.y2) / 2}) rotate(-90)"
						font-size={fsS}
						text-anchor="middle">{d.label}</text
					>
				{/if}
			{/each}
		{/if}

		<!-- Furniture -->
		{#each pieces as f (f.id)}
			{@const bad = checks[f.id]?.bad}
			{@const label = labelFits(f)}
			{#if bad}
				<!-- Soft red glow around pieces with a problem -->
				<rect
					class="glow"
					x={-f.w / 2 - 4}
					y={-f.d / 2 - 4}
					width={f.w + 8}
					height={f.d + 8}
					rx="8"
					filter="url(#furn-glow)"
					transform="translate({f.cx} {f.cy}) rotate({f.rot})"
				/>
			{/if}
			<rect
				data-fid={f.id}
				class={['furn', bad && 'bad', sel?.id === f.id && 'sel']}
				vector-effect="non-scaling-stroke"
				x={-f.w / 2}
				y={-f.d / 2}
				width={f.w}
				height={f.d}
				rx={Math.min(6, f.w / 6, f.d / 6)}
				style:fill="var({PALETTE[f.color % PALETTE.length]})"
				transform="translate({f.cx} {f.cy}) rotate({f.rot})"
				ondblclick={() => onopen?.(f.id)}
				role="presentation"
			>
				<title>{[f.name, ...describeCheck(checks[f.id])].join(' · ')}</title>
			</rect>
			<!-- The live angle replaces the name while rotating -->
			{#if label.show && !(live && sel?.id === f.id)}
				<text
					class="furn-name"
					x={f.cx}
					y={f.cy + label.nameFs * 0.35}
					font-size={label.nameFs}
					text-anchor="middle">{f.name}</text
				>
			{/if}
		{/each}

		<!-- Distances of the selected piece to the walls -->
		{#each distances as d, i (i)}
			<line
				class="dist"
				vector-effect="non-scaling-stroke"
				x1={d.x1}
				y1={d.y1}
				x2={d.x2}
				y2={d.y2}
			/>
			{#if d.y1 === d.y2}
				<text
					class="distt"
					x={(d.x1 + d.x2) / 2}
					y={d.y1 - fsS * 0.4}
					font-size={fsS}
					text-anchor="middle">{cm(d.v)}</text
				>
			{:else}
				<text class="distt" x={d.x1 + fsS * 0.4} y={(d.y1 + d.y2) / 2 + fsS * 0.35} font-size={fsS}
					>{cm(d.v)}</text
				>
			{/if}
		{/each}

		<!-- Handles of the selected piece -->
		{#if sel}
			{@const r = 5.5 / scale}
			<g transform="translate({sel.cx} {sel.cy}) rotate({sel.rot})">
				<line
					class="knob-line"
					vector-effect="non-scaling-stroke"
					x1="0"
					y1={-sel.d / 2}
					x2="0"
					y2={-knob}
				/>
				<circle
					class="knob"
					data-handle="rotate"
					cx="0"
					cy={-knob}
					r={r * 1.25}
					vector-effect="non-scaling-stroke"
				>
					<title>Drag to rotate (15° steps, Alt: free)</title>
				</circle>
			</g>
			{#if live}
				<text
					class="live"
					x={sel.cx}
					y={sel.cy + fs * 0.4}
					font-size={fs * 1.15}
					text-anchor="middle">{live}</text
				>
			{/if}
		{/if}

		<!-- Scale bar -->
		<path
			class="dim"
			vector-effect="non-scaling-stroke"
			d="M{sx} {sy}H{sx + 100}M{sx} {sy - tk}V{sy + tk}M{sx + 50} {sy - tk * 0.6}V{sy +
				tk * 0.6}M{sx + 100} {sy - tk}V{sy + tk}"
		/>
		<text class="dimt" x={sx + 50} y={sy - fsS * 0.6} font-size={fsS} text-anchor="middle">1 m</text
		>
	</svg>
</div>

<style>
	.floor {
		fill: var(--floor);
	}
	.loggia {
		fill: var(--loggia);
	}
	.wall {
		fill: var(--wall);
	}
	.grid {
		stroke: var(--grid-strong);
		stroke-width: 1;
		fill: none;
	}
	.glass {
		stroke: var(--glass);
		stroke-width: 1.5;
		fill: none;
	}
	.leaf {
		fill: var(--sheet);
		stroke: var(--ink);
		stroke-width: 1;
	}
	.glass-leaf {
		fill: var(--glass);
		fill-opacity: 0.35;
		stroke: var(--glass);
	}
	.arc {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1;
		stroke-dasharray: 4 3;
		opacity: 0.7;
	}
	.sector {
		fill: var(--accent);
		fill-opacity: 0.06;
	}
	.dim {
		stroke: var(--muted);
		stroke-width: 1;
		fill: none;
	}
	.dimt {
		fill: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.label {
		fill: var(--muted);
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.8;
	}
	.furn {
		stroke: color-mix(in srgb, var(--ink) 25%, transparent);
		stroke-width: 1;
		cursor: grab;
		filter: drop-shadow(0 2px 3px rgb(60 45 30 / 0.18));
	}
	.furn.sel {
		stroke: var(--accent);
		stroke-width: 2.5;
	}
	.furn.bad {
		stroke: var(--warn);
		stroke-width: 2;
	}
	.furn-name {
		fill: var(--ink);
		font-weight: 600;
		pointer-events: none;
	}
	.glow {
		fill: var(--warn);
		opacity: 0.55;
		pointer-events: none;
	}
	.sector.blocked {
		fill: var(--warn);
		fill-opacity: 0.18;
	}
	.knob {
		fill: var(--sheet);
		stroke: var(--accent);
		stroke-width: 1.75;
	}
	.knob {
		fill: var(--accent);
		cursor: grab;
	}
	.knob-line {
		stroke: var(--accent);
		stroke-width: 1.25;
	}
	.live {
		fill: var(--ink);
		font-weight: 700;
		paint-order: stroke;
		stroke: var(--sheet);
		stroke-width: 4px;
		pointer-events: none;
	}
	.readonly .furn {
		cursor: default;
	}
	.dist {
		stroke: var(--accent);
		stroke-width: 1.2;
		fill: none;
	}
	.distt {
		fill: var(--accent);
		font-weight: 600;
	}
</style>
