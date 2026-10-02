<script lang="ts">
	import PlanView from '#lib/components/PlanView.svelte';
	import RoomSettings from '#lib/components/RoomSettings.svelte';
	import Workspace from '#lib/components/Workspace.svelte';
	import FloatingBar from '#lib/components/ui/FloatingBar.svelte';
	import IconButton from '#lib/components/ui/IconButton.svelte';
	import { m2 } from '#lib/planner/format.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';

	let showDims = $state(true);
</script>

<svelte:head>
	<title>Shape · Room Planner</title>
</svelte:head>

<Workspace title="Room" sub={m2(planner.geo.area) + (planner.measured ? '' : ' · estimated')}>
	<PlanView {showDims} editable={false} />

	{#snippet controls()}
		<FloatingBar label="Plan">
			<IconButton
				icon="ruler"
				label="Dimensions"
				pressed={showDims}
				onclick={() => (showDims = !showDims)}
			/>
		</FloatingBar>
	{/snippet}

	{#snippet panel()}
		<RoomSettings />
	{/snippet}
</Workspace>
