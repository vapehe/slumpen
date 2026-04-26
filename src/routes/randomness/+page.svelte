<script lang="ts">
  import { onMount } from "svelte";
  import { generateSeed, simulateSyntheticDraws } from "$lib/random";
  import { runRandomnessTests, type RandomnessReport } from "$lib/randomness/api";
  import { getRecentReports, saveReport, type RandomnessTestRow } from "$lib/randomness/storage";
  import VerdictBanner from "$lib/randomness/components/VerdictBanner.svelte";
  import MetricCards from "$lib/randomness/components/MetricCards.svelte";
  import FrequencyChart from "$lib/randomness/components/FrequencyChart.svelte";
  import TestRunner from "$lib/randomness/components/TestRunner.svelte";
  import TestHistory from "$lib/randomness/components/TestHistory.svelte";
  import { userFacingErrorMessage } from "$lib/tauri-error";

  let report = $state<RandomnessReport | null>(null);
  /** Nyckel så FrequencyChart monteras om vid varje körning (Chart.js + Svelte use:). */
  let chartMountKey = $state(0);
  let history = $state<RandomnessTestRow[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  async function loadHistory(): Promise<void> {
    try {
      history = await getRecentReports(20);
    } catch (e) {
      console.warn("Failed to load randomness history", e);
      history = [];
    }
  }

  onMount(() => {
    void loadHistory();
  });

  async function runSynthetic(args: { numOutcomes: number; sampleSize: number }): Promise<void> {
    loading = true;
    error = null;
    report = null;
    try {
      const seed = await generateSeed();
      const draws = await simulateSyntheticDraws(args.numOutcomes, args.sampleSize, seed);
      const r = await runRandomnessTests(draws, 1, args.numOutcomes);
      report = r;
      chartMountKey += 1;
      await saveReport(r, "synthetic", 1, args.numOutcomes, `seed=${seed}`);
      await loadHistory();
    } catch (e) {
      error = userFacingErrorMessage(e, "Kunde inte köra testet.");
    } finally {
      loading = false;
    }
  }
</script>

<div class="mx-auto max-w-5xl space-y-6 px-6 py-10">
  <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="text-3xl font-bold tracking-tight text-neutral-900">Test av slumpmässighet</h1>
      <p class="mt-1 text-neutral-600">
        Kör statistiska tester (chi², runs, seriekorrelation) på syntetiska dragningar.
      </p>
    </div>
    <a
      href="/"
      class="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 px-4 py-2.5 font-semibold text-neutral-900 hover:bg-neutral-200"
    >
      Tillbaka
    </a>
  </div>

  <TestRunner
    disabled={loading}
    onRun={async ({ numOutcomes, sampleSize }) => runSynthetic({ numOutcomes, sampleSize })}
  />

  {#if error}
    <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">{error}</div>
  {/if}

  {#if report}
    <VerdictBanner overallPassed={report.overall_passed} sampleSize={report.sample_size} />
    <MetricCards {report} />
    {#key chartMountKey}
      <FrequencyChart frequency={report.frequency} minVal={1} />
    {/key}
  {/if}

  <TestHistory rows={history} />
</div>

