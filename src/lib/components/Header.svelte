<script lang="ts">
	import { page } from '$app/state';
	import { cm, m2 } from '#lib/planner/format.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { STEPS } from '#lib/url.ts';

	const g = $derived(planner.geo);
</script>

<header class="flex flex-wrap items-center gap-x-4 gap-y-2">
	<h1 class="m-0 text-[26px] leading-none font-semibold tracking-[.01em] font-stretch-[72%]">
		Room Planner
	</h1>

	<nav aria-label="Steps">
		<ol class="flex overflow-hidden rounded-[5px] border border-line-strong">
			{#each STEPS as step, i (step.path)}
				{@const current = page.url.pathname === step.path}
				<li>
					<a
						href={step.path}
						class={[
							'block px-3 py-[5px] text-[13px] font-semibold no-underline',
							current ? 'bg-ink text-sheet' : 'text-ink hover:bg-paper'
						]}
						aria-current={current ? 'page' : undefined}
						><span class="mr-1 opacity-60">{i + 1}</span>{step.label}</a
					>
				</li>
			{/each}
		</ol>
	</nav>

	<div class="flex gap-1">
		<button
			class="btn disabled:cursor-default disabled:opacity-40"
			title="Undo (Ctrl+Z)"
			disabled={!planner.canUndo}
			onclick={() => planner.undo()}>↶ Undo</button
		>
		<button
			class="btn disabled:cursor-default disabled:opacity-40"
			title="Redo (Ctrl+Shift+Z)"
			disabled={!planner.canRedo}
			onclick={() => planner.redo()}>↷ Redo</button
		>
	</div>

	<div class="flex flex-wrap gap-x-3.5 gap-y-1 font-mono text-[12.5px] text-muted tabular-nums">
		<span><b class="font-medium text-ink">{m2(g.area)}</b> room</span>
		<span><b class="font-medium text-ink">{cm(g.W)} × {cm(g.L)}</b> cm</span>
		<span>height <b class="font-medium text-ink">{cm(g.H)}</b></span>
		{#if g.D > 0}<span>loggia <b class="font-medium text-ink">{m2(g.loggiaArea)}</b></span>{/if}
	</div>

	<div class="flex flex-wrap gap-1.5 max-[900px]:ml-0 min-[901px]:ml-auto">
		{#if !planner.measured}
			<span class="rounded-full bg-warn-soft px-[9px] py-[3px] text-xs whitespace-nowrap text-warn">
				Estimated from floor plan
			</span>
		{/if}
		<span
			class={[
				'rounded-full border bg-sheet px-[9px] py-[3px] text-xs whitespace-nowrap',
				planner.saved ? 'border-line text-ok' : 'border-warn text-warn'
			]}
		>
			<span class="mr-1.5 inline-block h-[7px] w-[7px] rounded-full bg-current align-[1px]"></span>
			{planner.saved ? 'Saved in this browser' : 'Not saved – browser storage unavailable'}
		</span>
	</div>
</header>
