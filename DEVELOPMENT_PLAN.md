# Lotterigenerator - Utvecklingsplan för Cursor

Detta är en komplett utvecklingsplan för en desktop-applikation för lotteridragningar, byggd med Tauri 2.0 + SvelteKit + Svelte 5 + TailwindCSS + SQLite.

## Projektöversikt

**Syfte**: Desktop-app för att genomföra transparenta lotteridragningar i konstföreningar eller liknande sammanhang.

**Kärnfunktionalitet**:
- Ladda upp CSV-fil där varje rad = en lott
- Genomföra slumpmässiga dragningar med visuell animation (tombola-hjul/bandrulle)
- Spara alla dragningar i SQLite-databas
- Exportera resultat till PDF-protokoll med signaturrader

**Teknisk stack**:
- **App-skal**: Tauri 2.0 (Rust backend, native webview)
- **Frontend**: SvelteKit 2 + Svelte 5 (runes, SPA-mode via adapter-static)
- **Styling**: TailwindCSS 4
- **Databas**: SQLite via tauri-plugin-sql
- **Språk**: TypeScript (strict mode)

---

## Fas 1: Projektscaffold och grundkonfiguration

### 1.1 Skapa Tauri-projektet

**FRÅGA FÖRE START**: Vilket projektnamn ska användas? (Förslag: `lotterigenerator`)

**FRÅGA FÖRE START**: Vilken pakethanterare används? (pnpm rekommenderas enligt Tauri-skill)

```bash
pnpm create tauri-app@latest [PROJEKTNAMN] \
  --template svelte-ts \
  --manager pnpm

cd [PROJEKTNAMN]
pnpm install
```

### 1.2 Konfigurera adapter-static för SPA-mode

**Viktigt**: Tauri kräver SPA-mode eftersom det inte finns någon server.

1. Installera adapter:
```bash
pnpm add -D @sveltejs/adapter-static
```

2. Uppdatera `svelte.config.js`:
```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'index.html' }), // SPA mode
  },
};
```

3. Skapa `src/routes/+layout.ts`:
```ts
export const prerender = false;
export const ssr = false;
```

### 1.3 Lägg till TailwindCSS 4

```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

Uppdatera `vite.config.ts`:
```ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
});
```

Skapa `src/app.css`:
```css
@import "tailwindcss";
```

Importera i `src/routes/+layout.svelte`:
```svelte
<script lang="ts">
  import '../app.css';
</script>

<slot />
```

### 1.4 Konfigurera SQLite-plugin

**Viktigt**: Detta görs i två steg - NPM-paket i frontend, Cargo-crate i backend.

#### Frontend (projekt-root):
```bash
pnpm add @tauri-apps/plugin-sql
```

#### Backend (i src-tauri/):
```bash
cd src-tauri
cargo add tauri-plugin-sql --features sqlite
cd ..
```

---

## Fas 2: Databasschema och migrationer

### 2.1 Skapa migrationsfil

Skapa katalog och fil: `src-tauri/migrations/0001_init.sql`

```sql
-- Lotterier (varje genomförd dragning)
CREATE TABLE IF NOT EXISTS lotteries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  num_draws INTEGER NOT NULL,                    -- antal vinnare som ska dras
  with_replacement BOOLEAN NOT NULL DEFAULT 0,   -- 0=utan återläggning, 1=med återläggning
  name_column TEXT NOT NULL,                     -- vilken CSV-kolumn som visas på hjulet (t.ex. "fullname")
  seed TEXT                                      -- slumpseed för transparens/revision
);

-- Deltagare/lotter (varje rad från CSV)
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lottery_id INTEGER NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,                    -- ursprunglig radordning från CSV (0-indexerad)
  data_json TEXT NOT NULL                        -- hela CSV-raden som JSON, t.ex. {"fullname":"Anna","email":"anna@ex.com"}
);

-- Dragningsresultat (varje vinnare)
CREATE TABLE IF NOT EXISTS draws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lottery_id INTEGER NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,                     -- 1=första vinnare, 2=andra vinnare osv
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  drawn_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lottery_id, position)                   -- garanterar att position 1,2,3... är unika per lotteri
);

-- Index för snabbare queries
CREATE INDEX IF NOT EXISTS idx_participants_lottery ON participants(lottery_id);
CREATE INDEX IF NOT EXISTS idx_draws_lottery ON draws(lottery_id);
```

**NOTERING OM SCHEMA**:
- `data_json` innehåller hela CSV-raden som JSON för flexibilitet (olika CSV-filer kan ha olika kolumner)
- `name_column` sparas på lotteriet så vi vet vilken kolumn som visades på hjulet
- `with_replacement` avgör om samma lott kan vinnas flera gånger
- `seed` sparas för transparens - dragningen kan reproduceras

### 2.2 Registrera plugin och migrationer i Rust

Uppdatera `src-tauri/src/lib.rs`:

```rust
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:app.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 2.3 Konfigurera permissions

Uppdatera `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "sql:default",
    "sql:allow-load",
    "sql:allow-execute",
    "sql:allow-select",
    "sql:allow-close"
  ]
}
```

### 2.4 Skapa databas-hjälpfunktioner

Skapa `src/lib/db.ts`:

```typescript
import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:app.db');
  }
  return db;
}

// Typdefinitioner
export interface Lottery {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  num_draws: number;
  with_replacement: boolean;
  name_column: string;
  seed: string | null;
}

export interface Participant {
  id: number;
  lottery_id: number;
  row_index: number;
  data_json: string; // JSON-sträng
}

export interface Draw {
  id: number;
  lottery_id: number;
  position: number;
  participant_id: number;
  drawn_at: string;
}

// Parsed participant data (efter JSON.parse av data_json)
export interface ParticipantData {
  [key: string]: string; // Dynamiska kolumner från CSV
}

// CRUD-funktioner läggs till efter hand under utvecklingen
```

**NOTERING**: Fler CRUD-funktioner (createLottery, getParticipants, saveDraws etc.) läggs till när de behövs i respektive fas.

---

## Fas 3: CSV-uppladdning och förhandsgranskning

**FRÅGA FÖRE START**: Ska Tauri dialog-plugin användas för filväljare? (Rekommenderas: ja)

### 3.1 Installera dependencies

```bash
# Frontend
pnpm add papaparse
pnpm add -D @types/papaparse

# Backend (i src-tauri/)
cd src-tauri
cargo add tauri-plugin-dialog
cd ..
```

### 3.2 Uppdatera permissions för dialog

I `src-tauri/capabilities/default.json`, lägg till:
```json
"dialog:default",
"dialog:allow-open"
```

### 3.3 Registrera dialog-plugin

I `src-tauri/src/lib.rs`, lägg till:
```rust
.plugin(tauri_plugin_dialog::init())
```

### 3.4 Skapa CSV-parser utility

Skapa `src/lib/csv-parser.ts`:

```typescript
import Papa from 'papaparse';

export interface ParsedCSV {
  data: Record<string, string>[]; // Array av rader, varje rad är ett objekt med kolumnnamn som nycklar
  columns: string[];              // Lista över kolumnnamn från header
  errors: string[];               // Eventuella parsningsfel
}

export async function parseCSVFile(filePath: string): Promise<ParsedCSV> {
  // FRÅGA: Ska filen läsas via Tauri fs-plugin eller via dialog?
  // ANTAGANDE: Filen läses via Tauri fs-plugin efter att sökvägen valts via dialog
  
  // Placeholder - implementera med Tauri fs API
  throw new Error('Not implemented - behöver Tauri fs-plugin integration');
}

export function detectDuplicates(
  data: Record<string, string>[],
  columnName: string
): { total: number; unique: number; duplicates: number } {
  const values = data.map(row => row[columnName]).filter(Boolean);
  const uniqueValues = new Set(values);
  
  return {
    total: values.length,
    unique: uniqueValues.size,
    duplicates: values.length - uniqueValues.size
  };
}
```

**VIKTIGA FRÅGOR FÖR CSV-PARSING**:
1. Ska CSV-filen läsas via Tauri `fs`-plugin eller via native file input?
2. Ska UTF-8 antas, eller ska encoding-detektion implementeras?
3. Ska första raden alltid tolkas som header, eller ska det vara konfigurerbart?
4. Hur ska tomma rader hanteras - skippa eller visa fel?

**REKOMMENDATION FRÅN PLAN**: 
- Använd Tauri fs-plugin för att läsa fil efter dialog
- Anta UTF-8, men visa tydligt felmeddelande om konstiga tecken upptäcks
- Första raden = header (obligatoriskt)
- Skippa tomma rader tyst

### 3.5 Skapa förhandsgranskningskomponent

Skapa `src/lib/components/CSVPreview.svelte`:

```svelte
<script lang="ts">
  import type { ParsedCSV } from '$lib/csv-parser';
  import { detectDuplicates } from '$lib/csv-parser';

  interface Props {
    parsedData: ParsedCSV;
    selectedNameColumn: string;
    onColumnSelect: (column: string) => void;
  }

  let { parsedData, selectedNameColumn, onColumnSelect }: Props = $props();

  // Beräkna dubbletter när selectedNameColumn ändras
  let duplicateInfo = $derived(
    selectedNameColumn
      ? detectDuplicates(parsedData.data, selectedNameColumn)
      : null
  );

  // Visa bara första 10 raderna i tabellen
  let previewRows = $derived(parsedData.data.slice(0, 10));
</script>

<div class="space-y-4">
  <!-- Statistik -->
  <div class="bg-blue-50 border border-blue-200 rounded p-4">
    <p class="font-semibold">Inläst: {parsedData.data.length} rader</p>
    <p class="text-sm text-gray-600">Kolumner: {parsedData.columns.join(', ')}</p>
  </div>

  <!-- Kolumnväljare för namn -->
  <div>
    <label class="block font-medium mb-2">
      Vilken kolumn innehåller deltagarens namn?
    </label>
    <select
      bind:value={selectedNameColumn}
      onchange={() => onColumnSelect(selectedNameColumn)}
      class="border rounded px-3 py-2 w-full max-w-xs"
    >
      <option value="">-- Välj kolumn --</option>
      {#each parsedData.columns as col}
        <option value={col}>{col}</option>
      {/each}
    </select>
  </div>

  <!-- Dubblettvarning -->
  {#if duplicateInfo && duplicateInfo.duplicates > 0}
    <div class="bg-amber-50 border border-amber-200 rounded p-4">
      <p class="font-semibold">ℹ️ Information om dubbletter</p>
      <p class="text-sm mt-1">
        {duplicateInfo.total} rader inlästa. {duplicateInfo.unique} unika värden i kolumnen
        <strong>{selectedNameColumn}</strong> — {duplicateInfo.duplicates} rader är dubbletter.
      </p>
      <p class="text-sm text-gray-600 mt-1">
        Detta är normalt för lotterier där en person kan ha flera lotter. Om det inte är meningen,
        kontrollera CSV-filen.
      </p>
    </div>
  {/if}

  <!-- Tabellförhandsgranskning -->
  <div class="overflow-x-auto">
    <p class="text-sm text-gray-600 mb-2">Förhandsgranskning (första 10 raderna):</p>
    <table class="min-w-full border">
      <thead class="bg-gray-50">
        <tr>
          {#each parsedData.columns as col}
            <th class="border px-4 py-2 text-left text-sm font-semibold">{col}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each previewRows as row}
          <tr class="border-t">
            {#each parsedData.columns as col}
              <td class="border px-4 py-2 text-sm">{row[col] || ''}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
    {#if parsedData.data.length > 10}
      <p class="text-sm text-gray-500 mt-2">
        ... och {parsedData.data.length - 10} rader till
      </p>
    {/if}
  </div>

  <!-- Felmeddelanden om parsning misslyckades -->
  {#if parsedData.errors.length > 0}
    <div class="bg-red-50 border border-red-200 rounded p-4">
      <p class="font-semibold text-red-800">Parsningsfel:</p>
      <ul class="list-disc list-inside text-sm text-red-700 mt-1">
        {#each parsedData.errors as error}
          <li>{error}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
```

---

## Fas 4: Skapa lotteri - formulär och datalagring

### 4.1 Utöka db.ts med CRUD för lotterier

Lägg till i `src/lib/db.ts`:

```typescript
export async function createLottery(
  name: string,
  description: string | null,
  numDraws: number,
  withReplacement: boolean,
  nameColumn: string,
  seed: string
): Promise<number> {
  const database = await getDb();
  
  const result = await database.execute(
    `INSERT INTO lotteries (name, description, num_draws, with_replacement, name_column, seed)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [name, description, numDraws, withReplacement ? 1 : 0, nameColumn, seed]
  );
  
  // FRÅGA: Hur får vi tillbaka last_insert_rowid från tauri-plugin-sql?
  // ANTAGANDE: result.lastInsertId finns
  return result.lastInsertId as number;
}

export async function addParticipants(
  lotteryId: number,
  participants: { rowIndex: number; data: Record<string, string> }[]
): Promise<void> {
  const database = await getDb();
  
  for (const p of participants) {
    await database.execute(
      'INSERT INTO participants (lottery_id, row_index, data_json) VALUES ($1, $2, $3)',
      [lotteryId, p.rowIndex, JSON.stringify(p.data)]
    );
  }
}

export async function getAllLotteries(): Promise<Lottery[]> {
  const database = await getDb();
  return database.select<Lottery[]>('SELECT * FROM lotteries ORDER BY created_at DESC');
}

export async function getLotteryById(id: number): Promise<Lottery | null> {
  const database = await getDb();
  const results = await database.select<Lottery[]>(
    'SELECT * FROM lotteries WHERE id = $1',
    [id]
  );
  return results[0] || null;
}
```

**VIKTIGA FRÅGOR**:
1. Hur får vi tillbaka `last_insert_rowid` från tauri-plugin-sql efter INSERT?
2. Ska batch-insert användas för participants, eller är loop OK? (ANTAGANDE: loop OK för enkelhetens skull, optimera senare om nödvändigt)

### 4.2 Skapa formulär för nytt lotteri

Skapa `src/routes/create/+page.svelte`:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import CSVPreview from '$lib/components/CSVPreview.svelte';
  import { createLottery, addParticipants } from '$lib/db';
  import type { ParsedCSV } from '$lib/csv-parser';
  import { parseCSVFile } from '$lib/csv-parser';

  let name = $state('');
  let description = $state('');
  let numDraws = $state(1);
  let withReplacement = $state(false);
  let selectedNameColumn = $state('');
  let parsedCSV = $state<ParsedCSV | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  async function handleFileSelect() {
    // FRÅGA: Exakt implementation av dialog open och fs read behövs här
    // PLACEHOLDER:
    try {
      isLoading = true;
      error = null;
      // const filePath = await open({ ... });
      // parsedCSV = await parseCSVFile(filePath);
      throw new Error('Dialog integration not implemented yet');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Okänt fel vid filläsning';
    } finally {
      isLoading = false;
    }
  }

  async function handleCreate() {
    if (!parsedCSV || !selectedNameColumn || !name.trim()) {
      error = 'Vänligen fyll i alla obligatoriska fält';
      return;
    }

    if (numDraws < 1 || numDraws > parsedCSV.data.length) {
      error = `Antal dragningar måste vara mellan 1 och ${parsedCSV.data.length}`;
      return;
    }

    try {
      isLoading = true;
      error = null;

      // Generera kryptografiskt säker seed
      const seedArray = new Uint8Array(16);
      crypto.getRandomValues(seedArray);
      const seed = Array.from(seedArray, b => b.toString(16).padStart(2, '0')).join('');

      // Skapa lotteri
      const lotteryId = await createLottery(
        name,
        description || null,
        numDraws,
        withReplacement,
        selectedNameColumn,
        seed
      );

      // Lägg till deltagare
      const participants = parsedCSV.data.map((row, index) => ({
        rowIndex: index,
        data: row
      }));
      await addParticipants(lotteryId, participants);

      // Navigera till dragningssidan
      await goto(`/draw/${lotteryId}`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Okänt fel vid skapande av lotteri';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="max-w-4xl mx-auto p-6 space-y-6">
  <h1 class="text-3xl font-bold">Skapa nytt lotteri</h1>

  <!-- Formulär -->
  <div class="space-y-4">
    <div>
      <label class="block font-medium mb-1">Lotteriets namn *</label>
      <input
        type="text"
        bind:value={name}
        placeholder="T.ex. Årsmöte 2026 - Konstlotteri"
        class="border rounded px-3 py-2 w-full"
      />
    </div>

    <div>
      <label class="block font-medium mb-1">Beskrivning (valfritt)</label>
      <textarea
        bind:value={description}
        placeholder="Ytterligare information om lotteriet..."
        class="border rounded px-3 py-2 w-full"
        rows="3"
      />
    </div>

    <div>
      <label class="block font-medium mb-1">Antal vinnare att dra *</label>
      <input
        type="number"
        bind:value={numDraws}
        min="1"
        class="border rounded px-3 py-2 w-32"
      />
    </div>

    <div>
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={withReplacement} />
        <span>Tillåt att samma lott kan vinna flera gånger (med återläggning)</span>
      </label>
      <p class="text-sm text-gray-600 mt-1">
        Om avstängd kan varje lott bara vinna en gång. Om påslagen kan samma lott vinna flera priser.
      </p>
    </div>

    <!-- CSV-uppladdning -->
    <div>
      <label class="block font-medium mb-2">CSV-fil med deltagare *</label>
      <button
        onclick={handleFileSelect}
        disabled={isLoading}
        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Läser in...' : 'Välj CSV-fil'}
      </button>
    </div>

    <!-- Förhandsgranskning -->
    {#if parsedCSV}
      <CSVPreview
        {parsedCSV}
        {selectedNameColumn}
        onColumnSelect={(col) => selectedNameColumn = col}
      />
    {/if}

    <!-- Felmeddelanden -->
    {#if error}
      <div class="bg-red-50 border border-red-200 rounded p-4 text-red-800">
        {error}
      </div>
    {/if}

    <!-- Skapa-knapp -->
    <div class="flex gap-4">
      <button
        onclick={handleCreate}
        disabled={isLoading || !parsedCSV || !selectedNameColumn || !name.trim()}
        class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Starta dragning
      </button>
      <a
        href="/"
        class="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300"
      >
        Avbryt
      </a>
    </div>
  </div>
</div>
```

**VIKTIGA IMPLEMENTATIONSFRÅGOR**:
1. Exakt API för Tauri dialog open() och fs read()
2. Ska filväljaren vara begränsad till .csv/.txt eller alla filer?
3. Ska encoding-validering implementeras (UTF-8 vs latin-1)?

---

## Fas 5: Dragningslogik (slumpalgoritm)

### 5.1 Skapa slumpgenerator utility

Skapa `src/lib/random.ts`:

```typescript
/**
 * Genererar en kryptografiskt säker slumpseed (hex-sträng).
 */
export function generateSeed(): string {
  const seedArray = new Uint8Array(16);
  crypto.getRandomValues(seedArray);
  return Array.from(seedArray, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Seeded random number generator baserad på Mulberry32.
 * Deterministisk - samma seed ger samma sekvens.
 */
class SeededRandom {
  private state: number;

  constructor(seed: string) {
    // Konvertera hex-seed till 32-bit number
    this.state = parseInt(seed.substring(0, 8), 16);
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * Fisher-Yates shuffle med seeded random.
 */
export function shuffleWithSeed<T>(array: T[], seed: string): T[] {
  const rng = new SeededRandom(seed);
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Drar N vinnare utan återläggning.
 */
export function drawWithoutReplacement<T>(
  participants: T[],
  numDraws: number,
  seed: string
): T[] {
  const shuffled = shuffleWithSeed(participants, seed);
  return shuffled.slice(0, numDraws);
}

/**
 * Drar N vinnare med återläggning (samma deltagare kan dras flera gånger).
 */
export function drawWithReplacement<T>(
  participants: T[],
  numDraws: number,
  seed: string
): T[] {
  const rng = new SeededRandom(seed);
  const winners: T[] = [];

  for (let i = 0; i < numDraws; i++) {
    const index = Math.floor(rng.next() * participants.length);
    winners.push(participants[index]);
  }

  return winners;
}
```

**NOTERING OM SLUMP**:
- `crypto.getRandomValues()` används för seed-generering (kryptografiskt säker)
- Själva dragningen är deterministisk baserad på seeden (Mulberry32-algoritm)
- Detta gör att dragningen kan reproduceras/verifieras om seeden är känd

**FRÅGA**: Ska Mulberry32 användas, eller finns preferens för en annan PRNG? (Alternativen inkluderar SplitMix32, xoshiro128**)

### 5.2 Utöka db.ts med draws

Lägg till i `src/lib/db.ts`:

```typescript
export async function saveDraws(
  lotteryId: number,
  draws: { position: number; participantId: number }[]
): Promise<void> {
  const database = await getDb();

  for (const draw of draws) {
    await database.execute(
      'INSERT INTO draws (lottery_id, position, participant_id) VALUES ($1, $2, $3)',
      [lotteryId, draw.position, draw.participantId]
    );
  }
}

export async function getDrawsByLottery(lotteryId: number): Promise<Draw[]> {
  const database = await getDb();
  return database.select<Draw[]>(
    'SELECT * FROM draws WHERE lottery_id = $1 ORDER BY position ASC',
    [lotteryId]
  );
}

export async function getParticipantsByLottery(lotteryId: number): Promise<Participant[]> {
  const database = await getDb();
  return database.select<Participant[]>(
    'SELECT * FROM participants WHERE lottery_id = $1 ORDER BY row_index ASC',
    [lotteryId]
  );
}
```

---

## Fas 6: Dragningsanimation (tombola-hjul / bandrulle)

**KRITISK DESIGNBESLUT**: Animationen är ENDAST visuell. Vinnaren är redan bestämd innan animationen börjar.

**FRÅGA FÖRE IMPLEMENTATION**: 
- Ska bandrulle (slot-machine-stil) eller roterande hjul användas som default?
- Ska båda implementeras med möjlighet att växla?
- REKOMMENDATION FRÅN PLAN: Bandrulle som default eftersom det skalar bättre för stora deltagarlistor

### 6.1 Skapa bandrullekomponent

Skapa `src/lib/components/SlotReel.svelte`:

```svelte
<script lang="ts">
  /**
   * Slot-machine-stil animation för lotteridragning.
   * Visar deltagare som rullar förbi vertikalt och stannar på vinnaren.
   */

  interface Props {
    participants: { id: number; name: string }[];
    winnerId: number; // ID på den förutbestämda vinnaren
    speed: number; // Millisekunder för hela animationen (5000-30000 rekommenderat)
    onComplete: () => void;
  }

  let { participants, winnerId, speed, onComplete }: Props = $props();

  let isSpinning = $state(false);
  let currentOffset = $state(0); // Vertical offset i pixlar
  let reelElement: HTMLDivElement | null = $state(null);

  const ITEM_HEIGHT = 80; // Pixlar per deltagare i rullen

  /**
   * Startar animationen.
   * Rullen accelererar, snurrar snabbt, och bromsar in på vinnaren.
   */
  export function spin() {
    if (isSpinning) return;
    isSpinning = true;

    // Hitta vinnarens index
    const winnerIndex = participants.findIndex(p => p.id === winnerId);
    if (winnerIndex === -1) {
      console.error('Vinnare hittades inte i deltagarlistan');
      return;
    }

    // Beräkna slutposition
    // Rullen ska göra flera varv och sedan stanna så att vinnaren är centrerad
    const numFullRotations = 5; // Antal fullständiga varv innan bromsning
    const totalItems = participants.length;
    const finalOffset = -(winnerIndex * ITEM_HEIGHT + numFullRotations * totalItems * ITEM_HEIGHT);

    // Animera med CSS transition
    if (reelElement) {
      reelElement.style.transition = `transform ${speed}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
      reelElement.style.transform = `translateY(${finalOffset}px)`;
    }

    // Efter animation: markera som klar
    setTimeout(() => {
      isSpinning = false;
      onComplete();
    }, speed);
  }

  /**
   * Återställ position för nästa dragning.
   */
  export function reset() {
    if (reelElement) {
      reelElement.style.transition = 'none';
      reelElement.style.transform = 'translateY(0)';
    }
    currentOffset = 0;
    isSpinning = false;
  }

  // Dubbla deltagarlistan för sömlös loop
  let extendedParticipants = $derived([...participants, ...participants, ...participants]);
</script>

<div class="reel-container relative overflow-hidden h-96 border-4 border-gray-800 rounded-lg bg-gray-900">
  <!-- Visare (mittmarkör) -->
  <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-20 border-t-4 border-b-4 border-yellow-400 pointer-events-none z-10" />
  
  <!-- Rullande lista -->
  <div bind:this={reelElement} class="reel flex flex-col items-center pt-48">
    {#each extendedParticipants as participant}
      <div
        class="reel-item flex items-center justify-center text-white text-2xl font-bold"
        style="height: {ITEM_HEIGHT}px;"
      >
        {participant.name}
      </div>
    {/each}
  </div>
</div>

<style>
  .reel-container {
    position: relative;
  }

  .reel-item {
    flex-shrink: 0;
  }
</style>
```

**IMPLEMENTATIONSFRÅGOR**:
1. Ska ljudeffekter läggas till (tickande ljud under snurr + fanfar vid vinst)?
2. Ska konfetti-animation visas vid vinst?
3. Hur ska flera dragningar i rad fungera - ska listan uppdateras mellan snurr (ta bort vinnare vid "utan återläggning")?

**NOTERING OM ANIMATION**:
- Animationen måste ALLTID resultera i förutbestämd vinnare
- Hastighet styrs via `speed`-prop
- `cubic-bezier(0.17, 0.67, 0.12, 0.99)` ger realistisk acceleration/bromsning

### 6.2 Skapa dragningssida

Skapa `src/routes/draw/[id]/+page.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import SlotReel from '$lib/components/SlotReel.svelte';
  import {
    getLotteryById,
    getParticipantsByLottery,
    saveDraws,
    type Lottery,
    type Participant
  } from '$lib/db';
  import { drawWithoutReplacement, drawWithReplacement } from '$lib/random';

  let lottery = $state<Lottery | null>(null);
  let participants = $state<Participant[]>([]);
  let winners = $state<Participant[]>([]);
  let currentDrawIndex = $state(0);
  let isDrawing = $state(false);
  let speed = $state(8000); // Default 8 sekunder
  let error = $state<string | null>(null);

  let slotReel: any = $state(null); // Referens till SlotReel-komponenten

  onMount(async () => {
    const lotteryId = parseInt($page.params.id);
    lottery = await getLotteryById(lotteryId);
    
    if (!lottery) {
      error = 'Lotteriet hittades inte';
      return;
    }

    participants = await getParticipantsByLottery(lotteryId);

    if (participants.length === 0) {
      error = 'Inga deltagare hittades för detta lotteri';
      return;
    }

    // Förutbestäm alla vinnare baserat på sparad seed
    if (lottery.seed) {
      if (lottery.with_replacement) {
        winners = drawWithReplacement(participants, lottery.num_draws, lottery.seed);
      } else {
        winners = drawWithoutReplacement(participants, lottery.num_draws, lottery.seed);
      }
    } else {
      error = 'Lotteriet saknar seed och kan inte genomföras';
    }
  });

  async function handleDraw() {
    if (!lottery || currentDrawIndex >= winners.length || isDrawing) return;

    isDrawing = true;
    
    // Starta animation mot förutbestämd vinnare
    slotReel?.spin();
  }

  async function handleDrawComplete() {
    isDrawing = false;
    
    // Spara detta resultat till databasen
    if (lottery) {
      await saveDraws(lottery.id, [
        {
          position: currentDrawIndex + 1,
          participantId: winners[currentDrawIndex].id
        }
      ]);
    }

    // Gå vidare till nästa dragning
    currentDrawIndex++;

    // Om utan återläggning: ta bort vinnaren från listan för nästa snurr
    if (lottery && !lottery.with_replacement) {
      const winnerId = winners[currentDrawIndex - 1].id;
      participants = participants.filter(p => p.id !== winnerId);
    }

    // Om alla dragningar är klara: navigera till resultat
    if (currentDrawIndex >= winners.length) {
      setTimeout(() => {
        goto(`/results/${lottery?.id}`);
      }, 2000);
    } else {
      // Återställ rullen för nästa dragning
      setTimeout(() => {
        slotReel?.reset();
      }, 1500);
    }
  }

  // Parsed participant names för visning
  let participantList = $derived(
    participants.map(p => {
      const data = JSON.parse(p.data_json);
      return {
        id: p.id,
        name: data[lottery?.name_column || ''] || 'Okänd'
      };
    })
  );

  let currentWinnerName = $derived(
    currentDrawIndex < winners.length
      ? JSON.parse(winners[currentDrawIndex].data_json)[lottery?.name_column || '']
      : null
  );
</script>

<div class="max-w-5xl mx-auto p-6">
  {#if error}
    <div class="bg-red-50 border border-red-200 rounded p-4 text-red-800">
      {error}
    </div>
    <a href="/" class="text-blue-600 hover:underline mt-4 inline-block">Tillbaka till start</a>
  {:else if lottery}
    <h1 class="text-3xl font-bold mb-2">{lottery.name}</h1>
    {#if lottery.description}
      <p class="text-gray-600 mb-6">{lottery.description}</p>
    {/if}

    <div class="mb-6">
      <p class="text-lg">
        Dragning <strong>{currentDrawIndex + 1}</strong> av <strong>{lottery.num_draws}</strong>
      </p>
      <p class="text-sm text-gray-600">
        {participants.length} deltagare kvar i lotteriet
      </p>
    </div>

    <!-- Hastighetskontroll -->
    <div class="mb-6">
      <label class="block font-medium mb-2">Snurrhastighet: {speed / 1000} sekunder</label>
      <input
        type="range"
        bind:value={speed}
        min="3000"
        max="30000"
        step="1000"
        class="w-full max-w-md"
        disabled={isDrawing}
      />
    </div>

    <!-- Tombolahjul -->
    <SlotReel
      bind:this={slotReel}
      participants={participantList}
      winnerId={currentDrawIndex < winners.length ? winners[currentDrawIndex].id : 0}
      {speed}
      onComplete={handleDrawComplete}
    />

    <!-- Dra-knapp -->
    <div class="mt-8 text-center">
      {#if currentDrawIndex < winners.length}
        <button
          onclick={handleDraw}
          disabled={isDrawing}
          class="bg-green-600 text-white px-12 py-4 rounded-lg text-2xl font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDrawing ? 'Drar...' : 'DRA!'}
        </button>
      {:else}
        <p class="text-xl font-semibold text-green-600">Alla dragningar genomförda!</p>
      {/if}
    </div>

    <!-- Vinnarvisning efter avslutad dragning -->
    {#if currentDrawIndex > 0 && !isDrawing}
      <div class="mt-8 bg-yellow-50 border-4 border-yellow-400 rounded-lg p-6 text-center">
        <p class="text-lg font-semibold mb-2">Vinnare {currentDrawIndex}:</p>
        <p class="text-4xl font-bold text-yellow-800">
          {JSON.parse(winners[currentDrawIndex - 1].data_json)[lottery.name_column]}
        </p>
      </div>
    {/if}
  {/if}
</div>
```

**IMPLEMENTATIONSFRÅGOR**:
1. Ska fullscreen-läge implementeras via Tauri API? (Rekommenderat för projektionsscenarier)
2. Ska ljudeffekter läggas till här eller i SlotReel-komponenten?
3. Ska det finnas en "paus/avbryt"-knapp?

---

## Fas 7: Resultatvy och PDF-export

### 7.1 Installera jspdf

```bash
pnpm add jspdf jspdf-autotable
pnpm add -D @types/jspdf
```

### 7.2 Skapa PDF-generator utility

Skapa `src/lib/pdf-generator.ts`:

```typescript
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Lottery, Draw, Participant } from './db';

export async function generateLotteryProtocol(
  lottery: Lottery,
  draws: Draw[],
  participants: Participant[]
): Promise<Blob> {
  const doc = new jsPDF();

  // Titel
  doc.setFontSize(20);
  doc.text(lottery.name, 20, 20);

  // Metadata
  doc.setFontSize(12);
  let yPos = 35;
  
  if (lottery.description) {
    doc.text(`Beskrivning: ${lottery.description}`, 20, yPos);
    yPos += 10;
  }

  doc.text(`Datum: ${new Date(lottery.created_at).toLocaleString('sv-SE')}`, 20, yPos);
  yPos += 7;
  
  doc.text(`Antal deltagare: ${participants.length}`, 20, yPos);
  yPos += 7;
  
  doc.text(`Typ: ${lottery.with_replacement ? 'Med återläggning' : 'Utan återläggning'}`, 20, yPos);
  yPos += 15;

  // FRÅGA: Vilka kolumner från CSV ska visas i tabellen?
  // ANTAGANDE: Visa position, namn-kolumnen, och eventuellt övriga kolumner från första deltagaren
  
  // Hämta kolumnnamn från första deltagaren
  const sampleData = JSON.parse(participants[0].data_json);
  const allColumns = Object.keys(sampleData);
  
  // Bygg tabelldata
  const tableData = draws.map(draw => {
    const participant = participants.find(p => p.id === draw.participant_id);
    if (!participant) return null;
    
    const data = JSON.parse(participant.data_json);
    return [
      draw.position.toString(),
      data[lottery.name_column] || 'Okänd',
      // FRÅGA: Ska övriga kolumner inkluderas?
      // ANTAGANDE: Nej, bara position och namn för tydlighetens skull
    ];
  }).filter(Boolean);

  // Rita tabell
  autoTable(doc, {
    head: [['Position', 'Vinnare']],
    body: tableData as any[],
    startY: yPos,
    theme: 'grid',
    headStyles: { fillColor: [66, 139, 202] }
  });

  // Seed för transparens
  yPos = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(9);
  doc.text(`Dragning genomförd med lotterigenerator. Seed: ${lottery.seed}`, 20, yPos);
  doc.text('(Seeden gör att dragningen kan verifieras och reproduceras)', 20, yPos + 5);

  // Signaturrader (3 stycken)
  yPos += 25;
  doc.setFontSize(11);
  
  const signatureStartY = yPos;
  const signatureSpacing = 25;

  // Dragningsförrättare
  doc.text('Dragningsförrättare:', 20, signatureStartY);
  doc.line(20, signatureStartY + 8, 90, signatureStartY + 8);
  doc.setFontSize(9);
  doc.text('Namnförtydligande', 20, signatureStartY + 12);

  // Vittne 1
  doc.setFontSize(11);
  doc.text('Vittne 1:', 110, signatureStartY);
  doc.line(110, signatureStartY + 8, 180, signatureStartY + 8);
  doc.setFontSize(9);
  doc.text('Namnförtydligande', 110, signatureStartY + 12);

  // Vittne 2
  doc.setFontSize(11);
  doc.text('Vittne 2:', 20, signatureStartY + signatureSpacing);
  doc.line(20, signatureStartY + signatureSpacing + 8, 90, signatureStartY + signatureSpacing + 8);
  doc.setFontSize(9);
  doc.text('Namnförtydligande', 20, signatureStartY + signatureSpacing + 12);

  // Returnera som Blob
  return doc.output('blob');
}
```

**IMPLEMENTATIONSFRÅGOR**:
1. Ska alla CSV-kolumner visas i PDF-tabellen, eller bara namnkolumnen?
2. Ska logotyp eller header läggas till? (Kräver image import)
3. Önskas sidnumrering för långa deltagarlistor?

### 7.3 Lägg till Tauri dialog save för PDF

**FRÅGA**: Ska PDFen sparas via Tauri `dialog.save()` eller laddas ner via browser download?

**ANTAGANDE**: Tauri dialog.save() för bättre desktop-upplevelse.

Uppdatera `src-tauri/capabilities/default.json`:
```json
"dialog:allow-save"
```

### 7.4 Skapa resultatvy

Skapa `src/routes/results/[id]/+page.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { save } from '@tauri-apps/plugin-dialog';
  import { writeFile } from '@tauri-apps/plugin-fs';
  import {
    getLotteryById,
    getParticipantsByLottery,
    getDrawsByLottery,
    type Lottery,
    type Draw,
    type Participant
  } from '$lib/db';
  import { generateLotteryProtocol } from '$lib/pdf-generator';

  let lottery = $state<Lottery | null>(null);
  let draws = $state<Draw[]>([]);
  let participants = $state<Participant[]>([]);
  let isExporting = $state(false);
  let error = $state<string | null>(null);

  onMount(async () => {
    const lotteryId = parseInt($page.params.id);
    
    try {
      lottery = await getLotteryById(lotteryId);
      if (!lottery) {
        error = 'Lotteriet hittades inte';
        return;
      }

      draws = await getDrawsByLottery(lotteryId);
      participants = await getParticipantsByLottery(lotteryId);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Fel vid laddning av resultat';
    }
  });

  async function handleExportPDF() {
    if (!lottery || draws.length === 0) return;

    try {
      isExporting = true;
      error = null;

      // Generera PDF
      const pdfBlob = await generateLotteryProtocol(lottery, draws, participants);
      
      // Konvertera Blob till Uint8Array
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Öppna save-dialog
      const filePath = await save({
        defaultPath: `${lottery.name.replace(/[^a-z0-9]/gi, '_')}.pdf`,
        filters: [{
          name: 'PDF',
          extensions: ['pdf']
        }]
      });

      if (!filePath) {
        // Användaren avbröt
        isExporting = false;
        return;
      }

      // Skriv fil
      await writeFile(filePath, uint8Array);

      alert('PDF sparad!');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Fel vid PDF-export';
    } finally {
      isExporting = false;
    }
  }

  // Parsed vinnare för visning
  let winnersList = $derived(
    draws.map(draw => {
      const participant = participants.find(p => p.id === draw.participant_id);
      if (!participant) return null;
      
      const data = JSON.parse(participant.data_json);
      return {
        position: draw.position,
        name: data[lottery?.name_column || ''] || 'Okänd',
        drawnAt: draw.drawn_at
      };
    }).filter(Boolean)
  );
</script>

<div class="max-w-4xl mx-auto p-6">
  {#if error}
    <div class="bg-red-50 border border-red-200 rounded p-4 text-red-800 mb-4">
      {error}
    </div>
  {/if}

  {#if lottery}
    <h1 class="text-3xl font-bold mb-2">{lottery.name}</h1>
    {#if lottery.description}
      <p class="text-gray-600 mb-6">{lottery.description}</p>
    {/if}

    <div class="bg-green-50 border border-green-200 rounded p-4 mb-6">
      <p class="font-semibold text-green-800">✓ Lotteriet är genomfört</p>
      <p class="text-sm text-gray-600">
        {new Date(lottery.created_at).toLocaleString('sv-SE')}
      </p>
    </div>

    <h2 class="text-2xl font-bold mb-4">Vinnare</h2>
    
    <div class="space-y-3 mb-8">
      {#each winnersList as winner}
        <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p class="text-lg">
            <strong>Vinnare {winner.position}:</strong> {winner.name}
          </p>
          <p class="text-sm text-gray-600">
            Dragen: {new Date(winner.drawnAt).toLocaleString('sv-SE')}
          </p>
        </div>
      {/each}
    </div>

    <!-- Export-knappar -->
    <div class="flex gap-4">
      <button
        onclick={handleExportPDF}
        disabled={isExporting}
        class="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
      >
        {isExporting ? 'Exporterar...' : 'Ladda ner PDF-protokoll'}
      </button>

      <a
        href="/"
        class="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300"
      >
        Tillbaka till start
      </a>
    </div>

    <!-- Transparensinfo -->
    <div class="mt-8 bg-gray-50 border rounded p-4 text-sm">
      <p class="font-semibold mb-2">Information för revision:</p>
      <p><strong>Antal deltagare:</strong> {participants.length}</p>
      <p><strong>Typ:</strong> {lottery.with_replacement ? 'Med återläggning' : 'Utan återläggning'}</p>
      <p class="break-all"><strong>Seed:</strong> {lottery.seed}</p>
      <p class="text-gray-600 mt-2 text-xs">
        Dragningen kan reproduceras med samma seed för verifiering.
      </p>
    </div>
  {/if}
</div>
```

**IMPLEMENTATIONSFRÅGOR**:
1. Behöver Tauri fs-plugin permissions uppdateras?
2. Ska CSV-export också erbjudas (enklare importformat)?

---

## Fas 8: Startsida och arkiv

### 8.1 Skapa startsida med arkivlista

Skapa `src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { getAllLotteries, type Lottery } from '$lib/db';

  let lotteries = $state<Lottery[]>([]);
  let isLoading = $state(true);

  onMount(async () => {
    lotteries = await getAllLotteries();
    isLoading = false;
  });
</script>

<div class="max-w-5xl mx-auto p-6">
  <div class="flex justify-between items-center mb-8">
    <h1 class="text-4xl font-bold">Lotterigenerator</h1>
    <a
      href="/create"
      class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700"
    >
      + Nytt lotteri
    </a>
  </div>

  {#if isLoading}
    <p class="text-gray-600">Laddar...</p>
  {:else if lotteries.length === 0}
    <div class="bg-gray-50 border rounded p-8 text-center">
      <p class="text-xl text-gray-600 mb-4">Inga lotterier ännu</p>
      <p class="text-gray-500 mb-6">
        Kom igång genom att skapa ditt första lotteri
      </p>
      <a
        href="/create"
        class="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700"
      >
        Skapa lotteri
      </a>
    </div>
  {:else}
    <div class="space-y-4">
      <h2 class="text-2xl font-semibold mb-4">Tidigare lotterier</h2>
      {#each lotteries as lottery}
        <a
          href="/results/{lottery.id}"
          class="block bg-white border rounded-lg p-5 hover:shadow-lg transition-shadow"
        >
          <h3 class="text-xl font-semibold mb-1">{lottery.name}</h3>
          {#if lottery.description}
            <p class="text-gray-600 text-sm mb-2">{lottery.description}</p>
          {/if}
          <div class="flex gap-6 text-sm text-gray-500">
            <span>📅 {new Date(lottery.created_at).toLocaleDateString('sv-SE')}</span>
            <span>🎯 {lottery.num_draws} vinnare</span>
            <span>{lottery.with_replacement ? '🔁 Med återläggning' : '✓ Utan återläggning'}</span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
```

---

## Fas 9: Tester för slumpmässighet och transparens

**KRITISKT**: En lotteriapp måste kunna bevisa att den ger rättvisa, slumpmässiga resultat. Detta är både en teknisk och förtroende-fråga.

### 9.1 Installera testramverk

```bash
pnpm add -D vitest @vitest/ui
```

Skapa `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
```

Lägg till i `package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

### 9.2 Enhetstester för slumpfunktioner

Skapa `src/lib/random.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { shuffleWithSeed, drawWithoutReplacement, drawWithReplacement, generateSeed } from './random';

describe('Slumpgenerator - deterministisk reproducerbarhet', () => {
  
  it('ska ge identiska resultat med samma seed', () => {
    const participants = [1, 2, 3, 4, 5];
    const seed = 'abc123';
    
    const result1 = shuffleWithSeed(participants, seed);
    const result2 = shuffleWithSeed(participants, seed);
    
    expect(result1).toEqual(result2); // Måste vara identiska
  });

  it('ska ge olika resultat med olika seeds', () => {
    const participants = [1, 2, 3, 4, 5];
    
    const result1 = shuffleWithSeed(participants, 'seed1');
    const result2 = shuffleWithSeed(participants, 'seed2');
    
    expect(result1).not.toEqual(result2);
  });

  it('ska bevara alla element efter shuffle (ingen dubblett, ingen förlust)', () => {
    const participants = Array.from({length: 100}, (_, i) => i);
    const seed = 'test';
    
    const shuffled = shuffleWithSeed(participants, seed);
    
    expect(shuffled.length).toBe(100);
    expect(new Set(shuffled).size).toBe(100); // Alla unika
    expect([...shuffled].sort((a,b) => a-b)).toEqual(participants); // Samma innehåll
  });
});

describe('Dragning utan återläggning', () => {
  
  it('ska aldrig ge dubbletter', () => {
    const participants = Array.from({length: 50}, (_, i) => i);
    
    // Kör 100 dragningar med olika seeds
    for (let i = 0; i < 100; i++) {
      const seed = `test${i}`;
      const winners = drawWithoutReplacement(participants, 10, seed);
      
      const uniqueWinners = new Set(winners);
      expect(uniqueWinners.size).toBe(10); // Alla olika
    }
  });

  it('ska bara returnera element från ursprungslistan', () => {
    const participants = ['A', 'B', 'C', 'D', 'E'];
    const seed = 'test';
    
    const winners = drawWithoutReplacement(participants, 3, seed);
    
    winners.forEach(winner => {
      expect(participants).toContain(winner);
    });
  });

  it('ska kunna dra alla deltagare', () => {
    const participants = Array.from({length: 10}, (_, i) => i);
    const seed = 'test';
    
    const winners = drawWithoutReplacement(participants, 10, seed);
    
    expect(winners.length).toBe(10);
    expect(new Set(winners).size).toBe(10);
  });
});

describe('Dragning med återläggning', () => {
  
  it('ska kunna ge dubbletter', () => {
    const participants = [1, 2];
    
    // Med bara 2 deltagare och många dragningar MÅSTE dubbletter uppstå
    let foundDuplicate = false;
    for (let i = 0; i < 100; i++) {
      const seed = `test${i}`;
      const winners = drawWithReplacement(participants, 10, seed);
      
      if (new Set(winners).size < winners.length) {
        foundDuplicate = true;
        break;
      }
    }
    
    expect(foundDuplicate).toBe(true);
  });

  it('ska alltid returnera rätt antal vinnare', () => {
    const participants = Array.from({length: 5}, (_, i) => i);
    const seed = 'test';
    
    const winners = drawWithReplacement(participants, 20, seed);
    expect(winners.length).toBe(20);
  });
});

describe('Seed-generering', () => {
  
  it('ska generera unika seeds', () => {
    const seeds = new Set<string>();
    
    for (let i = 0; i < 100; i++) {
      seeds.add(generateSeed());
    }
    
    expect(seeds.size).toBe(100); // Alla olika
  });

  it('ska generera seeds med korrekt längd', () => {
    const seed = generateSeed();
    expect(seed.length).toBe(32); // 16 bytes * 2 (hex)
  });
});
```

### 9.3 Chi-kvadrat-test för jämn fördelning

Lägg till i `src/lib/random.test.ts`:

```typescript
/**
 * Chi-kvadrat test för att verifiera jämn fördelning.
 * Om värdet är för högt är fördelningen ojämn.
 */
function chiSquareTest(observed: number[], expected: number[]): number {
  let chiSquare = 0;
  for (let i = 0; i < observed.length; i++) {
    const diff = observed[i] - expected[i];
    chiSquare += (diff * diff) / expected[i];
  }
  return chiSquare;
}

describe('Jämn fördelning - statistisk validering', () => {
  
  it('ska ge ungefär lika sannolikhet för alla deltagare', () => {
    const numParticipants = 10;
    const numTrials = 10000;
    const participants = Array.from({length: numParticipants}, (_, i) => i);
    
    // Räkna hur ofta varje deltagare vinner
    const winCounts = new Array(numParticipants).fill(0);
    
    for (let trial = 0; trial < numTrials; trial++) {
      const seed = generateSeed(); // Ny slumpseed varje gång
      const winners = drawWithoutReplacement(participants, 1, seed);
      winCounts[winners[0]]++;
    }
    
    // Förväntad vinst per deltagare
    const expectedPerPerson = numTrials / numParticipants;
    const expected = new Array(numParticipants).fill(expectedPerPerson);
    
    const chiSquare = chiSquareTest(winCounts, expected);
    
    // Kritiskt värde för chi-kvadrat med 9 frihetsgrader (10-1) vid 95% konfidens: ~16.92
    // Om chi-square är mycket högre är fördelningen statistiskt ojämn
    expect(chiSquare).toBeLessThan(20);
    
    // Logga för manuell inspektion
    console.log('Vinstfördelning:', winCounts);
    console.log('Chi-square värde:', chiSquare.toFixed(2));
    console.log('Förväntat per person:', expectedPerPerson);
  });

  it('ska ge jämn fördelning även med stora deltagarlistor', () => {
    const numParticipants = 100;
    const numTrials = 10000;
    const participants = Array.from({length: numParticipants}, (_, i) => i);
    
    const winCounts = new Array(numParticipants).fill(0);
    
    for (let trial = 0; trial < numTrials; trial++) {
      const seed = generateSeed();
      const winners = drawWithoutReplacement(participants, 1, seed);
      winCounts[winners[0]]++;
    }
    
    const expectedPerPerson = numTrials / numParticipants;
    const expected = new Array(numParticipants).fill(expectedPerPerson);
    const chiSquare = chiSquareTest(winCounts, expected);
    
    // Med 99 frihetsgrader, kritiskt värde vid 95% konfidens är ~123.2
    expect(chiSquare).toBeLessThan(130);
  });
});
```

### 9.4 Visuellt testverktyg för användare

**SYFTE**: Låt användare (t.ex. föreningsmöte) själva verifiera att systemet ger jämn fördelning.

Skapa `src/routes/test-randomness/+page.svelte`:

```svelte
<script lang="ts">
  import { drawWithoutReplacement, generateSeed } from '$lib/random';
  
  let numParticipants = $state(10);
  let numTrials = $state(1000);
  let isRunning = $state(false);
  let results = $state<number[]>([]);
  let progress = $state(0);
  
  async function runTest() {
    isRunning = true;
    progress = 0;
    const participants = Array.from({length: numParticipants}, (_, i) => i);
    const winCounts = new Array(numParticipants).fill(0);
    
    for (let i = 0; i < numTrials; i++) {
      const seed = generateSeed(); // Ny slumpseed varje gång
      const winners = drawWithoutReplacement(participants, 1, seed);
      winCounts[winners[0]]++;
      
      // Uppdatera UI varje 50:e iteration
      if (i % 50 === 0) {
        progress = (i / numTrials) * 100;
        results = [...winCounts];
        await new Promise(r => setTimeout(r, 0)); // Yield till UI
      }
    }
    
    results = winCounts;
    progress = 100;
    isRunning = false;
  }
  
  let maxCount = $derived(Math.max(...results, 1));
  let expectedCount = $derived(numTrials / numParticipants);
  let deviation = $derived(
    results.map(count => {
      const dev = Math.abs(count - expectedCount) / expectedCount * 100;
      return dev;
    })
  );
  
  let maxDeviation = $derived(Math.max(...deviation, 0));
  
  function reset() {
    results = [];
    progress = 0;
  }
</script>

<div class="p-6 max-w-5xl mx-auto">
  <div class="mb-6">
    <h1 class="text-3xl font-bold mb-2">Test av slumpmässighet</h1>
    <p class="text-gray-600">
      Detta verktyg kör tusentals simulerade dragningar för att verifiera att varje deltagare
      har exakt lika stor chans att vinna. En jämn fördelning innebär att alla staplar är ungefär lika höga.
    </p>
  </div>
  
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
    <p class="font-semibold mb-2">Hur det fungerar:</p>
    <ol class="list-decimal list-inside space-y-1 text-sm">
      <li>Välj antal deltagare (5-100)</li>
      <li>Välj antal testkörningar (100-50000) - fler = mer tillförlitligt resultat</li>
      <li>Klicka "Kör test" - varje dragning använder en ny, helt slumpmässig seed</li>
      <li>Histogrammet visar hur många gånger varje deltagare vann</li>
      <li>Avvikelsen ska vara under 10% för ett rättvist system</li>
    </ol>
  </div>
  
  <div class="grid md:grid-cols-2 gap-6 mb-6">
    <div>
      <label class="block font-medium mb-2">
        Antal deltagare: <strong>{numParticipants}</strong>
      </label>
      <input 
        type="range" 
        bind:value={numParticipants} 
        min="5" 
        max="100" 
        step="5"
        disabled={isRunning}
        class="w-full" 
      />
    </div>
    
    <div>
      <label class="block font-medium mb-2">
        Antal testkörningar: <strong>{numTrials.toLocaleString('sv-SE')}</strong>
      </label>
      <input 
        type="range" 
        bind:value={numTrials} 
        min="100" 
        max="50000" 
        step="100"
        disabled={isRunning}
        class="w-full" 
      />
      <p class="text-xs text-gray-600 mt-1">
        Rekommenderat: minst 1000 körningar
      </p>
    </div>
  </div>
  
  <div class="flex gap-4 mb-6">
    <button
      onclick={runTest}
      disabled={isRunning}
      class="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isRunning ? `Kör test... ${progress.toFixed(0)}%` : 'Kör test'}
    </button>
    
    {#if results.length > 0 && !isRunning}
      <button
        onclick={reset}
        class="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300"
      >
        Rensa
      </button>
    {/if}
    
    <a
      href="/"
      class="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200"
    >
      Tillbaka
    </a>
  </div>
  
  {#if isRunning}
    <div class="mb-6">
      <div class="bg-gray-200 rounded-full h-4 overflow-hidden">
        <div 
          class="bg-blue-600 h-full transition-all duration-300"
          style="width: {progress}%"
        />
      </div>
    </div>
  {/if}
  
  {#if results.length > 0}
    <div class="space-y-6">
      <div class="bg-gray-50 border rounded-lg p-4">
        <div class="grid md:grid-cols-3 gap-4 text-center">
          <div>
            <p class="text-sm text-gray-600">Förväntat per deltagare</p>
            <p class="text-2xl font-bold">{expectedCount.toFixed(1)}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600">Totalt antal dragningar</p>
            <p class="text-2xl font-bold">{numTrials.toLocaleString('sv-SE')}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600">Största avvikelse</p>
            <p class="text-2xl font-bold" class:text-green-600={maxDeviation < 5} class:text-blue-600={maxDeviation >= 5 && maxDeviation < 10} class:text-red-600={maxDeviation >= 10}>
              {maxDeviation.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
      
      <!-- Histogram -->
      <div>
        <h2 class="text-xl font-semibold mb-3">Fördelning av vinster</h2>
        <div class="space-y-2">
          {#each results as count, index}
            {@const devPercent = deviation[index]}
            {@const isHighDeviation = devPercent > 10}
            <div class="flex items-center gap-3">
              <span class="w-28 text-sm font-medium">Deltagare {index + 1}:</span>
              <div class="flex-1 bg-gray-200 rounded-full h-10 relative overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  class:bg-blue-600={!isHighDeviation}
                  class:bg-red-500={isHighDeviation}
                  style="width: {(count / maxCount) * 100}%"
                />
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="text-sm font-semibold">
                    {count} vinster ({((count / numTrials) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
              <span 
                class="w-24 text-sm text-right font-medium"
                class:text-green-600={devPercent < 5}
                class:text-blue-600={devPercent >= 5 && devPercent < 10}
                class:text-red-600={devPercent >= 10}
              >
                ±{devPercent.toFixed(1)}%
              </span>
            </div>
          {/each}
        </div>
      </div>
      
      <!-- Bedömning -->
      <div class="border-l-4 rounded p-4" class:border-green-500={maxDeviation < 5} class:bg-green-50={maxDeviation < 5} class:border-blue-500={maxDeviation >= 5 && maxDeviation < 10} class:bg-blue-50={maxDeviation >= 5 && maxDeviation < 10} class:border-red-500={maxDeviation >= 10} class:bg-red-50={maxDeviation >= 10}>
        <p class="font-semibold text-lg mb-2">Bedömning:</p>
        {#if maxDeviation < 5}
          <p class="text-green-700">
            <strong>✓ Utmärkt</strong> - Alla deltagare har vinster inom 5% från förväntat värde.
            Systemet ger mycket jämn fördelning.
          </p>
        {:else if maxDeviation < 10}
          <p class="text-blue-700">
            <strong>○ Godkänt</strong> - Alla deltagare inom 10% avvikelse. Detta är normalt vid
            färre testkörningar. Öka antalet körningar för mer exakt resultat.
          </p>
        {:else}
          <p class="text-red-700">
            <strong>⚠ Varning</strong> - Stor avvikelse upptäckt ({maxDeviation.toFixed(1)}%). 
            Detta kan bero på slumpmässig variation - kör testet igen med fler dragningar 
            (minst 5000) för att verifiera.
          </p>
        {/if}
        
        <div class="mt-4 pt-4 border-t">
          <p class="text-sm font-semibold mb-1">Vad innebär detta?</p>
          <ul class="text-sm space-y-1 list-disc list-inside">
            <li>Varje deltagare ska vinna ungefär {expectedCount.toFixed(1)} gånger av {numTrials} dragningar</li>
            <li>Mindre än 5% avvikelse = excellent randomness</li>
            <li>5-10% avvikelse = acceptabelt, men kör gärna fler tester</li>
            <li>Över 10% = kör om testet med fler dragningar</li>
          </ul>
        </div>
      </div>
      
      <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p class="font-semibold mb-2">💡 Tips för bästa resultat:</p>
        <ul class="text-sm space-y-1 list-disc list-inside">
          <li>Använd minst 1000 testkörningar för tillförlitliga resultat</li>
          <li>Fler deltagare = behöver fler testkörningar för att se jämn fördelning</li>
          <li>Kör testet flera gånger - resultatet ska vara konsekvent jämnt</li>
          <li>Detta test kan visas på årsmöten för att bevisa transparens</li>
        </ul>
      </div>
    </div>
  {/if}
</div>
```

### 9.5 Lägg till länk till testverktyget

I `src/routes/+page.svelte`, lägg till länk i headern:

```svelte
<div class="flex justify-between items-center mb-8">
  <h1 class="text-4xl font-bold">Lotterigenerator</h1>
  <div class="flex gap-3">
    <a
      href="/test-randomness"
      class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 border border-gray-300"
    >
      🔬 Test slumpmässighet
    </a>
    <a
      href="/create"
      class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700"
    >
      + Nytt lotteri
    </a>
  </div>
</div>
```

### 9.6 Kör testerna

```bash
# Kör alla enhetstester
pnpm test

# Kör med UI (visuell testvy)
pnpm test:ui

# Kör specifikt testfil
pnpm test random.test.ts
```

**VIKTIGT**: Testerna ska köras innan release och vid varje större ändring av slumpalgoritmen.

---

## Fas 10: Putsning och extra funktioner

### 10.1 Fullscreen-mode

**FRÅGA**: Ska fullscreen implementeras via Tauri API eller F11-tangent?

Lägg till i `src-tauri/capabilities/default.json`:
```json
"core:window:allow-set-fullscreen"
```

Skapa `src/lib/fullscreen.ts`:
```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

export async function toggleFullscreen() {
  const window = getCurrentWindow();
  const isFullscreen = await window.isFullscreen();
  await window.setFullscreen(!isFullscreen);
}
```

Lägg till knapp på dragningssidan:
```svelte
<button
  onclick={toggleFullscreen}
  class="fixed top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded"
>
  Fullskärm (F11)
</button>
```

### 10.2 Ljudeffekter (valfritt)

**FRÅGA**: Ska ljud implementeras? (tickande under snurr + fanfar vid vinst)

Om ja - använd Web Audio API med förinladdade ljud-assets.

### 10.3 Konfetti-animation vid vinst (valfritt)

**FRÅGA**: Ska konfetti-animation läggas till?

Om ja - använd `canvas-confetti` library:
```bash
pnpm add canvas-confetti
pnpm add -D @types/canvas-confetti
```

---

## Checklista före byggstart

Innan du börjar implementera, svara på dessa frågor:

### Projektstruktur
- [ ] Projektnamn bestämt? (Förslag: `lotterigenerator`)
- [ ] Pakethanterare vald? (pnpm rekommenderas)

### CSV-hantering
- [ ] Ska Tauri dialog + fs-plugin användas för filläsning?
- [ ] Ska UTF-8 antas, eller ska encoding-detektion implementeras?
- [ ] Ska första raden ALLTID tolkas som header?
- [ ] Hur ska tomma rader hanteras? (Förslag: skippa tyst)

### Slumpalgoritm
- [ ] Är Mulberry32 OK, eller finns annan preferens? (Alternativ: SplitMix32, xoshiro)
- [ ] Ska seeded PRNG användas (deterministisk), eller rent random per dragning?

### Animation
- [ ] Bandrulle (slot-machine) eller roterande hjul som default?
- [ ] Ska båda implementeras med växlingsmöjlighet?
- [ ] Ska ljudeffekter implementeras?
- [ ] Ska konfetti-animation implementeras?

### PDF-export
- [ ] Ska alla CSV-kolumner visas i PDF-tabellen, eller bara namnkolumnen?
- [ ] Önskas logotyp/header i PDF?
- [ ] Ska CSV-export också erbjudas?

### Tauri-plugins som behövs
- [ ] `tauri-plugin-sql` (SQLite) ✓ obligatorisk
- [ ] `tauri-plugin-dialog` (filväljare, save) ✓ obligatorisk
- [ ] `tauri-plugin-fs` (filläsning/-skrivning) ✓ obligatorisk för CSV + PDF
- [ ] `tauri-plugin-window` (fullscreen) - valfri men rekommenderad

### Build targets
- [ ] Vilka plattformar ska stödjas? (Linux/Windows/macOS)

---

## Nästa steg

När frågorna ovan är besvarade kan implementationen börja enligt fasordningen:

1. ✅ Scaffold + TailwindCSS + SQLite
2. ✅ CSV-uppladdning + förhandsgranskning
3. ✅ Skapa lotteri-formulär + DB
4. ✅ Dragningslogik (slump)
5. ✅ Animation (tombola)
6. ✅ Resultatvy + PDF-export
7. ✅ Startsida + arkiv
8. ✅ Tester för slumpmässighet (enhetstester + visuellt verktyg)
9. ✅ Putsning (fullscreen, ljud, konfetti)

Beräknad total tid: **8 arbetsdagar**

---

## Tekniska referenser

- **Tauri 2.0 docs**: https://v2.tauri.app/
- **Svelte 5 docs**: https://svelte.dev/docs/svelte/overview
- **tauri-plugin-sql**: https://v2.tauri.app/plugin/sql/
- **jsPDF**: https://github.com/parallax/jsPDF
- **PapaParse**: https://www.papaparse.com/

---

## Kontaktpunkter under utveckling

Om något är oklart under implementationen - FRÅGA, gissa inte!

Nyckelområden där frågor kan uppstå:
- Tauri plugin API-användning (dialog, fs, window)
- Databas-schema om nya krav dyker upp
- Animation-implementation (timing, easing)
- PDF-layout om fler fält ska inkluderas
- Testverktyg och statistiska tröskelvärden (chi-kvadrat-gränser)
