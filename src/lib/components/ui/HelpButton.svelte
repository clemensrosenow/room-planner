<script lang="ts">
	import { duration } from '#lib/motion.ts';
	import { onboarding } from '#lib/onboarding/state.svelte.ts';
	import { fly } from 'svelte/transition';
	import IconButton from './IconButton.svelte';

	/** "?" button with a small popover of tips; works on touch screens too. */
	interface Props {
		/** [keys or gesture, what it does] */
		tips: [string, string][];
		/** Open upwards (for bars at the bottom of the screen) */
		up?: boolean;
	}
	let { tips, up = false }: Props = $props();

	let open = $state(false);
	let root = $state<HTMLElement>();
</script>

<svelte:window
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
	<IconButton
		icon="help"
		label="Tips and shortcuts"
		pressed={open}
		onclick={() => (open = !open)}
	/>
	{#if open}
		<div
			transition:fly={{ y: up ? 6 : -6, duration: duration(150) }}
			class={[
				'absolute left-0 z-30 w-72 rounded-2xl bg-sheet p-4 shadow-float ring-1 ring-line/70',
				up ? 'bottom-full mb-3' : 'top-full mt-3'
			]}
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
