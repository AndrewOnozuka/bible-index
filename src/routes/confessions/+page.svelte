<script lang="ts">
  const base = import.meta.env.VITE_BASE_PATH;
  let { data } = $props();
</script>

<svelte:head>
  <title>Confessions and Catechisms | Bible Index</title>
  <meta
    name="description"
    content="Browse the Westminster Confession of Faith and the Larger and Shorter Catechisms."
  />
</svelte:head>

<h1>Confessions and Catechisms</h1>
<p>Browse a document to read its sections, questions, and Scripture references.</p>

<ul>
  {#each data.documents as document}
    <li>
      <h2><a href="{base}/confessions/{document.id}">{document.name}</a></h2>
      <p>{document.description}</p>
      <p>{document.itemCount} entries</p>
    </li>
  {/each}
</ul>
