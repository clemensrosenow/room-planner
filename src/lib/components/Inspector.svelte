<script lang="ts">
	import { KINDS, furnitureKind, modelInfo, type Kind } from '#lib/planner/catalog.ts';
	import { PALETTE } from '#lib/planner/defaults.ts';
	import {
		bbox,
		describeCheck,
		normalizeAngle,
		setPosition,
		setSize
	} from '#lib/planner/furniture.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import type { Furniture } from '#lib/planner/types.ts';
	import Icon from './ui/Icon.svelte';
	import ScrubValue from './ui/ScrubValue.svelte';

	/** All details of the selected piece: name, type, color, exact size and position. */
	let { f }: { f: Furniture } = $props();

	const box = $derived(bbox(f));
	const model = $derived(modelInfo(f));
	const geo = $derived(planner.geo);
	const problems = $derived(describeCheck(planner.checks[f.id]));
</script>

<div class="grid gap-5">
	<input class="input font-semibold" aria-label="Name" bind:value={f.name} />

	<label class="grid gap-1">
		<span class="text-xs text-muted">Looks like (in the preview)</span>
		<select
			class="input"
			value={furnitureKind(f)}
			onchange={(e) => {
				f.kind = e.currentTarget.value as Kind;
				// Another type no longer looks like the real model
				delete f.model;
			}}
		>
			{#each KINDS as k (k.kind)}
				<option value={k.kind}>{k.label}</option>
			{/each}
		</select>
		{#if model}
			<span class="text-xs text-muted">Real 3D model: {model.label}</span>
		{/if}
	</label>

	<div class="flex gap-2" role="group" aria-label="Color">
		{#each PALETTE as color, i (color)}
			<button
				class={[
					'size-7 cursor-pointer rounded-full transition-transform hover:scale-110',
					f.color === i && 'ring-2 ring-ink ring-offset-2 ring-offset-sheet'
				]}
				style:background="var({color})"
				aria-label="Color {i + 1}"
				aria-pressed={f.color === i}
				onclick={() => (f.color = i)}
			></button>
		{/each}
	</div>

	<section class="grid gap-2" aria-label="Size">
		<h3 class="text-xs font-semibold tracking-wide text-muted uppercase">Size</h3>
		{#if model}
			<p class="text-[13px] tabular-nums">
				{f.w} × {f.d} × {f.h} cm <span class="text-muted">· size from model</span>
			</p>
		{:else}
			<div class="grid grid-cols-3 gap-2">
				<ScrubValue label="Width" value={f.w} min={1} onchange={(v) => setSize(f, 'w', v, geo)} />
				<ScrubValue label="Depth" value={f.d} min={1} onchange={(v) => setSize(f, 'd', v, geo)} />
				<ScrubValue label="Height" value={f.h} min={1} onchange={(v) => setSize(f, 'h', v, geo)} />
			</div>
		{/if}
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
				onchange={(v) => (f.rot = normalizeAngle(v))}
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
