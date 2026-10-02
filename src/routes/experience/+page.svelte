<script lang="ts">
	import Preview from '#lib/components/Preview.svelte';
	import Workspace from '#lib/components/Workspace.svelte';
</script>

<svelte:head>
	<title>Experience · Room Planner</title>
</svelte:head>

<Workspace>
	{#snippet toolbar()}
		<span class="text-xs text-muted"
			>Drag to orbit · scroll to zoom · pick a shot, tour or walk</span
		>
	{/snippet}
	<div class="absolute inset-0"><Preview /></div>
</Workspace>
