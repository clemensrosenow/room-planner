<script lang="ts">
	import { PRESETS } from '#lib/planner/defaults.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import FurnitureCard from './FurnitureCard.svelte';
	import Section from './ui/Section.svelte';

	const count = $derived(planner.furn.length);
</script>

<Section title="Furniture" sub={count ? `${count} ${count === 1 ? 'box' : 'boxes'}` : ''} open>
	<div class="flex flex-wrap items-center gap-1.5">
		<span class="text-xs text-muted">Add:</span>
		{#each PRESETS as preset, i (preset.name)}
			<button
				class={['btn px-2 py-1 text-xs', i === 0 && 'btn-primary']}
				title="{preset.w} × {preset.d} × {preset.h} cm"
				onclick={() => planner.add(preset)}>+ {preset.name}</button
			>
		{/each}
	</div>
	{#each planner.furn as f (f.id)}
		<FurnitureCard {f} />
	{:else}
		<p class="text-[13px] text-muted">
			No furniture yet. Add a piece above and adjust its dimensions to match yours.
		</p>
	{/each}
</Section>
