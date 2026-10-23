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
	 * Step 3 of the header: shows how far the Draft is from publishable: Pieces placed, then
	 * Conflicts, then Publish. Clicking always helps: it points to the dock, selects the first
	 * Conflict, or opens the dialog.
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
		'relative flex cursor-pointer items-center gap-1.5 overflow-hidden rounded-full py-1 pr-3 pl-1 text-[13px] font-semibold whitespace-nowrap transition-colors max-sm:pr-2.5',
		ready && 'bg-accent text-sheet hover:bg-accent/90',
		progress.kind === 'conflicts' && 'bg-warn-soft text-warn',
		progress.kind === 'pieces' && 'text-ink hover:bg-paper'
	]}
	aria-label={label}
	title={label}
	onclick={click}
>
	<span
		class={[
			'grid size-6 flex-none place-items-center rounded-full text-[12px] max-sm:size-5 max-sm:text-[11px]',
			ready
				? 'bg-sheet/25'
				: progress.kind === 'conflicts'
					? 'ring-1 ring-warn/40'
					: 'ring-1 ring-line-strong'
		]}
		aria-hidden="true">3</span
	>
	{#if progress.kind === 'ready'}
		Publish
		<span class="max-sm:hidden"><Icon name="send" size={14} /></span>
	{:else if progress.kind === 'conflicts'}
		<span class="flex items-center gap-1.5 max-sm:hidden">
			<Icon name="alert" size={14} />
			{plural(progress.conflicts, 'conflict')}
		</span>
		<span class="flex items-center gap-0.5 sm:hidden">
			{progress.conflicts}<Icon name="alert" size={13} />
		</span>
	{:else}
		<!-- Compact until the header has room for the words next to the title -->
		<span class="tabular-nums">
			<span class="max-md:hidden">{progress.placed} / {progress.total} placed</span>
			<span class="md:hidden">{progress.placed}/{progress.total}</span>
		</span>
		{#if progress.conflicts}
			<span class="flex items-center gap-1 text-warn">
				<span class="max-sm:hidden">·</span>
				<span class="max-lg:hidden">{plural(progress.conflicts, 'conflict')}</span>
				<span class="flex items-center gap-0.5 lg:hidden">
					{progress.conflicts}<Icon name="alert" size={13} />
				</span>
			</span>
		{/if}
		<span
			class="absolute right-3 bottom-0.5 left-8 h-0.5 rounded-full bg-line max-sm:right-2.5 max-sm:left-7"
			aria-hidden="true"
		>
			<span
				class="block h-full rounded-full bg-accent transition-[width] duration-300"
				style:width="{(progress.placed / progress.total) * 100}%"
			></span>
		</span>
	{/if}
</button>
<span class="sr-only" aria-live="polite">{label}</span>

<PublishDialog open={ui.publishOpen} onclose={() => (ui.publishOpen = false)} />
