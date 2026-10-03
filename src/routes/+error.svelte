<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Not found' : 'Error'} · Room Planner</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="grid h-full place-items-center px-4">
	<div
		class="grid max-w-sm justify-items-center gap-3 rounded-3xl bg-sheet px-8 py-10 text-center shadow-float ring-1 ring-line/70"
	>
		{#if page.status === 404}
			<h1 class="text-[20px] font-bold tracking-tight">This design doesn't exist</h1>
			<p class="text-muted">It may have been deleted, or the link is incomplete.</p>
		{:else}
			<h1 class="text-[20px] font-bold tracking-tight">Something went wrong</h1>
			<p class="text-muted">{page.error?.message ?? 'Please try again in a moment.'}</p>
		{/if}
		<a href="/designs" class="btn btn-primary mt-2">Browse designs</a>
	</div>
</div>
