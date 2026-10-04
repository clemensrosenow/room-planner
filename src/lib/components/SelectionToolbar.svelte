<script lang="ts">
	import { describeCheck } from '#lib/planner/furniture.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import type { Furniture } from '#lib/planner/types.ts';
	import FloatingBar from './ui/FloatingBar.svelte';
	import Icon from './ui/Icon.svelte';
	import IconButton from './ui/IconButton.svelte';

	/** Quick actions floating above the selected Piece. */
	interface Props {
		f: Furniture;
		ondetails: () => void;
	}
	let { f, ondetails }: Props = $props();

	const problems = $derived(describeCheck(planner.checks[f.id]));
</script>

<div class="flex flex-col items-center gap-1.5">
	<FloatingBar label="{f.name} actions">
		<span class="px-2.5 text-[13px] font-semibold whitespace-nowrap">{f.name}</span>
		<span class="mx-0.5 h-5 w-px bg-line"></span>
		<IconButton icon="rotate-ccw" label="Rotate left" onclick={() => planner.rotate(f, -90)} />
		<IconButton icon="rotate-cw" label="Rotate right (R)" onclick={() => planner.rotate(f, 90)} />
		<IconButton icon="sliders" label="Exact position" onclick={ondetails} />
		<IconButton icon="close" label="Put back (Delete)" onclick={() => planner.unplace(f.id)} />
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
