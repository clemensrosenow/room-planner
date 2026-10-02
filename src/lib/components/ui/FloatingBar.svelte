<script lang="ts">
	import type { Snippet } from 'svelte';

	let { label, children }: { label?: string; children: Snippet } = $props();
</script>

<!-- Pill of controls floating above the canvas -->
<div
	class="pointer-events-auto flex items-center gap-0.5 rounded-full bg-sheet/90 p-1 shadow-float ring-1 ring-line/70 backdrop-blur-md"
	role={label ? 'toolbar' : undefined}
	aria-label={label}
>
	{@render children()}
</div>
