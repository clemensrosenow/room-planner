<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { selectItem } from '#lib/url.ts';
	import PublishDialog from './PublishDialog.svelte';
	import Icon from './ui/Icon.svelte';

	/** Opens the publish dialog; while the Draft has Conflicts, it points to the first one. */
	let open = $state(false);

	const count = $derived(planner.conflicts.length);
	const hint = $derived(
		count ? `Resolve ${count} conflict${count === 1 ? '' : 's'} first` : 'Publish and share'
	);

	function click() {
		if (!count) {
			open = true;
			return;
		}
		const id = planner.conflicts[0];
		if (page.url.pathname === '/furnish') selectItem(id);
		else goto(`/furnish?item=${id}`);
	}
</script>

<button
	class={['btn btn-primary shadow-float', count && 'opacity-55']}
	aria-disabled={count > 0}
	title={hint}
	onclick={click}
>
	<Icon name={count ? 'alert' : 'send'} size={15} />
	<span class="max-sm:sr-only">Publish</span>
	{#if count}<span class="sr-only">({hint})</span>{/if}
</button>

<PublishDialog {open} onclose={() => (open = false)} />
