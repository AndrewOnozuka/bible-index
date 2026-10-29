<script lang="ts">
  let { data } = $props();
</script>

<p><a href="/">← All books</a></p>
<h1>{data.name} {data.chapter}</h1>

<p>
  {#each data.translations as t}
    {#if t === data.translation}
      <strong>{t}</strong>
    {:else}
      <a href="?t={t}">{t}</a>
    {/if}{' '}
  {/each}
</p>

{#each data.verses as v (v.verse)}
  <p id="v{v.verse}">
    <sup>{v.verse}</sup>
    {#if v.text}{v.text}{:else}<em>(verse not present in {data.translation})</em>{/if}
  </p>
{/each}

<nav>
  {#if data.chapter > 1}<a href="/read/{data.book}/{data.chapter - 1}?t={data.translation}">← Previous</a>{/if}
  {#if data.chapter < data.max}<a href="/read/{data.book}/{data.chapter + 1}?t={data.translation}">Next →</a>{/if}
</nav>
