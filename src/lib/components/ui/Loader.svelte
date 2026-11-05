<script lang="ts">
	import { duration } from '#lib/motion.ts';
	import { fade } from 'svelte/transition';

	interface Props {
		show?: boolean;
		label?: string;
		/** `dark` over the walk-through preview, `scene` over the Furnish 3D view */
		tone?: 'dark' | 'scene';
	}
	let { show = true, label = 'Loading room…', tone = 'dark' }: Props = $props();
</script>

<!-- Covers a 3D view until its real models are in, so no stand-ins flash by -->
{#if show}
	<div
		out:fade={{ duration: duration(300) }}
		class={[
			'absolute inset-0 z-10 grid place-items-center',
			tone === 'dark' ? 'bg-[#1c1a17] text-white/70' : 'bg-paper text-muted'
		]}
		role="status"
		aria-live="polite"
	>
		<div class="flex flex-col items-center gap-3 text-[13px] font-semibold">
			<span
				class="size-8 rounded-full border-[3px] border-current border-t-accent opacity-80 motion-safe:animate-spin"
				aria-hidden="true"
			></span>
			{label}
		</div>
	</div>
{/if}
