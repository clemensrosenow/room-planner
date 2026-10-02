<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		sub?: string;
		open?: boolean;
		children: Snippet;
	}
	let { title, sub = '', open = false, children }: Props = $props();
</script>

<details class="group border-b border-line" {open}>
	<summary
		class="flex cursor-pointer list-none items-baseline gap-2 px-3.5 py-[11px] text-[15px] font-semibold tracking-[.04em] uppercase font-stretch-[78%] [&::-webkit-details-marker]:hidden"
	>
		<span
			class="h-[7px] w-[7px] flex-none -rotate-45 self-center border-r-[1.5px] border-b-[1.5px] border-muted transition-transform group-open:rotate-45 motion-reduce:transition-none"
		></span>
		{title}
		<span
			class="ml-auto text-xs font-normal tracking-normal text-muted normal-case font-stretch-normal"
			>{sub}</span
		>
	</summary>
	<div class="grid gap-2.5 px-3.5 pb-3.5">
		{@render children()}
	</div>
</details>
