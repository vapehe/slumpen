<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  onMount(() => {
    void goto("/randomness");
  });
</script>

<div class="mx-auto max-w-5xl px-6 py-10">
  <p class="text-neutral-700">
    Flyttad sida. Om du inte skickas vidare automatiskt, öppna
    <a class="font-semibold text-emerald-700 underline" href="/randomness">/randomness</a>.
  </p>
</div>
