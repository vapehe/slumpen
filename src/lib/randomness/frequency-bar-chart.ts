import { Chart, registerables, type ChartConfiguration } from "chart.js";

let registerablesApplied = false;

function ensureChartRegistered(): void {
  if (!registerablesApplied) {
    Chart.register(...registerables);
    registerablesApplied = true;
  }
}

export type FrequencyBarChartParams = {
  frequency: number[];
  minVal: number;
};

function toNumberArray(raw: readonly number[] | unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => Number(v));
}

export function frequencyBarChart(
  canvas: HTMLCanvasElement,
  params: FrequencyBarChartParams,
): {
  update(next: FrequencyBarChartParams): void;
  destroy(): void;
} {
  ensureChartRegistered();

  let chart: Chart | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const scheduleResize = (): void => {
    requestAnimationFrame(() => {
      if (!chart) return;
      const p = canvas.parentElement;
      const w = Math.floor(p?.clientWidth ?? 0);
      const h = Math.floor(p?.clientHeight ?? 0);
      if (w > 0 && h > 0) {
        chart.resize(w, h);
      } else {
        chart.resize();
      }
    });
  };

  function bindChart(rawFreq: number[], m: number): void {
    const freq = toNumberArray(rawFreq);
    chart?.destroy();
    chart = null;
    if (freq.length === 0) return;

    const labels = freq.map((_, i) => String(m + i));
    const config: ChartConfiguration<"bar"> = {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Frekvens",
            data: freq,
            backgroundColor: "rgba(16, 185, 129, 0.6)",
            borderColor: "rgba(16, 185, 129, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
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
    scheduleResize();
    requestAnimationFrame(() => {
      scheduleResize();
    });
  }

  const parent = canvas.parentElement;
  if (parent && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      scheduleResize();
    });
    resizeObserver.observe(parent);
  }

  bindChart(params.frequency, params.minVal);

  return {
    update(next: FrequencyBarChartParams) {
      bindChart(next.frequency, next.minVal);
    },
    destroy() {
      resizeObserver?.disconnect();
      resizeObserver = null;
      chart?.destroy();
      chart = null;
    },
  };
}
