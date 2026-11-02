<script lang="ts">
  const base = import.meta.env.VITE_BASE_PATH;
  let { data } = $props();

  function alphaMarker(number: number) {
    let result = '';
    while (number > 0) {
      number--;
      result = String.fromCharCode(97 + (number % 26)) + result;
      number = Math.floor(number / 26);
    }
    return result;
  }
</script>

<svelte:head>
  <title>{data.title} | Bible Index</title>
</svelte:head>

<p><a href="{base}/confessions">← All confessions and catechisms</a></p>
<h1>{data.title}</h1>

{#each data.items as item, itemIndex}
  {#if data.doc === 'WCF'}
    {@const startsChapter =
      itemIndex === 0 || item.chapter !== data.items[itemIndex - 1].chapter}

    {#if startsChapter}
      <h2 class="chapter-heading">
        {item.title}
      </h2>
    {/if}
  {:else}
    <h2>{data.doc} Q. {item.number}. {item.question}</h2>
  {/if}

  {@const proofSegments = item.segments.filter((segment) => segment.refs.trim())}

  <article id={item.id}>
    {#if data.doc === 'WCF'}
      <p class="answer">
        <strong class="paragraph-number">{item.number}.</strong>
        {#each item.segments as segment}
          {segment.text}
          {@const markerIndex = proofSegments.indexOf(segment)}
          {#if markerIndex !== -1}
            <sup><a href="#proof-{item.id}-{markerIndex + 1}">[{alphaMarker(markerIndex + 1)}]</a></sup>
          {/if}
        {/each}
      </p>
    {:else}
      <p class="answer">
        <strong>A. </strong>
        {#each item.segments as segment}
          {segment.text}
          {@const markerIndex = proofSegments.indexOf(segment)}
          {#if markerIndex !== -1}
            <sup><a href="#proof-{item.id}-{markerIndex + 1}">[{alphaMarker(markerIndex + 1)}]</a></sup>
          {/if}
        {/each}
      </p>
    {/if}

    {#if proofSegments.length}
      <ol class="proofs">
        {#each proofSegments as segment, i}
          <li id="proof-{item.id}-{i + 1}">
            {#each segment.citations as citation, j}
              {#if j > 0}{'; '}{/if}
              {#if citation.href}
                <a href="{base}{citation.href}">{citation.text}</a>
              {:else}
                {citation.text}
              {/if}
            {/each}
          </li>
        {/each}
      </ol>
    {/if}
  </article>
{/each}

<style>
  .chapter-heading {
    margin-top: 2rem;
    border-bottom: 1px solid #aaa;
    padding-bottom: 0.35rem;
  }

  article {
    margin-block: 1rem;
  }

  .answer {
    line-height: 1.65;
  }

  .paragraph-number {
    margin-right: 0.35em;
  }

  .answer sup {
    margin-left: 0.08em;
    font-size: 0.75em;
  }

  .proofs {
    list-style-type: lower-alpha;
    margin-top: 0.35rem;
    font-size: 0.9em;
    line-height: 1.6;
  }
</style>
