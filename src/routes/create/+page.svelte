<script lang="ts">
  import { goto } from "$app/navigation";
  import { open } from "@tauri-apps/plugin-dialog";
  import CSVPreview from "$lib/components/CSVPreview.svelte";
  import { addParticipants, createLottery } from "$lib/db";
  import type { ParsedCSV } from "$lib/csv-parser";
  import { parseCSVFile } from "$lib/csv-parser";
  import { validateLotteryCreate } from "$lib/lottery-create-validation";
  import { generateSeed } from "$lib/random";

  let name = $state("");
  let description = $state("");
  let numDraws = $state(1);
  let withReplacement = $state(false);
  let selectedNameColumn = $state("");
  let parsedCSV = $state<ParsedCSV | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  let rowCount = $derived(parsedCSV?.data.length ?? 0);

  async function handleFileSelect() {
    try {
      isLoading = true;
      error = null;

      const selected = await open({
        title: "Välj CSV-fil",
        multiple: false,
        filters: [
          { name: "CSV", extensions: ["csv", "txt"] },
          { name: "Alla filer", extensions: ["*"] },
        ],
      });

      if (selected === null) {
        return;
      }

      const filePath = Array.isArray(selected) ? selected[0] : selected;
      if (!filePath) {
        return;
      }

      selectedNameColumn = "";
      parsedCSV = await parseCSVFile(filePath);

      if (parsedCSV.errors.length > 0 || parsedCSV.data.length === 0) {
        error =
          parsedCSV.errors.length > 0
            ? "CSV-filen kunde inte läsas helt utan fel. Se detaljer nedan."
            : "CSV-filen innehåller inga datarader.";
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Okänt fel vid filläsning.";
    } finally {
      isLoading = false;
    }
  }

  async function handleCreate() {
    const validation = validateLotteryCreate({
      name,
      numDraws,
      selectedNameColumn,
      parsedCSV,
    });

    if (!validation.ok) {
      error = validation.message;
      return;
    }

    if (!parsedCSV) {
      return;
    }

    try {
      isLoading = true;
      error = null;

      const seed = await generateSeed();
      const desc = description.trim();
      const lotteryId = await createLottery(
        validation.displayName,
        desc === "" ? null : desc,
        numDraws,
        withReplacement,
        selectedNameColumn,
        seed,
      );

      const participants = parsedCSV.data.map((row, index) => ({
        rowIndex: index,
        data: row,
      }));
      await addParticipants(lotteryId, participants);

      await goto(`/draw/${lotteryId}`);
    } catch (e) {
      error = e instanceof Error ? e.message : "Okänt fel vid skapande av lotteri.";
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="mx-auto max-w-4xl space-y-6 px-6 py-10">
  <h1 class="text-3xl font-bold tracking-tight text-neutral-900">Skapa nytt lotteri</h1>

  <div class="space-y-4">
    <div>
      <label class="mb-1 block font-medium text-neutral-800" for="lottery-name">Lotteriets namn *</label>
      <input
        id="lottery-name"
        type="text"
        bind:value={name}
        placeholder="T.ex. Årsmöte 2026 – konstlotteri"
        class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
      />
    </div>

    <div>
      <label class="mb-1 block font-medium text-neutral-800" for="lottery-desc">Beskrivning (valfritt)</label>
      <textarea
        id="lottery-desc"
        bind:value={description}
        placeholder="Ytterligare information om lotteriet…"
        rows="3"
        class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
      ></textarea>
    </div>

    <div>
      <label class="mb-1 block font-medium text-neutral-800" for="num-draws">Antal vinnare att dra *</label>
      <input
        id="num-draws"
        type="number"
        bind:value={numDraws}
        min="1"
        max={rowCount > 0 ? rowCount : undefined}
        class="w-36 rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
      />
      {#if rowCount > 0}
        <p class="mt-1 text-sm text-neutral-600">Högst {rowCount} (antal rader i CSV).</p>
      {/if}
    </div>

    <div>
      <label class="flex items-start gap-2">
        <input
          type="checkbox"
          bind:checked={withReplacement}
          class="mt-1 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-600"
        />
        <span class="font-medium text-neutral-800">
          Tillåt att samma lott kan vinna flera gånger (med återläggning)
        </span>
      </label>
      <p class="mt-1 text-sm text-neutral-600">
        Om avmarkerad kan varje rad bara vinna en gång. Om ikryssad kan samma rad dras flera gånger.
      </p>
    </div>

    <div>
      <span class="mb-2 block font-medium text-neutral-800">CSV-fil med deltagare *</span>
      <button
        type="button"
        onclick={handleFileSelect}
        disabled={isLoading}
        class="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {isLoading ? "Läser in…" : "Välj CSV-fil"}
      </button>
    </div>

    {#if parsedCSV}
      <CSVPreview
        parsedData={parsedCSV}
        bind:selectedNameColumn
        onColumnSelect={(col) => {
          selectedNameColumn = col;
        }}
      />
    {/if}

    {#if error}
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        {error}
      </div>
    {/if}

    <div class="flex flex-wrap gap-4">
      <button
        type="button"
        onclick={handleCreate}
        disabled={isLoading || !parsedCSV || !name.trim() || !selectedNameColumn}
        class="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Starta dragning
      </button>
      <a
        href="/"
        class="rounded-lg bg-neutral-200 px-6 py-3 font-semibold text-neutral-900 hover:bg-neutral-300"
      >
        Avbryt
      </a>
    </div>
  </div>
</div>
