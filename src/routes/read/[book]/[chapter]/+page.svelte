<script lang="ts">
  import { translationInfo } from '#lib/translations';
  const base = import.meta.env.VITE_BASE_PATH;

  let { data } = $props();
  const label = $derived(data.lang === 'heb' ? 'Hebrew' : 'Greek');
  const rtl = $derived(data.lang === 'heb');

  // Prev/Next links carry the current choices (the cookies cover anything omitted)
  const tail = $derived(
    `?t=${data.translation}${data.translation2 ? `&t2=${data.translation2}` : ''}${data.interlinear ? '&i=1' : ''}`
  );

  // Build a link that changes one choice and keeps the others
  function qs(o: { t?: string; t2?: string | null; i?: boolean } = {}) {
    const p = new URLSearchParams();
    p.set('t', o.t ?? data.translation);
    const t2 = o.t2 === undefined ? data.translation2 : o.t2;
    p.set('t2', t2 ?? 'none');
    if (o.i ?? data.interlinear) p.set('i', '1');
    return '?' + p.toString();
  }

  // Tag Japanese text so the browser picks Japanese glyph shapes
  const langOf = (t: string | null) => (t && t.startsWith('Jap') ? 'ja' : undefined);

  const orderedTranslations = $derived(
    [...data.translations].sort((a, b) => {
      const rankA = translationInfo[a]?.rank ?? Number.MAX_SAFE_INTEGER;
      const rankB = translationInfo[b]?.rank ?? Number.MAX_SAFE_INTEGER;
      return rankA - rankB || a.localeCompare(b);
    })
  );
</script>

<p><a href="{base}/">← All books</a></p>
<h1>{data.name} {data.chapter}</h1>

<nav aria-label="Choose translation" class="translations">
  {#each orderedTranslations as t}
    {#if t === data.translation}
      <strong aria-current="true">
        <span aria-hidden="true">{translationInfo[t]?.flag ?? '🌐'}</span>
        {t}
        <small>{translationInfo[t]?.language ?? 'Language not set'}</small>
      </strong>
    {:else}
      <a href={qs({ t })}>
        <span aria-hidden="true">{translationInfo[t]?.flag ?? '🌐'}</span>
        {t}
        <small>{translationInfo[t]?.language ?? 'Language not set'}</small>
      </a>
    {/if}
  {/each}
</nav>

{#if orderedTranslations.length > 1}
  <nav aria-label="Choose second translation" class="translations">
    <span>Also show:</span>
    {#if !data.translation2}
      <strong aria-current="true">None</strong>
    {:else}
      <a href={qs({ t2: null })}>None</a>
    {/if}
    {#each orderedTranslations as t}
      {#if t !== data.translation}
        {#if t === data.translation2}
          <strong aria-current="true">
            <span aria-hidden="true">{translationInfo[t]?.flag ?? '🌐'}</span>
            {t}
            <small>{translationInfo[t]?.language ?? 'Language not set'}</small>
          </strong>
        {:else}
          <a href={qs({ t2: t })}>
            <span aria-hidden="true">{translationInfo[t]?.flag ?? '🌐'}</span>
            {t}
            <small>{translationInfo[t]?.language ?? 'Language not set'}</small>
          </a>
        {/if}
      {/if}
    {/each}
  </nav>
{/if}

<p>
  {#if data.hasOriginal}
    {#if data.interlinear}
      <a href={qs({ i: false })}>Hide {label}</a>
    {:else}
      <a href={qs({ i: true })}>Show {label}</a>
    {/if}
  {:else if data.interlinear}
    <em>No original-language data for this book.</em>
  {/if}
</p>

{#each data.verses as v (v.verse)}
  <div id="v{v.verse}">
    <p lang={langOf(data.translation)}>
      <sup>{v.verse}</sup>
      {#if v.text}{v.text}{:else}<em>(verse not present in {data.translation})</em>{/if}
    </p>
    {#if data.translation2}
      <p class="second" lang={langOf(data.translation2)}>
        {#if v.text2}{v.text2}{:else}<em>(verse not present in {data.translation2})</em>{/if}
      </p>
    {/if}
    {#if data.interlinear && data.words[v.verse]}
      <div class="il" dir="ltr">
        {#each data.words[v.verse] as w (w.position)}
          <a class="w" href="{base}/lexicon/{w.estrong}">
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
  {#if data.chapter > 1}
    <a href="{base}/read/{data.book}/{data.chapter - 1}{tail}">← Previous</a>
  {/if}
  {#if data.chapter < data.max}
    <a href="{base}/read/{data.book}/{data.chapter + 1}{tail}">Next →</a>
  {/if}
</nav>

<style>
  .second { margin: -0.5rem 0 0.8rem 1.2rem; padding-left: 0.6rem; border-left: 2px solid #8886; }
  .second[lang='ja'] { font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif; }
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
