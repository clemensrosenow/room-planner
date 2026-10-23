<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Let the canvas run under the header too */
		fullBleed?: boolean;
		/** The canvas (3D, plan or preview) */
		children: Snippet;
	}
	let { fullBleed = false, children }: Props = $props();
</script>

<div class={['h-full', !fullBleed && 'pt-16']}>
	<div class="relative h-full">
		{@render children()}
	</div>
</div>
