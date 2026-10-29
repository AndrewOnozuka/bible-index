<script lang="ts">
  let { data } = $props();
  const tail = $derived(`?t=${data.translation}${data.interlinear ? '&i=1' : ''}`);
  const label = $derived(data.lang === 'heb' ? 'Hebrew' : 'Greek');
  const rtl = $derived(data.lang === 'heb');
</script>

<p><a href="/">← All books</a></p>
<h1>{data.name} {data.chapter}</h1>

<p>
  {#each data.translations as t}
    {#if t === data.translation}
      <strong>{t}</strong>
    {:else}
      <a href="?t={t}{data.interlinear ? '&i=1' : ''}">{t}</a>
    {/if}{' '}
  {/each}
</p>

<p>
  {#if data.hasOriginal}
    {#if data.interlinear}
      <a href="?t={data.translation}">Hide {label}</a>
    {:else}
      <a href="?t={data.translation}&i=1">Show {label}</a>
    {/if}
  {:else if data.interlinear}
    <em>No original-language data for this book.</em>
  {/if}
</p>

{#each data.verses as v (v.verse)}
  <div id="v{v.verse}">
    <p>
      <sup>{v.verse}</sup>
      {#if v.text}{v.text}{:else}<em>(verse not present in {data.translation})</em>{/if}
    </p>
    {#if data.interlinear && data.words[v.verse]}
      <div class="il" dir={rtl ? 'rtl' : 'ltr'}>
        {#each data.words[v.verse] as w (w.position)}
          <a class="w" href="/lexicon/{w.estrong}">
            <span class="gr" class:heb={rtl}>{w.surface}</span>
            <span class="tr" dir="ltr">{w.translit}</span>
            <span class="en" dir="ltr">{w.english}</span>
            <span class="tip" dir="ltr">
              <b>{w.lemma ?? w.surface}</b> {w.translit}<br />
              {w.gloss ?? ''}<br />
              <small>{w.estrong} · {w.morph}</small>
            </span>
          </a>
        {/each}
      </div>
    {/if}
  </div>
{/each}

<nav>
  {#if data.chapter > 1}<a href="/read/{data.book}/{data.chapter - 1}{tail}">← Previous</a>{/if}
  {#if data.chapter < data.max}<a href="/read/{data.book}/{data.chapter + 1}{tail}">Next →</a>{/if}
</nav>

<style>
  .il { display: flex; flex-wrap: wrap; gap: 0.6rem 1rem; margin: 0.25rem 0 1rem 1.2rem; }
  .w { position: relative; display: flex; flex-direction: column; text-align: center; text-decoration: none; color: inherit; }
  .gr { font-size: 1.15em; }
  .gr.heb { font-size: 1.5em; }
  .tr { font-size: 0.75em; opacity: 0.7; }
  .en { font-size: 0.8em; }
  .tip {
    display: none; position: absolute; top: 100%; left: 0; z-index: 5; min-width: 10rem;
    background: #222; color: #fff; padding: 0.4rem 0.6rem; border-radius: 6px; text-align: left; font-size: 0.85em;
  }
  .w:hover .tip { display: block; }
</style>
