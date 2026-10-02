<script lang="ts">
	import { duration, isNarrow } from '#lib/motion.ts';
	import type { Snippet } from 'svelte';
	import { fly } from 'svelte/transition';
	import Icon from './ui/Icon.svelte';

	interface Props {
		/** Floating controls in the bottom-left corner of the canvas */
		controls?: Snippet;
		/** Panel content: floating card on the right (desktop) or bottom sheet (mobile) */
		panel?: Snippet;
		title?: string;
		/** Small text next to the panel title */
		sub?: string;
		/** Let the canvas run under the header too */
		fullBleed?: boolean;
		/** Shows a close button on the panel */
		onclose?: () => void;
		/** The canvas (3D, plan or preview) */
		children: Snippet;
	}
	let {
		controls,
		panel,
		title = '',
		sub = '',
		fullBleed = false,
		onclose,
		children
	}: Props = $props();

	/** Mobile only: the sheet can shrink to its title */
	let collapsed = $state(false);
</script>

<div class="flex h-full flex-col md:block">
	<div
		class={[
			'relative min-h-0 flex-1 md:absolute md:inset-0',
			!fullBleed && 'pt-16',
			panel && 'md:right-[392px]'
		]}
	>
		<div class="relative h-full">
			{@render children()}
		</div>
		{#if controls}
			<div class="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-wrap gap-2">
				{@render controls()}
			</div>
		{/if}
	</div>

	{#if panel}
		<aside
			class="relative z-10 flex max-h-[45dvh] flex-none flex-col rounded-t-3xl bg-sheet shadow-float ring-1 ring-line/70 md:absolute md:top-20 md:right-4 md:bottom-4 md:max-h-none md:w-[360px] md:rounded-3xl"
			aria-label={title}
			transition:fly={{
				x: isNarrow() ? 0 : 24,
				y: isNarrow() ? 40 : 0,
				duration: duration(220)
			}}
		>
			<header class="flex items-baseline gap-2 px-5 pt-4 pb-3">
				<h2 class="text-[17px] font-bold tracking-tight">{title}</h2>
				<span class="min-w-0 truncate text-[13px] text-muted">{sub}</span>
				<div class="ml-auto flex flex-none gap-1 self-center">
					<button
						class="grid size-8 cursor-pointer place-items-center rounded-full text-muted hover:bg-paper md:hidden"
						aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
						aria-expanded={!collapsed}
						onclick={() => (collapsed = !collapsed)}
					>
						<Icon name={collapsed ? 'chevron-up' : 'chevron-down'} />
					</button>
					{#if onclose}
						<button
							class="grid size-8 cursor-pointer place-items-center rounded-full text-muted hover:bg-paper"
							aria-label="Close panel"
							onclick={onclose}
						>
							<Icon name="close" />
						</button>
					{/if}
				</div>
			</header>
			<div class={['min-h-0 flex-1 overflow-y-auto px-5 pb-5', collapsed && 'max-md:hidden']}>
				{@render panel()}
			</div>
		</aside>
	{/if}
</div>
