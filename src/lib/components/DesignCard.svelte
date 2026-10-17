<script lang="ts">
	import { designerName, timeAgo } from '#lib/social/format.ts';
	import { designPath } from '#lib/social/slug.ts';
	import type { DesignData } from '#lib/social/types.ts';
	import PlanThumb from './PlanThumb.svelte';
	import Icon from './ui/Icon.svelte';

	/** Leaderboard card. The whole card links to the design. */
	let { design = $bindable(), rank }: { design: DesignData; rank?: number } = $props();
</script>

<article
	class="group relative flex flex-col overflow-hidden rounded-3xl bg-sheet shadow-float ring-1 ring-line/70 transition-transform focus-within:ring-accent hover:-translate-y-0.5"
>
	<div class="relative aspect-[5/6] bg-paper/70 p-4">
		<PlanThumb placements={design.placements} />
		{#if rank}
			<span
				class={[
					'absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-[12px] font-bold',
					rank === 1 ? 'bg-accent text-sheet' : 'bg-sheet text-muted ring-1 ring-line'
				]}>#{rank}</span
			>
		{/if}
	</div>
	<div class="grid gap-2 p-4">
		<div class="grid gap-0.5">
			<h2 class="truncate text-[15px] leading-snug font-bold tracking-tight">
				<!-- Stretched link: covers the whole card -->
				<a href={designPath(design)} class="outline-none after:absolute after:inset-0"
					>{design.title}</a
				>
			</h2>
			<p class="truncate text-[13px] text-muted">
				by {designerName(design.designer)} · {timeAgo(design.createdAt)}
			</p>
		</div>
		<div class="flex items-center justify-between gap-2">
			{#if design.remixedFrom}
				<span
					class="flex items-center gap-1 text-[12px] font-semibold text-muted"
					title={design.remixedFrom.id
						? `Remix of ${design.remixedFrom.title}`
						: 'Remix of a deleted design'}
				>
					<Icon name="remix" size={14} /> Remix
				</span>
			{/if}
		</div>
	</div>
</article>
