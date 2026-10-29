<script lang="ts">
  let { data } = $props();
</script>

<p><a href="/">← All books</a></p>
<h1>{data.name} {data.chapter}</h1>

{#each data.verses as v (v.verse)}
  <p id="v{v.verse}"><sup>{v.verse}</sup> {v.text}</p>
{/each}

<nav>
  {#if data.chapter > 1}<a href="/read/{data.book}/{data.chapter - 1}">← Previous</a>{/if}
  {#if data.chapter < data.max}<a href="/read/{data.book}/{data.chapter + 1}">Next →</a>{/if}
</nav>
<small>{data.translation}</small>
