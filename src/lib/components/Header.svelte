<script lang="ts">
	import { page } from '$app/state';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { STEPS } from '#lib/url.ts';
	import PublishButton from './PublishButton.svelte';
	import FloatingBar from './ui/FloatingBar.svelte';
	import Icon from './ui/Icon.svelte';
	import IconButton from './ui/IconButton.svelte';

	/** Undo, redo and Publish belong to the Draft, so only the steps show them */
	const editing = $derived(STEPS.some((s) => s.path === page.url.pathname));
	const onDesigns = $derived(page.url.pathname === '/designs');

	const tab = (current: boolean) => [
		'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-sm:px-2.5',
		current ? 'bg-ink text-sheet' : 'text-muted hover:text-ink'
	];
</script>

<!-- Named view transition: the header stays put while the pages cross-fade -->
<header
	class="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-16 items-center gap-3 px-4 [view-transition-name:header]"
>
	<a
		href="/furnish"
		class="pointer-events-auto flex-1 text-[15px] font-bold tracking-tight max-md:hidden"
		>Room Planner</a
	>

	<nav aria-label="Main" class="max-md:flex-1">
		<FloatingBar>
			<ol class="flex gap-0.5">
				{#each STEPS as step, i (step.path)}
					{@const current = page.url.pathname === step.path}
					<li>
						<a href={step.path} class={tab(current)} aria-current={current ? 'page' : undefined}>
							<span class="opacity-50 max-sm:hidden">{i + 1}</span>{step.label}
						</a>
					</li>
				{/each}
			</ol>
			<span class="mx-1 h-5 w-px bg-line"></span>
			<a
				href="/designs"
				class={tab(onDesigns)}
				aria-current={onDesigns ? 'page' : undefined}
				aria-label="Designs"
				title="Designs by everyone"
			>
				<Icon name="trophy" size={15} /><span class="max-sm:hidden">Designs</span>
			</a>
		</FloatingBar>
	</nav>

	<div class="flex items-center justify-end gap-2 md:flex-1">
		{#if editing}
			<span class="max-sm:hidden">
				<FloatingBar label="History">
					<IconButton
						icon="undo"
						label="Undo (Ctrl+Z)"
						disabled={!planner.canUndo}
						onclick={() => planner.undo()}
					/>
					<IconButton
						icon="redo"
						label="Redo (Ctrl+Shift+Z)"
						disabled={!planner.canRedo}
						onclick={() => planner.redo()}
					/>
					<span
						class={[
							'mx-2.5 size-2 flex-none rounded-full',
							planner.saved ? 'bg-ok/60' : 'animate-pulse bg-warn'
						]}
						role="img"
						aria-label={planner.saved
							? 'Saved in this browser'
							: 'Not saved – browser storage unavailable'}
						title={planner.saved
							? 'Saved in this browser'
							: 'Not saved – browser storage unavailable'}
					></span>
				</FloatingBar>
			</span>
			<span class="pointer-events-auto"><PublishButton /></span>
		{/if}
	</div>
</header>
