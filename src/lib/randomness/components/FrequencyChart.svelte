<script lang="ts">
  import { frequencyBarChart } from "$lib/randomness/frequency-bar-chart";

  let { frequency, minVal }: { frequency: number[]; minVal: number } = $props();
</script>

<div
  class="relative h-56 w-full min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white"
>
  <div class="absolute inset-3 box-border min-h-0 min-w-0">
    <canvas
      class="block h-full w-full min-h-px min-w-px"
      aria-label="Frekvensfördelning"
      use:frequencyBarChart={{ frequency, minVal }}
    ></canvas>
  </div>
</div>
