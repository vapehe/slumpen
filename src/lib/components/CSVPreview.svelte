<script lang="ts">
  import type { ParsedCSV } from "$lib/csv-parser";
  import { detectDuplicates } from "$lib/csv-parser";

  interface Props {
    parsedData: ParsedCSV;
    selectedNameColumn: string;
    onColumnSelect: (column: string) => void;
  }

  let {
    parsedData,
    selectedNameColumn = $bindable(""),
    onColumnSelect,
  }: Props = $props();

  let duplicateInfo = $derived(
    selectedNameColumn
      ? detectDuplicates(parsedData.data, selectedNameColumn)
      : null,
  );

  let previewRows = $derived(parsedData.data.slice(0, 10));

  function handleColumnChange(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    selectedNameColumn = value;
    onColumnSelect(value);
  }
</script>

<div class="space-y-4">
  <div class="rounded border border-blue-200 bg-blue-50 p-4">
    <p class="font-semibold">
      Inläst: {parsedData.data.length} rad{parsedData.data.length === 1 ? "" : "er"}
    </p>
    <p class="text-sm text-neutral-600">
      Kolumner: {parsedData.columns.join(", ")}
    </p>
  </div>

  <div>
    <label class="mb-2 block font-medium" for="csv-name-column">
      Vilken kolumn innehåller deltagarens namn?
    </label>
    <select
      id="csv-name-column"
      class="w-full max-w-xs rounded border px-3 py-2"
      value={selectedNameColumn}
      onchange={handleColumnChange}
    >
      <option value="">— Välj kolumn —</option>
      {#each parsedData.columns as col}
        <option value={col}>{col}</option>
      {/each}
    </select>
  </div>

  {#if duplicateInfo && duplicateInfo.duplicates > 0}
    <div class="rounded border border-amber-200 bg-amber-50 p-4">
      <p class="font-semibold">Information om dubbletter</p>
      <p class="mt-1 text-sm">
        {duplicateInfo.total} rader inlästa. {duplicateInfo.unique} unika värden i kolumnen
        <strong>{selectedNameColumn}</strong>
        — {duplicateInfo.duplicates} rad{duplicateInfo.duplicates === 1 ? "" : "er"}
        är dubbletter.
      </p>
      <p class="mt-1 text-sm text-neutral-600">
        Detta är normalt för lotterier där en person kan ha flera lotter. Om det inte är meningen,
        kontrollera CSV-filen.
      </p>
    </div>
  {/if}

  <div class="overflow-x-auto">
    <p class="mb-2 text-sm text-neutral-600">Förhandsgranskning (första 10 raderna):</p>
    <table class="min-w-full border border-neutral-300">
      <thead class="bg-neutral-50">
        <tr>
          {#each parsedData.columns as col}
            <th class="border border-neutral-200 px-4 py-2 text-left text-sm font-semibold">{col}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each previewRows as row}
          <tr class="border-t border-neutral-200">
            {#each parsedData.columns as col}
              <td class="border border-neutral-200 px-4 py-2 text-sm">{row[col] ?? ""}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
    {#if parsedData.data.length > 10}
      {@const remaining = parsedData.data.length - 10}
      <p class="mt-2 text-sm text-neutral-500">
        … och {remaining}
        {remaining === 1 ? " rad till" : " rader till"}
      </p>
    {/if}
  </div>

  {#if parsedData.errors.length > 0}
    <div class="rounded border border-red-200 bg-red-50 p-4">
      <p class="font-semibold text-red-800">Parsningsfel:</p>
      <ul class="mt-1 list-inside list-disc text-sm text-red-700">
        {#each parsedData.errors as error}
          <li>{error}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
