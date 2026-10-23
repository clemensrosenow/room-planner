<script lang="ts">
	import { goto } from '$app/navigation';
	import type { HintId, Shown } from '#lib/onboarding/next.ts';
	import { onboarding } from '#lib/onboarding/state.svelte.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import Hint from './ui/Hint.svelte';

	/**
	 * The hint chosen by `nextOnboarding`, with its copy. A new hint waits 600 ms, so hints don't
	 * flash during nudges or follow each other instantly. A hint is done for good when closed or
	 * when the user does what it explains.
	 */
	let { shown }: { shown: Shown } = $props();

	const touch = new MediaQuery('pointer: coarse');

	const isHint = (s: Shown): s is HintId => s !== null && s !== 'welcome' && s !== 'arrival';

	let current = $state<HintId | null>(null);
	$effect(() => {
		const next = isHint(shown) ? shown : null;
		if (next === untrack(() => current)) return;
		current = null;
		if (!next) return;
		const t = setTimeout(() => (current = next), 600);
		return () => clearTimeout(t);
	});

	// Hints that were on screen are done once the user does what they explain.
	// A plain Set: it's a memory, nothing renders from it.
	const seen = new Set<HintId>();
	let turning: { id: string; rot: number } | undefined;
	$effect(() => {
		if (current) seen.add(current);
		const selected = planner.selected;
		if (current === 'move-turn' && selected && turning?.id !== selected.id)
			turning = { id: selected.id, rot: selected.rot };
		if (seen.has('drag-in') && planner.furn.length > 0) onboarding.done('drag-in');
		if (seen.has('conflict') && planner.conflicts.length === 0) onboarding.done('conflict');
		if (seen.has('move-turn') && selected?.id === turning?.id && selected?.rot !== turning?.rot)
			onboarding.done('move-turn');
	});

	/** The conflict hint points at the selected Piece's toolbar if that Piece is in Conflict */
	const conflictTarget = $derived(
		planner.selected && planner.conflicts.includes(planner.selected.id) ? 'toolbar' : 'publish'
	);

	const close = (id: HintId) => () => onboarding.done(id);
</script>

{#if current === 'drag-in'}
	<Hint target="dock" prefer="above" gesture onclose={close('drag-in')}>
		Drag a piece into the room, or {touch.current ? 'tap' : 'click'} it to drop it in the middle.
	</Hint>
{:else if current === 'move-turn'}
	<Hint target="toolbar" prefer="above" onclose={close('move-turn')}>
		{#if touch.current}
			Drag to move. It snaps to walls and other pieces. Turn it with these buttons.
		{:else}
			Drag to move. It snaps to walls and other pieces (hold Alt to place freely). Turn it here or
			press R.
		{/if}
	</Hint>
{:else if current === 'conflict'}
	<Hint target={conflictTarget} prefer="above" onclose={close('conflict')}>
		Red means a conflict: this piece sticks out of the room, overlaps another one or blocks a door.
		Fix every conflict before you publish.
	</Hint>
{:else if current === 'ready'}
	<Hint target="publish" prefer="below" title="Every piece has its place." onclose={close('ready')}>
		Walk through your room in realistic light first, or publish it now.
		{#snippet actions()}
			<button
				class="btn"
				onclick={() => {
					onboarding.done('ready');
					ui.publishOpen = true;
				}}>Publish</button
			>
			<button
				class="btn btn-primary"
				onclick={() => {
					onboarding.done('ready');
					goto('/experience');
				}}>Walk through it</button
			>
		{/snippet}
	</Hint>
{:else if current === 'experience'}
	<Hint target="camera" prefer="above" onclose={close('experience')}>
		{touch.current ? 'Drag to look around, pinch to zoom.' : 'Drag to look around, ↑↓ to walk.'}
		Try the viewpoints and the time of day. Publish whenever you're happy.
	</Hint>
{/if}
