<script lang="ts">
	import { PALETTE } from '#lib/planner/defaults.ts';
	import { bbox, normalizeAngle, setPosition, setSize } from '#lib/planner/furniture.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import type { Furniture } from '#lib/planner/types.ts';
	import { selectItem } from '#lib/url.ts';
	import ConfirmButton from './ui/ConfirmButton.svelte';
	import Icon from './ui/Icon.svelte';
	import IconButton from './ui/IconButton.svelte';
	import ScrubValue from './ui/ScrubValue.svelte';

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
		class="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-paper"
		onclick={() => selectItem(f.id)}
	>
		<span
			class="size-3.5 flex-none rounded-[5px]"
			style:background="var({PALETTE[f.color % PALETTE.length]})"
		></span>
		<span class="flex-1 truncate font-semibold">{f.name || 'Box'}</span>
		{#if check?.bad}
			<span class="text-warn" title="Has a warning" aria-label="Has a warning">
				<Icon name="alert" size={16} />
			</span>
		{/if}
	</button>
{:else}
	<div
		bind:this={card}
		class="my-1 grid gap-4 rounded-2xl bg-sheet p-4 shadow-float ring-1 ring-accent/50"
	>
		<div class="flex items-center gap-2">
			<input class="input flex-1 font-semibold" aria-label="Name" bind:value={f.name} />
			<IconButton icon="close" label="Done (Esc)" onclick={() => selectItem(null)} />
		</div>

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

		<div class="grid grid-cols-3 gap-2">
			<ScrubValue label="Width" value={f.w} min={1} onchange={(v) => setSize(f, 'w', v)} />
			<ScrubValue label="Depth" value={f.d} min={1} onchange={(v) => setSize(f, 'd', v)} />
			<ScrubValue label="Height" value={f.h} min={1} onchange={(v) => setSize(f, 'h', v)} />
		</div>
		<div class="grid grid-cols-3 gap-2">
			<ScrubValue label="From left" value={box.minX} onchange={(v) => setPosition(f, 'x', v)} />
			<ScrubValue label="From top" value={box.minY} onchange={(v) => setPosition(f, 'y', v)} />
			<ScrubValue
				label="Rotation"
				unit="°"
				value={f.rot}
				onchange={(v) => (f.rot = normalizeAngle(v))}
			/>
		</div>

		{#if check?.bad}
			<ul class="flex flex-wrap gap-1.5 text-[12.5px]">
				{#if check.out}<li class="rounded-full bg-warn-soft px-2.5 py-1 text-warn">
						Sticks out of the room
					</li>{/if}
				{#each check.doors as d (d)}
					<li class="rounded-full bg-warn-soft px-2.5 py-1 text-warn">Blocks the {d}</li>
				{/each}
				{#each check.overlap as name, i (i)}
					<li class="rounded-full bg-warn-soft px-2.5 py-1 text-warn">Overlaps {name}</li>
				{/each}
			</ul>
		{:else if check}
			<p class="flex items-center gap-1.5 text-[13px] text-ok">
				<Icon name="check" size={16} /> Fits
			</p>
		{/if}

		<div class="flex items-center gap-1">
			<IconButton icon="rotate-ccw" label="Rotate left" onclick={() => planner.rotate(f, -90)} />
			<IconButton icon="rotate-cw" label="Rotate right (R)" onclick={() => planner.rotate(f, 90)} />
			<IconButton
				icon="copy"
				label="Duplicate"
				onclick={() => selectItem(planner.duplicate(f).id)}
			/>
			<span class="flex-1"></span>
			<ConfirmButton
				label="Delete"
				confirmLabel="Really delete?"
				onconfirm={() => planner.remove(f)}
			/>
		</div>
	</div>
{/if}
