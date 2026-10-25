<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { designFurniture } from '#lib/planner/room.ts';
	import { deleteDesign, getDesign } from '#lib/social/api.ts';
	import { designerName, duelRecord, shareDescription, timeAgo } from '#lib/social/format.ts';
	import { designPath } from '#lib/social/slug.ts';
	import type { DesignData } from '#lib/social/types.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import { setParams } from '#lib/url.ts';
	import { onMount } from 'svelte';
	import ArrivalCard from './ArrivalCard.svelte';
	import PlanView from './PlanView.svelte';
	import ConfirmButton from './ui/ConfirmButton.svelte';
	import Dialog from './ui/Dialog.svelte';
	import Icon from './ui/Icon.svelte';
	import Loader from './ui/Loader.svelte';
	import Segmented from './ui/Segmented.svelte';

	/** A Published Design, read-only: 3D or plan, its Rank and Duel record, Remix and Delete. */
	let { initial }: { initial: DesignData } = $props();

	// svelte-ignore state_referenced_locally
	let design = $state(structuredClone(initial));
	let mounted = $state(false);
	let publishedOpen = $state(false);
	let remixOpen = $state(false);

	// svelte-ignore state_referenced_locally
	const furn = designFurniture(initial.placements);
	const url = $derived(page.url.origin + designPath(design));
	const view = $derived(page.url.searchParams.get('view') === 'plan' ? 'plan' : '3d');
	const description = $derived(shareDescription(design));

	// Right after publishing, say where the Design went, once
	afterNavigate(() => {
		if (!page.url.searchParams.has('published')) return;
		publishedOpen = true;
		setParams({ published: null }, { replace: true });
	});

	onMount(() => {
		mounted = true;
		// Ownership needs the Device id, so only the client knows it
		getDesign(design.id)
			.then((d) => (design.mine = d.mine))
			.catch(() => {});
	});

	/** Remix replaces the Draft, so warn unless it's still the starting arrangement. */
	function remix(confirmed = false) {
		if (!confirmed && !planner.isEmpty) {
			remixOpen = true;
			return;
		}
		remixOpen = false;
		planner.remix(structuredClone($state.snapshot(design.placements)), {
			id: design.id,
			title: design.title,
			designer: design.designer
		});
		goto('/furnish');
	}

	async function remove() {
		try {
			await deleteDesign(design.id);
			toast.show('Design deleted');
			goto('/designs', { replace: true });
		} catch (e) {
			toast.show((e as Error).message);
		}
	}
</script>

<svelte:head>
	<title>{design.title} · Room Planner</title>
	<meta name="robots" content="noindex" />
	<meta name="description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={design.title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content="{page.url.origin}/og.jpg" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div class="relative h-full">
	{#if mounted && view === '3d'}
		<!-- Only rendered while shown; the viewpoint survives in ?shot=. Loaded on demand, so
		     the plan view doesn't download three.js -->
		{#await import('./Preview.svelte')}
			<Loader />
		{:then { default: Preview }}
			<Preview {furn} defaultShot="above" hint={false} />
		{/await}
	{:else if view === 'plan'}
		<div class="absolute inset-0 pt-16 max-md:pt-64">
			<PlanView {furn} />
		</div>
	{/if}

	<section
		class="pointer-events-auto absolute top-20 left-4 z-10 grid w-[min(380px,calc(100vw-32px))] gap-3 rounded-3xl bg-sheet/90 p-4 shadow-float ring-1 ring-line/70 backdrop-blur-md"
		aria-label="Design"
	>
		<div class="grid gap-0.5">
			<h1 class="text-[19px] leading-tight font-bold tracking-tight">{design.title}</h1>
			<p class="text-[13px] text-muted">
				by <span class="font-semibold text-ink">{designerName(design.designer)}</span> ·
				<time datetime={design.createdAt}>{timeAgo(design.createdAt)}</time>
			</p>
			{#if design.remixedFrom}
				<p class="flex items-center gap-1.5 text-[13px] text-muted">
					<Icon name="remix" size={14} />
					<span class="min-w-0 truncate">
						{#if design.remixedFrom.id}
							Remix of
							<a
								class="font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink"
								href={designPath({ id: design.remixedFrom.id, title: design.remixedFrom.title })}
								>{design.remixedFrom.title}</a
							>
							by {designerName(design.remixedFrom.designer)}
						{:else}
							Remix of a deleted design
						{/if}
					</span>
				</p>
			{/if}
		</div>

		<ArrivalCard
			where="design"
			designer={design.designer}
			own={design.mine}
			onremix={() => remix()}
		/>

		<p class="flex flex-wrap items-center gap-2 text-[13px]">
			<span
				class={[
					'rounded-full px-2.5 py-0.5 font-bold',
					design.rank === 1 && !design.provisional ? 'bg-accent text-sheet' : 'bg-paper text-ink'
				]}
				title="Rank on the Leaderboard">Rank #{design.rank}</span
			>
			<span class="font-semibold" title="Duels won–lost · win rate">{duelRecord(design)}</span>
			{#if design.provisional}
				<span
					class="rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-muted ring-1 ring-line"
					title="Fewer than 5 Duels so far, so this Rank can still move a lot">provisional</span
				>
			{/if}
		</p>

		<div class="flex flex-wrap items-center gap-1.5">
			<button class="btn" onclick={() => remix()} title="Copy into your design and change it">
				<Icon name="remix" size={15} /> Remix
			</button>
			{#if design.mine}
				<ConfirmButton label="Delete" confirmLabel="Delete for good?" onconfirm={remove} />
			{/if}
		</div>

		<Segmented
			label="View"
			value={view}
			options={[
				{ value: '3d', label: '3D', icon: 'cube' },
				{ value: 'plan', label: 'Plan', icon: 'plan' }
			]}
			onchange={(v) => setParams({ view: v === 'plan' ? 'plan' : null }, { replace: true })}
		/>
	</section>
</div>

<Dialog open={publishedOpen} title="Published!" closable onclose={() => (publishedOpen = false)}>
	<p class="text-[14px] text-muted">
		Your design is in the Duels now: friends see it next to others and pick where they'd rather
		live.
	</p>
	<div class="flex justify-end">
		<a href="/duel" class="btn btn-primary" onclick={() => (publishedOpen = false)}
			>Judge other designs</a
		>
	</div>
</Dialog>

<Dialog open={remixOpen} title="Replace your current design?" onclose={() => (remixOpen = false)}>
	<p class="text-[14px] text-muted">
		Your current arrangement will be replaced by this design. This can't be undone.
	</p>
	<div class="flex justify-end gap-2">
		<button class="btn" onclick={() => (remixOpen = false)}>Cancel</button>
		<button class="btn btn-primary" onclick={() => remix(true)}>Replace and remix</button>
	</div>
</Dialog>
