<script lang="ts">
  let { data } = $props();
</script>

<p><a href="/">← All books</a></p>
<h1>{data.entry.lemma} <small>{data.entry.translit}</small></h1>
<p><strong>{data.entry.gloss}</strong> · {data.entry.pos} · {data.key}</p>

<div class="def">{@html data.definition}</div>
<p><small>{data.entry.source}</small></p>

<h2>Occurrences ({data.total})</h2>
{#if data.total > data.occurrences.length}
  <p><em>Showing the first {data.occurrences.length}.</em></p>
{/if}
<ul>
  {#each data.occurrences as o}
    <li><a href={o.href}>{o.label}</a> — {o.surface} <small>({o.english})</small></li>
  {/each}
</ul>
