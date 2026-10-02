<script lang="ts">
	import { page } from '$app/state';
	import PlanView from '#lib/components/PlanView.svelte';
	import RoomCard from '#lib/components/RoomCard.svelte';
	import RoomHandles, { type RoomPart } from '#lib/components/RoomHandles.svelte';
	import RoomSettings from '#lib/components/RoomSettings.svelte';
	import Workspace from '#lib/components/Workspace.svelte';
	import FloatingBar from '#lib/components/ui/FloatingBar.svelte';
	import IconButton from '#lib/components/ui/IconButton.svelte';
	import { m2 } from '#lib/planner/format.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { setParams } from '#lib/url.ts';

	let showDims = $state(false);

	/** The part being edited follows `?focus=` (default: walls) */
	const PARTS: RoomPart[] = ['walls', 'door', 'front', 'loggia', 'more'];
	const focus = $derived.by<RoomPart>(() => {
		const f = page.url.searchParams.get('focus') as RoomPart | null;
		return f && PARTS.includes(f) ? f : 'walls';
	});
	const setFocus = (part: RoomPart) =>
		setParams({ focus: part === 'walls' ? null : part }, { replace: true });
</script>

<svelte:head>
	<title>Shape · Room Planner</title>
</svelte:head>

<Workspace title="Room" sub={m2(planner.geo.area) + (planner.measured ? '' : ' · estimated')}>
	<PlanView {showDims} editable={false}>
		{#snippet overlay(api)}
			<RoomHandles {api} {focus} onfocus={setFocus} />
		{/snippet}
		{#snippet htmlOverlay(api)}
			<RoomCard {api} {focus} />
		{/snippet}
	</PlanView>

	{#snippet controls()}
		<FloatingBar label="Plan">
			<IconButton
				icon="ruler"
				label="All dimensions"
				pressed={showDims}
				onclick={() => (showDims = !showDims)}
			/>
		</FloatingBar>
	{/snippet}

	{#snippet panel()}
		<RoomSettings {focus} onfocus={setFocus} />
	{/snippet}
</Workspace>
