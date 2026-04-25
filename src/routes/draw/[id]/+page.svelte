<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import SlotReel from "$lib/components/SlotReel.svelte";
  import { saveDraws, type Participant } from "$lib/db";
  import { buildReelItems, participantDisplayName, reelForSpin, type ReelItem } from "$lib/draw-reel";
  import { computeLotteryDrawRows, type DrawRow } from "$lib/execute-lottery-draw";
  import { messageFromTauriInvokeError } from "$lib/tauri-error";
  import { isFullscreen as readFullscreen, setFullscreen } from "$lib/fullscreen";
  import { closeAudio, playFanfare, playTick } from "$lib/sounds";
  import confetti from "canvas-confetti";
  import { onDestroy, onMount } from "svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  let slotReel = $state<SlotReel | null>(null);

  let speedMs = $state(8000);
  let soundsEnabled = $state(true);
  let isSpinning = $state(false);
  let actionError = $state<string | null>(null);

  /** Antal vinnare som redan är avslöjade (sparade i DB eller nyss dragna). */
  let revealedCount = $state(0);

  let precomputed = $state<DrawRow[]>([]);
  let computeError = $state<string | null>(null);

  /** Om fönstret är i helskärm (synkas vid mount, hover/fokus och knapptryck). */
  let inFullscreen = $state(false);

  // Snapshots: frysta när snurret startar så att SlotReels items inte ändras
  // mitt i eller i samma tick som animationen slutar (annars byts namnet vid
  // mittmarkören i samma ögonblick som `revealedCount` inkrementeras).
  let reelItems = $state<ReelItem[]>([]);
  let reelWinnerId = $state<number>(0);

  onMount(() => {
    if (!data.ok) return;
    void (async () => {
      try {
        precomputed = await computeLotteryDrawRows(data.lottery, data.participants);
        revealedCount = data.draws.length;
        if (revealedCount < precomputed.length) {
          reelItems = computeReelItems();
          reelWinnerId = precomputed[revealedCount].participantId;
        }
      } catch (e) {
        computeError = messageFromTauriInvokeError(e);
      }
    })();

    void syncFullscreenState();

    const refreshFs = () => void syncFullscreenState();
    window.addEventListener("focus", refreshFs);
    document.addEventListener("visibilitychange", refreshFs);

    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      void readFullscreen().then((fs) => {
        if (!fs) return;
        void leaveFullscreen();
      });
    };
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("focus", refreshFs);
      document.removeEventListener("visibilitychange", refreshFs);
      window.removeEventListener("keydown", onEscape);
    };
  });

  async function syncFullscreenState(): Promise<void> {
    inFullscreen = await readFullscreen();
  }

  async function enterFullscreen(): Promise<void> {
    try {
      await setFullscreen(true);
      inFullscreen = true;
    } catch (e) {
      console.error("enter fullscreen failed", e);
      actionError = "Kunde inte aktivera helskärm.";
    }
  }

  async function leaveFullscreen(): Promise<void> {
    try {
      await setFullscreen(false);
      inFullscreen = false;
    } catch (e) {
      console.error("leave fullscreen failed", e);
      actionError = "Kunde inte lämna helskärm.";
    }
  }

  onDestroy(() => {
    closeAudio();
  });

  function nameForParticipantId(participantId: number, participants: Participant[], nameColumn: string): string {
    const p = participants.find((x) => x.id === participantId);
    return p ? participantDisplayName(p, nameColumn) : "(okänd)";
  }

  /** Returnerar ReelItem[] för nästa snurr. */
  function computeReelItems(): { id: number; name: string }[] {
    if (!data.ok) return [];
    const allItems = buildReelItems(data.participants, data.lottery.name_column);
    const revealedIds = precomputed.slice(0, revealedCount).map((r) => r.participantId);
    return reelForSpin(allItems, revealedIds, data.lottery.with_replacement);
  }

  function handleTick(): void {
    if (!soundsEnabled) return;
    void playTick();
  }

  function fireConfetti(): void {
    try {
      confetti({
        particleCount: 180,
        spread: 90,
        startVelocity: 55,
        origin: { y: 0.5 },
      });
    } catch (e) {
      console.warn("confetti failed", e);
    }
  }

  async function startSpin(): Promise<void> {
    if (!data.ok || isSpinning) return;
    if (revealedCount >= precomputed.length) return;

    const row = precomputed[revealedCount];
    reelItems = computeReelItems();
    reelWinnerId = row.participantId;

    actionError = null;
    isSpinning = true;
    slotReel?.spin();
  }

  async function handleDrawComplete(): Promise<void> {
    if (!data.ok) return;

    const row = precomputed[revealedCount];
    try {
      await saveDraws(data.lotteryId, [row]);
      revealedCount += 1;
      if (soundsEnabled) void playFanfare();
      fireConfetti();

      if (revealedCount >= precomputed.length) {
        await invalidateAll();
      }
    } catch (e) {
      actionError = messageFromTauriInvokeError(e);
    } finally {
      isSpinning = false;
    }
  }

  let isComplete = $derived(data.ok && revealedCount >= data.lottery.num_draws);
  let currentWinnerRow = $derived(
    data.ok && revealedCount < precomputed.length ? precomputed[revealedCount] : null,
  );
  let revealedRows = $derived(precomputed.slice(0, revealedCount));
</script>

{#if data.ok}
  <div
    class="pointer-events-none fixed top-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-end gap-2"
    aria-label="Snabbåtgärder för dragning"
  >
    <div
      class="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white/95 px-2 py-2 shadow-lg backdrop-blur-sm"
    >
      <button
        type="button"
        onclick={() => (soundsEnabled = !soundsEnabled)}
        class="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        aria-pressed={soundsEnabled}
        title={soundsEnabled ? "Stäng av ljud" : "Slå på ljud"}
      >
        {soundsEnabled ? "🔊 Ljud på" : "🔈 Ljud av"}
      </button>
      {#if inFullscreen}
        <button
          type="button"
          onclick={() => leaveFullscreen()}
          class="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
          title="Lämnar helskärm (Esc fungerar också)"
        >
          ✕ Avsluta helskärm
        </button>
      {:else}
        <button
          type="button"
          onclick={() => enterFullscreen()}
          class="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          title="Visa i helskärm"
        >
          ⤢ Helskärm
        </button>
      {/if}
    </div>
  </div>
{/if}

<div class="mx-auto max-w-4xl px-6 py-10">
  <div class="mb-6">
    <h1 class="text-3xl font-bold tracking-tight text-neutral-900">Dragning</h1>
  </div>

  {#if !data.ok}
    {#if data.reason === "bad_id"}
      <p class="mb-4 text-neutral-700">Ogiltigt lotteri-id.</p>
    {:else}
      <p class="mb-4 text-neutral-700">Lotteriet hittades inte.</p>
    {/if}
  {:else}
    <p class="mb-2 text-neutral-700">
      <span class="font-semibold">{data.lottery.name}</span>
      <span class="text-neutral-500">· id {data.lotteryId}</span>
    </p>

    {#if data.lottery.description}
      <p class="mb-4 text-sm text-neutral-600">{data.lottery.description}</p>
    {/if}

    <dl class="mb-6 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
      <div>
        <dt class="text-neutral-500">Antal vinnare</dt>
        <dd class="font-medium">{data.lottery.num_draws}</dd>
      </div>
      <div>
        <dt class="text-neutral-500">Återläggning</dt>
        <dd class="font-medium">{data.lottery.with_replacement ? "Ja" : "Nej"}</dd>
      </div>
      <div class="sm:col-span-2">
        <dt class="text-neutral-500">Namnkolumn (CSV)</dt>
        <dd class="font-mono font-medium">{data.lottery.name_column}</dd>
      </div>
      <div class="sm:col-span-2">
        <dt class="text-neutral-500">Slumpseed (reproducerbar)</dt>
        <dd class="break-all font-mono text-xs">{data.lottery.seed ?? "—"}</dd>
      </div>
    </dl>

    {#if computeError}
      <div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {computeError}
      </div>
    {/if}

    {#if actionError}
      <div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {actionError}
      </div>
    {/if}

    {#if data.participants.length === 0}
      <div class="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Det finns inga deltagare för detta lotteri.
      </div>
    {:else if isComplete}
      <!-- Alla vinnare dragna – statisk resultatvy. -->
      <div class="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Alla {data.lottery.num_draws} vinnare är dragna och sparade.
      </div>
      <div class="mb-6">
        <h2 class="mb-3 text-lg font-semibold text-neutral-900">Resultat</h2>
        <ol class="list-inside list-decimal space-y-2 rounded-lg border border-neutral-200 bg-white px-4 py-3">
          {#each data.draws as draw (draw.id)}
            <li class="font-medium text-neutral-800">
              {nameForParticipantId(draw.participant_id, data.participants, data.lottery.name_column)}
            </li>
          {/each}
        </ol>
        <p class="mt-4">
          <a
            href="/results/{data.lotteryId}"
            class="font-semibold text-emerald-700 underline hover:text-emerald-800"
          >
            Resultat och PDF
          </a>
          <span class="text-sm text-neutral-600"> — visa protokoll och exportera PDF</span>
        </p>
      </div>
    {:else if precomputed.length > 0 && currentWinnerRow}
      <!-- Aktiv dragning med animation -->
      <div class="mb-4 flex items-baseline justify-between">
        <p class="text-sm font-medium text-neutral-700">
          Vinnare <span class="text-lg font-bold text-neutral-900">{revealedCount + 1}</span>
          av <span class="font-semibold">{data.lottery.num_draws}</span>
        </p>
        <p class="text-xs text-neutral-500">
          {computeReelItems().length} möjliga utfall på rullen
        </p>
      </div>

      <SlotReel
        bind:this={slotReel}
        items={reelItems}
        winnerId={reelWinnerId}
        speed={speedMs}
        onTick={handleTick}
        onComplete={handleDrawComplete}
      />

      <div class="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label class="flex items-center gap-3 text-sm text-neutral-700">
          <span class="min-w-40">
            Snurrtid: <span class="font-semibold text-neutral-900">{(speedMs / 1000).toFixed(0)} s</span>
          </span>
          <input
            type="range"
            min="3000"
            max="20000"
            step="500"
            bind:value={speedMs}
            disabled={isSpinning}
            class="flex-1"
          />
        </label>

        <button
          type="button"
          onclick={() => startSpin()}
          disabled={isSpinning}
          class="rounded-xl bg-emerald-700 px-8 py-4 text-lg font-bold text-white shadow-md hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {#if isSpinning}
            Snurrar…
          {:else if revealedCount === 0}
            Starta dragning
          {:else}
            Dra vinnare {revealedCount + 1}
          {/if}
        </button>
      </div>

      {#if revealedRows.length > 0}
        <div class="mt-10">
          <h2 class="mb-3 text-lg font-semibold text-neutral-900">Hittills dragna</h2>
          <ol class="list-inside list-decimal space-y-2 rounded-lg border border-neutral-200 bg-white px-4 py-3">
            {#each revealedRows as row (row.position)}
              <li class="font-medium text-neutral-800">
                {nameForParticipantId(row.participantId, data.participants, data.lottery.name_column)}
              </li>
            {/each}
          </ol>
        </div>
      {/if}
    {/if}

    <p class="mt-8 text-xs text-neutral-500">
      Vinnarna är förutbestämda av seed innan animationen startar – animationen är enbart visuell.
    </p>
  {/if}

  <a href="/" class="mt-6 inline-block font-medium text-emerald-700 underline hover:text-emerald-800">
    Tillbaka till startsidan
  </a>
</div>
