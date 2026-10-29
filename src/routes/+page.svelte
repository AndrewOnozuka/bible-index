<script lang="ts">
  let { data } = $props();
</script>

<h1>Bible Index</h1>
{#each data.books as b}
  <details>
    <summary>{b.name}</summary>
    {#each Array(b.chapters) as _, i}
      <a href="/read/{b.osis}/{i + 1}">{i + 1}</a>{' '}
    {/each}
  </details>
{/each}
