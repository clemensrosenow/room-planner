<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { duration } from '#lib/motion.ts';
	import { describeProgress, publishProgress } from '#lib/onboarding/next.ts';
	import { onboarding } from '#lib/onboarding/state.svelte.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { INVENTORY } from '#lib/planner/room.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { selectItem } from '#lib/url.ts';
	import PublishDialog from './PublishDialog.svelte';
	import Icon from './ui/Icon.svelte';

	/**
	 * Shows how far the Draft is from publishable: Pieces placed, then Conflicts, then Publish.
	 * Clicking always helps: it points to the dock, selects the first Conflict, or opens the dialog.
	 */
	const total = INVENTORY.length;
	const progress = $derived(publishProgress(planner.furn.length, total, planner.conflicts.length));
	const label = $derived(describeProgress(progress));
	const ready = $derived(progress.kind === 'ready');

	let button = $state<HTMLButtonElement>();
	let wasReady: boolean | undefined;

	// Becoming publishable pulses the button once (not on the first render)
	$effect(() => {
		const ms = duration(400);
		if (ready && wasReady === false && ms)
			button?.animate(
				[{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
				{ duration: ms, easing: 'ease-out' }
			);
		wasReady = ready;
	});

	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

	function click() {
		if (progress.kind === 'ready') {
			onboarding.done('ready');
			ui.publishOpen = true;
		} else if (progress.kind === 'pieces') {
			if (page.url.pathname !== '/furnish') goto('/furnish');
			ui.pulseDock();
		} else {
			const id = planner.conflicts[0];
			if (page.url.pathname === '/furnish') selectItem(id);
			else goto(`/furnish?item=${id}`);
		}
	}
</script>

<button
	bind:this={button}
	data-hint="publish"
	class={[
		'btn relative overflow-hidden whitespace-nowrap shadow-float',
		ready && 'btn-primary',
		progress.kind === 'conflicts' && 'bg-warn-soft text-warn hover:bg-warn-soft',
		progress.kind === 'pieces' && 'bg-sheet/90 ring-1 ring-line/70 backdrop-blur-md hover:bg-sheet'
	]}
	aria-label={label}
	title={label}
	onclick={click}
>
	{#if progress.kind === 'ready'}
		<Icon name="send" size={15} />
		Publish
	{:else if progress.kind === 'conflicts'}
		<Icon name="alert" size={15} />
		<span class="max-sm:hidden">{plural(progress.conflicts, 'conflict')}</span>
		<span class="sm:hidden">{progress.conflicts}</span>
	{:else}
		<span class="tabular-nums">
			<span class="max-sm:hidden">{progress.placed} / {progress.total} placed</span>
			<span class="sm:hidden">{progress.placed}/{progress.total}</span>
		</span>
		{#if progress.conflicts}
			<span class="flex items-center gap-1 text-warn">
				·
				<span class="max-sm:hidden">{plural(progress.conflicts, 'conflict')}</span>
				<span class="flex items-center gap-0.5 sm:hidden">
					{progress.conflicts}<Icon name="alert" size={13} />
				</span>
			</span>
		{/if}
		<span class="absolute inset-x-3.5 bottom-1 h-0.5 rounded-full bg-line" aria-hidden="true">
			<span
				class="block h-full rounded-full bg-accent transition-[width] duration-300"
				style:width="{(progress.placed / progress.total) * 100}%"
			></span>
		</span>
	{/if}
</button>
<span class="sr-only" aria-live="polite">{label}</span>

<PublishDialog open={ui.publishOpen} onclose={() => (ui.publishOpen = false)} />
