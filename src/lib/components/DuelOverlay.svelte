<script lang="ts">
	import { duration } from '#lib/motion.ts';
	import { designFurniture } from '#lib/planner/room.ts';
	import type { DesignData } from '#lib/social/types.ts';
	import { fade } from 'svelte/transition';
	import Icon from './ui/Icon.svelte';

	/**
	 * One Design of a Duel in 3D, full screen and read-only. A single Preview shows either side,
	 * so there is only ever one 3D view. Esc (native <dialog>) and × close it without a vote.
	 */
	interface Props {
		pair: [DesignData, DesignData];
		/** Which side is on screen */
		index: 0 | 1;
		onchoose: (design: DesignData) => void;
		onclose: () => void;
	}
	let { pair, index = $bindable(), onchoose, onclose }: Props = $props();

	const design = $derived(pair[index]);
	const furn = $derived(designFurniture(design.placements));
</script>

<dialog
	{@attach (dialog) => {
		dialog.showModal();
		// Not the first control (the time slider): arrow keys walk, they must not move it
		dialog.querySelector<HTMLElement>('[data-primary]')?.focus();
	}}
	in:fade={{ duration: duration(160) }}
	class="m-0 size-full max-h-none max-w-none border-0 bg-[#1c1a17] p-0 text-ink"
	aria-label="Look inside {design.title}"
	{onclose}
>
	<!-- Loaded on demand: the Duel page itself only shows plans and doesn't need three.js -->
	{#await import('./Preview.svelte') then { default: Preview }}
		<Preview {furn} defaultShot="above" hint={false} />
	{/await}

	<section
		class="absolute top-4 left-4 z-10 grid w-[min(380px,calc(100vw-32px))] gap-3 rounded-3xl bg-sheet/90 p-4 shadow-float ring-1 ring-line/70 backdrop-blur-md"
	>
		<div class="flex items-start gap-2">
			<div class="grid min-w-0 flex-1 gap-0.5">
				<p class="text-[12px] font-semibold text-muted">
					{index === 0 ? 'Left' : 'Right'} design · read-only
				</p>
				<h2 class="truncate text-[19px] leading-tight font-bold tracking-tight">{design.title}</h2>
			</div>
			<button
				class="grid size-9 flex-none cursor-pointer place-items-center rounded-full text-ink transition-colors hover:bg-paper"
				aria-label="Back to both plans (Esc)"
				title="Back to both plans (Esc)"
				onclick={onclose}
			>
				<Icon name="close" />
			</button>
		</div>
		<div class="flex flex-wrap gap-1.5">
			<button class="btn btn-primary" data-primary onclick={() => onchoose(design)}>
				<Icon name="check" size={15} /> I'd rather live here
			</button>
			<button class="btn" onclick={() => (index = index === 0 ? 1 : 0)}> See the other one </button>
		</div>
	</section>
</dialog>
