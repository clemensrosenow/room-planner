<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { selectItem } from '#lib/url.ts';
	import PublishDialog from './PublishDialog.svelte';
	import Icon from './ui/Icon.svelte';

	/**
	 * Opens the publish dialog. Until every Piece is placed it leads to the Furnish step, and while
	 * the Draft has Conflicts it points to the first one.
	 */
	let open = $state(false);

	const left = $derived(planner.unplaced.length);
	const conflicts = $derived(planner.conflicts.length);
	const blocked = $derived(left > 0 || conflicts > 0);
	const hint = $derived(
		left
			? `Place ${left} more piece${left === 1 ? '' : 's'} first`
			: conflicts
				? `Resolve ${conflicts} conflict${conflicts === 1 ? '' : 's'} first`
				: 'Publish and share'
	);

	function click() {
		if (!blocked) {
			open = true;
			return;
		}
		if (left) {
			if (page.url.pathname !== '/furnish') goto('/furnish');
			return;
		}
		const id = planner.conflicts[0];
		if (page.url.pathname === '/furnish') selectItem(id);
		else goto(`/furnish?item=${id}`);
	}
</script>

<button
	class={['btn btn-primary shadow-float', blocked && 'opacity-55']}
	aria-disabled={blocked}
	title={hint}
	onclick={click}
>
	<Icon name={blocked ? 'alert' : 'send'} size={15} />
	<span class="max-sm:sr-only">Publish</span>
	{#if blocked}<span class="sr-only">({hint})</span>{/if}
</button>

<PublishDialog {open} onclose={() => (open = false)} />
