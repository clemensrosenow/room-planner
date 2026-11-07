<script lang="ts">
	import { navigating } from '$app/state';
	import { duration } from '#lib/motion.ts';
	import { fade } from 'svelte/transition';

	// Show immediately for route changes; selection and lighting query updates stay quiet.
	const shown = $derived(
		!!navigating.to && navigating.to.url.pathname !== navigating.from?.url.pathname
	);
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
