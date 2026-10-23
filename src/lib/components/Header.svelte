<script lang="ts">
	import { page } from '$app/state';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { STEPS } from '#lib/url.ts';
	import PublishButton from './PublishButton.svelte';
	import FloatingBar from './ui/FloatingBar.svelte';
	import Icon from './ui/Icon.svelte';
	import IconButton from './ui/IconButton.svelte';

	/** Undo and redo belong to the Draft, so only its pages show them */
	const editing = $derived(STEPS.some((s) => s.path === page.url.pathname));
	const onDesigns = $derived(page.url.pathname === '/designs');
	const onDuel = $derived(page.url.pathname === '/duel');

	/** Steps 1 and 2; on phones only the current one shows its label next to its number */
	const step = (current: boolean) => [
		'flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-[13px] font-semibold transition-colors',
		current ? 'bg-ink text-sheet max-sm:pr-2.5' : 'text-muted hover:text-ink max-sm:pr-1'
	];
	const number = (current: boolean) => [
		'grid size-6 flex-none place-items-center rounded-full text-[12px] max-sm:size-5 max-sm:text-[11px]',
		current ? 'bg-sheet/20' : 'ring-1 ring-line-strong'
	];
	const tab = (current: boolean) => [
		'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-lg:px-2 max-sm:px-1.5',
		current ? 'bg-ink text-sheet' : 'text-muted hover:text-ink'
	];
</script>

<!-- Named view transition: the header stays put while the pages cross-fade -->
<header
	class="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-16 items-center gap-2 px-4 [view-transition-name:header] max-sm:gap-1.5 max-sm:px-2"
>
	<a
		href="/furnish"
		class="pointer-events-auto flex-1 text-[15px] font-bold tracking-tight max-md:hidden"
		>Room Planner</a
	>

	<nav aria-label="Main" class="flex items-center gap-2 max-sm:gap-1.5">
		<FloatingBar>
			<ol class="flex items-center gap-0.5 max-sm:gap-0" aria-label="Steps">
				{#each STEPS as s, i (s.path)}
					{@const current = page.url.pathname === s.path}
					<li>
						<a
							href={s.path}
							class={step(current)}
							aria-current={current ? 'page' : undefined}
							aria-label={current ? undefined : s.label}
						>
							<span class={number(current)} aria-hidden="true">{i + 1}</span>
							<span class={[!current && 'max-sm:hidden']}>{s.label}</span>
						</a>
					</li>
					<li class="text-line-strong" aria-hidden="true">
						<Icon name="chevron-right" size={12} />
					</li>
				{/each}
				<li><PublishButton /></li>
			</ol>
		</FloatingBar>
		<FloatingBar>
			<a
				href="/designs"
				class={tab(onDesigns)}
				aria-current={onDesigns ? 'page' : undefined}
				aria-label="Designs"
				title="Designs by everyone"
			>
				<Icon name="trophy" size={15} /><span class="max-lg:hidden">Designs</span>
			</a>
			<a
				href="/duel"
				class={tab(onDuel)}
				aria-current={onDuel ? 'page' : undefined}
				aria-label="Duel"
				title="Pick where you'd rather live"
			>
				<Icon name="scale" size={15} /><span class="max-lg:hidden">Duel</span>
			</a>
		</FloatingBar>
	</nav>

	<div class="flex items-center justify-end gap-2 max-md:ml-auto md:flex-1">
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
		{/if}
	</div>
</header>
