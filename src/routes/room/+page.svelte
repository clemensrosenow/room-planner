<script lang="ts">
	import PlanView from '#lib/components/PlanView.svelte';
	import RoomSettings from '#lib/components/RoomSettings.svelte';
	import Workspace from '#lib/components/Workspace.svelte';
	import { planner } from '#lib/planner/planner.svelte.ts';

	let showDims = $state(true);
</script>

<svelte:head>
	<title>Shape · Room Planner</title>
</svelte:head>

<Workspace asideLabel="Room dimensions">
	{#snippet toolbar()}
		<button class="btn" aria-pressed={showDims} onclick={() => (showDims = !showDims)}>
			Dimensions
		</button>
		<span class="ml-auto text-xs text-muted max-[900px]:hidden">
			Set walls, doors and the glass front · furniture is arranged in the next step
		</span>
	{/snippet}

	<div class="absolute inset-0"><PlanView {showDims} editable={false} /></div>

	{#snippet aside()}
		{#if planner.geo.issues.length}
			<ul
				class="mx-3 mt-2.5 list-disc rounded-[5px] bg-warn-soft py-2 pr-2.5 pl-6 text-[12.5px] text-warn"
			>
				{#each planner.geo.issues as issue (issue)}
					<li>{issue}</li>
				{/each}
			</ul>
		{/if}
		<RoomSettings />
	{/snippet}
</Workspace>
