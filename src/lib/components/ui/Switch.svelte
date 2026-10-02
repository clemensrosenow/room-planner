<script lang="ts">
	let { label, checked = $bindable(false) }: { label: string; checked?: boolean } = $props();
</script>

<label class="flex cursor-pointer items-center justify-between gap-3 text-[13.5px]">
	{label}
	<input type="checkbox" role="switch" class="peer sr-only" bind:checked />
	<span
		class="relative h-6 w-10 flex-none rounded-full bg-line-strong transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-sheet after:shadow-sm after:transition-transform peer-checked:after:translate-x-4"
	></span>
</label>
