<script lang="ts">
	import { navigating } from '$app/state';
	import { duration } from '#lib/motion.ts';
	import { fade } from 'svelte/transition';

	/** Fast page changes stay clean: the bar only shows once one takes longer than this */
	const DELAY = 150;

	let shown = $state(false);
	$effect(() => {
		// Query-only changes (selection, viewpoint) are not page changes
		const to = navigating.to?.url.pathname;
		if (!to || to === navigating.from?.url.pathname) {
			shown = false;
			return;
		}
		const timer = setTimeout(() => (shown = true), DELAY);
		return () => clearTimeout(timer);
	});
</script>

{#if shown}
	<div
		out:fade={{ duration: duration(200) }}
		class="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
		role="progressbar"
		aria-label="Loading page"
	>
		<div class="bar h-full origin-left bg-accent"></div>
	</div>
{/if}

<style>
	/* Creeps towards the end without reaching it; the page showing up finishes it */
	.bar {
		animation: grow 6s cubic-bezier(0.1, 0.6, 0.2, 1) forwards;
	}
	@keyframes grow {
		from {
			transform: scaleX(0.05);
		}
		to {
			transform: scaleX(0.9);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bar {
			animation: none;
			transform: scaleX(0.6);
		}
	}
</style>
