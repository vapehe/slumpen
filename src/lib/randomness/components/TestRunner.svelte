<script lang="ts">
  let {
    disabled = false,
    onRun,
  }: {
    disabled?: boolean;
    onRun: (args: { source: "synthetic"; numOutcomes: number; sampleSize: number }) => Promise<void>;
  } = $props();

  let numOutcomes = $state(10);
  let sampleSize = $state(10_000);
</script>

<div class="rounded-lg border border-neutral-200 bg-white p-4">
  <p class="mb-3 font-semibold text-neutral-900">Kör test</p>

  <div class="grid gap-4 md:grid-cols-2">
    <div>
      <label class="mb-1 block text-sm font-medium text-neutral-800" for="outcomes">
        Antal möjliga utfall
      </label>
      <input
        id="outcomes"
        type="number"
        min="2"
        bind:value={numOutcomes}
        disabled={disabled}
        class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
      />
    </div>
    <div>
      <label class="mb-1 block text-sm font-medium text-neutral-800" for="samples">
        Sample size
      </label>
      <input
        id="samples"
        type="number"
        min="100"
        step="100"
        bind:value={sampleSize}
        disabled={disabled}
        class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
      />
      <p class="mt-1 text-xs text-neutral-500">Tips: minst {String(numOutcomes * 5)} dragningar.</p>
    </div>
  </div>

  <div class="mt-4 flex gap-3">
    <button
      type="button"
      disabled={disabled}
      onclick={() => void onRun({ source: "synthetic", numOutcomes, sampleSize })}
      class="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      Kör syntetiskt test
    </button>
  </div>
</div>

