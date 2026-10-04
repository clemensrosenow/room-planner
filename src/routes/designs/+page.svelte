<script lang="ts">
	import { page } from '$app/state';
	import DesignCard from '#lib/components/DesignCard.svelte';
	import Segmented from '#lib/components/ui/Segmented.svelte';
	import { listDesigns } from '#lib/social/api.ts';
	import type { DesignData, Sort } from '#lib/social/types.ts';
	import { setParams } from '#lib/url.ts';

	/** The Leaderboard: Top (most Likes, default) or New (`?sort=new`). */
	const sort = $derived<Sort>(page.url.searchParams.get('sort') === 'new' ? 'new' : 'top');

	let designs = $state<DesignData[]>([]);
	let cursor = $state<string | null>(null);
	let loading = $state(true);
	let error = $state('');

	async function load(more = false) {
		const s = sort;
		loading = true;
		error = '';
		try {
			const res = await listDesigns(s, more ? cursor : null);
			// Ignore answers for a tab that is no longer shown
			if (s !== sort) return;
			designs = more ? [...designs, ...res.designs] : res.designs;
			cursor = res.nextCursor;
		} catch (e) {
			if (s === sort) error = (e as Error).message;
		} finally {
			if (s === sort) loading = false;
		}
	}

	$effect(() => {
		void sort;
		designs = [];
		cursor = null;
		load();
	});
</script>

<svelte:head>
	<title>Designs · Room Planner</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="h-full overflow-y-auto">
	<div class="mx-auto grid max-w-6xl gap-6 px-4 pt-24 pb-12">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div class="grid gap-1">
				<h1 class="text-[26px] font-bold tracking-tight">Designs</h1>
				<p class="text-muted">
					Everyone furnishes the same room with the same furniture. Like the best.
				</p>
			</div>
			<Segmented
				label="Sort"
				value={sort}
				options={[
					{ value: 'top', label: 'Top' },
					{ value: 'new', label: 'New' }
				]}
				onchange={(v) => setParams({ sort: v === 'new' ? 'new' : null }, { replace: true })}
			/>
		</div>

		{#if designs.length}
			<ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each designs as design, i (design.id)}
					<li><DesignCard bind:design={designs[i]} rank={sort === 'top' ? i + 1 : undefined} /></li>
				{/each}
			</ul>
		{:else if !loading && !error}
			<div
				class="grid justify-items-center gap-3 rounded-3xl bg-sheet px-6 py-16 text-center ring-1 ring-line/70"
			>
				<p class="text-[17px] font-bold">No designs yet. Be the first</p>
				<p class="text-muted">Arrange the furniture, then publish it from the top right.</p>
				<a href="/furnish" class="btn btn-primary">Start furnishing</a>
			</div>
		{/if}

		{#if error}
			<div class="flex flex-wrap items-center justify-center gap-3 text-center" role="alert">
				<span class="font-semibold text-warn">{error}</span>
				<button class="btn" onclick={() => load(designs.length > 0)}>Try again</button>
			</div>
		{:else if loading}
			<p class="text-center text-muted" aria-live="polite">Loading…</p>
		{:else if cursor}
			<div class="flex justify-center">
				<button class="btn" onclick={() => load(true)}>Load more</button>
			</div>
		{/if}
	</div>
</div>
