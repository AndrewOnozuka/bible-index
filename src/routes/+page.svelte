<script lang="ts">
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  let { data } = $props();
</script>

<h1>Bible Index</h1>
{#each data.books as b}
  <details>
    <summary>{b.name}</summary>
    {#each Array(b.chapters) as _, i}
      <a href="{base}/read/{b.osis}/{i + 1}">{i + 1}</a>{' '}
    {/each}
  </details>
{/each}