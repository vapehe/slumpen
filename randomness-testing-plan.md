# Implementationsplan: Slumpmässighetstestning i Tauri-lotteriapp

## Mål

Bygga en testmodul som verifierar att lotteriets slumpgenerator producerar statistiskt korrekta resultat. Modulen ska:

- Köra tre statistiska tester (chi², runs, seriekorrelation) i Rust
- Visa resultaten i en visuell dashboard i Svelte
- Spara historiska testrapporter i SQLite så trender kan följas över tid
- Kunna testa både syntetiska data (för verifiering) och riktiga historiska dragningar

---

## Arkitekturöversikt

```
┌────────────────────┐         ┌────────────────────┐         ┌──────────────┐
│  Svelte Dashboard  │ invoke  │  Rust kommandon    │  query  │   SQLite     │
│  (presentation)    │────────▶│  (statistik)       │────────▶│   (historik) │
└────────────────────┘         └────────────────────┘         └──────────────┘
```

**Varför dela upp så här:** Statistiska beräkningar i Rust är snabbare och mer precisa än i JavaScript. Svelte sköter bara visualisering. SQLite lagrar testrapporter så du kan jämföra över tid.

---

## Fas 1 – Databasschema

**Fil:** `src-tauri/migrations/0002_randomness_tests.sql`

```sql
CREATE TABLE IF NOT EXISTS randomness_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  source TEXT NOT NULL,              -- 'synthetic' eller 'historical'
  sample_size INTEGER NOT NULL,
  min_value INTEGER NOT NULL,
  max_value INTEGER NOT NULL,
  chi_square_stat REAL NOT NULL,
  chi_square_p REAL NOT NULL,
  chi_square_passed INTEGER NOT NULL,
  runs_stat REAL NOT NULL,
  runs_p REAL NOT NULL,
  runs_passed INTEGER NOT NULL,
  serial_correlation REAL NOT NULL,
  overall_passed INTEGER NOT NULL,
  frequency_json TEXT NOT NULL,      -- frekvensarray som JSON
  notes TEXT
);

CREATE INDEX idx_tests_created ON randomness_tests(created_at DESC);
```

**Registrera migrationen** i `src-tauri/src/lib.rs` (lägg till i den befintliga `migrations`-vektorn):

```rust
Migration {
    version: 2,
    description: "create_randomness_tests",
    sql: include_str!("../migrations/0002_randomness_tests.sql"),
    kind: MigrationKind::Up,
},
```

---

## Fas 2 – Rust-backend

### 2.1 Lägg till beroenden

**Fil:** `src-tauri/Cargo.toml`

```toml
[dependencies]
libm = "0.2"  # för erf() i p-värdesberäkning
```

### 2.2 Skapa modul för statistiska tester

**Fil:** `src-tauri/src/randomness.rs`

```rust
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct RandomnessReport {
    pub chi_square_stat: f64,
    pub chi_square_p: f64,
    pub chi_square_passed: bool,
    pub runs_stat: f64,
    pub runs_p: f64,
    pub runs_passed: bool,
    pub serial_correlation: f64,
    pub frequency: Vec<u32>,
    pub sample_size: usize,
    pub overall_passed: bool,
}

#[tauri::command]
pub fn run_randomness_tests(
    draws: Vec<u32>,
    min_val: u32,
    max_val: u32,
) -> Result<RandomnessReport, String> {
    // ... (se föregående kod – chi², runs, seriekorrelation)
}

fn chi_square_p_value(x: f64, df: f64) -> f64 { /* Wilson-Hilferty */ }
fn standard_normal_cdf(z: f64) -> f64 { /* erf-baserad */ }
```

### 2.3 Registrera kommandot

**Fil:** `src-tauri/src/lib.rs`

```rust
mod randomness;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default()...)
        .invoke_handler(tauri::generate_handler![
            randomness::run_randomness_tests,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 2.4 Enhetstester

**Fil:** `src-tauri/src/randomness.rs` (i botten)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn perfect_uniform_passes() {
        // 1000 dragningar jämnt fördelade över 1-10
        let draws: Vec<u32> = (1..=10).cycle().take(1000).collect();
        let r = run_randomness_tests(draws, 1, 10).unwrap();
        assert!(r.chi_square_passed);
    }

    #[test]
    fn heavy_bias_fails() {
        // 90% av dragningarna är talet 5
        let mut draws = vec![5u32; 900];
        draws.extend((1..=10).cycle().take(100));
        let r = run_randomness_tests(draws, 1, 10).unwrap();
        assert!(!r.chi_square_passed);
    }

    #[test]
    fn too_few_samples_returns_error() {
        let draws = vec![1u32, 2, 3];
        assert!(run_randomness_tests(draws, 1, 10).is_err());
    }
}
```

Kör med `cd src-tauri && cargo test`.

---

## Fas 3 – Svelte-frontend

### 3.1 Typer och API-wrapper

**Fil:** `src/lib/randomness/api.ts`

```ts
import { invoke } from '@tauri-apps/api/core';

export interface RandomnessReport {
  chi_square_stat: number;
  chi_square_p: number;
  chi_square_passed: boolean;
  runs_stat: number;
  runs_p: number;
  runs_passed: boolean;
  serial_correlation: number;
  frequency: number[];
  sample_size: number;
  overall_passed: boolean;
}

export async function runRandomnessTests(
  draws: number[],
  minVal: number,
  maxVal: number,
): Promise<RandomnessReport> {
  return invoke('run_randomness_tests', { draws, minVal, maxVal });
}
```

### 3.2 Persistenslager

**Fil:** `src/lib/randomness/storage.ts`

```ts
import { getDb } from '$lib/db';
import type { RandomnessReport } from './api';

export async function saveReport(
  report: RandomnessReport,
  source: 'synthetic' | 'historical',
  minVal: number,
  maxVal: number,
  notes?: string,
) {
  const db = await getDb();
  await db.execute(
    `INSERT INTO randomness_tests (
      source, sample_size, min_value, max_value,
      chi_square_stat, chi_square_p, chi_square_passed,
      runs_stat, runs_p, runs_passed,
      serial_correlation, overall_passed, frequency_json, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      source, report.sample_size, minVal, maxVal,
      report.chi_square_stat, report.chi_square_p, report.chi_square_passed ? 1 : 0,
      report.runs_stat, report.runs_p, report.runs_passed ? 1 : 0,
      report.serial_correlation, report.overall_passed ? 1 : 0,
      JSON.stringify(report.frequency), notes ?? null,
    ],
  );
}

export async function getRecentReports(limit = 20) {
  const db = await getDb();
  return db.select(
    'SELECT * FROM randomness_tests ORDER BY created_at DESC LIMIT $1',
    [limit],
  );
}
```

### 3.3 Komponentstruktur

```
src/lib/randomness/
├── api.ts                    # Tauri invoke-wrapper
├── storage.ts                # SQLite-anrop
└── components/
    ├── TestRunner.svelte     # Knapp + parameterval för att köra test
    ├── VerdictBanner.svelte  # Grön/röd toppbanner
    ├── MetricCards.svelte    # De fyra sifferkorten
    ├── FrequencyChart.svelte # Stapeldiagram (Chart.js)
    ├── DeviationChart.svelte # Avvikelsediagram
    └── TestHistory.svelte    # Lista av tidigare rapporter
```

### 3.4 Sidan

**Fil:** `src/routes/randomness/+page.svelte`

Importerar komponenterna ovan och kopplar ihop logiken. Använd Svelte 5 runes (`$state`, `$effect`).

```svelte
<script lang="ts">
  import { runRandomnessTests, type RandomnessReport } from '$lib/randomness/api';
  import { saveReport } from '$lib/randomness/storage';
  import VerdictBanner from '$lib/randomness/components/VerdictBanner.svelte';
  // ... resten

  let report = $state<RandomnessReport | null>(null);
  let loading = $state(false);

  async function handleRun(draws: number[], min: number, max: number) {
    loading = true;
    try {
      report = await runRandomnessTests(draws, min, max);
      await saveReport(report, 'historical', min, max);
    } finally {
      loading = false;
    }
  }
</script>
```

---

## Fas 4 – Chart.js-integration

### 4.1 Installation

```bash
pnpm add chart.js
```

### 4.2 Wrapper-komponent

**Fil:** `src/lib/randomness/components/FrequencyChart.svelte`

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  Chart.register(...registerables);

  let { frequency, expected }: { frequency: number[]; expected: number } = $props();
  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  $effect(() => {
    if (!canvas) return;
    chart?.destroy();
    chart = new Chart(canvas, { /* config */ });
  });

  onDestroy(() => chart?.destroy());
</script>

<div class="relative h-56">
  <canvas bind:this={canvas} role="img" aria-label="Frekvensfördelning"></canvas>
</div>
```

---

## Fas 5 – Integration med befintlig lottoplogik

Här kopplas testet till de riktiga dragningarna i appen.

### 5.1 Hämta historiska dragningar från SQLite

```ts
async function getHistoricalDraws(): Promise<number[]> {
  const db = await getDb();
  const rows = await db.select<{ value: number }[]>(
    'SELECT value FROM lottery_draws ORDER BY drawn_at',
  );
  return rows.map(r => r.value);
}
```

### 5.2 Schemalagd verifiering (valfritt)

Lägg till en knapp `"Kör veckotest"` som drar de senaste t.ex. 1 000 dragningarna och sparar en automatisk rapport. På så vis byggs en historik upp utan manuellt arbete.

---

## Fas 6 – UI-detaljer

| Element | Beteende |
|---------|----------|
| Verdict-banner | Grön vid godkänt, gul/röd vid varning. Visar antal dragningar och antal möjliga utfall. |
| Sifferkort | Värdet i grönt om testet godkänt, orange annars. P-värde visas som undertext. |
| Frekvensdiagram | Staplar färgas orange om de avviker mer än 20% från förväntat värde. |
| Avvikelsediagram | Visar `frekvens − förväntat` per tal. Hjälper att se mönster. |
| Historikvy | Tabell med datum, sample size, verdict (✓/✗) och länk till detaljerad rapport. |

---

## Fas 7 – Validering och edge cases

**Innan release, testa följande scenarier:**

- [ ] Perfekt uniform fördelning → alla tester ska godkännas
- [ ] Tung bias (ett tal 80% av tiden) → chi² ska underkänna
- [ ] Sorterad sekvens (1,2,3,…) → runs-test ska underkänna
- [ ] Repeterande mönster (1,2,1,2,…) → seriekorrelation ska bli hög
- [ ] För få samples (< 5×range) → vänligt felmeddelande, inget krasch
- [ ] Tomma input → felmeddelande
- [ ] Värden utanför min/max → ignoreras eller felmeddelande

**Verifiera mot kända implementationer:** Generera 10 000 tal med `Math.random()` och kontrollera att de godkänns. Generera samma med en avsiktligt bristfällig RNG (t.ex. `(seed * 1103515245 + 12345) % 32768`) och se att avvikelser detekteras.

---

## Fas 8 – Förbättringar för senare

- **Fler tester:** Kolmogorov-Smirnov, gap-test, poker-test
- **Konfidensintervall** istället för bara pass/fail
- **Export av rapport** som PDF eller CSV
- **Trendgraf** över historiska testresultat (är slumpen stabil över månader?)
- **Larm** om tre tester i rad underkänns
- **Jämförelseläge** – kör samma data genom två olika RNG-implementationer

---

## Tidsplan (uppskattad)

| Fas | Innehåll | Uppskattad tid |
|-----|----------|----------------|
| 1 | Databasschema + migration | 30 min |
| 2 | Rust-tester + enhetstester | 3–4 h |
| 3 | Svelte-komponenter (utan diagram) | 3–4 h |
| 4 | Chart.js-integration | 2 h |
| 5 | Integration med lottologik | 1–2 h |
| 6 | UI-finputs och styling | 2–3 h |
| 7 | Edge case-tester | 2 h |
| **Totalt** | | **~14–18 h** |

---

## Att tänka på

**Statistik är probabilistisk.** Ett underkänt test betyder inte automatiskt att RNG är trasig — med p < 0,05 förväntas en av tjugo körningar misslyckas även med perfekt slump. Det är upprepade misslyckanden över tid som indikerar ett verkligt problem. Därför är historikvyn viktig.

**Lita på Rusts RNG.** Om du använder `rand`-cratet med standardgeneratorn (`thread_rng()`) kommer den att passera alla rimliga tester. Värdet i denna modul är att *bevisa* det för dig själv och för revisorer/användare, inte att jaga buggar du sannolikt inte har.

**Sample size är allt.** Med 100 dragningar över 1–35 är statistiken meningslös. Sikta på minst 1 000 dragningar för att resultaten ska vara meningsfulla.
