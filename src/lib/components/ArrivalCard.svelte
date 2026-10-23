<script lang="ts">
	import { duration } from '#lib/motion.ts';
	import { nextOnboarding } from '#lib/onboarding/next.ts';
	import { onboarding } from '#lib/onboarding/state.svelte.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { INVENTORY } from '#lib/planner/room.ts';
	import { slide } from 'svelte/transition';
	import IconButton from './ui/IconButton.svelte';

	/**
	 * For a friend arriving from a link (a Design, the Duel or the Leaderboard) who hasn't furnished
	 * anything yet: what this is and how to join. Shown once per Device, on whichever page comes
	 * first; closing it or any of its buttons is for good.
	 */
	interface Props {
		where: 'design' | 'duel' | 'designs';
		/** On a Design page: its Designer, and whether this Device published it */
		designer?: string | null;
		own?: boolean;
		onremix?: () => void;
	}
	let { where, designer = null, own = false, onremix }: Props = $props();

	const visible = $derived(
		nextOnboarding({
			page: where,
			state: onboarding.snapshot,
			placed: planner.furn.length,
			total: INVENTORY.length,
			conflicts: 0,
			selected: false,
			dragging: false,
			dialogOpen: false,
			ownDesign: own
		}) === 'arrival'
	);

	const copy = $derived(
		where === 'design'
			? {
					heading: `${designer?.trim() || 'Someone'} furnished my new room.`,
					text: "It's my room in Munich, with my furniture. Everyone gets the same pieces. Can you do better?"
				}
			: where === 'duel'
				? {
						heading: 'Help me furnish my new room.',
						text: "Everyone arranged my furniture in my Munich room. Pick the one you'd rather live in."
					}
				: {
						heading: 'Ideas for my new room.',
						text: 'Everyone arranged my furniture in my Munich room. Duels decide the ranking.'
					}
	);

	const close = () => onboarding.closeArrival();
</script>

<svelte:window
	onkeydown={(e) => {
		if (!visible || e.key !== 'Escape' || e.defaultPrevented) return;
		e.preventDefault();
		close();
	}}
/>

{#if visible}
	<section
		transition:slide={{ duration: duration(200) }}
		data-onboarding
		aria-label="What is this?"
		class="relative grid gap-1.5 rounded-2xl bg-accent-soft p-4 pr-12 text-[13.5px]"
	>
		<span class="absolute top-2 right-2"
			><IconButton icon="close" label="Close" onclick={close} /></span
		>
		<p class="text-[15px] leading-snug font-bold">{copy.heading}</p>
		<p class="leading-snug text-ink/80">{copy.text}</p>
		<div class="flex flex-wrap gap-1.5 pt-1.5">
			{#if where === 'duel'}
				<button class="btn btn-primary" onclick={close}>Got it</button>
				<a class="btn bg-sheet" href="/furnish" onclick={close}>Furnish your own</a>
			{:else}
				<a class="btn btn-primary" href="/furnish" onclick={close}>Furnish your own</a>
				{#if where === 'design' && onremix}
					<button
						class="btn bg-sheet"
						onclick={() => {
							close();
							onremix();
						}}>Remix this</button
					>
				{/if}
				<a class="btn bg-sheet" href="/duel" onclick={close}>Duel</a>
			{/if}
		</div>
	</section>
{/if}
