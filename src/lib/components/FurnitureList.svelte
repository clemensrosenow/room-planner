<script lang="ts">
	import { PALETTE, PRESETS } from '#lib/planner/defaults.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { selectItem } from '#lib/url.ts';
	import FurnitureCard from './FurnitureCard.svelte';
	import Icon from './ui/Icon.svelte';
</script>

<div class="grid gap-6">
	<section class="grid gap-2" aria-label="Add furniture">
		<h3 class="text-xs font-semibold tracking-wide text-muted uppercase">Add</h3>
		<div class="grid grid-cols-3 gap-2">
			{#each PRESETS as preset (preset.name)}
				<button
					class="group flex cursor-pointer flex-col items-start gap-2 rounded-2xl bg-paper p-3 text-left transition-colors hover:bg-line"
					title="{preset.w} × {preset.d} × {preset.h} cm"
					onclick={() => selectItem(planner.add(preset).id)}
				>
					<span class="flex w-full items-center justify-between">
						<span
							class="size-3.5 rounded-[5px]"
							style:background="var({PALETTE[preset.color % PALETTE.length]})"
						></span>
						<span class="text-muted opacity-0 transition-opacity group-hover:opacity-100">
							<Icon name="plus" size={14} />
						</span>
					</span>
					<span class="text-[13px] leading-tight font-semibold">{preset.name}</span>
				</button>
			{/each}
		</div>
	</section>

	<section class="grid gap-1" aria-label="In the room">
		<h3 class="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">In the room</h3>
		{#each planner.furn as f (f.id)}
			<FurnitureCard {f} />
		{:else}
			<p class="text-[13px] text-muted">Nothing here yet. Pick a piece above to place it.</p>
		{/each}
	</section>
</div>
