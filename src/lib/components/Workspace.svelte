<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Controls above the canvas */
		toolbar?: Snippet;
		/** Side panel; the canvas takes the full width without it */
		aside?: Snippet;
		asideLabel?: string;
		/** The canvas (3D, plan or preview) */
		children: Snippet;
	}
	let { toolbar, aside, asideLabel, children }: Props = $props();
</script>

<div
	class={[
		'grid h-full gap-3 max-[900px]:h-auto max-[900px]:grid-cols-[minmax(0,1fr)]',
		aside ? 'grid-cols-[minmax(0,1fr)_384px]' : 'grid-cols-[minmax(0,1fr)]'
	]}
>
	<section
		class="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-line bg-sheet"
		aria-label="View"
	>
		{#if toolbar}
			<div class="flex flex-wrap items-center gap-2 border-b border-line px-2.5 py-2">
				{@render toolbar()}
			</div>
		{/if}
		<div
			class="relative min-h-[340px] flex-1 max-[900px]:h-[min(64vh,540px)] max-[900px]:flex-none"
		>
			{@render children()}
		</div>
	</section>

	{#if aside}
		<aside
			class="min-h-0 overflow-auto rounded-md border border-line bg-sheet max-[900px]:overflow-visible"
			aria-label={asideLabel}
		>
			{@render aside()}
		</aside>
	{/if}
</div>
