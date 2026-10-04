<script lang="ts">
	import { goto } from '$app/navigation';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { publishDesign } from '#lib/social/api.ts';
	import { lastDesigner, rememberDesigner } from '#lib/social/device.ts';
	import { designerName } from '#lib/social/format.ts';
	import { suggestTitle } from '#lib/social/titles.ts';
	import { DESIGNER_MAX, TITLE_MAX } from '#lib/social/types.ts';
	import Dialog from './ui/Dialog.svelte';
	import Icon from './ui/Icon.svelte';

	/** Publishes the Draft with a title and an optional Designer name. */
	let { open, onclose }: { open: boolean; onclose: () => void } = $props();

	let title = $state('');
	let suggestion = $state('');
	let designer = $state('');
	let busy = $state(false);
	let error = $state('');

	// Every opening starts fresh, with a new suggestion and the name used last
	$effect(() => {
		if (!open) return;
		title = '';
		suggestion = suggestTitle();
		designer = lastDesigner();
		error = '';
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (busy) return;
		busy = true;
		error = '';
		try {
			const name = designer.trim();
			const res = await publishDesign({
				title: title.trim() || suggestion,
				designer: name || null,
				placements: planner.placements,
				...(planner.remixedFrom && { remixedFromId: planner.remixedFrom.id })
			});
			rememberDesigner(name);
			planner.published();
			onclose();
			await goto(`/d/${res.id}${res.slug ? '-' + res.slug : ''}?published=1`);
		} catch (err) {
			// The Draft stays as it is; the message explains what to do
			error = (err as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

<Dialog {open} title="Publish your design" {onclose}>
	<form class="grid gap-4" onsubmit={submit}>
		<label class="grid gap-1">
			<span class="text-xs font-semibold text-muted">Title</span>
			<span class="flex gap-2">
				<input
					class="input font-semibold"
					bind:value={title}
					placeholder={suggestion}
					maxlength={TITLE_MAX}
				/>
				<button
					type="button"
					class="grid size-10 flex-none cursor-pointer place-items-center rounded-xl bg-paper text-ink transition-colors hover:bg-line"
					aria-label="Suggest another title"
					title="Suggest another title"
					onclick={() => {
						suggestion = suggestTitle(suggestion);
						title = '';
					}}
				>
					<Icon name="dice" />
				</button>
			</span>
			<span class="text-xs text-muted">Leave it empty to use the suggestion.</span>
		</label>

		<label class="grid gap-1">
			<span class="text-xs font-semibold text-muted">Your name (optional)</span>
			<input
				class="input"
				bind:value={designer}
				placeholder="Anonymous"
				maxlength={DESIGNER_MAX}
				autocomplete="nickname"
			/>
		</label>

		{#if planner.remixedFrom}
			<p class="flex items-center gap-1.5 text-[13px] text-muted">
				<Icon name="remix" size={15} />
				<span class="min-w-0 truncate">
					Remix of <em class="font-semibold text-ink not-italic">{planner.remixedFrom.title}</em>
					by {designerName(planner.remixedFrom.designer)}
				</span>
			</p>
		{/if}

		{#if error}
			<p
				class="rounded-2xl bg-warn-soft px-4 py-2.5 text-[13px] font-semibold text-warn"
				role="alert"
			>
				{error}
			</p>
		{/if}

		<div class="flex justify-end gap-2 pt-1">
			<button type="button" class="btn" onclick={onclose}>Cancel</button>
			<button type="submit" class="btn btn-primary" disabled={busy}>
				<Icon name="send" size={15} />
				{busy ? 'Publishing…' : 'Publish'}
			</button>
		</div>
	</form>
</Dialog>
