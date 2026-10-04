<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Modal dialog (native <dialog>: focus trap, Esc and backdrop close it). Shown while `open`;
	 * closing for any reason calls `onclose`.
	 */
	interface Props {
		open: boolean;
		title: string;
		onclose: () => void;
		children: Snippet;
	}
	let { open, title, onclose, children }: Props = $props();

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	class="m-auto w-[min(420px,calc(100vw-32px))] rounded-3xl bg-sheet p-0 text-ink shadow-float ring-1 ring-line/70 backdrop:bg-ink/30 backdrop:backdrop-blur-[2px]"
	aria-label={title}
	{onclose}
	onclick={(e) => {
		// A click on the backdrop lands on the dialog itself
		if (e.target === dialog) dialog.close();
	}}
>
	{#if open}
		<div class="grid gap-4 p-6">
			<h2 class="text-[19px] font-bold tracking-tight">{title}</h2>
			{@render children()}
		</div>
	{/if}
</dialog>
