<script lang="ts">
	import { PALETTE } from '#lib/planner/defaults.ts';
	import { describeCheck } from '#lib/planner/furniture.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import type { Furniture } from '#lib/planner/types.ts';
	import { selectItem } from '#lib/url.ts';
	import FloatingBar from './ui/FloatingBar.svelte';
	import Icon from './ui/Icon.svelte';
	import IconButton from './ui/IconButton.svelte';
	import { duration } from '#lib/motion.ts';
	import { scale } from 'svelte/transition';

	/** Quick actions floating above the selected piece. */
	interface Props {
		f: Furniture;
		ondetails: () => void;
	}
	let { f, ondetails }: Props = $props();

	let colors = $state(false);
	let armed = $state(false);
	let timer: ReturnType<typeof setTimeout>;
	const problems = $derived(describeCheck(planner.checks[f.id]));

	function remove() {
		clearTimeout(timer);
		if (!armed) {
			armed = true;
			timer = setTimeout(() => (armed = false), 3000);
			return;
		}
		planner.remove(f);
	}
	$effect(() => () => clearTimeout(timer));
	// A different piece starts with closed menus
	$effect(() => {
		void f.id;
		colors = armed = false;
	});
</script>

<div class="flex flex-col items-center gap-1.5">
	{#if colors}
		<div
			transition:scale={{ start: 0.9, duration: duration(120) }}
			class="pointer-events-auto flex gap-1.5 rounded-full bg-sheet/95 p-1.5 shadow-float ring-1 ring-line/70"
			role="group"
			aria-label="Color"
		>
			{#each PALETTE as color, i (color)}
				<button
					class={[
						'size-7 cursor-pointer rounded-full transition-transform hover:scale-110',
						f.color === i && 'ring-2 ring-ink ring-offset-2 ring-offset-sheet'
					]}
					style:background="var({color})"
					aria-label="Color {i + 1}"
					aria-pressed={f.color === i}
					onclick={() => (f.color = i)}
				></button>
			{/each}
		</div>
	{/if}
	<FloatingBar label="{f.name} actions">
		<IconButton icon="rotate-ccw" label="Rotate left" onclick={() => planner.rotate(f, -90)} />
		<IconButton icon="rotate-cw" label="Rotate right (R)" onclick={() => planner.rotate(f, 90)} />
		<button
			class="grid size-9 cursor-pointer place-items-center rounded-full hover:bg-paper"
			aria-label="Color"
			aria-expanded={colors}
			title="Color"
			onclick={() => (colors = !colors)}
		>
			<span
				class="size-4.5 rounded-full ring-1 ring-ink/20"
				style:background="var({PALETTE[f.color % PALETTE.length]})"
			></span>
		</button>
		<IconButton icon="copy" label="Duplicate" onclick={() => selectItem(planner.duplicate(f).id)} />
		<IconButton icon="sliders" label="Size and details" onclick={ondetails} />
		<span class="mx-0.5 h-5 w-px bg-line"></span>
		{#if armed}
			<button
				class="cursor-pointer rounded-full bg-warn px-3 py-1.5 text-[13px] font-semibold text-sheet"
				onclick={remove}>Delete?</button
			>
		{:else}
			<IconButton icon="trash" label="Delete" tone="danger" onclick={remove} />
		{/if}
	</FloatingBar>
	{#if problems.length}
		<p
			class="flex max-w-80 items-center gap-1.5 rounded-full bg-warn-soft px-3 py-1 text-[12.5px] font-semibold text-warn shadow-float"
		>
			<Icon name="alert" size={14} />
			{problems.join(' · ')}
		</p>
	{/if}
</div>
