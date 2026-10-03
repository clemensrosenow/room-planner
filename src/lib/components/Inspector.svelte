<script lang="ts">
	import { modelInfo } from '#lib/planner/catalog.ts';
	import { bbox, describeCheck, normalizeAngle, setPosition } from '#lib/planner/furniture.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import type { Furniture } from '#lib/planner/types.ts';
	import Icon from './ui/Icon.svelte';
	import ScrubValue from './ui/ScrubValue.svelte';

	/** Details of the selected Piece: its fixed size, and exact position and rotation. */
	let { f }: { f: Furniture } = $props();

	const box = $derived(bbox(f));
	const model = $derived(modelInfo(f));
	const geo = $derived(planner.geo);
	const problems = $derived(describeCheck(planner.checks[f.id]));
</script>

<div class="grid gap-5">
	<section class="grid gap-1" aria-label="Size">
		<h3 class="text-xs font-semibold tracking-wide text-muted uppercase">Size</h3>
		<p class="text-[13px] tabular-nums">
			{f.w} × {f.d} × {f.h} cm
			<span class="text-muted">· {model ? `real model: ${model.label}` : 'the real piece'}</span>
		</p>
	</section>

	<section class="grid gap-2" aria-label="Position">
		<h3 class="text-xs font-semibold tracking-wide text-muted uppercase">Position</h3>
		<div class="grid grid-cols-3 gap-2">
			<ScrubValue
				label="From left"
				value={box.minX}
				onchange={(v) => setPosition(f, 'x', v, geo)}
			/>
			<ScrubValue label="From top" value={box.minY} onchange={(v) => setPosition(f, 'y', v, geo)} />
			<ScrubValue
				label="Rotation"
				unit="°"
				value={f.rot}
				onchange={(v) => planner.rotate(f, normalizeAngle(v) - f.rot)}
			/>
		</div>
	</section>

	{#if problems.length}
		<ul class="grid gap-1 rounded-2xl bg-warn-soft px-4 py-3 text-[13px] text-warn">
			{#each problems as p (p)}<li>{p}</li>{/each}
		</ul>
	{:else}
		<p class="flex items-center gap-1.5 text-[13px] text-ok">
			<Icon name="check" size={16} /> Fits
		</p>
	{/if}
</div>
