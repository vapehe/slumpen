<script lang="ts">
  import { ask, save } from "@tauri-apps/plugin-dialog";
  import { writeFile } from "@tauri-apps/plugin-fs";
  import { goto } from "$app/navigation";
  import { participantDisplayName } from "$lib/draw-reel";
  import { deleteLottery, type Draw, type Participant } from "$lib/db";
  import { generateLotteryProtocol } from "$lib/pdf-generator";
  import { messageFromTauriInvokeError } from "$lib/tauri-error";
  import { formatDateTimeSv } from "$lib/format-swedish-time";
  import { verifyLotteryDraw, type VerificationResult } from "$lib/verify-lottery-draw";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  let isExporting = $state(false);
  let exportError = $state<string | null>(null);
  let exportSuccess = $state(false);
  let isDeleting = $state(false);
  let deleteError = $state<string | null>(null);
  let isVerifying = $state(false);
  let verification = $state<VerificationResult | null>(null);
  let verifyError = $state<string | null>(null);

  let winnersList = $derived(
    !data.ok
      ? []
      : data.draws.map((draw: Draw) => {
          const participant = data.participants.find((p: Participant) => p.id === draw.participant_id);
          const name =
            participant != null
              ? participantDisplayName(participant, data.lottery.name_column)
              : "(okänd deltagare)";
          return {
            position: draw.position,
            name,
            drawnAt: draw.drawn_at,
          };
        }),
  );

  async function handleExportPDF(): Promise<void> {
    if (!data.ok || data.draws.length === 0) return;

    try {
      isExporting = true;
      exportError = null;
      exportSuccess = false;

      const pdfBlob = await generateLotteryProtocol(data.lottery, data.draws, data.participants);
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const safeName = data.lottery.name.replace(/[^a-z0-9åäöÅÄÖ]/gi, "_").replace(/_+/g, "_");
      const defaultPath = `${safeName || "protokoll"}.pdf`;

      const filePath = await save({
        defaultPath,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });

      if (filePath == null) {
        return;
      }

      await writeFile(filePath, uint8Array);
      exportSuccess = true;
    } catch (e) {
      exportError = e instanceof Error ? e.message : "Kunde inte spara PDF.";
    } finally {
      isExporting = false;
    }
  }

  async function handleDeleteLottery(): Promise<void> {
    if (!data.ok || isDeleting) return;

    const confirmed = await ask(
      `Vill du ta bort "${data.lottery.name}"?\n\nDetta raderar lotteriet samt all tillhörande data (deltagare och dragningar). Åtgärden kan inte ångras.`,
      { title: "Ta bort lotteri", kind: "warning" },
    );
    if (!confirmed) return;

    isDeleting = true;
    deleteError = null;
    try {
      await deleteLottery(data.lotteryId);
      await goto("/");
    } catch (e) {
      deleteError = e instanceof Error ? e.message : "Kunde inte ta bort lotteriet.";
    } finally {
      isDeleting = false;
    }
  }

  async function handleVerifyDraw(): Promise<void> {
    if (!data.ok || isVerifying) return;

    isVerifying = true;
    verifyError = null;
    verification = null;
    try {
      verification = await verifyLotteryDraw(data.lottery, data.participants, data.draws);
    } catch (e) {
      console.error("verify draw failed", e);
      verifyError = messageFromTauriInvokeError(e);
    } finally {
      isVerifying = false;
    }
  }

  function actualIdLabel(actualId: number): string {
    if (actualId === -1) return "saknas";
    return String(actualId);
  }
</script>

<div class="mx-auto max-w-4xl px-6 py-10">
  <div class="mb-6">
    <h1 class="text-3xl font-bold tracking-tight text-neutral-900">Resultat</h1>
  </div>

  {#if !data.ok}
    {#if data.reason === "bad_id"}
      <p class="mb-4 text-neutral-700">Ogiltigt lotteri-id.</p>
    {:else}
      <p class="mb-4 text-neutral-700">Lotteriet hittades inte.</p>
    {/if}
    <a href="/" class="font-medium text-emerald-700 underline hover:text-emerald-800">Tillbaka till startsidan</a>
  {:else}
    <p class="mb-2 text-neutral-700">
      <span class="font-semibold">{data.lottery.name}</span>
      <span class="text-neutral-500">· id {data.lotteryId}</span>
    </p>

    {#if data.lottery.description}
      <p class="mb-4 text-sm text-neutral-600">{data.lottery.description}</p>
    {/if}

    <div class="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <p class="font-semibold">Lotteriet är genomfört i databasen.</p>
      <p class="mt-1 text-neutral-700">
        Skapat: {formatDateTimeSv(data.lottery.created_at)}
      </p>
    </div>

    {#if exportError}
      <div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {exportError}
      </div>
    {/if}

    {#if deleteError}
      <div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {deleteError}
      </div>
    {/if}

    {#if exportSuccess}
      <div
        class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        role="status"
        aria-live="polite"
      >
        PDF-protokoll har sparats.
      </div>
    {/if}

    <h2 class="mb-3 text-lg font-semibold text-neutral-900">Vinnare</h2>

    {#if winnersList.length === 0}
      <div class="mb-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Inga dragningar är sparade för detta lotteri ännu.
      </div>
    {:else}
      <ol class="mb-8 list-inside list-decimal space-y-3 rounded-lg border border-neutral-200 bg-white px-4 py-4">
        {#each winnersList as winner (winner.position)}
          <li class="font-medium text-neutral-800">
            <span class="mr-2">{winner.name}</span>
            <span class="block text-xs font-normal text-neutral-500 sm:inline sm:text-sm">
              Dragen {formatDateTimeSv(winner.drawnAt)}
            </span>
          </li>
        {/each}
      </ol>
    {/if}

    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <button
        type="button"
        onclick={() => handleExportPDF()}
        disabled={isExporting || data.draws.length === 0}
        class="rounded-lg bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {#if isExporting}
          Sparar PDF…
        {:else}
          Exportera PDF-protokoll
        {/if}
      </button>

      <a
        href="/draw/{data.lotteryId}"
        class="inline-flex justify-center rounded-lg border border-neutral-300 bg-white px-6 py-3 font-semibold text-neutral-800 hover:bg-neutral-50"
      >
        Till dragningssidan
      </a>

      <a
        href="/"
        class="inline-flex justify-center rounded-lg bg-neutral-100 px-6 py-3 font-semibold text-neutral-800 hover:bg-neutral-200"
      >
        Till startsidan
      </a>

      <button
        type="button"
        onclick={() => void handleDeleteLottery()}
        disabled={isDeleting}
        class="inline-flex justify-center rounded-lg border border-red-200 bg-red-50 px-6 py-3 font-semibold text-red-900 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDeleting ? "Tar bort…" : "Ta bort lotteri"}
      </button>
    </div>

    <div class="mt-10 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-800">
      <p class="mb-2 font-semibold text-neutral-900">Information för revision</p>
      <p><span class="text-neutral-600">Antal deltagare:</span> {data.participants.length}</p>
      <p>
        <span class="text-neutral-600">Återläggning:</span>
        {data.lottery.with_replacement ? "Ja" : "Nej"}
      </p>
      <p class="mt-2 break-all">
        <span class="text-neutral-600">Seed:</span>
        <span class="font-mono text-xs">{data.lottery.seed ?? "—"}</span>
      </p>
      <p class="mt-3 text-xs text-neutral-600">
        Klicka på <span class="font-semibold text-neutral-800">Verifiera dragning</span> för att köra om dragningen med
        samma seed och deltagare och bekräfta att utfallet är identiskt med det som sparats i databasen.
      </p>

      <div class="mt-4">
        <button
          type="button"
          onclick={() => void handleVerifyDraw()}
          disabled={isVerifying || data.draws.length === 0 || data.lottery.seed == null || data.lottery.seed === ""}
          class="rounded-lg border border-neutral-300 bg-white px-4 py-2 font-semibold text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isVerifying ? "Verifierar…" : "Verifiera dragning"}
        </button>
      </div>

      {#if verifyError}
        <div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {verifyError}
        </div>
      {/if}

      {#if verification != null}
        {#if verification.ok}
          <div
            class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
            role="status"
            aria-live="polite"
          >
            <p class="font-semibold">Verifiering lyckades</p>
            <p class="mt-1">
              Dragningen reproducerades med samma seed och deltagare. Alla {verification.expected.length} vinnare
              stämmer med det sparade resultatet.
            </p>
          </div>
        {:else if "reason" in verification}
          <div
            class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
            aria-live="polite"
          >
            {#if verification.reason === "no_seed"}
              <p class="font-semibold">Kan inte verifiera</p>
              <p class="mt-1">Lotteriet saknar seed och kan inte verifieras.</p>
            {:else if verification.reason === "no_draws"}
              <p class="font-semibold">Kan inte verifiera</p>
              <p class="mt-1">Inga sparade dragningar att jämföra mot.</p>
            {:else}
              <p class="font-semibold">Antal dragningar stämmer inte</p>
              <p class="mt-1">
                Antalet sparade dragningar matchar inte vad som beräknas utifrån lotteriets inställningar (antal
                vinnare).
              </p>
            {/if}
          </div>
        {:else}
          <div
            class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
            role="status"
            aria-live="polite"
          >
            <p class="font-semibold">Verifiering misslyckades</p>
            <p class="mt-1">Omberäknat resultat skiljer sig från det sparade på följande positioner:</p>
            <ul class="mt-2 list-inside list-disc space-y-1 font-mono text-xs">
              {#each verification.mismatches as m (m.position)}
                <li>
                  Position {m.position}: förväntat deltagar-id {m.expectedId}, faktiskt {actualIdLabel(m.actualId)}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
