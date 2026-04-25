<script lang="ts">
  import type { RandomnessReport } from "../api";

  let { report }: { report: RandomnessReport } = $props();

  const fmtP = (p: number) => (Number.isFinite(p) ? p.toFixed(4) : "—");
  const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : "—");
</script>

<div class="grid gap-4 md:grid-cols-3">
  <div class="rounded-lg border border-neutral-200 bg-white p-4">
    <p class="text-sm font-semibold text-neutral-800">Chi²</p>
    <p class="mt-2 text-2xl font-bold text-neutral-900">{fmt(report.chi_square_stat)}</p>
    <p class="mt-1 text-sm text-neutral-600">p = {fmtP(report.chi_square_p)}</p>
    <p class="mt-1 text-sm font-medium {report.chi_square_passed ? 'text-emerald-700' : 'text-red-700'}">
      {report.chi_square_passed ? "Godkänt" : "Underkänt"}
    </p>
  </div>

  <div class="rounded-lg border border-neutral-200 bg-white p-4">
    <p class="text-sm font-semibold text-neutral-800">Runs (z)</p>
    <p class="mt-2 text-2xl font-bold text-neutral-900">{fmt(report.runs_stat)}</p>
    <p class="mt-1 text-sm text-neutral-600">p = {fmtP(report.runs_p)}</p>
    <p class="mt-1 text-sm font-medium {report.runs_passed ? 'text-emerald-700' : 'text-red-700'}">
      {report.runs_passed ? "Godkänt" : "Underkänt"}
    </p>
  </div>

  <div class="rounded-lg border border-neutral-200 bg-white p-4">
    <p class="text-sm font-semibold text-neutral-800">Seriekorrelation</p>
    <p class="mt-2 text-2xl font-bold text-neutral-900">{fmt(report.serial_correlation)}</p>
    <p class="mt-1 text-sm text-neutral-600">|corr| &lt; 0.05</p>
  </div>
</div>

