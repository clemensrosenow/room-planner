<script lang="ts">
	import { PALETTE } from '#lib/planner/defaults.ts';
	import { cm } from '#lib/planner/format.ts';
	import { bbox, normalizeAngle, setPosition, setSize } from '#lib/planner/furniture.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import type { Furniture } from '#lib/planner/types.ts';
	import ConfirmButton from './ui/ConfirmButton.svelte';
	import NumberField from './ui/NumberField.svelte';

	let { f }: { f: Furniture } = $props();

	let card = $state<HTMLElement>();
	const selected = $derived(planner.selectedId === f.id);
	const check = $derived(planner.checks[f.id]);
	const box = $derived(bbox(f));

	// Bring the card into view when the piece gets selected in the 3D/plan view
	$effect(() => {
		if (selected && card && !card.contains(document.activeElement)) {
			card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		}
	});
</script>

<!-- Only the selected piece shows all fields; the others collapse to one line -->
{#if !selected}
	<button
		class="flex w-full cursor-pointer items-center gap-2 rounded-md border border-line bg-paper px-2.5 py-2 text-left hover:border-line-strong"
		onclick={() => planner.select(f.id)}
	>
		<span
			class="h-3 w-3 flex-none rounded-sm border border-line-strong"
			style:background="var({PALETTE[f.color % PALETTE.length]})"
		></span>
		<span class="flex-1 truncate font-semibold">{f.name || 'Box'}</span>
		<span class="font-mono text-xs text-muted tabular-nums">{cm(f.w)} × {cm(f.d)} × {cm(f.h)}</span>
		{#if check?.bad}
			<span class="text-warn" title="Has a warning" aria-label="Has a warning">⚠</span>
		{/if}
	</button>
{:else}
	<div
		bind:this={card}
		class="grid gap-2 rounded-md border border-accent bg-paper p-2.5 shadow-[0_0_0_1px_var(--accent)] [&_.num]:bg-sheet"
	>
		<div class="flex items-center gap-2">
			<input class="input flex-1 bg-sheet font-semibold" aria-label="Name" bind:value={f.name} />
			<div class="flex gap-[5px]">
				{#each PALETTE as color, i (color)}
					<button
						class={[
							'h-5 w-5 cursor-pointer rounded border border-line-strong p-0',
							f.color === i && 'outline-2 outline-offset-1 outline-ink'
						]}
						style:background="var({color})"
						aria-label="Color {i + 1}"
						aria-pressed={f.color === i}
						onclick={() => (f.color = i)}
					></button>
				{/each}
			</div>
		</div>

		<div class="grid grid-cols-3 gap-x-2.5 gap-y-2">
			<NumberField label="Width" value={f.w} onchange={(v) => setSize(f, 'w', v)} />
			<NumberField label="Depth" value={f.d} onchange={(v) => setSize(f, 'd', v)} />
			<NumberField label="Height" value={f.h} onchange={(v) => setSize(f, 'h', v)} />
		</div>
		<div class="grid grid-cols-2 gap-x-2.5 gap-y-2">
			<NumberField
				label="X from left wall"
				value={box.minX}
				onchange={(v) => setPosition(f, 'x', v)}
			/>
			<NumberField
				label="Y from top wall"
				value={box.minY}
				onchange={(v) => setPosition(f, 'y', v)}
			/>
		</div>
		<div class="flex items-end gap-1.5">
			<div class="flex-1">
				<NumberField
					label="Rotation"
					unit="°"
					value={f.rot}
					onchange={(v) => (f.rot = normalizeAngle(v))}
				/>
			</div>
			<button
				class="btn"
				aria-label="Rotate 90° counter-clockwise"
				onclick={() => planner.rotate(f, -90)}>↺ 90°</button
			>
			<button class="btn" aria-label="Rotate 90° clockwise" onclick={() => planner.rotate(f, 90)}
				>↻ 90°</button
			>
		</div>

		<div class="flex flex-wrap gap-[5px] text-[11.5px]">
			{#if check && !check.bad}
				<span class="text-ok">✓ fits</span>
			{:else if check}
				{#if check.out}<span class="rounded-full bg-warn-soft px-2 py-0.5 text-warn"
						>sticks out of the room</span
					>{/if}
				{#each check.doors as d (d)}
					<span class="rounded-full bg-warn-soft px-2 py-0.5 text-warn"
						>in the swing area of the {d}</span
					>
				{/each}
				{#each check.overlap as name, i (i)}
					<span class="rounded-full bg-warn-soft px-2 py-0.5 text-warn">overlaps “{name}”</span>
				{/each}
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<button class="btn" onclick={() => planner.duplicate(f)}>Duplicate</button>
			<ConfirmButton
				label="Delete"
				confirmLabel="Really delete?"
				onconfirm={() => planner.remove(f)}
			/>
		</div>
	</div>
{/if}
