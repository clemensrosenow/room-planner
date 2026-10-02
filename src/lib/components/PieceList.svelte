<script lang="ts">
	import { furnitureKind } from '#lib/planner/catalog.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { selectItem } from '#lib/url.ts';
	import FurnitureIcon from './FurnitureIcon.svelte';
	import Icon from './ui/Icon.svelte';

	/** Everything in the room, for finding pieces that are hard to click. */
	let { onpick }: { onpick: () => void } = $props();
</script>

<div
	class="pointer-events-auto grid max-h-[50dvh] w-64 gap-0.5 overflow-y-auto rounded-3xl bg-sheet/95 p-2 shadow-float ring-1 ring-line/70 backdrop-blur-md"
>
	{#each planner.furn as f (f.id)}
		<button
			class={[
				'flex w-full cursor-pointer items-center gap-2.5 rounded-2xl px-2.5 py-1.5 text-left transition-colors hover:bg-paper',
				planner.selectedId === f.id && 'bg-accent-soft'
			]}
			onclick={() => {
				selectItem(f.id);
				onpick();
			}}
		>
			<FurnitureIcon kind={furnitureKind(f)} color={f.color} size={26} />
			<span class="flex-1 truncate font-semibold">{f.name || 'Box'}</span>
			{#if planner.checks[f.id]?.bad}
				<span class="text-warn" title="Has a problem"><Icon name="alert" size={15} /></span>
			{/if}
		</button>
	{:else}
		<p class="px-3 py-2 text-[13px] text-muted">The room is empty.</p>
	{/each}
</div>
