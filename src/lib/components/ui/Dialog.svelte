<script lang="ts">
	import { ui } from '#lib/ui.svelte.ts';
	import { untrack, type Snippet } from 'svelte';
	import IconButton from './IconButton.svelte';

	/**
	 * Modal dialog (native <dialog>: focus trap, Esc and backdrop close it). Shown while `open`;
	 * closing for any reason calls `onclose`.
	 */
	interface Props {
		open: boolean;
		title: string;
		onclose: () => void;
		children: Snippet;
		/** Show a close button next to the title */
		closable?: boolean;
	}
	let { open, title, onclose, children, closable = false }: Props = $props();

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	// Hints wait while any dialog is open
	$effect(() => {
		if (!open) return;
		untrack(() => ui.modals++);
		return () => untrack(() => ui.modals--);
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
			<div class="flex items-start justify-between gap-3">
				<h2 class="text-[19px] font-bold tracking-tight">{title}</h2>
				{#if closable}
					<span class="-mt-1.5 -mr-2">
						<IconButton icon="close" label="Close" onclick={() => dialog?.close()} />
					</span>
				{/if}
			</div>
			{@render children()}
		</div>
	{/if}
</dialog>
