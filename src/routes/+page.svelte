<script lang="ts">
  import { onMount } from "svelte";
  import { ask } from "@tauri-apps/plugin-dialog";
  import { deleteLottery, getAllLotteries, type Lottery } from "$lib/db";
  import { formatDateSv } from "$lib/format-swedish-time";

  let lotteries = $state<Lottery[]>([]);
  let isLoading = $state(true);
  let loadError = $state<string | null>(null);
  let deletingId = $state<number | null>(null);

  async function loadLotteries(): Promise<void> {
    isLoading = true;
    loadError = null;
    try {
      lotteries = await getAllLotteries();
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Kunde inte läsa lotterier.";
      lotteries = [];
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    void loadLotteries();
  });

  async function confirmAndDelete(lottery: Lottery): Promise<void> {
    if (deletingId != null) return;

    const confirmed = await ask(
      `Vill du ta bort "${lottery.name}"?\n\nDetta raderar lotteriet samt all tillhörande data (deltagare och dragningar). Åtgärden kan inte ångras.`,
      { title: "Ta bort lotteri", kind: "warning" },
    );
    if (!confirmed) return;

    deletingId = lottery.id;
    loadError = null;
    try {
      await deleteLottery(lottery.id);
      await loadLotteries();
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Kunde inte ta bort lotteriet.";
    } finally {
      deletingId = null;
    }
  }
</script>

<div class="mx-auto max-w-5xl px-6 py-10">
  <div class="mb-10 flex flex-wrap justify-end gap-3">
    <a
      href="/randomness"
      class="inline-flex justify-center rounded-lg border border-neutral-300 bg-white px-4 py-3 font-semibold text-neutral-800 hover:bg-neutral-50"
    >
      Testa slumpmässighet
    </a>
    <a
      href="/create"
      class="inline-flex justify-center rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700"
    >
      Skapa nytt lotteri
    </a>
  </div>

  {#if isLoading}
    <p class="text-neutral-600">Laddar…</p>
  {:else if loadError}
    <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-900">
      <p class="mb-3 font-medium">{loadError}</p>
      <button
        type="button"
        class="rounded-lg bg-red-800 px-4 py-2 font-semibold text-white hover:bg-red-900"
        onclick={() => void loadLotteries()}
      >
        Försök igen
      </button>
    </div>
  {:else if lotteries.length === 0}
    <div class="rounded-lg border border-neutral-200 bg-neutral-50 p-10 text-center">
      <p class="mb-2 text-xl text-neutral-700">Inga lotterier ännu</p>
      <p class="mb-8 text-neutral-500">
        Kom igång genom att skapa ditt första lotteri och ladda upp en CSV med deltagare.
      </p>
      <a
        href="/create"
        class="inline-flex rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700"
      >
        Skapa lotteri
      </a>
    </div>
  {:else}
    <h2 class="mb-4 text-2xl font-semibold text-neutral-900">Tidigare lotterier</h2>
    <ul class="space-y-4">
      {#each lotteries as lottery (lottery.id)}
        <li>
          <div class="rounded-lg border border-neutral-200 bg-white p-5 transition-shadow hover:shadow-md">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <a href="/results/{lottery.id}" class="block min-w-0 flex-1">
                <h3 class="mb-1 text-xl font-semibold text-neutral-900">{lottery.name}</h3>
                {#if lottery.description}
                  <p class="mb-2 text-sm text-neutral-600">{lottery.description}</p>
                {/if}
                <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-500">
                  <span>
                    Skapat {formatDateSv(lottery.created_at)}
                  </span>
                  <span>
                    {lottery.num_draws === 1 ? "1 vinnare" : `${lottery.num_draws} vinnare`}
                  </span>
                  <span>{lottery.with_replacement ? "Med återläggning" : "Utan återläggning"}</span>
                </div>
              </a>

              <div class="shrink-0">
                <button
                  type="button"
                  class="inline-flex justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-semibold text-red-900 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={deletingId === lottery.id}
                  aria-label={`Ta bort lotteri: ${lottery.name}`}
                  onclick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void confirmAndDelete(lottery);
                  }}
                >
                  {deletingId === lottery.id ? "Tar bort…" : "Ta bort"}
                </button>
              </div>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>
