<script lang="ts">
	import { duration } from '#lib/motion.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import { fly } from 'svelte/transition';
</script>

<div
	class="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
	aria-live="polite"
>
	{#if toast.message}
		<p
			transition:fly={{ y: 12, duration: duration(180) }}
			class="rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-sheet shadow-float"
		>
			{toast.message}
		</p>
	{/if}
</div>
