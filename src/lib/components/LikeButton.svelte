<script lang="ts">
	import { setLike } from '#lib/social/api.ts';
	import type { DesignData } from '#lib/social/types.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import Icon from './ui/Icon.svelte';

	/**
	 * Like toggle with count. Optimistic: flips at once and rolls back with a toast on error.
	 * Your own designs can't be liked, so they show a "Yours" badge with the count instead.
	 */
	let { design = $bindable() }: { design: DesignData } = $props();

	let busy = false;

	async function toggle() {
		if (busy) return;
		busy = true;
		const liked = !design.likedByMe;
		design.likedByMe = liked;
		design.likeCount += liked ? 1 : -1;
		try {
			design.likeCount = (await setLike(design.id, liked)).likeCount;
		} catch (e) {
			design.likedByMe = !liked;
			design.likeCount += liked ? -1 : 1;
			toast.show((e as Error).message);
		} finally {
			busy = false;
		}
	}
</script>

{#if design.mine}
	<span
		class="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-[13px] font-semibold text-muted"
		title="{design.likeCount} like{design.likeCount === 1 ? '' : 's'}"
	>
		Yours <span class="h-3 w-px bg-line-strong"></span>
		<Icon name="heart" size={14} />{design.likeCount}
	</span>
{:else}
	<button
		class={[
			'relative inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors',
			design.likedByMe ? 'bg-warn-soft text-warn' : 'bg-paper text-ink hover:bg-line'
		]}
		aria-pressed={design.likedByMe}
		aria-label={design.likedByMe ? 'Unlike' : 'Like'}
		title={design.likedByMe ? 'Unlike' : 'Like'}
		onclick={toggle}
	>
		<Icon name="heart" size={15} filled={design.likedByMe} />
		{design.likeCount}
	</button>
{/if}
