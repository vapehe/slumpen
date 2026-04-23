<script lang="ts">
  import type { ReelItem } from "$lib/draw-reel";
  import { onDestroy } from "svelte";

  interface Props {
    items: ReelItem[];
    winnerId: number;
    /** Total spinntid i millisekunder. */
    speed: number;
    onComplete?: () => void;
    onTick?: () => void;
  }

  let { items, winnerId, speed, onComplete, onTick }: Props = $props();

  const ITEM_HEIGHT = 80;
  const VIEWPORT_ITEMS = 5;
  const CENTER_IDX = Math.floor(VIEWPORT_ITEMS / 2);
  const REPETITIONS = 10;

  let reelEl: HTMLDivElement | undefined = $state();
  let spinning = $state(false);
  let revealed = $state(false);
  let rafId = 0;

  const extendedItems = $derived(
    Array.from({ length: REPETITIONS }, () => items).flat(),
  );

  const viewportHeight = VIEWPORT_ITEMS * ITEM_HEIGHT;

  // Monoton ease-out: hög fart i början och en lång, jämn inbromsning utan
  // "omtag" i mitten. Hög potens ger en tydlig slutfas där vinnaren glider
  // långsamt in i mittmarkören.
  function easeReel(t: number): number {
    const DECELERATION_POWER = 6;
    return 1 - Math.pow(1 - t, DECELERATION_POWER);
  }

  export function spin(): void {
    if (spinning || !reelEl || items.length === 0) return;
    const winnerIndex = items.findIndex((i) => i.id === winnerId);
    if (winnerIndex < 0) {
      console.error("SlotReel: winnerId not present in items", { winnerId });
      return;
    }

    revealed = false;
    spinning = true;

    const finalLogicalIndex = (REPETITIONS - 2) * items.length + winnerIndex;
    const finalOffset = -(finalLogicalIndex - CENTER_IDX) * ITEM_HEIGHT;

    reelEl.style.transition = "none";
    reelEl.style.transform = "translateY(0px)";

    const startTime = performance.now();
    const total = speed;
    let lastTickIdx = -1;

    const step = (now: number) => {
      if (!spinning || !reelEl) return;
      const t = Math.min((now - startTime) / total, 1);
      const progress = easeReel(t);
      // Snappa till heltalspixlar varje frame – CSS-transition över samma
      // sträcka lämnar GPU:n i subpixelläge där vinnarraden ser ut att
      // stanna en bra stund innan ett plötsligt hopp vid snapp till målet.
      const offset = Math.round(progress * finalOffset);
      reelEl.style.transform = `translateY(${offset}px)`;

      const idx = Math.floor(-offset / ITEM_HEIGHT);
      if (idx !== lastTickIdx) {
        lastTickIdx = idx;
        onTick?.();
      }

      if (t < 1) {
        rafId = requestAnimationFrame(step);
        return;
      }
      spinning = false;
      revealed = true;
      onComplete?.();
    };
    rafId = requestAnimationFrame(step);
  }

  export function reset(): void {
    spinning = false;
    revealed = false;
    cancelAnimationFrame(rafId);
    if (reelEl) {
      reelEl.style.transition = "none";
      reelEl.style.transform = "translateY(0px)";
    }
  }

  onDestroy(() => {
    cancelAnimationFrame(rafId);
  });
</script>

<div
  class="reel-container relative overflow-hidden rounded-2xl border-4 border-neutral-800 bg-linear-to-b from-neutral-900 via-neutral-950 to-neutral-900 shadow-xl"
  style="height: {viewportHeight}px;"
>
  <!-- Övre blur-mask -->
  <div
    class="pointer-events-none absolute inset-x-0 top-0 z-20 bg-linear-to-b from-neutral-950 to-transparent"
    style="height: {CENTER_IDX * ITEM_HEIGHT}px;"
  ></div>
  <!-- Nedre blur-mask -->
  <div
    class="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-linear-to-t from-neutral-950 to-transparent"
    style="height: {CENTER_IDX * ITEM_HEIGHT}px;"
  ></div>

  <!-- Mittmarkör -->
  <div
    class="pointer-events-none absolute inset-x-0 z-30 border-t-4 border-b-4 border-amber-400/80 transition-colors duration-300"
    class:bg-amber-300={revealed}
    style="top: {CENTER_IDX * ITEM_HEIGHT}px; height: {ITEM_HEIGHT}px; background-color: {revealed ? 'rgba(252,211,77,0.25)' : 'rgba(251,191,36,0.06)'};"
  ></div>

  <!-- Rulle -->
  <div
    bind:this={reelEl}
    class="reel flex flex-col"
    style="transform: translateY(0px);"
  >
    {#each extendedItems as item, i (i)}
      <div
        class="flex items-center justify-center text-center text-3xl font-semibold text-white/90"
        style="height: {ITEM_HEIGHT}px;"
      >
        {item.name}
      </div>
    {/each}
  </div>
</div>

<style>
  .reel {
    will-change: transform;
  }
</style>
