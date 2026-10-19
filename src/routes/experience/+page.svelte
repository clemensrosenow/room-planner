<script lang="ts">
	import OnboardingHints from '#lib/components/OnboardingHints.svelte';
	import Preview from '#lib/components/Preview.svelte';
	import WelcomeCard from '#lib/components/WelcomeCard.svelte';
	import Workspace from '#lib/components/Workspace.svelte';
	import { DragWatch } from '#lib/onboarding/drag.svelte.ts';
	import { nextOnboarding, publishProgress } from '#lib/onboarding/next.ts';
	import { onboarding } from '#lib/onboarding/state.svelte.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { INVENTORY } from '#lib/planner/room.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { onMount } from 'svelte';

	const drag = new DragWatch();
	/** The Experience hint waits until the room has had a moment to load */
	let settled = $state(false);

	onMount(() => {
		// Opening Experience is what the "ready" hint suggests, so it's done
		const progress = publishProgress(
			planner.furn.length,
			INVENTORY.length,
			planner.conflicts.length
		);
		if (progress.kind === 'ready') onboarding.done('ready');
		const t = setTimeout(() => (settled = true), 1500);
		return () => clearTimeout(t);
	});

	const next = $derived(
		nextOnboarding({
			page: 'experience',
			state: onboarding.snapshot,
			placed: planner.furn.length,
			total: INVENTORY.length,
			conflicts: planner.conflicts.length,
			selected: false,
			dragging: drag.active,
			dialogOpen: ui.modals > 0,
			ownDesign: false
		})
	);
	const shown = $derived(next === 'welcome' || settled ? next : null);
</script>

<svelte:head>
	<title>Experience · Room Planner</title>
</svelte:head>

<svelte:window
	onpointerdown={drag.down}
	onpointermove={drag.move}
	onpointerup={drag.up}
	onpointercancel={drag.up}
/>

<Workspace fullBleed>
	<!-- The Experience hint says the same as the walking tip, so only one of them shows -->
	<Preview hint={shown !== 'experience'} />
</Workspace>

<WelcomeCard open={shown === 'welcome'} />
<OnboardingHints {shown} />
