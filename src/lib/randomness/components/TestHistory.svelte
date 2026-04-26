<script lang="ts">
  import { formatDateTimeSv } from "$lib/format-swedish-time";
  import type { RandomnessTestRow } from "../storage";

  let { rows }: { rows: RandomnessTestRow[] } = $props();

  const isTrue = (v: number | boolean) => v === true || v === 1;
</script>

<div class="rounded-lg border border-neutral-200 bg-white">
  <div class="border-b border-neutral-200 px-4 py-3">
    <p class="font-semibold text-neutral-900">Historik</p>
  </div>
  {#if rows.length === 0}
    <div class="px-4 py-4 text-sm text-neutral-600">Inga sparade testrapporter ännu.</div>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-neutral-50 text-left text-neutral-700">
          <tr>
            <th class="px-4 py-2">Datum</th>
            <th class="px-4 py-2">Källa</th>
            <th class="px-4 py-2">Sample</th>
            <th class="px-4 py-2">Resultat</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as r (r.id)}
            <tr class="border-t border-neutral-100">
              <td class="px-4 py-2">
                {formatDateTimeSv(r.created_at, { dateStyle: "medium", timeStyle: "short" })}
              </td>
              <td class="px-4 py-2">{r.source === "synthetic" ? "Syntetisk" : "Historik"}</td>
              <td class="px-4 py-2">{r.sample_size.toLocaleString("sv-SE")}</td>
              <td class="px-4 py-2">
                <span class="{isTrue(r.overall_passed) ? 'text-emerald-700' : 'text-red-700'} font-semibold">
                  {isTrue(r.overall_passed) ? "✓" : "✗"}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

