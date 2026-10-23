<script lang="ts">
	import { duration } from '#lib/motion.ts';
	import { onboarding } from '#lib/onboarding/state.svelte.ts';
	import { fly } from 'svelte/transition';
	import IconButton from './IconButton.svelte';

	/** "?" button with a small popover of tips; works on touch screens too. */
	interface Props {
		/** [keys or gesture, what it does] */
		tips: [string, string][];
	}
	let { tips }: Props = $props();

	const WIDTH = 288;
	const MARGIN = 12;

	let open = $state(false);
	let root = $state<HTMLElement>();
	/** Popover offset from the button's left edge and its width, in px */
	let place = $state({ left: 0, width: WIDTH });

	/**
	 * Aligns the popover's left edge with the button's if it fits to the right, else their right
	 * edges; never past the screen's edge.
	 */
	function measure() {
		if (!root) return;
		const r = root.getBoundingClientRect();
		const vw = document.documentElement.clientWidth;
		const width = Math.min(WIDTH, vw - 2 * MARGIN);
		const left = r.left + width <= vw - MARGIN ? 0 : r.width - width;
		place = { left: Math.max(left, MARGIN - r.left), width };
	}

	function toggle() {
		if (!open) measure();
		open = !open;
	}
</script>

<svelte:window
	onresize={() => {
		if (open) measure();
	}}
	onpointerdown={(e) => {
		if (open && !root?.contains(e.target as Node)) open = false;
	}}
	onkeydowncapture={(e) => {
		// Esc closes the tips first, before it deselects anything on the page
		if (open && e.key === 'Escape') {
			open = false;
			e.preventDefault();
		}
	}}
/>

<span class="relative" bind:this={root}>
	<IconButton icon="help" label="Tips and shortcuts" pressed={open} onclick={toggle} />
	{#if open}
		<div
			transition:fly={{ y: -6, duration: duration(150) }}
			class="absolute top-full z-30 mt-3 rounded-2xl bg-sheet p-4 shadow-float ring-1 ring-line/70"
			style:left="{place.left}px"
			style:width="{place.width}px"
			role="dialog"
			aria-label="Tips and shortcuts"
		>
			<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[13px]">
				{#each tips as [keys, text] (keys)}
					<dt class="font-semibold whitespace-nowrap">{keys}</dt>
					<dd class="text-muted">{text}</dd>
				{/each}
			</dl>
			<button
				class="mt-3 w-full cursor-pointer border-t border-line pt-3 text-left text-[13px] font-semibold text-accent hover:underline"
				onclick={() => {
					open = false;
					onboarding.reset();
				}}
			>
				Show intro again
			</button>
		</div>
	{/if}
</span>
