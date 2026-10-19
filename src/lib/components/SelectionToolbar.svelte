<script lang="ts">
	import { describeCheck } from '#lib/planner/furniture.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import type { Furniture } from '#lib/planner/types.ts';
	import FloatingBar from './ui/FloatingBar.svelte';
	import Icon from './ui/Icon.svelte';
	import IconButton from './ui/IconButton.svelte';

	/** Quick actions floating above the selected Piece, or docked at the bottom on phones. */
	interface Props {
		f: Furniture;
		ondetails: () => void;
		/** At the bottom of the screen: the problems show above the actions */
		docked?: boolean;
	}
	let { f, ondetails, docked = false }: Props = $props();

	const problems = $derived(describeCheck(planner.checks[f.id]));
</script>

<div class={['flex items-center gap-1.5', docked ? 'flex-col-reverse' : 'flex-col']}>
	<FloatingBar label="{f.name} actions">
		<span class="px-2.5 text-[13px] font-semibold whitespace-nowrap max-md:max-w-36 max-md:truncate"
			>{f.name}</span
		>
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
