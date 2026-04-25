<script lang="ts">
  import { onDestroy } from "svelte";
  import { Chart, registerables, type ChartConfiguration } from "chart.js";
  Chart.register(...registerables);

  let { frequency, minVal }: { frequency: number[]; minVal: number } = $props();

  let canvas: HTMLCanvasElement | null = null;
  let chart: Chart | null = null;

  function render(): void {
    if (!canvas) return;
    chart?.destroy();

    const labels = frequency.map((_, i) => String(minVal + i));
    const config: ChartConfiguration<"bar"> = {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Frekvens",
            data: frequency,
            backgroundColor: "rgba(16, 185, 129, 0.6)", // emerald-ish
            borderColor: "rgba(16, 185, 129, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
          },
        },
        plugins: {
          legend: { display: false },
        },
      },
    };

    chart = new Chart(canvas, config);
  }

  $effect(() => {
    frequency;
    minVal;
    render();
  });

  onDestroy(() => chart?.destroy());
</script>

<div class="relative h-56 rounded-lg border border-neutral-200 bg-white p-3">
  <canvas bind:this={canvas} aria-label="Frekvensfördelning"></canvas>
</div>

