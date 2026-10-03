<script lang="ts">
	import DesignView from '#lib/components/DesignView.svelte';

	let { data } = $props();
</script>

<!-- A fresh view per design, so its state (likes, dialogs) never leaks into the next one -->
{#key data.design.id}
	<DesignView initial={data.design} />
{/key}
