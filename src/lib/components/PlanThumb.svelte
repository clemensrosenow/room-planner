<script lang="ts">
	import { PALETTE } from '#lib/planner/defaults.ts';
	import { modelInfo } from '#lib/planner/catalog.ts';
	import { buildWalls, segmentPolygon } from '#lib/planner/geometry.ts';
	import { designFurniture, GEO, type Placements } from '#lib/planner/room.ts';
	import type { Point } from '#lib/planner/types.ts';

	/** Small floor plan of a Design, drawn from the Room and the placements (no stored images). */
	let { placements }: { placements: Placements } = $props();

	const g = GEO;
	const walls = buildWalls(g, g.H).segs.filter((s) => s.h0 === 0);
	const pts = (p: Point[]) => p.map((q) => q.join(',')).join(' ');
	const furn = $derived(designFurniture(placements));
	const pad = 4;
</script>

<svg
	viewBox="{-g.tI - pad} {-g.tI - pad} {g.W + 2 * (g.tI + pad)} {g.L + g.tE + g.D + g.tI + 2 * pad}"
	class="block h-full w-full"
	role="img"
	aria-label="Floor plan"
>
	{#if g.D > 0}<rect x="0" y={g.L + g.tE} width={g.W} height={g.D} fill="var(--loggia)" />{/if}
	<polygon points={pts(g.poly)} fill="var(--floor)" />
	{#each walls as s, i (i)}
		<polygon points={pts(segmentPolygon(s))} fill="var(--wall)" />
	{/each}
	<line
		x1={g.front.gx0}
		x2={g.front.gx1}
		y1={g.L + g.tE / 2}
		y2={g.L + g.tE / 2}
		stroke="var(--glass)"
		stroke-width="4"
	/>
	{#each furn as f (f.id)}
		{@const ceiling = modelInfo(f)?.mount === 'ceiling'}
		<rect
			x={-f.w / 2}
			y={-f.d / 2}
			width={f.w}
			height={f.d}
			rx={Math.min(5, f.w / 6, f.d / 6)}
			transform="translate({f.cx} {f.cy}) rotate({f.rot})"
			fill="var({PALETTE[f.color % PALETTE.length]})"
			fill-opacity={ceiling ? 0.35 : 1}
			stroke="color-mix(in srgb, var(--ink) 30%, transparent)"
			stroke-width="1.5"
		/>
	{/each}
</svg>
