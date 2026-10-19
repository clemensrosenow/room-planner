<script lang="ts">
	import type { Snippet } from 'svelte';

	/** `hint` marks the bar as the target of an onboarding hint (`data-hint`) */
	let { label, hint, children }: { label?: string; hint?: string; children: Snippet } = $props();
</script>

<!-- Pill of controls floating above the canvas -->
<div
	class="pointer-events-auto flex items-center gap-0.5 rounded-full bg-sheet/90 p-1 shadow-float ring-1 ring-line/70 backdrop-blur-md"
	role={label ? 'toolbar' : undefined}
	aria-label={label}
	data-hint={hint}
>
	{@render children()}
</div>
