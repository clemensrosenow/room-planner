<script lang="ts" generics="T extends string">
	interface Props {
		label: string;
		value: T;
		options: { value: T; label: string }[];
		onchange: (value: T) => void;
	}
	let { label, value, options, onchange }: Props = $props();
</script>

<label class="grid min-w-0 gap-[3px]">
	<span class="text-xs text-muted">{label}</span>
	<select class="input" {value} onchange={(e) => onchange(e.currentTarget.value as T)}>
		{#each options as o (o.value)}
			<option value={o.value}>{o.label}</option>
		{/each}
	</select>
</label>
