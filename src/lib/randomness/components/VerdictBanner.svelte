<script lang="ts">
  let { overallPassed, sampleSize }: { overallPassed: boolean; sampleSize: number } = $props();
</script>

<div
  class="rounded-lg border p-4 {overallPassed
    ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
    : 'border-amber-200 bg-amber-50 text-amber-950'}"
>
  <p class="text-lg font-semibold">
    {overallPassed ? "Godkänt" : "Varning"}
  </p>
  <p class="text-sm opacity-90">Sample size: {sampleSize.toLocaleString("sv-SE")}.</p>
</div>

