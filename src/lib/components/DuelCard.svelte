<script lang="ts">
	import type { DesignData } from '#lib/social/types.ts';
	import PlanThumb from './PlanThumb.svelte';
	import Icon from './ui/Icon.svelte';

	/**
	 * One side of a Duel: the plan and the title, never the Designer. The whole card votes for it;
	 * "Look inside" sits above that and opens the 3D view.
	 */
	interface Props {
		design: DesignData;
		/** Arrow key that votes for this card */
		side: 'left' | 'right';
		/** chosen = just picked, passed = the other one was */
		status: 'idle' | 'chosen' | 'passed';
		disabled: boolean;
		onvote: () => void;
		onlook: () => void;
	}
	let { design, side, status, disabled, onvote, onlook }: Props = $props();
</script>

<article
	class={[
		'relative flex flex-col overflow-hidden rounded-3xl bg-sheet shadow-float transition duration-200 motion-reduce:transform-none motion-reduce:transition-none',
		status === 'chosen'
			? 'scale-[1.02] ring-4 ring-accent'
			: 'ring-1 ring-line/70 focus-within:ring-accent',
		status === 'passed' && 'scale-[0.98] opacity-40',
		status === 'idle' && !disabled && 'hover:-translate-y-0.5'
	]}
>
	<div
		class="relative aspect-[5/6] max-h-[50dvh] bg-paper/70 p-4 max-sm:aspect-auto max-sm:h-[24dvh] max-sm:p-3"
	>
		<PlanThumb placements={design.placements} />
		{#if status === 'chosen'}
			<span
				class="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-accent text-sheet"
			>
				<Icon name="check" size={16} />
			</span>
		{/if}
	</div>
	<div class="flex items-center gap-3 p-4 max-sm:py-3">
		<h2 class="min-w-0 flex-1 text-[15px] leading-snug font-bold tracking-tight">
			<!-- Stretched button: covers the whole card -->
			<button
				class="block w-full cursor-pointer truncate text-left outline-none after:absolute after:inset-0 disabled:cursor-default"
				{disabled}
				onclick={onvote}>{design.title}<span class="sr-only"> – I'd rather live here</span></button
			>
		</h2>
		<kbd
			class="rounded-md px-1.5 text-[12px] font-semibold text-muted ring-1 ring-line max-sm:hidden"
			title="Press {side === 'left' ? '←' : '→'} to choose">{side === 'left' ? '←' : '→'}</kbd
		>
		<button class="btn relative z-10" {disabled} onclick={onlook}>
			<Icon name="cube" size={15} /> Look inside
		</button>
	</div>
</article>
