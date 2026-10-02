<script lang="ts">
	import { cm, m2 } from '#lib/planner/format.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';

	const g = $derived(planner.geo);
</script>

<header class="col-span-full flex flex-wrap items-center gap-x-4 gap-y-1.5">
	<h1 class="m-0 text-[26px] leading-none font-semibold tracking-[.01em] font-stretch-[72%]">
		Room Planner
	</h1>
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
