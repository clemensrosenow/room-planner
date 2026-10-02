<script lang="ts">
	import { planner } from '#lib/planner/planner.svelte.ts';
	import FurnitureCard from './FurnitureCard.svelte';
	import Section from './ui/Section.svelte';

	const count = $derived(planner.furn.length);
</script>

<Section title="Furniture" sub={count ? `${count} ${count === 1 ? 'box' : 'boxes'}` : ''} open>
	<div>
		<button class="btn btn-primary" onclick={() => planner.add()}>+ Add box</button>
	</div>
	{#each planner.furn as f (f.id)}
		<FurnitureCard {f} />
	{:else}
		<p class="text-[13px] text-muted">
			No furniture yet. Add a box and give it the dimensions of your piece of furniture.
		</p>
	{/each}
</Section>
