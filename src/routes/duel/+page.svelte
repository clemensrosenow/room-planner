<script lang="ts">
	import DuelCard from '#lib/components/DuelCard.svelte';
	import DuelOverlay from '#lib/components/DuelOverlay.svelte';
	import { getPair, vote, type DuelResponse } from '#lib/duels/client.ts';
	import { pairKey } from '#lib/duels/types.ts';
	import { duration } from '#lib/motion.ts';
	import { ApiError } from '#lib/social/api.ts';
	import type { DesignData } from '#lib/social/types.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import { setParams } from '#lib/url.ts';
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';

	/** A Duel: "Where would you rather live?" between two Designs, one tap per vote. */
	type Pair = [DesignData, DesignData];

	/** undefined while loading */
	let duel = $state.raw<DuelResponse | undefined>(undefined);
	/** undefined while loading, null when there is nothing to judge (`duel.reason` says why) */
	const pair = $derived<Pair | null | undefined>(duel?.pair);
	let error = $state('');
	/** While a vote is cast and the next pair loads; `chosen` is highlighted meanwhile */
	let busy = $state(false);
	let chosen = $state<string | null>(null);
	/** Side shown in the 3D overlay; null = closed */
	let looking = $state<0 | 1 | null>(null);

	const HIGHLIGHT_MS = 350;
	const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	async function load() {
		error = '';
		duel = undefined;
		try {
			duel = await getPair();
		} catch (e) {
			error = (e as Error).message;
		}
	}

	onMount(load);

	/** Votes for `winner` (null = Skip), then shows the next pair, fetched during the highlight. */
	async function judge(winner: DesignData | null) {
		if (!pair || busy) return;
		const [a, b] = pair;
		busy = true;
		chosen = winner?.id ?? null;
		try {
			const highlight = wait(winner ? HIGHLIGHT_MS : 0);
			try {
				await vote(a.id, b.id, winner?.id ?? null);
			} catch (e) {
				// Deleted meanwhile or already judged: move on without a word
				if (!(e instanceof ApiError && (e.status === 404 || e.status === 409))) throw e;
			}
			const [next] = await Promise.all([getPair(), highlight]);
			duel = next;
		} catch (e) {
			// No connection: keep the pair so the vote can be tried again
			toast.show((e as Error).message);
		} finally {
			busy = false;
			chosen = null;
		}
	}

	/** The 3D view mirrors its camera into the URL; drop that when leaving it. */
	function closeLook() {
		looking = null;
		setParams({ shot: null, time: null, lamp: null, mode: null }, { replace: true });
	}

	function chooseInside(design: DesignData) {
		closeLook();
		judge(design);
	}

	/** ← / → vote for the left / right Design, S skips. Off while walking around in 3D. */
	function onkeydown(e: KeyboardEvent) {
		if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || looking !== null || !pair)
			return;
		const t = e.target as HTMLElement;
		if (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) || t.isContentEditable) return;
		if (e.key === 'ArrowLeft') judge(pair[0]);
		else if (e.key === 'ArrowRight') judge(pair[1]);
		else if (e.key.toLowerCase() === 's') judge(null);
		else return;
		e.preventDefault();
	}

	const status = (d: DesignData) => (!chosen ? 'idle' : chosen === d.id ? 'chosen' : 'passed');
</script>

<svelte:head>
	<title>Duel · Room Planner</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<svelte:window {onkeydown} />

<div class="h-full overflow-x-hidden overflow-y-auto">
	<div class="mx-auto grid max-w-3xl gap-6 px-4 pt-24 pb-12 max-sm:gap-4 max-sm:pt-20">
		<div class="grid gap-1 text-center">
			<h1 class="text-[26px] font-bold tracking-tight max-sm:text-[22px]">
				Where would you rather live?
			</h1>
			<p class="text-muted">Same room, same furniture. Tap the one you'd pick.</p>
		</div>

		{#if pair}
			{#key pairKey(pair[0].id, pair[1].id)}
				<div
					class="grid grid-cols-1 gap-4 sm:grid-cols-2"
					in:fly={{ x: 48, duration: duration(280), easing: cubicOut }}
				>
					{#each pair as design, i (design.id)}
						<DuelCard
							{design}
							side={i === 0 ? 'left' : 'right'}
							status={status(design)}
							disabled={busy}
							onvote={() => judge(design)}
							onlook={() => (looking = i === 0 ? 0 : 1)}
						/>
					{/each}
				</div>
			{/key}
			<div class="grid justify-items-center gap-1">
				<button
					class="cursor-pointer rounded-full px-3 py-1 text-[13px] font-semibold text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink disabled:cursor-default"
					disabled={busy}
					onclick={() => judge(null)}
				>
					Skip
				</button>
				<p class="text-[12px] text-muted max-sm:hidden">← → to choose · S to skip</p>
			</div>
			<p class="sr-only" aria-live="polite">{pair[0].title} or {pair[1].title}</p>
		{:else if duel && !duel.pair}
			<div
				class="grid justify-items-center gap-3 rounded-3xl bg-sheet px-6 py-16 text-center ring-1 ring-line/70"
			>
				{#if duel.reason === 'too-few'}
					<p class="text-[17px] font-bold">Not enough designs yet</p>
					<p class="text-muted">
						Duels need at least two designs from other people. Publish yours and share the link with
						friends.
					</p>
					<a href="/furnish" class="btn btn-primary">Furnish your design</a>
				{:else}
					<p class="text-[17px] font-bold">You've judged every pair for now.</p>
					<p class="text-muted">Come back in a few hours to vote on new designs.</p>
					<a href="/furnish" class="btn btn-primary">Publish your own</a>
				{/if}
			</div>
		{:else if error}
			<div class="flex flex-wrap items-center justify-center gap-3 text-center" role="alert">
				<span class="font-semibold text-warn">{error}</span>
				<button class="btn" onclick={load}>Try again</button>
			</div>
		{:else}
			<p class="text-center text-muted" aria-live="polite">Loading…</p>
		{/if}
	</div>
</div>

{#if pair && looking !== null}
	<DuelOverlay
		{pair}
		bind:index={() => looking ?? 0, (side) => (looking = side)}
		onchoose={chooseInside}
		onclose={closeLook}
	/>
{/if}
