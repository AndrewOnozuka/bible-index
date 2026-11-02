<script lang="ts">
  import { goto } from '$app/navigation';
  const base = import.meta.env.VITE_BASE_PATH;
  let { data } = $props();

  const width = 1000;
  const height = 1000;
  let graphSvg = $state<SVGSVGElement | undefined>(undefined);
  let graphHeight = $state(0);

  $effect(() => {
    if (!graphSvg) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) graphHeight = Math.ceil(entry.contentRect.height);
    });

    observer.observe(graphSvg);
    return () => observer.disconnect();
  });

  const mapStyle = $derived(
    graphHeight ? `--graph-height: ${graphHeight}px` : undefined
  );
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let isDragging = $state(false);
  let dragStart: {
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null = null;
  let didDrag = false;

  type Node = {
    strongs: string;
    label: string;
    lemma: string;
    gloss: string;
    frequency: number;
    size: number;
    labelSize: number;
    x: number;
    y: number;
  };

  function shortLabel(label: string, size: number) {
    const maxCharacters = Math.max(4, Math.floor(size / 2.4));
    return label.length > maxCharacters
      ? `${label.slice(0, maxCharacters - 1)}…`
      : label;
  }

  function layoutGraph(
    inputNodes: Node[],
    edges: { source: string; target: string; score: number }[]
  ): Node[] {
    const count = inputNodes.length;
    if (!count) return [];

    let seed = 918273;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const gaussian = () =>
      random() + random() + random() + random() + random() + random() - 3;

    const nodes = inputNodes.map((node) => ({
      ...node,
      x: width / 2 + gaussian() * 190,
      y: height / 2 + gaussian() * 165
    }));

    const indexByStrong = new Map(nodes.map((node, i) => [node.strongs, i]));
    const degrees = new Array(count).fill(0);
    const usefulEdges = edges.flatMap((edge) => {
      const source = indexByStrong.get(edge.source);
      const target = indexByStrong.get(edge.target);
      if (source === undefined || target === undefined) return [];
      degrees[source]++;
      degrees[target]++;
      return [{ source, target, score: edge.score }];
    });

    const maxFrequency = Math.max(...nodes.map((node) => node.frequency), 1);
    const maxDegree = Math.max(...degrees, 1);
    const idealDistance = Math.sqrt((width * height) / count) * 0.58;
    const iterations = count > 250 ? 90 : 140;

    for (let iteration = 0; iteration < iterations; iteration++) {
      const fx = new Array(count).fill(0);
      const fy = new Array(count).fill(0);
      const cooling = 1 - iteration / iterations;

      // Repel every pair so the graph spreads into the available square.
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          let dx = nodes[i].x - nodes[j].x;
          let dy = nodes[i].y - nodes[j].y;
          let distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 1) {
            dx = 1;
            dy = 0;
            distance = 1;
          }

          const overlap = Math.max(0, nodes[i].size + nodes[j].size + 10 - distance);
          const force =
            0.16 * (idealDistance * idealDistance) / (distance * distance) +
            (overlap * 0.025) / distance;
          fx[i] += dx * force;
          fy[i] += dy * force;
          fx[j] -= dx * force;
          fy[j] -= dy * force;
        }
      }

      // Pull words together according to their verse co-occurrence strength.
      for (const edge of usefulEdges) {
        const source = nodes[edge.source];
        const target = nodes[edge.target];
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const pull = (distance - idealDistance * 0.72) * (0.012 + edge.score * 0.18);
        const xForce = (dx / distance) * pull;
        const yForce = (dy / distance) * pull;

        fx[edge.source] += xForce;
        fy[edge.source] += yForce;
        fx[edge.target] -= xForce;
        fy[edge.target] -= yForce;
      }

      for (let i = 0; i < count; i++) {
        const frequencyWeight =
          Math.log(nodes[i].frequency + 1) / Math.log(maxFrequency + 1);
        const degreeWeight = degrees[i] / maxDegree;
        const centerPull = 0.01 + frequencyWeight * 0.007 + degreeWeight * 0.005;

        fx[i] += (width / 2 - nodes[i].x) * centerPull;
        fy[i] += (height / 2 - nodes[i].y) * centerPull;

        const softMargin = 220;
        const wallForce = 0.11;
        if (nodes[i].x < softMargin) fx[i] += (softMargin - nodes[i].x) * wallForce;
        if (nodes[i].x > width - softMargin) fx[i] -= (nodes[i].x - (width - softMargin)) * wallForce;
        if (nodes[i].y < softMargin) fy[i] += (softMargin - nodes[i].y) * wallForce;
        if (nodes[i].y > height - softMargin) fy[i] -= (nodes[i].y - (height - softMargin)) * wallForce;

        const magnitude = Math.sqrt(fx[i] * fx[i] + fy[i] * fy[i]) || 1;
        const step = Math.min(8 * cooling, magnitude);

        nodes[i].x = Math.max(35, Math.min(width - 35, nodes[i].x + (fx[i] / magnitude) * step));
        nodes[i].y = Math.max(35, Math.min(height - 35, nodes[i].y + (fy[i] / magnitude) * step));
      }
    }

    return nodes.map((node) => ({
      ...node,
      x: width / 2 + (node.x - width / 2) * 0.92,
      y: height / 2 + (node.y - height / 2) * 0.92
    }));
  }

  const positionedNodes = $derived.by(() => layoutGraph(data.nodes, data.edges));
  const nodeByStrong = $derived(
    new Map(positionedNodes.map((node) => [node.strongs, node]))
  );
  const maxFrequency = $derived(
    Math.max(...positionedNodes.map((node) => node.frequency), 1)
  );
  const graphTransform = $derived(
    `translate(${panX + width / 2} ${panY + height / 2}) scale(${zoom}) translate(${-width / 2} ${-height / 2})`
  );

  function changeZoom(nextZoom: number) {
    zoom = Math.max(1, Math.min(3, nextZoom));
    const maxPanX = ((zoom - 1) * width) / 2;
    const maxPanY = ((zoom - 1) * height) / 2;
    panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
    panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
  }

  function startPan(event: PointerEvent) {
    if (event.button !== 0 || zoom <= 1) return;
    const target = event.target;
    if (target instanceof Element && target.closest('a[data-strongs]')) return;
    const svg = event.currentTarget as SVGSVGElement;
    svg.setPointerCapture(event.pointerId);
    dragStart = {
      x: event.clientX,
      y: event.clientY,
      panX,
      panY
    };
    didDrag = false;
    isDragging = true;
  }

  function movePan(event: PointerEvent) {
    if (!dragStart) return;
    const svg = event.currentTarget as SVGSVGElement;
    const bounds = svg.getBoundingClientRect();
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;

    if (Math.abs(dx) + Math.abs(dy) > 3) didDrag = true;
    const maxPanX = Math.max(0, ((zoom - 1) * width) / 2);
    const maxPanY = Math.max(0, ((zoom - 1) * height) / 2);
    panX = Math.max(-maxPanX, Math.min(maxPanX,
      dragStart.panX + dx * (width / bounds.width)));
    panY = Math.max(-maxPanY, Math.min(maxPanY,
      dragStart.panY + dy * (height / bounds.height)));
  }

  function selectNode(event: MouseEvent, node: Node) {
    event.preventDefault();

    if (didDrag) {
      didDrag = false;
      return;
    }

    const params = new URLSearchParams();
    params.set('focus', node.strongs);
    params.set('count', String(data.count));
    if (data.query) params.set('q', data.query);

    void goto(`${base}/map?${params.toString()}`);
  }

  function endPan(event: PointerEvent) {
    const svg = event.currentTarget as SVGSVGElement;
    if (svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }
    dragStart = null;
    isDragging = false;
    if (didDrag) {
      window.setTimeout(() => {
        didDrag = false;
      }, 0);
    }
  }

</script>

<svelte:head>
  <title>Concept Map | Bible Index</title>
  <meta
    name="description"
    content="Explore connections between Hebrew and Greek words, people, and Bible verses."
  />
</svelte:head>

<p><a href="{base}/">← Home</a></p>
<h1>Concept Map</h1>
<p>
  Larger nodes appear in more verses. Connected words pull toward each other;
  stronger links mean they occur together more often relative to their frequency.
</p>

<form method="GET" action="{base}/map">
  <label for="concept-search">Search by English gloss, original word, transliteration, or Strong’s number</label>
  <input
    id="concept-search"
    name="q"
    value={data.query}
    placeholder="e.g. love, agape, H157, G26, Jesus"
  />
  <button type="submit">Search</button>
</form>

{#if data.query}
  <h2>Search results</h2>
  {#if data.results.length}
    <ul class="results">
      {#each data.results as result}
        <li>
          <a href="{base}/map?focus={encodeURIComponent(result.strongs)}&count={data.count}">
            <strong>{result.strongs}</strong>
            · {result.strongs === 'G2424' ? 'Jesus' : (result.gloss || result.lemma)}
          </a>
          <small>{result.frequency} verses</small>
        </li>
      {/each}
    </ul>
  {:else}
    <p>No matching concepts found.</p>
  {/if}
{/if}

  <div class="graph-controls">
    <button type="button" aria-label="Zoom out" onclick={() => changeZoom(zoom - 0.2)}>−</button>
    <button type="button" aria-label="Zoom in" onclick={() => changeZoom(zoom + 0.2)}>+</button>
    <span>{data.nodes.length} concepts shown</span>

    {#if data.count < 400}
      <form method="GET" action="{base}/map" class="count-control">
        <input type="hidden" name="count" value={Math.min(data.count + 50, 400)} />
        {#if data.query}<input type="hidden" name="q" value={data.query} />{/if}
        {#if data.focus}<input type="hidden" name="focus" value={data.focus} />{/if}
        <button type="submit">Add 50 concepts</button>
      </form>
    {/if}

    {#if data.count > 30}
      <form method="GET" action="{base}/map" class="count-control">
        <input type="hidden" name="count" value={Math.max(data.count - 50, 30)} />
        {#if data.query}<input type="hidden" name="q" value={data.query} />{/if}
        {#if data.focus}<input type="hidden" name="focus" value={data.focus} />{/if}
        <button type="submit">Remove 50 concepts</button>
      </form>
    {/if}

    <small>Drag when zoomed in to pan within the square.</small>
  </div>

<div class="map-layout" class:has-focus={!!data.focusConcept} style={mapStyle}>
  <div class="graph-wrap">
  <svg
    bind:this={graphSvg}
    viewBox="0 0 {width} {height}"
    role="img"
    aria-label="Concept co-occurrence graph"
    class:dragging={isDragging}
    onpointerdown={startPan}
    onpointermove={movePan}
    onpointerup={endPan}
    onpointercancel={endPan}
  >
    <g transform={graphTransform}>
      {#each data.edges as edge}
        {@const source = nodeByStrong.get(edge.source)}
        {@const target = nodeByStrong.get(edge.target)}
        {#if source && target}
          <line
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            stroke-width={Math.min(5, 1 + edge.score * 40)}
            class="edge"
          >
            <title>{edge.shared} shared verses</title>
          </line>
        {/if}
      {/each}

      {#each positionedNodes as node}
        <a
          href="{base}/map?focus={encodeURIComponent(node.strongs)}&count={data.count}"
          data-strongs={node.strongs}
          aria-label="Open {node.label}"
          onclick={(event) => selectNode(event, node)}
        >
          <circle
            cx={node.x}
            cy={node.y}
            r={node.size}
            class:focused={data.focus === node.strongs}
            class="concept-node"
          >
            <title>{node.label} · {node.frequency} verses · {node.strongs}</title>
          </circle>
          <text
            x={node.x}
            y={node.y}
            text-anchor="middle"
            dominant-baseline="middle"
            class="node-label"
            font-size={node.labelSize}
            textLength={Math.min(node.label.length * 5.5, node.size * 1.6)}
            lengthAdjust="spacingAndGlyphs"
          >
            {shortLabel(node.label, node.size)}
          </text>
        </a>
      {/each}
    </g>
  </svg>
  </div>

{#if data.focusConcept}
  <section class="detail">
    <h2>
      {data.focusConcept.label}
      <small>{data.focusConcept.strongs} · {data.focusConcept.frequency} verses</small>
    </h2>
    <p>
      Original lemma: {data.focusConcept.lemma} ·
      {data.focusConcept.strongs.startsWith('H') ? 'Hebrew' : 'Greek'}
      {#if data.focusConcept.gloss} · {data.focusConcept.gloss}{/if}
    </p>

    <h3>Verse occurrences</h3>
    {#each data.occurrences as occurrence}
      <article class="verse-card">
        <h4>
          <a href="{base}/read/{occurrence.book}/{occurrence.chapter}?t=ESV#v{occurrence.verse}">
            {occurrence.book} {occurrence.chapter}:{occurrence.verse}
          </a>
        </h4>
        <p>
          <strong>Original:</strong>
          {occurrence.surface}
          {#if occurrence.translit}({occurrence.translit}){/if}
          {#if occurrence.english} — {occurrence.english}{/if}
        </p>
        {#if occurrence.morph}
          <p><small>Morphology: {occurrence.morph}</small></p>
        {/if}
        {#each ['ESV', 'KJV', 'JapSKY2017'] as translation}
          {#if occurrence.texts[translation]}
            <p><strong>{translation}:</strong> {occurrence.texts[translation]}</p>
          {/if}
        {/each}
      </article>
    {/each}
  </section>
{/if}
</div>

<p><a href="{base}/confessions">Confessions and Catechisms</a></p>

<style>
  form {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }

  form label {
    flex-basis: 100%;
  }

  input {
    min-width: min(24rem, 70vw);
    padding: 0.5rem;
  }

  .results li {
    margin-block: 0.5rem;
  }

  .results small {
    margin-left: 0.6rem;
    opacity: 0.7;
  }

  .map-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }

  .map-layout.has-focus {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 0.62fr);
    align-items: stretch;
  }

  .graph-wrap {
    width: 100%;
    min-width: 0;
    margin: 0;
    overflow: hidden;
  }

  .graph-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.5rem;
  }

  .graph-controls button {
    min-width: 2.2rem;
    min-height: 2rem;
    font-size: 1.1rem;
  }

  svg {
    display: block;
    width: 100%;
    min-width: 600px;
    aspect-ratio: 1;
    background: #111827;
    border-radius: 1rem;
    cursor: grab;
    touch-action: none;
  }

  svg.dragging {
    cursor: grabbing;
  }

  .edge {
    stroke: #94a3b8;
    opacity: 0.4;
  }

  .concept-node {
    fill: #7c3aed;
    stroke: #ddd6fe;
    stroke-width: 1.5;
  }

  .concept-node:hover,
  .concept-node.focused {
    fill: #f59e0b;
    stroke: white;
    stroke-width: 3;
  }

  .node-label {
    fill: white;
    font-family: system-ui, sans-serif;
    font-weight: 700;
    pointer-events: none;
  }

  .detail {
    align-self: stretch;
    box-sizing: border-box;
    height: var(--graph-height, auto);
    min-height: 0;
    max-height: var(--graph-height, 100vh);
    overflow: auto;
    border: 1px solid #64748b;
    border-radius: 0.75rem;
    padding: 0.8rem;
  }

  @media (max-width: 900px) {
    .map-layout.has-focus {
      grid-template-columns: minmax(0, 1fr);
    }

    .detail {
      height: auto;
      max-height: none;
      overflow: visible;
    }
  }

  .detail h2 small {
    display: block;
    font-size: 0.55em;
    font-weight: normal;
    opacity: 0.75;
  }

  .verse-card {
    border-top: 1px solid #aaa;
    padding-block: 0.5rem;
  }

  /* Keep map and details side by side on desktop */
  @media (min-width: 701px) {
    .map-layout.has-focus {
      grid-template-columns: minmax(0, 1.5fr) minmax(250px, 0.85fr);
      align-items: stretch;
    }

    .graph-wrap,
    .detail {
      min-width: 0;
    }

    .graph-wrap svg {
      min-width: 0;
    }
  }

  @media (max-width: 700px) {
    .map-layout.has-focus {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
